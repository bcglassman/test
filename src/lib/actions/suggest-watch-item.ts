"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireLoggedInUser } from "./ai-shared";

export interface WatchItemSuggestion {
  suggestion: string;
  /** How much the frames actually support the suggestion. */
  confidence: "high" | "medium" | "low";
  /** What these frames can't settle. Always shown to the handler. */
  limitations: string;
}

/**
 * Looks at stills sampled around a moment in a set's clip and proposes what
 * the watch item there might say.
 *
 * The honesty problem this has to solve: a handful of JPEG stills, from one
 * consumer camera at whatever angle the phone happened to be at, is thin
 * evidence for a movement assessment — and a confident-sounding sentence
 * attached to "the AI watched the video" reads as far stronger evidence
 * than it is. So the model is told to describe what is visible, to say
 * outright when the frames can't settle something, and to return its
 * confidence and limitations alongside the text. The UI shows all three,
 * and nothing is written to the note until a person accepts it.
 */
export async function suggestWatchItemFromFrames(
  frames: { base64: string; atSeconds: number }[],
  context: {
    exerciseName?: string;
    atSeconds: number;
    /** What the handler has already typed, if anything. */
    draft?: string;
    /** Standing observations about how this dog moves. */
    dogObservations?: string;
  },
): Promise<WatchItemSuggestion> {
  if (frames.length === 0) {
    throw new Error("No frames were captured from the clip.");
  }

  await requireLoggedInUser();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: [
      "You help a handler write 'watch items' in a dog training and ",
      "physical-rehab journal — short notes about something to look for ",
      "again in a clip. You are shown a few still frames sampled around ",
      "one moment of a training video.",
      "",
      "Read them as a canine conditioning coach, behaviourist, rehab ",
      "therapist and veterinarian would together, and use whichever ",
      "vocabulary fits what is actually visible: anatomy (stifle, hock, ",
      "carpus, thoracic/pelvic limb), movement (abduction, weight-shift, ",
      "cadence, loading), or behaviour (arousal, latency, disengagement).",
      "",
      "What you are working from is weak evidence, and your answer must ",
      "reflect that rather than paper over it:",
      "- These are stills, not motion. Anything between frames is inferred.",
      "- One camera, one angle, uncontrolled. Depth, rotation and subtle ",
      "  left-right differences are often not recoverable from it.",
      "- There is no scale, no force plate, no second view.",
      "",
      "Rules:",
      "1. Describe what is visible. Do not diagnose, do not grade severity ",
      "   on a clinical scale, and do not name a cause.",
      "2. Only state a side, a joint or a phase of movement if the frames ",
      "   actually show it. If the angle hides it, say so in `limitations` ",
      "   and leave it out of the suggestion.",
      "3. If the frames don't support any specific observation, say that ",
      "   plainly in the suggestion and set confidence to \"low\". A frank ",
      "   \"nothing clearly visible at this moment\" is a correct answer and ",
      "   is more useful than an invented finding.",
      "4. Set `confidence` honestly: \"high\" only when the thing is plainly ",
      "   and repeatedly visible across the frames.",
      "5. The suggestion is one short phrase, under 140 characters, no ",
      "   final full stop — it sits on a chip in a list.",
      "6. If the handler has already drafted a note, treat it as what they ",
      "   think they saw: confirm it, sharpen its wording, or say in ",
      "   `limitations` that the frames don't show it. Never silently ",
      "   replace their observation with a different one.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              context.exerciseName ? `Exercise: ${context.exerciseName}` : null,
              `Moment of interest: ${context.atSeconds}s into the clip.`,
              `Frames below are at: ${frames.map((f) => `${f.atSeconds}s`).join(", ")}.`,
              context.dogObservations
                ? `Standing observations about this dog: ${context.dogObservations}`
                : null,
              context.draft?.trim()
                ? `The handler has drafted: "${context.draft.trim()}"`
                : "The handler hasn't written anything yet.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
          ...frames.map(
            (f) =>
              ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: f.base64,
                },
              }) as const,
          ),
        ],
      },
    ],
    tools: [
      {
        name: "propose_watch_item",
        description: "Propose the watch item, with how well the frames support it.",
        input_schema: {
          type: "object",
          properties: {
            suggestion: {
              type: "string",
              description:
                "One short phrase, under 140 characters, saying what is " +
                "visible at this moment — or that nothing specific is.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description:
                "How well these frames actually support the suggestion.",
            },
            limitations: {
              type: "string",
              description:
                "What these frames cannot settle — camera angle, missing " +
                "view, motion between frames. One or two sentences.",
            },
          },
          required: ["suggestion", "confidence", "limitations"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "propose_watch_item" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI didn't return a suggestion. Try again.");
  }

  const out = toolUse.input as WatchItemSuggestion;
  return { ...out, suggestion: out.suggestion.trim().slice(0, 140) };
}
