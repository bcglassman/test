"use client";

import { useMemo, useState } from "react";
import type { RatingDimensionDoc } from "@/lib/types";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from "@/components/icons";

/**
 * Chooses an exercise's default rating dimensions from the global library,
 * in the order they'll be presented when logging.
 *
 * Removing one here only detaches it from this exercise — the dimension
 * itself is global and stays. The 1-5 descriptors are shown while
 * configuring, since "Symmetry" alone doesn't tell you what a 3 would mean.
 */
export function RatingDimensionPicker({
  library,
  selectedIds,
  onChange,
}: {
  library: RatingDimensionDoc[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(library.map((d) => [d.id, d])),
    [library],
  );
  const chosen = selectedIds
    .map((id) => byId.get(id))
    .filter((d): d is RatingDimensionDoc => Boolean(d));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library
      .filter((d) => !d.archived && !selectedIds.includes(d.id))
      .filter(
        (d) =>
          !q ||
          d.label.toLowerCase().includes(q) ||
          (d.category ?? "").toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [library, query, selectedIds]);

  function move(index: number, delta: number) {
    const next = selectedIds.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
        Default rating dimensions
        <span className="ml-1.5 font-normal">
          · shown in this order when logging this exercise
        </span>
      </span>

      {chosen.length === 0 ? (
        <p className="mb-2 text-sm text-[var(--color-ink-soft)]">
          None yet — search the Rating Library below.
        </p>
      ) : (
        <ol className="mb-3 flex flex-col gap-1.5">
          {chosen.map((dim, i) => (
            <li
              key={dim.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[11px] font-semibold text-[var(--color-sage-dark)]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--color-ink)]">
                    {dim.label}
                  </span>
                  {dim.description && (
                    <span className="block text-xs text-[var(--color-ink-soft)]">
                      {dim.description}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === dim.id ? null : dim.id)
                  }
                  className="shrink-0 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
                >
                  {expanded === dim.id ? "Hide 1–5" : "Show 1–5"}
                </button>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${dim.label} up`}
                  className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === chosen.length - 1}
                  aria-label={`Move ${dim.label} down`}
                  className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(selectedIds.filter((id) => id !== dim.id))
                  }
                  aria-label={`Remove ${dim.label} from this exercise`}
                  title="Removes it from this exercise only; the dimension itself stays in the library"
                  className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              {expanded === dim.id && dim.scale && dim.scale.length > 0 && (
                <ol className="mt-2 flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
                  {dim.scale.map((level, n) => (
                    <li
                      key={n}
                      className="flex items-start gap-2 text-xs text-[var(--color-ink)]"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-cream)] text-[10px] font-semibold text-[var(--color-ink-soft)]">
                        {n + 1}
                      </span>
                      {level}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the Rating Library…"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
      />
      {query.trim() && (
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)]">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-ink-soft)]">
              Nothing matches “{query}”.
            </li>
          ) : (
            matches.map((dim) => (
              <li key={dim.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selectedIds, dim.id]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-cream)]"
                >
                  <PlusIcon className="h-3 w-3 shrink-0 text-[var(--color-sage-dark)]" />
                  <span className="min-w-0">
                    <span className="block text-sm text-[var(--color-ink)]">
                      {dim.label}
                      {dim.category && (
                        <span className="ml-1.5 text-xs text-[var(--color-ink-soft)]">
                          {dim.category}
                        </span>
                      )}
                    </span>
                    {dim.description && (
                      <span className="block truncate text-xs text-[var(--color-ink-soft)]">
                        {dim.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
