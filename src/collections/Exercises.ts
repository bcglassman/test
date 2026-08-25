import type { CollectionConfig } from "payload";
import { authenticated } from "./access";

export const Exercises: CollectionConfig = {
  slug: "exercises",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "category", "focus"],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: ["Strength", "Mobility", "Coordination", "Cardio", "Skill"],
    },
    {
      name: "focus",
      type: "text",
      required: true,
      admin: {
        description: "Body area / focus, e.g. \"Hind Limb\", \"General\".",
      },
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "defaultRatings",
      type: "array",
      admin: {
        description:
          "Rating dimensions pre-filled when logging a new session for this exercise.",
      },
      fields: [
        { name: "key", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "max", type: "number", required: true, defaultValue: 5 },
        {
          name: "scale",
          type: "text",
          hasMany: true,
          minRows: 5,
          maxRows: 5,
          admin: {
            description:
              'Optional rubric: exactly 5 short descriptions for scores 1-5, e.g. "Maintains Good Form" for a 4.',
          },
        },
      ],
    },
  ],
};
