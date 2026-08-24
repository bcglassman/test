import type { CollectionConfig } from "payload";
import { authenticated } from "./access";

export const Sessions: CollectionConfig = {
  slug: "sessions",
  admin: {
    useAsTitle: "date",
    defaultColumns: ["exercise", "date"],
  },
  defaultSort: "-date",
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: "exercise",
      type: "relationship",
      relationTo: "exercises",
      required: true,
    },
    {
      name: "date",
      type: "date",
      required: true,
      admin: {
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "ratings",
      type: "array",
      fields: [
        { name: "key", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "score", type: "number", required: true },
        { name: "max", type: "number", required: true, defaultValue: 10 },
      ],
    },
    { name: "sets", type: "number" },
    { name: "reps", type: "number" },
    { name: "passes", type: "number" },
    { name: "restLabel", type: "text" },
    { name: "notes", type: "textarea" },
    {
      name: "media",
      type: "array",
      admin: {
        description: "Videos/photos belonging to this session, in order.",
      },
      fields: [
        {
          name: "type",
          type: "select",
          required: true,
          options: ["video", "image"],
        },
        {
          name: "file",
          type: "upload",
          relationTo: "media",
          required: true,
        },
        { name: "label", type: "text" },
        { name: "notes", type: "text" },
        { name: "duration", type: "text" },
        { name: "order", type: "number", required: true, defaultValue: 0 },
      ],
    },
  ],
};
