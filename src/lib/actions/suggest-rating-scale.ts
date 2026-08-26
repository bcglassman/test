"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireLoggedInUser } from "./ai-shared";

/**
 * Generates a 5-level rubric for one custom rating dimension that isn't in
 * the standard library (src/lib/rating-library.ts) — e.g. an exercise-
 * specific dimension the user typed themselves.
 */
export async function suggestRatingScale(
  exerciseName: string,
  ratingLabel: string,
): Promise<string[]> {
  const trimmedExercise = exerciseName.trim();
  const trimmedLabel = ratingLabel.trim();
  if (!trimmedExercise || !trimmedLabel) {
    throw new Error("Exercise name and rating label are required.");
  }

  await requireLoggedInUser();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You write 5-level rating rubrics for a dog training and physical-" +
      "rehab exercise journal called Canine Training. Given an exercise " +
      "and a rating dimension name, write what a score of 1 through 5 " +
      "means for that dimension on that exercise, worst to best.",
    messages: [
      {
        role: "user",
        content: `Exercise: "${trimmedExercise}"\nRating dimension: "${trimmedLabel}"`,
      },
    ],
    tools: [
      {
        name: "write_scale",
        description: "Write the 5-level rubric.",
        input_schema: {
          type: "object",
          properties: {
            scale: {
              type: "array",
              minItems: 5,
              maxItems: 5,
              description:
                "Exactly 5 short phrases (2-6 words each) for scores 1 " +
                'through 5, worst to best, e.g. ["Significant Form ' +
                'Breakdown", ..., "Maintains Excellent Form Throughout"].',
              items: { type: "string" },
            },
          },
          required: ["scale"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "write_scale" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI didn't return a suggestion. Try again.");
  }

  return (toolUse.input as { scale: string[] }).scale;
}
