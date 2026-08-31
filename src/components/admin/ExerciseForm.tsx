"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryIcon, SparkleIcon } from "@/components/icons";
import { TagPicker } from "./TagPicker";
import { RatingDimensionPicker } from "./RatingDimensionPicker";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";
import { suggestExerciseDetails } from "@/lib/actions/suggest-exercise";
import type { Exercise } from "@/lib/types";
import {
  EQUIPMENT_VALUES,
  EXERCISE_CATEGORIES,
  FOCUS_VALUES,
  TRACKING_METHODS,
  UNITS,
  UNITS_FOR_TRACKING,
  type ExerciseCategory,
  type TrackingMethod,
  type Unit,
} from "@/lib/taxonomy";

type Draft = Omit<Exercise, "defaultRatings">;

export function blankExercise(): Draft {
  return {
    id: "",
    name: "",
    category: "Walking & General Activity",
    focus: [],
    trackingMethods: [],
    equipment: [],
    defaultRatingDimensionIds: [],
    status: "active",
  };
}

const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]";

export function ExerciseForm({ initial }: { initial: Draft }) {
  const { ratingDimensions, saveExercise } = useSessions();
  const { showToast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = !initial.id;

  function patch(next: Partial<Draft>) {
    setForm((f) => ({ ...f, ...next }));
  }

  /** Units worth offering, given what the exercise actually tracks. */
  const relevantUnits: readonly Unit[] =
    form.trackingMethods.length === 0
      ? UNITS
      : Array.from(
          new Set(form.trackingMethods.flatMap((m) => UNITS_FOR_TRACKING[m])),
        );

  async function runAi() {
    if (!form.name.trim()) {
      setError("Give the exercise a name first.");
      return;
    }
    setError(null);
    setAiLoading(true);
    try {
      const s = await suggestExerciseDetails(form.name);
      const byKey = new Map(ratingDimensions.map((d) => [d.key, d.id]));
      patch({
        category: s.category,
        focus: s.focus,
        description: s.description,
        trackingMethods: s.trackingMethods,
        primaryUnit: s.primaryUnit,
        equipment: s.equipment,
        techniqueNotes: s.techniqueNotes,
        defaultRatingDimensionIds: s.ratingKeys
          .map((k) => byKey.get(k))
          .filter((id): id is string => Boolean(id)),
      });
    } catch {
      setError("Couldn't get an AI suggestion. Fill the fields in by hand.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Give the exercise a name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await saveExercise({ ...form, name: form.name.trim() });
      showToast(isNew ? "Exercise created" : "Exercise saved");
      router.push(`/exercises/${saved.id}`);
    } catch {
      setError("Couldn't save. Make sure you're logged in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-soft)]">
          Name
          {isNew && (
            <button
              type="button"
              onClick={runAi}
              disabled={aiLoading}
              title="Fill in the rest from the name"
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline disabled:opacity-50"
            >
              <SparkleIcon className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
              {aiLoading ? "Thinking…" : "Fill in from the name"}
            </button>
          )}
        </span>
        <input
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Incline Carpetmill Intervals"
          autoFocus
          className={field}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Category
            <span className="ml-1.5 font-normal">· the type of exercise</span>
          </span>
          <div className="flex items-center gap-2">
            <CategoryIcon
              category={form.category}
              className="h-5 w-5 shrink-0 text-[var(--color-sage-dark)]"
            />
            <select
              value={form.category}
              onChange={(e) =>
                patch({ category: e.target.value as ExerciseCategory })
              }
              className={field}
            >
              {EXERCISE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Primary unit
            <span className="ml-1.5 font-normal">· optional</span>
          </span>
          <select
            value={form.primaryUnit ?? ""}
            onChange={(e) =>
              patch({ primaryUnit: (e.target.value || undefined) as Unit })
            }
            className={field}
          >
            <option value="">—</option>
            {relevantUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TagPicker
        label="Focus"
        hint="what it trains"
        options={FOCUS_VALUES}
        selected={form.focus}
        onChange={(focus) => patch({ focus })}
      />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Description
        </span>
        <textarea
          rows={4}
          value={form.description ?? ""}
          onChange={(e) => patch({ description: e.target.value || undefined })}
          placeholder="What the exercise involves and why it is performed"
          className={field}
        />
      </label>

      <TagPicker
        label="Tracking"
        hint="decides which fields the session form offers"
        options={TRACKING_METHODS}
        selected={form.trackingMethods}
        onChange={(v) => patch({ trackingMethods: v as TrackingMethod[] })}
        allowCustom={false}
      />

      <TagPicker
        label="Equipment"
        hint="optional"
        options={EQUIPMENT_VALUES}
        selected={form.equipment}
        onChange={(equipment) => patch({ equipment })}
      />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Technique / setup notes
        </span>
        <textarea
          rows={3}
          value={form.techniqueNotes ?? ""}
          onChange={(e) =>
            patch({ techniqueNotes: e.target.value || undefined })
          }
          placeholder="What good execution looks like, and what would mean easing off"
          className={field}
        />
      </label>

      <RatingDimensionPicker
        library={ratingDimensions}
        selectedIds={form.defaultRatingDimensionIds}
        onChange={(defaultRatingDimensionIds) =>
          patch({ defaultRatingDimensionIds })
        }
      />

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
        <input
          type="checkbox"
          checked={form.status === "archived"}
          onChange={(e) =>
            patch({ status: e.target.checked ? "archived" : "active" })
          }
          className="accent-[var(--color-sage)]"
        />
        Archived — keeps every session that used it, but drops out of
        new-session selection
      </label>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-down)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-60"
        >
          {saving ? "Saving…" : isNew ? "Create exercise" : "Save exercise"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
