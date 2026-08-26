import type { CollectionConfig } from "payload";

// Payload marks its auth cookie `Secure` by default whenever NODE_ENV is
// "production" — correct for a real HTTPS deployment, but it means the
// browser silently refuses to ever send the cookie back on a plain-HTTP
// site (login "succeeds" every time but never actually persists). Only
// require Secure once this is genuinely served over HTTPS.
const isHttps =
  process.env.PAYLOAD_PUBLIC_SERVER_URL?.startsWith("https://") ?? false;

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    cookies: {
      secure: isHttps,
    },
  },
  admin: {
    useAsTitle: "email",
  },
  access: {
    // Only logged-in users can see the users list; nobody can self-register
    // through the API (the very first user is created via Payload's
    // built-in "create first admin" flow, which bypasses access control).
    read: ({ req: { user } }) => Boolean(user),
    create: () => false,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "name",
      type: "text",
      admin: { description: "Display name; falls back to the email address." },
    },
    {
      name: "role",
      type: "select",
      defaultValue: "owner",
      options: [
        { label: "Dog owner", value: "owner" },
        { label: "Trainer", value: "trainer" },
        { label: "Admin", value: "admin" },
      ],
      admin: {
        description:
          "Drives which navigation and screens this person sees. It does not yet restrict what the API returns — that is a separate access change.",
      },
    },
  ],
};
