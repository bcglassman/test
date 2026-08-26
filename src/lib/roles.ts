import type { UserRole } from "./types";
import type { CurrentUser } from "./payload-client";

/**
 * What this pass's roles do — and don't do.
 *
 * A role decides which navigation items and screens a person is shown. It
 * does NOT decide what the API will return: every collection still reads
 * publicly and accepts writes from any logged-in account, exactly as
 * before. Treat everything here as presentation, not enforcement, and
 * don't put anything behind it that would be harmful to reveal.
 */

/**
 * Accounts created before the role field existed have `role: null`. The
 * only such account is whoever set the site up, so they're treated as an
 * admin rather than being silently demoted out of their own admin area.
 */
export function resolveRole(user: CurrentUser | null): UserRole | null {
  if (!user) return null;
  return (user.role as UserRole | null | undefined) ?? "admin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Dog owner",
  trainer: "Trainer",
  admin: "Admin",
};

export type NavKey = "feed" | "sessions" | "exercises" | "manage";

interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  /** Which signed-in roles see this item. */
  roles: UserRole[];
  /** Whether a signed-out visitor sees it too. */
  signedOut: boolean;
}

const ALL: UserRole[] = ["owner", "trainer", "admin"];

export const NAV_ITEMS: NavItem[] = [
  { key: "feed", href: "/", label: "Feed", roles: ALL, signedOut: true },
  // The record — the feed, the sessions behind it and the exercise library
  // — is one readable whole, so these stay in the navigation for everyone.
  // Writing still needs a login; /sessions shows a login prompt in place of
  // its form.
  { key: "sessions", href: "/sessions", label: "Sessions", roles: ALL, signedOut: true },
  { key: "exercises", href: "/exercises", label: "Exercise Library", roles: ALL, signedOut: true },
  // Payload owns /admin, so the app's own admin area lives at /manage and
  // just calls itself "Admin" in the navigation.
  { key: "manage", href: "/manage", label: "Admin", roles: ["admin"], signedOut: false },
];

/** Navigation for a role, or for a signed-out visitor when role is null. */
export function navForRole(role: UserRole | null): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => item.signedOut);
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function displayName(user: CurrentUser | null): string {
  if (!user) return "";
  return user.name?.trim() || user.email;
}
