"use client";

import { useState } from "react";
import { SparkleIcon } from "@/components/icons";
import { refineNote, type NoteContext } from "@/lib/actions/refine-note";

/**
 * Tidies a note in place, with the surrounding recorded data as context.
 *
 * The previous wording is held until the note is edited again, so a
 * rewrite that lost the point is one click from being put back — the same
 * bargain as the watch-item rewrite: the AI drafts, the handler decides.
 */
export function NoteSparkle({
  scope,
  value,
  onChange,
  buildContext,
}: {
  scope: "set" | "session";
  value: string;
  onChange: (text: string) => void;
  /** Gathered when the button is pressed, so it reflects the form as it is now. */
  buildContext: () => NoteContext;
}) {
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const draft = value.trim();
    if (!draft) {
      setError("Write the note first, then refine it.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const rewritten = await refineNote(scope, draft, buildContext());
      setPrevious(draft);
      onChange(rewritten);
    } catch {
      setError("Couldn't reach the AI. Your wording is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {previous !== null && previous !== value && (
        <button
          type="button"
          onClick={() => {
            onChange(previous);
            setPrevious(null);
          }}
          className="text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
        >
          Revert
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-[var(--color-down)]">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-label={
          scope === "session" ? "Reword the session notes" : "Reword the set notes"
        }
        title={
          scope === "session"
            ? "Reword using this session's sets, ratings and watch items"
            : "Reword using this set's reps, ratings and watch items"
        }
        className="rounded-md p-1 text-[var(--color-sage-dark)] hover:bg-[var(--color-sage-tint)] disabled:opacity-50"
      >
        <SparkleIcon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      </button>
    </span>
  );
}
