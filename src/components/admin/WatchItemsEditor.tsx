"use client";

import { useState } from "react";
import type { WatchItem } from "@/lib/types";
import { formatTimecode, parseTimecode } from "@/lib/session-utils";
import { CloseIcon, PlusIcon } from "../icons";

/**
 * The rows for editing a set's watch items — short things to look for,
 * each optionally pinned to a moment in that set's clip.
 *
 * Shared by the session form and the feed's inline editor so the two can't
 * drift apart; the timecode parsing in particular is fiddly enough that
 * one copy is the point.
 */
export function WatchItemsEditor({
  items,
  onChange,
  autoFocusLast = false,
}: {
  items: WatchItem[];
  onChange: (items: WatchItem[]) => void;
  /** Focus a freshly added row — useful when adding is the way in. */
  autoFocusLast?: boolean;
}) {
  // What each timecode box shows while it's being typed. Without this,
  // "0:" would be parsed to 0 and reformatted to "0:00" under the cursor.
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  function timecodeValue(index: number, item: WatchItem) {
    const draft = drafts[index];
    if (draft !== undefined) return draft;
    return item.atSeconds === undefined ? "" : formatTimecode(item.atSeconds);
  }

  function update(index: number, patch: Partial<WatchItem>) {
    onChange(items.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-ink-soft)]">
          Nothing flagged for this set.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={item.text}
                onChange={(e) => update(i, { text: e.target.value })}
                maxLength={140}
                autoFocus={autoFocusLast && i === items.length - 1}
                placeholder="e.g. left knee flaring"
                className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
              />
              <input
                value={timecodeValue(i, item)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDrafts((d) => ({ ...d, [i]: raw }));
                  update(i, { atSeconds: parseTimecode(raw) });
                }}
                onBlur={() =>
                  setDrafts((d) => {
                    const next = { ...d };
                    delete next[i];
                    return next;
                  })
                }
                placeholder="0:07"
                aria-label={`Video timestamp for watch item ${i + 1}`}
                title="Where in this set's video it shows, e.g. 0:07"
                className="w-16 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[var(--color-sage)]"
              />
              <button
                type="button"
                onClick={() => {
                  // Drafts are keyed by position, so they'd point at the
                  // wrong rows once one is removed.
                  setDrafts({});
                  onChange(items.filter((_, j) => j !== i));
                }}
                aria-label={`Remove watch item ${i + 1}`}
                className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, { text: "" }])}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
      >
        <PlusIcon className="h-3 w-3" />
        Add watch item
      </button>
    </div>
  );
}
