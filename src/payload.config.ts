import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import { Users } from "./collections/Users";
import { Exercises } from "./collections/Exercises";
import { Sessions } from "./collections/Sessions";
import { Media } from "./collections/Media";
import { Dogs } from "./collections/Dogs";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  // `serverURL` is deliberately left unset (Payload defaults it to "").
  //
  // Setting it makes Payload append it to the CSRF allowlist
  // (config/sanitize.ts: `if (config.serverURL !== '') config.csrf.push(...)`),
  // and a non-empty allowlist switches cookie auth onto a strict path: the
  // auth cookie is only honoured when the request carries either a matching
  // `Origin` header or a `Sec-Fetch-Site` header (see auth/extractJWT.ts).
  // A plain top-level navigation to /admin sends neither, so the cookie was
  // silently discarded and every login bounced back to the login screen.
  //
  // With the allowlist empty, Payload uses the cookie whenever it's present.
  // Cross-site request forgery is still mitigated by the SameSite=Lax auth
  // cookie, which browsers refuse to send on the cross-site POST/PATCH/DELETE
  // requests that actually mutate data here.
  //
  // PAYLOAD_PUBLIC_SERVER_URL is still read elsewhere — for Next's Server
  // Actions origin allowlist and to decide whether the auth cookie gets the
  // `Secure` flag — so setting it for a real HTTPS deployment still matters.
  csrf: [],
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " — Canine Training CMS",
    },
  },
  collections: [Users, Dogs, Exercises, Sessions, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || "file:./cookie-training.db",
    },
  }),
});
