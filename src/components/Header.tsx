"use client";

import Link from "next/link";
import { InfoIcon, PawIcon } from "./icons";
import { useSessions } from "@/lib/sessions-context";

export function Header({ active }: { active: "feed" | "sessions" }) {
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
          <button
            type="button"
            title="A simple exercise journal for tracking Cookie's rehab and training progress."
            className="hidden items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] sm:flex"
          >
            <InfoIcon className="h-4 w-4" />
            About
          </button>

          <Link
            href={active === "sessions" ? "/" : "/sessions"}
            className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            {active === "sessions" ? "View Feed" : "Sessions"}
          </Link>

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
