import type { CollectionConfig } from "payload";
import { authenticated } from "./access";

export const Dogs: CollectionConfig = {
  slug: "dogs",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "breed", "archived"],
  },
  defaultSort: "name",
  // Deliberately the same rules as every other collection in this app for
  // now: the feed is public, writes need a login. Per-dog scoping (owners
  // and trainers only seeing their own dogs) is a separate change — the
  // `owners`/`trainers` fields below are recorded now so that change has
  // the data it needs, but nothing reads them for access yet.
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "photo",
      type: "upload",
      relationTo: "media",
      admin: { description: "Profile photo shown in the dog selector and header." },
    },
    { name: "breed", type: "text" },
    {
      name: "dateOfBirth",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Used to show the dog's age; no age is shown without it.",
      },
    },
    {
      name: "sex",
      type: "select",
      options: [
        { label: "Male", value: "male" },
        { label: "Female", value: "female" },
      ],
    },
    {
      name: "weightKg",
      type: "number",
      admin: { description: "Current weight in kilograms." },
    },
    {
      name: "trainingFocus",
      type: "text",
      admin: {
        description:
          'What the current programme is working on, e.g. "Hind-limb strength after CCL repair".',
      },
    },
    {
      name: "trainingGoals",
      type: "text",
      hasMany: true,
      admin: { description: "Short goal statements, one per entry." },
    },
    {
      name: "movementObservations",
      type: "textarea",
      admin: {
        description:
          "Standing observations about how this dog moves, carried across sessions.",
      },
    },
    {
      name: "restrictions",
      type: "text",
      hasMany: true,
      admin: {
        description:
          'Things to avoid, e.g. "No jumping above hock height". Shown on the dog profile.',
      },
    },
    { name: "notes", type: "textarea" },
    {
      name: "owners",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        description:
          "Recorded for a later access change; not enforced yet.",
      },
    },
    {
      name: "trainers",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        description:
          "Recorded for a later access change; not enforced yet.",
      },
    },
    {
      name: "archived",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Archived dogs stay in the record but drop out of the dog selector.",
      },
    },
  ],
};
