import type { Access } from "payload";

/** Anyone signed into the Payload admin can write; the public feed just reads. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user);
