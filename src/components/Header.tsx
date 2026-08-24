import Link from "next/link";
import { InfoIcon, PawIcon } from "./icons";

export function Header({ active }: { active: "feed" | "sessions" }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-sage)] text-white">
            <PawIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-serif text-2xl leading-tight text-[var(--color-ink)]">
              Cookie Training
            </span>
            <span className="block text-sm text-[var(--color-ink-soft)]">
              A simple exercise journal.
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <button
            type="button"
            title="A simple exercise journal for tracking Cookie's rehab and training progress."
            className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <InfoIcon className="h-4 w-4" />
            About
          </button>
          <Link
            href="/sessions"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === "sessions"
                ? "bg-[var(--color-sage-dark)] text-white"
                : "bg-[var(--color-sage)] text-white hover:bg-[var(--color-sage-dark)]"
            }`}
          >
            {active === "sessions" ? "View Feed" : "Log in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
