"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireLoggedInUser } from "./ai-shared";

/**
 * Rewrites one watch item in the vocabulary a canine rehab professional
 * would use — "left knee goes funny" -> "Left stifle drifts laterally
 * under load".
 *
 * This tightens *wording*, not substance. The system prompt below is
 * deliberately strict about that: the note is a record of what someone
 * actually saw, and a rewrite that added severity, a cause, or a
 * diagnosis would turn an observation into a clinical claim nobody made.
 * Better-worded is useful; better-sounding than the evidence supports is
 * how a training log misleads whoever reads it next — quite possibly a
 * vet making a decision from it.
 */
export async function refineWatchItem(
  text: string,
  exerciseName?: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Write the observation first, then refine it.");
  }

  await requireLoggedInUser();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 512,
    system: [
      "You rewrite short observations in a dog training and physical-",
      "rehab journal called Canine Training. These are 'watch items' — ",
      "things the handler noticed and wants to look for again.",
      "",
      "Write as someone who is at once a canine athletic conditioning ",
      "coach, a behaviourist, a rehabilitation therapist and a ",
      "veterinarian — so the wording is right whichever of those lenses ",
      "the observation belongs to. Use the vocabulary that fits what was ",
      "actually seen: correct anatomy (stifle, hock, carpus, thoracic/",
      "pelvic limb), movement and conditioning language (abduction, ",
      "weight-shift, cadence, loading, work:rest), and behavioural ",
      "language (arousal, latency, disengagement, displacement) where the ",
      "observation is about behaviour rather than movement. Don't reach ",
      "for clinical wording when the note is plainly behavioural, or vice ",
      "versa.",
      "",
      "Rules, in order of importance:",
      "1. Say only what the original says. Never add a severity, a cause, ",
      "   a diagnosis, a body part, a side, or a phase of movement that ",
      "   wasn't in the original.",
      "2. It is an observation, not a finding. Don't write it as an ",
      "   assessment, and don't imply it was made by a clinician.",
      "3. If the original is too vague to restate precisely, keep it ",
      "   vague. Tidy the wording and stop — do not invent detail to make ",
      "   it sound more authoritative.",
      "4. Keep it short: one phrase, under 140 characters, no final full ",
      "   stop. It sits on a chip in a list.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: exerciseName?.trim()
          ? `Exercise: "${exerciseName.trim()}"\nObservation: "${trimmed}"`
          : `Observation: "${trimmed}"`,
      },
    ],
    tools: [
      {
        name: "write_watch_item",
        description: "Return the rewritten observation.",
        input_schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "The rewritten observation: one short phrase, under 140 " +
                "characters, saying exactly what the original said.",
            },
          },
          required: ["text"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "write_watch_item" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI didn't return a rewrite. Try again.");
  }

  const result = (toolUse.input as { text: string }).text.trim();
  // The cap is a hard limit on the field, so enforce it here rather than
  // trusting the instruction.
  return result.slice(0, 140);
}
