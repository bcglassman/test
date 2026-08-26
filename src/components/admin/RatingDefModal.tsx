"use client";

import { useEffect, useState } from "react";
import type { RatingDefinition } from "@/lib/types";
import { RATING_LIBRARY } from "@/lib/rating-library";
import { CloseIcon } from "@/components/icons";

function slugify(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "rating"
  );
}

/**
 * Add or edit one rating dimension for a session. The exercise's own
 * dimensions are only a template, so changes here stay on this session.
 */
export function RatingDefModal({
  initial,
  existingKeys,
  onSave,
  onClose,
}: {
  /** Undefined when adding a new dimension. */
  initial?: RatingDefinition;
  /** Keys already in use, so a new one doesn't collide. */
  existingKeys: string[];
  onSave: (def: RatingDefinition) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [max, setMax] = useState(initial?.max ?? 5);
  const [scale, setScale] = useState<string[]>(
    initial?.scale ?? ["", "", "", "", ""],
  );
  const [useScale, setUseScale] = useState(Boolean(initial?.scale?.length));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyLibraryEntry(key: string) {
    const entry = RATING_LIBRARY.find((r) => r.key === key);
    if (!entry) return;
    setLabel(entry.label);
    setMax(entry.max);
    setScale(entry.scale ?? ["", "", "", "", ""]);
    setUseScale(Boolean(entry.scale?.length));
  }

  function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) return;
    // Keep an existing key stable so scores already recorded stay attached.
    let key = initial?.key ?? slugify(trimmed);
    if (!initial) {
      let n = 2;
      const taken = new Set(existingKeys);
      while (taken.has(key)) key = `${slugify(trimmed)}_${n++}`;
    }
    const cleaned = scale.map((s) => s.trim());
    onSave({
      key,
      label: trimmed,
      max,
      scale: useScale && cleaned.every(Boolean) ? cleaned : undefined,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit rating" : "Add rating"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-[var(--color-ink)]">
            {initial ? "Edit rating" : "Add rating"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {!initial && (
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Start from the library
            </span>
            <select
              defaultValue=""
              onChange={(e) => {
                applyLibraryEntry(e.target.value);
                e.target.value = "";
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
            >
              <option value="" disabled>
                Pick a standard dimension…
              </option>
              {RATING_LIBRARY.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-3 gap-4">
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Label
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Intensity"
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Max
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={max}
              onChange={(e) => setMax(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={useScale}
            onChange={(e) => setUseScale(e.target.checked)}
            className="accent-[var(--color-sage)]"
          />
          Describe what each score means
        </label>

        {useScale && (
          <ol className="mt-3 flex flex-col gap-2">
            {scale.slice(0, 5).map((level, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-xs font-semibold text-[var(--color-sage-dark)]">
                  {i + 1}
                </span>
                <input
                  value={level}
                  onChange={(e) => {
                    const next = [...scale];
                    next[i] = e.target.value;
                    setScale(next);
                  }}
                  placeholder={`What a ${i + 1} looks like`}
                  className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
                />
              </li>
            ))}
          </ol>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!label.trim()}
            className="rounded-full bg-[var(--color-sage)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-50"
          >
            {initial ? "Save rating" : "Add rating"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
