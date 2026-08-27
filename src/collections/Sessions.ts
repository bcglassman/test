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
      name: "dog",
      type: "relationship",
      relationTo: "dogs",
      // Optional so sessions logged before dogs existed still load; the
      // migration backfills them onto the default dog.
      admin: { description: "Which dog performed this session." },
    },
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
      name: "sets",
      type: "array",
      admin: {
        description:
          "One entry per set performed, holding that set's work, scores and notes. Rating labels/max/scale come from the exercise's own dimensions, not stored here.",
      },
      fields: [
        { name: "setNumber", type: "number", required: true },
        { name: "reps", type: "number" },
        {
          name: "passes",
          type: "number",
          admin: {
            description:
              'For exercises counted in passes rather than reps (e.g. cavaletti).',
          },
        },
        {
          name: "notes",
          type: "textarea",
          admin: { description: "Note about this set specifically." },
        },
        {
          name: "watchItems",
          type: "text",
          hasMany: true,
          admin: {
            hidden: true,
            description:
              "Superseded by watchPoints, which can carry a timestamp. Kept so sessions saved before that aren't lost; the seed copies them across and the app writes only watchPoints.",
          },
        },
        {
          name: "watchPoints",
          type: "array",
          admin: {
            description:
              'Short things to watch for in this set, e.g. "left knee flaring", each optionally pinned to a moment in that set\'s video.',
          },
          fields: [
            { name: "text", type: "text", required: true },
            {
              name: "atSeconds",
              type: "number",
              admin: {
                description:
                  "Where in the set's clip this shows, in seconds. Empty when it isn't tied to a moment.",
              },
            },
          ],
        },
        {
          name: "ratings",
          type: "array",
          fields: [
            { name: "key", type: "text", required: true },
            { name: "score", type: "number", required: true },
          ],
        },
      ],
    },
    {
      name: "ratingDefs",
      type: "array",
      admin: {
        description:
          "This session's rating dimensions, seeded from the exercise as a template then editable here.",
      },
      fields: [
        { name: "key", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "max", type: "number", required: true, defaultValue: 5 },
        { name: "scale", type: "text", hasMany: true },
      ],
    },
    {
      name: "restLabel",
      type: "text",
      admin: { description: "Rest taken between sets." },
    },
    {
      name: "locationName",
      type: "text",
      defaultValue: "Singapore",
      admin: { description: "Where the session took place; used to look up the weather." },
    },
    { name: "latitude", type: "number", admin: { description: "Decimal degrees." } },
    { name: "longitude", type: "number", admin: { description: "Decimal degrees." } },
    {
      name: "weather",
      type: "group",
      admin: {
        description:
          "Conditions at the session's time and place, fetched once and stored so the record doesn't change later.",
      },
      fields: [
        { name: "temperatureC", type: "number" },
        { name: "humidityPercent", type: "number" },
        { name: "description", type: "text" },
        { name: "fetchedAt", type: "date" },
      ],
    },
    {
      name: "environment",
      type: "text",
      admin: {
        description:
          'Where and under what conditions, e.g. "Outside — warm" or "Air-conditioned gym".',
      },
    },
    { name: "notes", type: "textarea" },
    {
      name: "media",
      type: "array",
      admin: {
        description:
          "Videos/photos belonging to this session, in order. Each one belongs to a specific set.",
      },
      fields: [
        {
          name: "setNumber",
          type: "number",
          required: true,
          defaultValue: 1,
          admin: { description: "Which set this clip/photo was taken during." },
        },
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
        {
          name: "activeMovementSeconds",
          type: "number",
          admin: {
            description:
              "Seconds of actual movement, prepopulated from the clip's duration then editable.",
          },
        },
        {
          name: "capturedAt",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayAndTime" },
            description:
              "When the clip/photo was recorded, read from the file's own metadata on upload.",
          },
        },
        { name: "order", type: "number", required: true, defaultValue: 0 },
      ],
    },
  ],
};
