"use client";

import { useRef, useState } from "react";
import type { Exercise, MediaItem, RatingDimension, TrainingSession } from "@/lib/types";
import { CategoryIcon, UploadIcon } from "@/components/icons";
import { MediaEditorCard } from "./MediaEditorCard";
import { mediaFromFile } from "@/lib/media-utils";

const REST_PRESETS = ["None", "~30 sec", "~45 sec", "~60 sec", "~90 sec", "~2 min", "~5 min", "~10 min"];

function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function blankFromExercise(exercise: Exercise): TrainingSession {
  return {
    // Empty id marks a session that hasn't been created in the CMS yet;
    // saveSession() uses this to decide POST (create) vs PATCH (update).
    id: "",
    exerciseId: exercise.id,
    date: toDateTimeLocal(new Date().toISOString()),
    ratings: exercise.defaultRatings.map((r) => ({ ...r, score: Math.round(r.max / 2) })),
    sets: 3,
    reps: 6,
    restLabel: "~60 sec",
    notes: "",
    media: [],
  };
}

export function SessionForm({
  exercises,
  session,
  onSave,
  onCancel,
}: {
  exercises: Exercise[];
  session: TrainingSession | null;
  onSave: (session: TrainingSession) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TrainingSession>(() =>
    session
      ? { ...session, date: toDateTimeLocal(session.date) }
      : blankFromExercise(exercises[0]),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exercise = exercises.find((e) => e.id === form.exerciseId) ?? exercises[0];

  function updateRating(key: string, score: number) {
    setForm((f) => ({
      ...f,
      ratings: f.ratings.map((r) => (r.key === key ? { ...r, score } : r)),
    }));
  }

  function handleExerciseChange(exerciseId: string) {
    const next = exercises.find((e) => e.id === exerciseId);
    if (!next) return;
    setForm((f) => ({
      ...f,
      exerciseId,
      ratings: next.defaultRatings.map(
        (r) =>
          f.ratings.find((existing) => existing.key === r.key) ?? {
            ...r,
            score: Math.round(r.max / 2),
          },
      ),
    }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setIsUploading(true);
    try {
      const nextOrder = form.media.length + 1;
      const added: MediaItem[] = [];
      for (const [i, file] of Array.from(files).entries()) {
        added.push(await mediaFromFile(file, nextOrder + i));
      }
      setForm((f) => ({ ...f, media: [...f.media, ...added] }));
    } catch {
      setError("Couldn't upload that file. Make sure you're logged in.");
    } finally {
      setIsUploading(false);
    }
  }

  function updateMedia(id: string, patch: Partial<MediaItem>) {
    setForm((f) => ({
      ...f,
      media: f.media.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function removeMedia(id: string) {
    setForm((f) => ({ ...f, media: f.media.filter((m) => m.id !== id) }));
  }

  function moveMedia(id: string, direction: "up" | "down") {
    setForm((f) => {
      const sorted = f.media.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((m) => m.id === id);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= sorted.length) return f;
      const a = sorted[idx];
      const b = sorted[swapWith];
      [a.order, b.order] = [b.order, a.order];
      return { ...f, media: sorted };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ ...form, date: new Date(form.date).toISOString() });
    } catch {
      setError("Couldn't save this session. Make sure you're logged in.");
    } finally {
      setIsSaving(false);
    }
  }

  const sortedMedia = form.media.slice().sort((a, b) => a.order - b.order);

  return (
    <form onSubmit={handleSubmit} className="flex-1">
      <h1 className="mb-6 font-serif text-2xl text-[var(--color-ink)]">
        {session ? "Edit Training Session" : "Add Training Session"}
      </h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Exercise
          </span>
          <select
            value={form.exerciseId}
            onChange={(e) => handleExerciseChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Category
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2.5 text-sm text-[var(--color-ink)]">
            <CategoryIcon category={exercise.category} className="h-4 w-4 text-[var(--color-sage-dark)]" />
            {exercise.category} · {exercise.focus}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Date &amp; time
          </span>
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium text-[var(--color-ink-soft)]">
          Ratings
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {form.ratings.map((r: RatingDimension) => (
            <div
              key={r.key}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[var(--color-ink-soft)]">{r.label}</span>
                <span className="text-lg font-semibold text-[var(--color-ink)]">
                  {r.score}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={r.max}
                value={r.score}
                onChange={(e) => updateRating(r.key, Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-sage)]"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Sets
          </span>
          <input
            type="number"
            min={0}
            value={form.sets ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, sets: e.target.value === "" ? undefined : Number(e.target.value) }))
            }
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Reps
          </span>
          <input
            type="number"
            min={0}
            value={form.reps ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, reps: e.target.value === "" ? undefined : Number(e.target.value) }))
            }
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
            Rest
          </span>
          <select
            value={form.restLabel ?? "None"}
            onChange={(e) => setForm((f) => ({ ...f, restLabel: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
          >
            {REST_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Session notes
        </span>
        <textarea
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
        />
      </label>

      <div className="mt-6">
        <span className="mb-2 block text-sm font-medium text-[var(--color-ink-soft)]">
          Media
        </span>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sortedMedia.map((m, i) => (
            <MediaEditorCard
              key={m.id}
              media={m}
              isFirst={i === 0}
              isLast={i === sortedMedia.length - 1}
              onChange={(patch) => updateMedia(m.id, patch)}
              onRemove={() => removeMedia(m.id)}
              onMove={(dir) => moveMedia(m.id, dir)}
            />
          ))}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] p-3 text-center text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-sage-dark)] disabled:opacity-50"
          >
            <UploadIcon className="h-6 w-6" />
            <span className="text-xs leading-snug">
              {isUploading ? (
                "Uploading…"
              ) : (
                <>
                  Upload video or image
                  <br />
                  MP4, MOV, JPG, PNG
                </>
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-down)]">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Session"}
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
