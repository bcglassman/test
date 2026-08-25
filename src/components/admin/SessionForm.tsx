"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Exercise, MediaItem, RatingSetEntry, TrainingSession } from "@/lib/types";
import { CategoryIcon, DriveIcon, UploadIcon } from "@/components/icons";
import { MediaEditorCard } from "./MediaEditorCard";
import { mediaFromFile } from "@/lib/media-utils";
import { aggregateRatings } from "@/lib/session-utils";
import {
  downloadDriveFile,
  fetchCapturedAt,
  isGoogleDriveConfigured,
  pickDriveFiles,
} from "@/lib/google-drive";

const REST_PRESETS = ["None", "~30 sec", "~45 sec", "~60 sec", "~90 sec", "~2 min", "~5 min", "~10 min"];

function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * Builds `count` rating-set rows for `exercise`, carrying over scores from
 * `existing` by set index + dimension key where possible, so switching the
 * exercise or the set count doesn't throw away scores that still apply.
 */
function ratingSetsForExercise(
  exercise: Exercise,
  existing: RatingSetEntry[],
  count: number,
): RatingSetEntry[] {
  return Array.from({ length: Math.max(count, 0) }, (_, i) => {
    const prior = existing[i];
    return {
      setNumber: i + 1,
      ratings: exercise.defaultRatings.map((def) => {
        const priorScore = prior?.ratings.find((r) => r.key === def.key)?.score;
        return { key: def.key, score: priorScore ?? Math.round(def.max / 2) };
      }),
    };
  });
}

