import type { CollectionConfig } from "payload";
import { authenticated } from "./access";

/**
 * A dog's weekly training plan: what is *meant* to happen, as a repeating
 * week. It is a template, not a diary — the calendar projects it onto real
 * dates, and what actually happened stays in `sessions`. Nothing here is
 * duplicated per week, so a plan change applies from now on rather than
 * rewriting history.
 */
export const Plans: CollectionConfig = {
  slug: "plans",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "dog", "active"],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text", required: true, defaultValue: "Weekly plan" },
    {
      name: "dog",
      type: "relationship",
      relationTo: "dogs",
      required: true,
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "The plan the calendar shows. Keep one active per dog; older ones stay for the record.",
      },
    },
    { name: "notes", type: "textarea" },
    {
      name: "items",
      type: "array",
      admin: {
        description:
          "One entry per planned activity. Several can share a day and category — the calendar stacks them in that cell.",
      },
      fields: [
        {
          name: "dayOfWeek",
          type: "number",
          required: true,
          min: 0,
          max: 6,
          admin: { description: "0 = Sunday, 6 = Saturday." },
        },
        {
          name: "category",
          type: "select",
          required: true,
          options: [
            { label: "Cardio", value: "cardio" },
            { label: "Strength", value: "strength" },
            { label: "Flexibility", value: "flexibility" },
            { label: "Body awareness", value: "bodyAwareness" },
            { label: "Enrichment / mental", value: "enrichment" },
            { label: "Sport / work-specific", value: "sport" },
          ],
        },
        { name: "title", type: "text", required: true },
        {
          name: "detail",
          type: "textarea",
          admin: { description: "How to run it. Line breaks are kept." },
        },
        {
          name: "durationMinMinutes",
          type: "number",
          admin: { description: "Planned minutes. Set both for a range like 45-60." },
        },
        { name: "durationMaxMinutes", type: "number" },
        {
          name: "intensity",
          type: "select",
          required: true,
          defaultValue: "low",
          options: [
            { label: "Low", value: "low" },
            { label: "Low–moderate", value: "lowModerate" },
            { label: "Moderate", value: "moderate" },
            { label: "Moderate–high", value: "moderateHigh" },
            { label: "Recovery / rest", value: "rest" },
          ],
        },
        {
          name: "optional",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Do it if the day allows; not counted as missed." },
        },
        {
          name: "stopRule",
          type: "text",
          admin: {
            description:
              'When to stop or skip, e.g. "Stop if gait changes". Shown on its own so it is not lost in the instructions.',
          },
        },
        {
          name: "alternatives",
          type: "array",
          admin: { description: "Swaps for this slot — any one of them counts." },
          fields: [
            { name: "title", type: "text", required: true },
            { name: "detail", type: "textarea" },
          ],
        },
        {
          name: "exercise",
          type: "relationship",
          relationTo: "exercises",
          admin: {
            description:
              "Links the plan to the exercise library. Without it the calendar can't tell whether this was done — a logged session is matched to a plan item by day and exercise.",
          },
        },
        { name: "order", type: "number", defaultValue: 0 },
      ],
    },
  ],
};
