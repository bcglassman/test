"use server";

import Anthropic from "@anthropic-ai/sdk";
import { RATING_LIBRARY } from "@/lib/rating-library";
import {
  EQUIPMENT_VALUES,
  EXERCISE_CATEGORIES,
  FOCUS_VALUES,
  TRACKING_METHODS,
  UNITS,
  type ExerciseCategory,
  type TrackingMethod,
  type Unit,
} from "@/lib/taxonomy";
import { requireLoggedInUser } from "./ai-shared";

export interface SuggestedExerciseDetails {
  category: ExerciseCategory;
  focus: string[];
  description: string;
  trackingMethods: TrackingMethod[];
  primaryUnit?: Unit;
  equipment: string[];
  techniqueNotes: string;
  /** Keys from the global Rating Library, in presentation order. */
  ratingKeys: string[];
}

/**
 * Given just an exercise name, fills in the rest of the library entry.
 *
 * Ratings are *chosen from* the global library by key rather than written
 * fresh: the point of the library is that a dimension is defined once and
 * worded the same everywhere, and a model inventing a near-duplicate
 * "Form Quality" beside the existing "Gait / Form" would quietly undo that.
 */
export async function suggestExerciseDetails(
  name: string,
): Promise<SuggestedExerciseDetails> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Exercise name is required.");
  }

  await requireLoggedInUser();

  const catalogue = RATING_LIBRARY.map(
    (r) => `${r.key} — ${r.label} (${r.description})`,
  ).join("\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2048,
    system: [
      "You fill in entries for the Exercise Library in Canine Training, a ",
      "dog training and physical-rehab journal. Given an exercise's name, ",
      "infer the rest of its library definition.",
      "",
      "The library answers: what is the exercise, what does it train, how ",
      "is it measured, what does good execution look like, and how should ",
      "performance be rated.",
      "",
      "Category is the *type* of exercise, not the body part — the body ",
      "part is Focus. Tracking methods decide which fields the session ",
      "form will offer, so choose only what would genuinely be recorded.",
      "",
      "Pick rating dimensions from this library by key. Choose 3-6 that ",
      "actually discriminate performance of this exercise, most important ",
      "first. Do not invent new ones:",
      catalogue,
    ].join("\n"),
    messages: [{ role: "user", content: `Exercise name: "${trimmed}"` }],
    tools: [
      {
        name: "populate_exercise",
        description: "Fill in the exercise's library definition.",
        input_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: [...EXERCISE_CATEGORIES],
              description: "The type of exercise.",
            },
            focus: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              description: `What it trains. Prefer these: ${FOCUS_VALUES.join(", ")}.`,
              items: { type: "string" },
            },
            description: {
              type: "string",
              description:
                "Two or three sentences: what the dog does, and why the " +
                "exercise is performed.",
            },
            trackingMethods: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              description: "Only what would genuinely be recorded per set.",
              items: { type: "string", enum: [...TRACKING_METHODS] },
            },
            primaryUnit: {
              type: "string",
              enum: [...UNITS],
              description: "Default unit for the primary tracking method.",
            },
            equipment: {
              type: "array",
              maxItems: 4,
              description: `Normally required. Prefer these: ${EQUIPMENT_VALUES.join(", ")}. Use ["None"] if none is needed.`,
              items: { type: "string" },
            },
            techniqueNotes: {
              type: "string",
              description:
                "Two or three sentences on good execution and setup, and " +
                "what to watch for that would mean stopping or easing off.",
            },
            ratingKeys: {
              type: "array",
              minItems: 3,
              maxItems: 6,
              description:
                "Keys from the library above, most important first.",
              items: { type: "string" },
            },
          },
          required: [
            "category",
            "focus",
            "description",
            "trackingMethods",
            "primaryUnit",
            "equipment",
            "techniqueNotes",
            "ratingKeys",
          ],
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

  const out = toolUse.input as SuggestedExerciseDetails;
  const known = new Set(RATING_LIBRARY.map((r) => r.key));
  return {
    ...out,
    // Drop anything that isn't actually in the library, rather than
    // carrying a dangling key into the form.
    ratingKeys: out.ratingKeys.filter((k) => known.has(k)),
  };
}
