import type { CollectionConfig } from "payload";
import { authenticated } from "./access";
import {
  EQUIPMENT_VALUES,
  EXERCISE_CATEGORIES,
  FOCUS_VALUES,
  TRACKING_METHODS,
  UNITS,
} from "../lib/taxonomy";

/**
 * The global Exercise Library: what the exercise is, what it trains, how it
 * is measured, what good execution looks like, and how it should be rated.
 *
 * Definitions are global and never dog-specific. What a dog actually did
 * lives on the session — see Sessions.sets. Exercises are archived rather
 * than deleted so the sessions that reference them stay intact.
 */
export const Exercises: CollectionConfig = {
  slug: "exercises",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "category", "status"],
  },
  defaultSort: "name",
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "category",
      type: "select",
      required: true,
      options: [...EXERCISE_CATEGORIES],
      admin: {
        description:
          "The type of exercise, not the body part — that is what Focus is for.",
      },
    },
    {
      name: "focus",
      type: "text",
      hasMany: true,
      admin: {
        description: `What it trains. Suggested values: ${FOCUS_VALUES.join(", ")}. Custom values are allowed.`,
      },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "What the exercise involves and why it is done." },
    },
    {
      name: "trackingMethods",
      type: "select",
      hasMany: true,
      options: [...TRACKING_METHODS],
      admin: {
        description:
          "Decides which fields the session form offers for this exercise.",
      },
    },
    {
      name: "primaryUnit",
      type: "select",
      options: [...UNITS],
      admin: { description: "Default unit for the primary tracking method." },
    },
    {
      name: "equipment",
      type: "text",
      hasMany: true,
      admin: {
        description: `Normally required. Suggested values: ${EQUIPMENT_VALUES.join(", ")}. Custom values are allowed.`,
      },
    },
    {
      name: "techniqueNotes",
      type: "textarea",
      admin: { description: "What good execution and setup look like." },
    },
    {
      name: "defaultRatingDimensions",
      type: "relationship",
      relationTo: "rating-dimensions",
      hasMany: true,
      admin: {
        description:
          "Presented when logging this exercise, in this order. References the global Rating Library rather than copying it; removing one here leaves the dimension itself alone.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      admin: {
        description:
          "Archived exercises drop out of new-session selection but keep every session that referenced them.",
      },
    },
    {
      name: "defaultRatings",
      type: "array",
      admin: {
        hidden: true,
        description:
          "Superseded by defaultRatingDimensions. Kept so exercises defined before the Rating Library became a collection aren't lost; the seed migrates them across.",
      },
      fields: [
        { name: "key", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "max", type: "number", required: true, defaultValue: 5 },
        { name: "scale", type: "text", hasMany: true },
      ],
    },
  ],
};
