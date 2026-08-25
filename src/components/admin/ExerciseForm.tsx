"use client";

import { useState } from "react";
import type { ExerciseCategory } from "@/lib/types";
import { createExercise } from "@/lib/data-source";
import {
  suggestExerciseDetails,
  type SuggestedExerciseDetails,
} from "@/lib/actions/suggest-exercise";
import { RATING_LIBRARY } from "@/lib/rating-library";
import {
  RatingDimensionEditor,
  type RatingDraft,
} from "./RatingDimensionEditor";
import { CategoryIcon, PlusIcon, SparkleIcon } from "@/components/icons";

const CATEGORIES: ExerciseCategory[] = [
  "Strength",
  "Mobility",
  "Coordination",
  "Cardio",
  "Skill",
];

function slugify(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

export function ExerciseForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("Strength");
  const [focus, setFocus] = useState("");
  const [description, setDescription] = useState("");
  const [ratings, setRatings] = useState<RatingDraft[]>([
    RATING_LIBRARY[0], // Form
    RATING_LIBRARY[1], // Control
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function applySuggestion(s: SuggestedExerciseDetails) {
    setCategory(s.category);
    setFocus(s.focus);
    setDescription(s.description);
    setRatings(s.defaultRatings);
  }

  async function handleSuggest() {
    if (!name.trim() || aiLoading) return;
    setAiError(null);
    setAiLoading(true);
    try {
      applySuggestion(await suggestExerciseDetails(name));
    } catch {
      setAiError("Couldn't get an AI suggestion. You can fill this in yourself.");
    } finally {
      setAiLoading(false);
    }
  }

  function updateRating(index: number, patch: Partial<RatingDraft>) {
    setRatings((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRating() {
    setRatings((r) => [...r, { key: "", label: "", max: 5 }]);
  }

  function removeRating(index: number) {
    setRatings((r) => r.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      await createExercise({
        name: name.trim(),
        category,
        focus: focus.trim(),
        description: description.trim() || undefined,
        defaultRatings: ratings
          .filter((r) => r.label.trim())
          .map((r) => ({ ...r, key: r.key.trim() || slugify(r.label) })),
      });
      onCreated();
    } catch {
      setSaveError("Couldn't save this exercise. Make sure you're logged in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
      <h1 className="mb-6 font-serif text-2xl text-[var(--color-ink)]">
        New Exercise
      </h1>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Name
        </span>
        <div className="relative">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sit to Stand"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-3 pr-11 text-sm outline-none focus:border-[var(--color-sage)]"
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!name.trim() || aiLoading}
            title="Pre-fill the rest with AI"
            aria-label="Pre-fill the rest with AI"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-sage-dark)] hover:bg-[var(--color-sage-tint)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SparkleIcon className={`h-5 w-5 ${aiLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </label>
      {aiError && (
        <p className="mt-1.5 text-xs text-[var(--color-down)]">{aiError}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Category
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
            <CategoryIcon category={category} className="h-4 w-4 shrink-0 text-[var(--color-sage-dark)]" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
              className="w-full bg-transparent text-sm outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Focus
          </span>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Hind Limb"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Description
        </span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
        />
      </label>

      <div className="mt-5">
        <span className="mb-2 block text-sm font-medium text-[var(--color-ink-soft)]">
          Default rating dimensions
        </span>
        <p className="mb-2 text-xs text-[var(--color-ink-soft)]">
          Pick a standard dimension from the library for consistent wording
          across exercises, or type your own and use the sparkle button to
          write a 1–5 scale for it.
        </p>
        <div className="flex flex-col gap-2">
          {ratings.map((r, i) => (
            <RatingDimensionEditor
              key={i}
              rating={r}
              exerciseName={name}
              onChange={(patch) => updateRating(i, patch)}
              onRemove={() => removeRating(i)}
            />
          ))}
          {ratings.length < 5 ? (
            <button
              type="button"
              onClick={addRating}
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--color-sage-dark)] hover:underline"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add dimension
            </button>
          ) : (
            <p className="text-xs text-[var(--color-ink-soft)]">
              Maximum of 5 rating dimensions per exercise.
            </p>
          )}
        </div>
      </div>

      {saveError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-down)]">
          {saveError}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button
          type="submit"
          disabled={isSaving || !name.trim() || !focus.trim()}
          className="rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Create Exercise"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
