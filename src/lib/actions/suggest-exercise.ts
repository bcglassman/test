"use server";

import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import Anthropic from "@anthropic-ai/sdk";
import config from "@payload-config";
import type { ExerciseCategory } from "@/lib/types";

export interface SuggestedExerciseDetails {
  category: ExerciseCategory;
  focus: string;
  description: string;
  defaultRatings: { key: string; label: string; max: number }[];
}

const CATEGORIES: ExerciseCategory[] = [
  "Strength",
  "Mobility",
  "Coordination",
  "Cardio",
  "Skill",
];

/**
 * Given just an exercise name, asks Claude to fill in the rest of the
 * Exercise fields. Requires a logged-in Payload user, checked server-side
 * here — not just gated by the calling page — same as every other write in
 * this app.
 */
export async function suggestExerciseDetails(
  name: string,
): Promise<SuggestedExerciseDetails> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Exercise name is required.");
  }

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  if (!user) {
    throw new Error("You must be logged in to use AI suggestions.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You help fill in metadata for exercises in Cookie Training, a dog " +
      "training and physical-rehab exercise journal. Given just an " +
      "exercise's name, infer sensible values for a physical-therapy-style " +
      "logging form for that exercise.",
    messages: [
      {
        role: "user",
        content: `Exercise name: "${trimmed}"`,
      },
    ],
    tools: [
      {
        name: "populate_exercise",
        description:
          "Fill in the category, focus, description, and rating dimensions " +
          "for this exercise.",
        input_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: CATEGORIES,
              description: "The best-fitting exercise category.",
            },
            focus: {
              type: "string",
              description:
                'Body area or focus, e.g. "Hind Limb", "Core", "General".',
            },
            description: {
              type: "string",
              description:
                "One or two sentences describing what the dog does during this exercise.",
            },
            defaultRatings: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              description:
                "3-5 rating dimensions most relevant to judging performance " +
                'of this specific exercise (e.g. "Form", "Control", but also ' +
                "exercise-specific ones like \"Stride Length\" or \"Balance\" when they fit better).",
              items: {
                type: "object",
                properties: {
                  key: {
                    type: "string",
                    description: 'Short lowercase key, e.g. "form".',
                  },
                  label: {
                    type: "string",
                    description: 'Display label, e.g. "Form".',
                  },
                  max: {
                    type: "number",
                    description: "Max score for this dimension, normally 10.",
                  },
                },
                required: ["key", "label", "max"],
                additionalProperties: false,
              },
            },
          },
          required: ["category", "focus", "description", "defaultRatings"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "populate_exercise" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI didn't return a suggestion. Try again.");
  }

  return toolUse.input as SuggestedExerciseDetails;
}
