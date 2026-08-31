import type { CollectionConfig } from "payload";
import { authenticated } from "./access";

/**
 * The global Rating Library.
 *
 * Exercises reference these rather than carrying their own copies, so a
 * dimension is defined once and worded the same wherever it appears. A
 * logged session still snapshots the definition it used (see
 * Sessions.ratingDefs) — changing a dimension here must not silently
 * rewrite what a past session was scored against.
 */
export const RatingDimensions: CollectionConfig = {
  slug: "rating-dimensions",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "category", "archived"],
  },
  defaultSort: "label",
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Stable identifier; scores are stored against it." },
    },
    { name: "label", type: "text", required: true },
    {
      name: "category",
      type: "text",
      admin: { description: "Grouping in the picker, e.g. Movement, Strength." },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "What this dimension is judging." },
    },
    {
      name: "max",
      type: "number",
      required: true,
      defaultValue: 5,
      admin: { description: "Top of the scale. 5 throughout the seeded library." },
    },
    {
      name: "scale",
      type: "text",
      hasMany: true,
      admin: {
        description:
          "The 1-5 descriptors, worst to best. For a workload dimension such as Intensity, 5 is the heaviest workload rather than the best performance.",
      },
    },
    {
      name: "archived",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Hidden from the picker; existing uses are untouched." },
    },
  ],
};
