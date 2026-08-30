"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireLoggedInUser } from "./ai-shared";

export interface NoteSetContext {
  setNumber: number;
  reps?: number;
  passes?: number;
  notes?: string;
  watchItems: { text: string; at?: string }[];
  ratings: { label: string; score: number; max: number; meaning?: string }[];
}

export interface NoteContext {
  dogName?: string;
  dogObservations?: string;
  exerciseName?: string;
  exerciseCategory?: string;
  exerciseFocus?: string;
  environment?: string;
  weather?: string;
  restLabel?: string;
  totalActiveMovement?: string;
  /** Just the one set for a set note; all of them for a session note. */
  sets: NoteSetContext[];
}

function describeSet(set: NoteSetContext): string {
  const work =
    set.passes !== undefined
      ? `${set.passes} passes`
      : set.reps !== undefined
        ? `${set.reps} reps`
        : "work not recorded";
  const ratings = set.ratings.length
    ? set.ratings
        .map(
          (r) =>
            `${r.label} ${r.score}/${r.max}${r.meaning ? ` (${r.meaning})` : ""}`,
        )
        .join("; ")
    : "no ratings";
  const watch = set.watchItems.length
    ? set.watchItems
        .map((w) => `${w.at ? `${w.at} ` : ""}${w.text}`)
        .join("; ")
    : "none";
  return [
    `Set ${set.setNumber}: ${work}`,
    `  ratings: ${ratings}`,
    `  watch items: ${watch}`,
    set.notes?.trim() ? `  set note: "${set.notes.trim()}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Rewrites a set note or a session note, with the rest of that set's — or
 * that session's — recorded data in front of it.
 *
 * This differs from the watch-item rewrite on purpose. There, the only
 * evidence was the handler's own phrase, so the model was forbidden from
 * adding anything. Here the reps, scores, rating wording and watch items
 * are real recorded facts from the same session, and drawing the note
 * together from them is the whole point. The line it must not cross is
 * inventing observations that appear neither in the draft nor in the data.
 */
export async function refineNote(
  scope: "set" | "session",
  draft: string,
  context: NoteContext,
): Promise<string> {
  const trimmed = draft.trim();
  if (!trimmed) {
    throw new Error("Write the note first, then refine it.");
  }

  await requireLoggedInUser();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2048,
    system: [
      "You tidy up notes in a dog training and physical-rehab journal ",
      "called Canine Training. You are given the handler's draft note and ",
      "the data recorded alongside it.",
      "",
      "Write as a canine athletic conditioning coach, behaviourist, ",
      "rehabilitation therapist and veterinarian would together, choosing ",
      "the vocabulary that fits what is described: anatomy and movement ",
      "language for movement, behavioural language for behaviour. Don't ",
      "reach for clinical wording where the note is plainly behavioural.",
      "",
      scope === "set"
        ? "This is a note about ONE set. Keep it to that set."
        : "This is the note for the WHOLE session. It should read as an " +
          "account of the session, drawing the sets together — what the " +
          "work was, how it went, and what to carry forward.",
      "",
      "Rules:",
      "1. You may use the recorded data below — reps or passes, ratings ",
      "   and their wording, watch items, environment, rest. Referring to ",
      "   those is expected: they are facts from this same session.",
      "2. Do not introduce an observation that appears neither in the ",
      "   handler's draft nor in the data. No severity, cause, diagnosis, ",
      "   side or body part that isn't already there.",
      "3. Don't contradict the draft. If it says something the data seems ",
      "   to disagree with, keep the handler's account — they were there.",
      "4. Keep the handler's voice and roughly their length. This is ",
      "   tidying and sharpening, not expanding a line into an essay.",
      "5. Plain prose. Line breaks between paragraphs are fine; no ",
      "   markdown, headings or bullet characters.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          context.dogName ? `Dog: ${context.dogName}` : null,
          context.dogObservations
            ? `Standing observations about this dog: ${context.dogObservations}`
            : null,
          context.exerciseName
            ? `Exercise: ${context.exerciseName}${
                context.exerciseCategory
                  ? ` (${context.exerciseCategory}${
                      context.exerciseFocus ? ` · ${context.exerciseFocus}` : ""
                    })`
                  : ""
              }`
            : null,
          context.environment ? `Environment: ${context.environment}` : null,
          context.weather ? `Weather: ${context.weather}` : null,
          context.restLabel ? `Rest between sets: ${context.restLabel}` : null,
          context.totalActiveMovement
            ? `Total active movement: ${context.totalActiveMovement}`
            : null,
          "",
          "Recorded data:",
          context.sets.map(describeSet).join("\n"),
          "",
          `The handler's draft note:\n"${trimmed}"`,
        ]
          .filter((line) => line !== null)
          .join("\n"),
      },
    ],
    tools: [
      {
        name: "write_note",
        description: "Return the tidied note.",
        input_schema: {
          type: "object",
          properties: {
            note: {
              type: "string",
              description:
                "The rewritten note, in plain prose, roughly the length " +
                "of the draft.",
            },
          },
          required: ["note"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "write_note" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI didn't return a rewrite. Try again.");
  }
  return (toolUse.input as { note: string }).note.trim().slice(0, 4000);
}
