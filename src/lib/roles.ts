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
  /** Which roles see this item. A signed-out visitor sees only the feed. */
  roles: UserRole[];
}

const ALL: UserRole[] = ["owner", "trainer", "admin"];

export const NAV_ITEMS: NavItem[] = [
  { key: "feed", href: "/", label: "Feed", roles: ALL },
  { key: "sessions", href: "/sessions", label: "Sessions", roles: ["trainer", "admin"] },
  { key: "exercises", href: "/exercises", label: "Exercises", roles: ["trainer", "admin"] },
  // Payload owns /admin, so the app's own admin area lives at /manage and
  // just calls itself "Admin" in the navigation.
  { key: "manage", href: "/manage", label: "Admin", roles: ["admin"] },
];

/** Navigation for a role; signed-out visitors get the feed only. */
export function navForRole(role: UserRole | null): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => item.key === "feed");
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function displayName(user: CurrentUser | null): string {
  if (!user) return "";
  return user.name?.trim() || user.email;
}
