"use client";

import { useMemo, useState } from "react";
import type { SessionWithExercise } from "@/lib/types";
import { formatSessionDate, formatSessionTime } from "@/lib/session-utils";
import { ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/icons";

export function SessionsSidebar({
  sessions,
  selectedId,
  onSelect,
  onAddNew,
  onDelete,
}: {
  sessions: SessionWithExercise[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [exerciseId, setExerciseId] = useState("all");

  // Exercises that actually appear in these sessions — no empty filter options.
  const exerciseOptions = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.exerciseId, s.exercise.name]));
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [sessions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (exerciseId !== "all" && s.exerciseId !== exerciseId) return false;
      if (!q) return true;
      // Search across the things you'd actually remember a session by.
      const haystack = [
        s.exercise.name,
        s.notes,
        s.environment,
        formatSessionDate(s.date),
        ...s.sets.map((set) => set.notes),
        ...s.media.map((m) => `${m.label} ${m.notes ?? ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, query, exerciseId]);

  return (
    <aside className="w-full shrink-0 border-[var(--color-border)] lg:w-[300px] lg:border-r lg:pr-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[var(--color-ink)]">Sessions</h2>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-sage)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add session
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            aria-label="Search sessions"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
          />
        </div>
        {exerciseOptions.length > 1 && (
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            aria-label="Filter by exercise"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
          >
            <option value="all">All exercises</option>
            {exerciseOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {visible.map((s) => {
          const active = s.id === selectedId;
          return (
            <li key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={`flex w-full items-center justify-between gap-2 border-l-4 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-l-[var(--color-sage)] bg-[var(--color-sage-tint)]"
                    : "border-l-transparent hover:bg-[var(--color-cream)]"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium text-[var(--color-ink)]">
                    {formatSessionDate(s.date)} · {s.exercise.name} · {s.overall}/
                    {s.overallMax}
                  </span>
                  <span className="block text-xs text-[var(--color-ink-soft)]">
                    {formatSessionTime(s.date)}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-ink-soft)]" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.exercise.name} session`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                className="absolute right-9 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-[var(--color-ink-soft)] hover:bg-white hover:text-[var(--color-down)] group-hover:block"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
            {sessions.length === 0
              ? "No sessions yet."
              : "No sessions match that search."}
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-ink-soft)]">
          Showing {visible.length} of {sessions.length} sessions
        </p>
        {(query || exerciseId !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setExerciseId("all");
            }}
            className="text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </aside>
  );
}
