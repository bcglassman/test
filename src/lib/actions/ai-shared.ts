import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";

/** Throws unless a Payload user is logged in. Every AI action checks this
 * itself, server-side — not just the calling page — same as every other
 * write in this app. */
export async function requireLoggedInUser(): Promise<void> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  if (!user) {
    throw new Error("You must be logged in to use AI suggestions.");
  }
}
