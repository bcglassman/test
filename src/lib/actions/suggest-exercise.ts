"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { ExerciseCategory } from "@/lib/types";
import { requireLoggedInUser } from "./ai-shared";

export interface SuggestedExerciseDetails {
  category: ExerciseCategory;
  focus: string;
  description: string;
  defaultRatings: { key: string; label: string; max: number; scale: string[] }[];
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
 * Exercise fields, including a 5-level rubric per rating dimension.
 */
export async function suggestExerciseDetails(
  name: string,
): Promise<SuggestedExerciseDetails> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Exercise name is required.");
  }

  await requireLoggedInUser();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2048,
    system:
      "You help fill in metadata for exercises in Canine Training, a dog " +
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
                    enum: [5],
                    description: "Always 5 — every dimension uses a 1-5 scale.",
                  },
                  scale: {
                    type: "array",
                    minItems: 5,
                    maxItems: 5,
                    description:
                      "Exactly 5 short phrases describing what a score of 1 " +
                      "through 5 means for this dimension, worst to best, " +
                      'e.g. ["Significant Form Breakdown", ..., "Maintains Excellent Form Throughout"].',
                    items: { type: "string" },
                  },
                },
                required: ["key", "label", "max", "scale"],
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
