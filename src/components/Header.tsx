"use client";

import Link from "next/link";
import { PawIcon } from "./icons";
import { useSessions } from "@/lib/sessions-context";

const NAV = [
  { href: "/", label: "Feed", key: "feed" },
  { href: "/sessions", label: "Sessions", key: "sessions" },
  { href: "/exercises", label: "Exercises", key: "exercises" },
] as const;

export function Header({
  active,
}: {
  active: "feed" | "sessions" | "exercises";
}) {
  const { user, authLoading, logout } = useSessions();

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage)] text-white sm:h-11 sm:w-11">
            <PawIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-serif text-xl leading-tight text-[var(--color-ink)] sm:text-2xl">
              Cookie Training
            </span>
            <span className="block text-sm text-[var(--color-ink-soft)]">
              A simple exercise journal.
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active === item.key
                    ? "bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]"
                    : "text-[var(--color-ink-soft)] hover:bg-white hover:text-[var(--color-ink)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {!authLoading && user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-[var(--color-ink-soft)] sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-white"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
