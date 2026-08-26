"use client";

import { useState } from "react";
import type { RatingDimension } from "@/lib/types";
import type { LibraryRating } from "@/lib/rating-library";
import { RatingLibraryPicker } from "./RatingLibraryPicker";
import { suggestRatingScale } from "@/lib/actions/suggest-rating-scale";
import { SparkleIcon, TrashIcon } from "@/components/icons";

export type RatingDraft = Omit<RatingDimension, "score">;

export function RatingDimensionEditor({
  rating,
  exerciseName,
  onChange,
  onRemove,
}: {
  rating: RatingDraft;
  exerciseName: string;
  onChange: (patch: Partial<RatingDraft>) => void;
  onRemove: () => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function applyLibraryEntry(entry: LibraryRating) {
    onChange({
      key: entry.key,
      label: entry.label,
      max: entry.max,
      scale: entry.scale,
    });
  }

  async function handleSuggestScale() {
    if (!rating.label.trim() || !exerciseName.trim() || aiLoading) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const scale = await suggestRatingScale(exerciseName, rating.label);
      onChange({ scale, max: 5 });
    } catch {
      setAiError("Couldn't get an AI scale. You can fill it in yourself.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center gap-2">
        <input
          value={rating.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder="key"
          className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
        />
        <input
          value={rating.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label, e.g. Form"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
        />
        <button
          type="button"
          onClick={handleSuggestScale}
          disabled={!rating.label.trim() || !exerciseName.trim() || aiLoading}
          title="Generate a 1-5 scale with AI"
          aria-label="Generate a 1-5 scale with AI"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--color-sage-dark)] hover:bg-[var(--color-sage-tint)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SparkleIcon className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove dimension"
          className="rounded-md p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-down)]"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <RatingLibraryPicker
          onPick={applyLibraryEntry}
          label="Or start from the library"
          placeholder="Search 70+ standard ratings…"
        />
      </div>

      {aiError && (
        <p className="mt-1.5 text-xs text-[var(--color-down)]">{aiError}</p>
      )}

      {rating.scale && rating.scale.length === 5 && (
        <ol className="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-2.5">
          {rating.scale.map((level, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-xs font-semibold text-[var(--color-sage-dark)]">
                {i + 1}
              </span>
              <input
                value={level}
                onChange={(e) => {
                  const next = [...rating.scale!];
                  next[i] = e.target.value;
                  onChange({ scale: next });
                }}
                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-sage)]"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