function blankFromExercise(exercise: Exercise): TrainingSession {
  return {
    // Empty id marks a session that hasn't been created in the CMS yet;
    // saveSession() uses this to decide POST (create) vs PATCH (update).
    id: "",
    exerciseId: exercise.id,
    date: toDateTimeLocal(new Date().toISOString()),
    ratingSets: ratingSetsForExercise(exercise, [], 3),
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
  const [form, setForm] = useState<TrainingSession>(() => {
    if (!session) return blankFromExercise(exercises[0]);
    const ex = exercises.find((e) => e.id === session.exerciseId) ?? exercises[0];
    const count = session.sets && session.sets > 0 ? session.sets : session.ratingSets.length || 1;
    return {
      ...session,
      date: toDateTimeLocal(session.date),
      ratingSets: ratingSetsForExercise(ex, session.ratingSets, count),
    };
  });
  const [isUploading, setIsUploading] = useState(false);
  const [compressPercent, setCompressPercent] = useState<number | null>(null);
  const [uploadingSet, setUploadingSet] = useState<number | null>(null);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const driveEnabled = isGoogleDriveConfigured();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which set's "Add to set" button opened the (single, shared) file picker.
  const pendingSetRef = useRef<number>(1);

  const exercise = exercises.find((e) => e.id === form.exerciseId) ?? exercises[0];

  function updateSetRating(setNumber: number, key: string, score: number) {
    setForm((f) => ({
      ...f,
      ratingSets: f.ratingSets.map((s) =>
        s.setNumber === setNumber
          ? { ...s, ratings: s.ratings.map((r) => (r.key === key ? { ...r, score } : r)) }
          : s,
      ),
    }));
  }

  function handleExerciseChange(exerciseId: string) {
    const next = exercises.find((e) => e.id === exerciseId);
    if (!next) return;
    setForm((f) => ({
      ...f,
      exerciseId,
      ratingSets: ratingSetsForExercise(next, f.ratingSets, f.ratingSets.length || 1),
    }));
  }

  function handleSetsChange(value: number | undefined) {
    const count = Math.max(value ?? 1, 1);
    setForm((f) => ({
      ...f,
      sets: value,
      ratingSets: ratingSetsForExercise(exercise, f.ratingSets, count),
      // Dropping sets would otherwise strand media on a set that no longer
      // exists; pull those items back to the last remaining set.
      media: f.media.map((m) =>
        m.setNumber > count ? { ...m, setNumber: count } : m,
      ),
    }));
  }

  async function addFilesToSet(
    files: File[],
    setNumber: number,
    capturedAtByIndex?: (string | undefined)[],
  ) {
    if (files.length === 0) return;
    setError(null);
    setIsUploading(true);
    setUploadingSet(setNumber);
    try {
      const nextOrder = form.media.length + 1;
      const added: MediaItem[] = [];
      for (const [i, file] of files.entries()) {
        added.push(
          await mediaFromFile(
            file,
            nextOrder + i,
            setNumber,
            (fraction) => setCompressPercent(Math.round(fraction * 100)),
            capturedAtByIndex?.[i],
          ),
        );
        setCompressPercent(null);
      }
      setForm((f) => ({ ...f, media: [...f.media, ...added] }));
    } catch {
      setError("Couldn't upload that file. Make sure you're logged in.");
    } finally {
      setIsUploading(false);
      setUploadingSet(null);
      setCompressPercent(null);
    }
  }

  function handleFiles(files: FileList | null, setNumber: number) {
    if (!files || files.length === 0) return;
    addFilesToSet(Array.from(files), setNumber);
  }

  /**
   * Pulls the picked Drive files into the browser, then runs them through the
   * same compress-and-upload path as a local file.
   */
  async function handleDriveImport(setNumber: number) {
    if (isUploading) return;
    setError(null);
    try {
      const picked = await pickDriveFiles();
      if (picked.length === 0) return;

      setIsUploading(true);
      setUploadingSet(setNumber);
      setDriveStatus(`Fetching from Drive… (1/${picked.length})`);
      const files: File[] = [];
      const capturedAt: (string | undefined)[] = [];
      for (const [i, file] of picked.entries()) {
        setDriveStatus(`Fetching from Drive… (${i + 1}/${picked.length})`);
        capturedAt.push(await fetchCapturedAt(file.id));
        files.push(await downloadDriveFile(file));
      }
      setDriveStatus(null);
      // addFilesToSet manages the uploading flags from here.
      setIsUploading(false);
      setUploadingSet(null);
      await addFilesToSet(files, setNumber, capturedAt);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't import from Google Drive.",
      );
      setIsUploading(false);
      setUploadingSet(null);
      setDriveStatus(null);
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

  /** Reorders within the item's own set — media is grouped by set. */
  function moveMedia(id: string, direction: "up" | "down") {
    setForm((f) => {
      const target = f.media.find((m) => m.id === id);
      if (!target) return f;
      const siblings = f.media
        .filter((m) => m.setNumber === target.setNumber)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((m) => m.id === id);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= siblings.length) return f;
      const [a, b] = [siblings[idx], siblings[swapWith]];
      const swapped = new Map([
        [a.id, b.order],
        [b.id, a.order],
      ]);
      return {
        ...f,
        media: f.media.map((m) =>
          swapped.has(m.id) ? { ...m, order: swapped.get(m.id)! } : m,
        ),
      };
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
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-soft)]">
            Exercise
            <Link
              href="/exercises/new"
              className="font-medium text-[var(--color-sage-dark)] hover:underline"
            >
              + New exercise
            </Link>
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
          Ratings — per set
        </legend>
        <div className="flex flex-col gap-5">
          {form.ratingSets.map((set) => (
            <div key={set.setNumber}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                Set {set.setNumber}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {exercise.defaultRatings.map((def) => {
                  const score =
                    set.ratings.find((r) => r.key === def.key)?.score ??
                    Math.round(def.max / 2);
                  const min = def.scale ? 1 : 0;
                  return (
                    <div
                      key={def.key}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[var(--color-ink-soft)]">{def.label}</span>
                        <span className="text-lg font-semibold text-[var(--color-ink)]">
                          {score}
                        </span>
                      </div>
                      {def.scale && (
                        <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                          {def.scale[score - 1]}
                        </p>
                      )}
                      <input
                        type="range"
                        min={min}
                        max={def.max}
                        value={score}
                        onChange={(e) =>
                          updateSetRating(set.setNumber, def.key, Number(e.target.value))
                        }
                        className="mt-2 w-full accent-[var(--color-sage)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {form.ratingSets.length > 1 && (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              Session average
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {aggregateRatings(form, exercise).map((r) => (
                <div key={r.key} className="text-sm">
                  <span className="text-[var(--color-ink-soft)]">{r.label}</span>{" "}
                  <span className="font-semibold text-[var(--color-ink)]">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
              handleSetsChange(e.target.value === "" ? undefined : Number(e.target.value))
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
          Environment
        </span>
        <input
          value={form.environment ?? ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, environment: e.target.value }))
          }
          placeholder="e.g. Outside — warm, or Air-conditioned gym"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
        />
      </label>

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
        <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
          Media
        </span>
        <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
          Every clip or photo belongs to a set — upload it under the set it was
          taken during.
        </p>
        <div className="flex flex-col gap-5">
          {form.ratingSets.map((set) => {
            const setMedia = sortedMedia.filter(
              (m) => m.setNumber === set.setNumber,
            );
            const busy = isUploading && uploadingSet === set.setNumber;
            return (
              <div key={set.setNumber}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Set {set.setNumber}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {setMedia.map((m, i) => (
                    <MediaEditorCard
                      key={m.id}
                      media={m}
                      isFirst={i === 0}
                      isLast={i === setMedia.length - 1}
                      setCount={form.ratingSets.length}
                      onChange={(patch) => updateMedia(m.id, patch)}
                      onRemove={() => removeMedia(m.id)}
                      onMove={(dir) => moveMedia(m.id, dir)}
                    />
                  ))}
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
                      pendingSetRef.current = set.setNumber;
                      fileInputRef.current?.click();
                    }}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] p-3 text-center text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-sage-dark)] disabled:opacity-50"
                  >
                    <UploadIcon className="h-6 w-6" />
                    <span className="text-xs leading-snug">
                      {busy ? (
                        driveStatus ?? (
                          compressPercent !== null
                            ? `Compressing… ${compressPercent}%`
                            : "Uploading…"
                        )
                      ) : (
                        <>
                          Add to set {set.setNumber}
                          <br />
                          MP4, MOV, JPG, PNG
                        </>
                      )}
                    </span>
                  </button>
                </div>
                {driveEnabled && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => handleDriveImport(set.setNumber)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-sage-dark)] hover:underline disabled:opacity-50"
                  >
                    <DriveIcon className="h-3.5 w-3.5" />
                    Import from Google Drive
                  </button>
                )}
              </div>
            );
          })}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files, pendingSetRef.current);
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
