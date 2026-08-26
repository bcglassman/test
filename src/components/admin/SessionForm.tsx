"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Dog,
  Exercise,
  MediaItem,
  RatingDefinition,
  SessionSet,
  TrainingSession,
} from "@/lib/types";
import {
  CategoryIcon,
  CloseIcon,
  DriveIcon,
  PawIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { MediaEditorCard } from "./MediaEditorCard";
import { useConfirm } from "@/components/ConfirmDialog";
import { RatingDefModal } from "./RatingDefModal";
import { mediaFromFile } from "@/lib/media-utils";
import {
  aggregateRatings,
  describeScore,
  formatDuration,
  resolveRatingDefs,
  totalActiveMovementSeconds,
} from "@/lib/session-utils";
import {
  downloadDriveFile,
  fetchCapturedAt,
  isGoogleDriveConfigured,
  pickDriveFiles,
} from "@/lib/google-drive";
import {
  DEFAULT_LOCATION,
  LOCATION_PRESETS,
  fetchWeatherAt,
  formatWeather,
  geocodeLocation,
} from "@/lib/weather";

const REST_PRESETS = ["None", "~30 sec", "~45 sec", "~60 sec", "~90 sec", "~2 min", "~5 min", "~10 min"];

function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** A set's ratings for the given dimensions, keeping any score that still applies. */
function ratingsForDefs(
  defs: RatingDefinition[],
  existing?: SessionSet,
): SessionSet["ratings"] {
  return defs.map((def) => {
    const priorScore = existing?.ratings.find((r) => r.key === def.key)?.score;
    return { key: def.key, score: priorScore ?? Math.round(def.max / 2) };
  });
}

function blankSet(
  defs: RatingDefinition[],
  setNumber: number,
  template?: SessionSet,
): SessionSet {
  return {
    setNumber,
    // Carry the previous set's rep count forward — sets usually repeat.
    reps: template?.reps ?? 6,
    passes: template?.passes,
    notes: "",
    watchItems: [],
    ratings: ratingsForDefs(defs),
  };
}

/** Re-seeds every set's ratings against a new set of dimensions, keeping the rest. */
function setsForDefs(defs: RatingDefinition[], existing: SessionSet[]): SessionSet[] {
  return existing.map((set) => ({ ...set, ratings: ratingsForDefs(defs, set) }));
}

function blankFromExercise(exercise: Exercise): TrainingSession {
  // The exercise's dimensions are a starting template; the session owns its
  // own copy from here on.
  const defs = exercise.defaultRatings;
  return {
    // Empty id marks a session that hasn't been created in the CMS yet;
    // saveSession() uses this to decide POST (create) vs PATCH (update).
    id: "",
    exerciseId: exercise.id,
    date: toDateTimeLocal(new Date().toISOString()),
    sets: [1, 2, 3].map((n) => blankSet(defs, n)),
    ratingDefs: defs,
    restLabel: "~60 sec",
    notes: "",
    locationName: DEFAULT_LOCATION.name,
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    media: [],
  };
}

export function SessionForm({
  exercises,
  dog,
  session,
  onSave,
  onCancel,
}: {
  exercises: Exercise[];
  /** The dog this session is being logged against; stamped onto new ones. */
  dog: Dog | null;
  session: TrainingSession | null;
  onSave: (session: TrainingSession) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TrainingSession>(() => {
    if (!session) return blankFromExercise(exercises[0]);
    const ex = exercises.find((e) => e.id === session.exerciseId) ?? exercises[0];
    const defs = resolveRatingDefs(session, ex);
    const sets = session.sets.length
      ? setsForDefs(defs, session.sets)
      : [blankSet(defs, 1)];
    return { ...session, date: toDateTimeLocal(session.date), sets, ratingDefs: defs };
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
  // The form's own list is authoritative once it's initialised — including
  // when it's empty. Falling back to the exercise here made removing the
  // last rating silently resurrect the exercise's defaults, which then
  // vanished again the moment another rating was added.
  const ratingDefs = form.ratingDefs ?? [];
  const totalActiveSeconds = totalActiveMovementSeconds(form);
  // null = closed; { def: undefined } = adding; { def } = editing that one.
  const [ratingModal, setRatingModal] = useState<{
    def?: RatingDefinition;
  } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const confirm = useConfirm();
  const [scrolled, setScrolled] = useState(false);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Expanded, the summary is tall enough to swallow a third of the screen.
  // Once you scroll into the sets it drops to the compact aggregate row, so
  // it stays a reference rather than an obstacle.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const summaryExpanded = summaryOpen && !scrolled;

  /**
   * Looks the weather up once and stores it on the session — a past
   * session's conditions don't change, and storing them keeps the record
   * intact even if the service is unavailable later.
   */
  async function lookUpWeather() {
    if (weatherBusy) return;
    setWeatherBusy(true);
    setWeatherError(null);
    try {
      let { latitude, longitude } = form;
      if (latitude == null || longitude == null) {
        const place = await geocodeLocation(form.locationName ?? DEFAULT_LOCATION.name);
        if (!place) {
          setWeatherError("Couldn't find that location.");
          return;
        }
        ({ latitude, longitude } = place);
        setForm((f) => ({ ...f, latitude, longitude }));
      }
      const reading = await fetchWeatherAt(
        latitude,
        longitude,
        new Date(form.date).toISOString(),
      );
      if (!reading) {
        setWeatherError("No weather available for that date and place.");
        return;
      }
      setForm((f) => ({ ...f, weather: reading }));
    } catch {
      setWeatherError("Couldn't reach the weather service.");
    } finally {
      setWeatherBusy(false);
    }
  }

  function updateSetRating(setNumber: number, key: string, score: number) {
    setForm((f) => ({
      ...f,
      sets: f.sets.map((s) =>
        s.setNumber === setNumber
          ? { ...s, ratings: s.ratings.map((r) => (r.key === key ? { ...r, score } : r)) }
          : s,
      ),
    }));
  }

  function updateSet(setNumber: number, patch: Partial<SessionSet>) {
    setForm((f) => ({
      ...f,
      sets: f.sets.map((s) => (s.setNumber === setNumber ? { ...s, ...patch } : s)),
    }));
  }

  function addSet() {
    setForm((f) => {
      const next = f.sets.length + 1;
      return {
        ...f,
        sets: [
          ...f.sets,
          blankSet(ratingDefs, next, f.sets[f.sets.length - 1]),
        ],
      };
    });
  }

  /** Removes a set, renumbers those after it, and moves its media rather than orphaning it. */
  async function removeSet(setNumber: number) {
    const clips = form.media.filter((m) => m.setNumber === setNumber).length;
    const ok = await confirm({
      title: `Remove set ${setNumber}?`,
      message: clips
        ? `Its scores and notes are discarded. Its ${clips} media item(s) move to the previous set rather than being deleted.`
        : "Its scores and notes are discarded.",
      confirmLabel: "Remove set",
    });
    if (!ok) return;
    setForm((f) => {
      if (f.sets.length <= 1) return f;
      const sets = f.sets
        .filter((s) => s.setNumber !== setNumber)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      const lastSet = sets.length;
      return {
        ...f,
        sets,
        media: f.media.map((m) => {
          if (m.setNumber === setNumber) {
            // Its set is gone — park it on the set that took its place.
            return { ...m, setNumber: Math.min(setNumber, lastSet) };
          }
          return m.setNumber > setNumber ? { ...m, setNumber: m.setNumber - 1 } : m;
        }),
      };
    });
  }

  /** Switching exercise adopts that exercise's dimensions as the new template. */
  function handleExerciseChange(exerciseId: string) {
    const next = exercises.find((e) => e.id === exerciseId);
    if (!next) return;
    setForm((f) => ({
      ...f,
      exerciseId,
      ratingDefs: next.defaultRatings,
      sets: setsForDefs(next.defaultRatings, f.sets),
    }));
  }

  function saveRatingDef(def: RatingDefinition) {
    setForm((f) => {
      const defs = f.ratingDefs ?? [];
      const exists = defs.some((d) => d.key === def.key);
      const nextDefs = exists
        ? defs.map((d) => (d.key === def.key ? def : d))
        : [...defs, def];
      return { ...f, ratingDefs: nextDefs, sets: setsForDefs(nextDefs, f.sets) };
    });
    setRatingModal(null);
  }

  async function removeRatingDef(key: string) {
    const def = ratingDefs.find((d) => d.key === key);
    const ok = await confirm({
      title: `Remove the ${def?.label ?? "rating"} rating?`,
      message: `It's dropped from every set in this session, along with the scores recorded against it. Other sessions and the exercise itself are unaffected.`,
      confirmLabel: "Remove rating",
    });
    if (!ok) return;
    setForm((f) => {
      const nextDefs = (f.ratingDefs ?? []).filter((d) => d.key !== key);
      return {
        ...f,
        ratingDefs: nextDefs,
        sets: f.sets.map((s) => ({
          ...s,
          ratings: s.ratings.filter((r) => r.key !== key),
        })),
      };
    });
  }

  function updateWatchItem(setNumber: number, index: number, value: string) {
    setForm((f) => ({
      ...f,
      sets: f.sets.map((s) =>
        s.setNumber === setNumber
          ? {
              ...s,
              watchItems: (s.watchItems ?? []).map((w, i) =>
                i === index ? value : w,
              ),
            }
          : s,
      ),
    }));
  }

  function addWatchItem(setNumber: number) {
    setForm((f) => ({
      ...f,
      sets: f.sets.map((s) =>
        s.setNumber === setNumber
          ? { ...s, watchItems: [...(s.watchItems ?? []), ""] }
          : s,
      ),
    }));
  }

  function removeWatchItem(setNumber: number, index: number) {
    setForm((f) => ({
      ...f,
      sets: f.sets.map((s) =>
        s.setNumber === setNumber
          ? { ...s, watchItems: (s.watchItems ?? []).filter((_, i) => i !== index) }
          : s,
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

  async function removeMedia(id: string) {
    const target = form.media.find((m) => m.id === id);
    const ok = await confirm({
      title: "Remove this media?",
      message: `${target?.label || "This item"} is removed from the session. The uploaded file itself stays in the media library.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
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
      await onSave({
        ...form,
        // An existing session keeps whichever dog it was logged against;
        // a new one belongs to whoever is selected in the header.
        dogId: form.dogId ?? dog?.id,
        date: new Date(form.date).toISOString(),
      });
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
        {dog && (
          <span className="ml-2 text-base text-[var(--color-ink-soft)]">
            for {dog.name}
          </span>
        )}
      </h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
      </div>

      {/* Session Summary sits above the sets and sticks to the top: the
          aggregate is the thing you keep checking while editing sets below. */}
      <div className="sticky top-0 z-30 -mx-1 mt-6 px-1 pb-3 pt-1">
        <div className="rounded-2xl border-2 border-[var(--color-sage)]/35 bg-[var(--color-sage-tint)] p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PawIcon className="h-4 w-4 shrink-0 text-[var(--color-sage-dark)]" />
              <h2 className="font-serif text-lg text-[var(--color-ink)]">
                Session Summary
              </h2>
              <span className="hidden text-xs text-[var(--color-ink-soft)] sm:inline">
                · applies across every set
              </span>
            </div>
            {/* The session's timestamp lives here rather than in the fields
                above: the feed is sorted by it, so it needs to stay on
                screen while you scroll down through the sets. */}
            <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-[var(--color-ink-soft)]">
              <span className="hidden sm:inline">Date &amp; time</span>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-sage)]"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!summaryExpanded) window.scrollTo({ top: 0, behavior: "smooth" });
                setSummaryOpen(!summaryExpanded);
              }}
              aria-expanded={summaryExpanded}
              className="shrink-0 rounded-full border border-[var(--color-sage)]/40 px-3 py-1 text-xs font-medium text-[var(--color-sage-dark)] hover:bg-white/60"
            >
              {summaryExpanded ? "Collapse" : "Expand"}
            </button>
          </div>

          {/* Always visible, collapsed or not — the at-a-glance row. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {aggregateRatings(form, exercise).map((r) => (
              <span key={r.key}>
                <span className="text-[var(--color-ink-soft)]">{r.label}</span>{" "}
                <span className="font-semibold text-[var(--color-ink)]">
                  {r.score}
                </span>
              </span>
            ))}
            <span className="ml-auto rounded-full bg-white/70 px-3 py-1 text-xs">
              <span className="text-[var(--color-ink-soft)]">
                Total active movement
              </span>{" "}
              <span className="font-semibold text-[var(--color-ink)]">
                {formatDuration(totalActiveSeconds)}
              </span>
            </span>
          </div>

          {summaryExpanded && (
            <div className="mt-4 border-t border-[var(--color-sage)]/25 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                    Rest between sets
                  </span>
                  <select
                    value={form.restLabel ?? "None"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, restLabel: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
                  >
                    {REST_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
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
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                    Location
                  </span>
                  <input
                    list="location-presets"
                    value={form.locationName ?? ""}
                    onChange={(e) =>
                      // Clear the coordinates so the next lookup re-geocodes.
                      setForm((f) => ({
                        ...f,
                        locationName: e.target.value,
                        latitude: undefined,
                        longitude: undefined,
                      }))
                    }
                    placeholder={DEFAULT_LOCATION.name}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
                  />
                  <datalist id="location-presets">
                    {LOCATION_PRESETS.map((p) => (
                      <option key={p.name} value={p.name} />
                    ))}
                  </datalist>
                </label>

                <div>
                  <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                    Weather
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2.5 text-sm text-[var(--color-ink)]">
                      {formatWeather(form.weather) ?? (
                        <span className="text-[var(--color-ink-soft)]">
                          Not looked up yet
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={lookUpWeather}
                      disabled={weatherBusy}
                      className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm font-medium text-[var(--color-sage-dark)] hover:border-[var(--color-sage)] disabled:opacity-50"
                    >
                      {weatherBusy ? "Looking up…" : "Look up"}
                    </button>
                  </div>
                  {weatherError && (
                    <p className="mt-1 text-xs text-[var(--color-down)]">
                      {weatherError}
                    </p>
                  )}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                  Session notes
                </span>
                <textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="How the session went overall"
                  className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-sage)]"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-[var(--color-ink-soft)]">Sets</h2>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Each set holds its own reps, scores, notes and media.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {form.sets.map((set) => {
            const setMedia = sortedMedia.filter((m) => m.setNumber === set.setNumber);
            const busy = isUploading && uploadingSet === set.setNumber;
            const usesPasses = set.passes !== undefined;
            return (
              <div
                key={set.setNumber}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
              >
                {/* Dark band so each set reads as its own component. */}
                <div className="flex items-center justify-between bg-[var(--color-sage-dark)] px-4 py-2.5 text-white">
                  <h3 className="font-serif text-lg">Set {set.setNumber}</h3>
                  {form.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(set.setNumber)}
                      aria-label={`Remove set ${set.setNumber}`}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Remove set
                    </button>
                  )}
                </div>
                <div className="p-4">

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
                      {usesPasses ? "Passes" : "Reps"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={(usesPasses ? set.passes : set.reps) ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? undefined : Number(e.target.value);
                        updateSet(set.setNumber, usesPasses ? { passes: v } : { reps: v });
                      }}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        updateSet(
                          set.setNumber,
                          usesPasses
                            ? { reps: set.passes, passes: undefined }
                            : { passes: set.reps, reps: undefined },
                        )
                      }
                      className="pb-2 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
                    >
                      Count in {usesPasses ? "reps" : "passes"} instead
                    </button>
                  </div>
                </div>

                {ratingDefs.length === 0 ? (
                  <div className="mt-4 rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 text-center">
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      No ratings for this session
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--color-ink-soft)]">
                      Every set is scored against the same set of ratings. Add
                      one to start scoring, or pick from the library.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRatingModal({})}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add a rating
                    </button>
                  </div>
                ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {ratingDefs.map((def) => {
                    const score =
                      set.ratings.find((r) => r.key === def.key)?.score ??
                      Math.round(def.max / 2);
                    const min = def.scale ? 1 : 0;
                    const description = describeScore(def, score);
                    return (
                      <div
                        key={def.key}
                        className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm text-[var(--color-ink-soft)]">
                            {def.label}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-[var(--color-ink)]">
                              {score}
                              <span className="text-sm font-normal text-[var(--color-ink-soft)]">
                                /{def.max}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setRatingModal({ def })}
                              aria-label={`Edit ${def.label} rating`}
                              className="rounded p-1 text-[var(--color-ink-soft)]/60 transition-colors hover:bg-white hover:text-[var(--color-ink)]"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRatingDef(def.key)}
                              aria-label={`Remove ${def.label} rating`}
                              className="rounded p-1 text-[var(--color-ink-soft)]/60 transition-colors hover:bg-white hover:text-[var(--color-down)]"
                            >
                              <CloseIcon className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={def.max}
                          step={0.5}
                          value={score}
                          onChange={(e) =>
                            updateSetRating(set.setNumber, def.key, Number(e.target.value))
                          }
                          className="mt-2 w-full accent-[var(--color-sage)]"
                        />
                        <p className="mt-1 min-h-[2rem] text-xs leading-snug text-[var(--color-ink-soft)]">
                          {description}
                        </p>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setRatingModal({})}
                    className="flex min-h-[5rem] items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--color-border)] p-3 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-sage-dark)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add rating
                  </button>
                </div>
                )}

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
                    Set notes
                  </span>
                  <textarea
                    rows={3}
                    value={set.notes ?? ""}
                    onChange={(e) => updateSet(set.setNumber, { notes: e.target.value })}
                    placeholder="What happened in this set specifically"
                    className="min-h-[4.5rem] w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-sage)]"
                  />
                </label>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-ink-soft)]">
                      Watch items
                    </span>
                    <button
                      type="button"
                      onClick={() => addWatchItem(set.setNumber)}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
                    >
                      <PlusIcon className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                  {(set.watchItems ?? []).length === 0 ? (
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      Nothing flagged for this set.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {(set.watchItems ?? []).map((item, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <input
                            value={item}
                            onChange={(e) =>
                              updateWatchItem(set.setNumber, i, e.target.value)
                            }
                            maxLength={140}
                            placeholder="e.g. left knee flaring"
                            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
                          />
                          <button
                            type="button"
                            onClick={() => removeWatchItem(set.setNumber, i)}
                            aria-label={`Remove watch item ${i + 1}`}
                            className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
                          >
                            <CloseIcon className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4">
                  <span className="mb-2 block text-xs font-medium text-[var(--color-ink-soft)]">
                    Media
                  </span>
                  <div className="flex flex-col gap-4">
                    {setMedia.map((m, i) => (
                      <MediaEditorCard
                        key={m.id}
                        media={m}
                        isFirst={i === 0}
                        isLast={i === setMedia.length - 1}
                        setCount={form.sets.length}
                        onChange={(patch) => updateMedia(m.id, patch)}
                        onRemove={() => removeMedia(m.id)}
                        onMove={(dir) => moveMedia(m.id, dir)}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => {
                        pendingSetRef.current = set.setNumber;
                        fileInputRef.current?.click();
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] px-4 py-3 text-center text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-sage-dark)] disabled:opacity-50"
                    >
                      <UploadIcon className="h-5 w-5 shrink-0" />
                      <span className="leading-snug">
                        {busy
                          ? driveStatus ??
                            (compressPercent !== null
                              ? `Compressing… ${compressPercent}%`
                              : "Uploading…")
                          : `Add media to set ${set.setNumber}`}
                      </span>
                    </button>
                    {driveEnabled && (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleDriveImport(set.setNumber)}
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-sage-dark)] hover:border-[var(--color-sage)] disabled:opacity-50"
                      >
                        <DriveIcon className="h-4 w-4" />
                        Google Drive
                      </button>
                    )}
                  </div>
                </div>
                </div>
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

          <button
            type="button"
            onClick={addSet}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--color-sage-dark)] hover:underline"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add set
          </button>
        </div>
      </div>

      {/* Deliberately a different surface from the set cards: this is the
          session as a whole, not another set in the list. */}

      {ratingModal && (
        <RatingDefModal
          initial={ratingModal.def}
          existingKeys={ratingDefs.map((d) => d.key)}
          onSave={saveRatingDef}
          onClose={() => setRatingModal(null)}
        />
      )}

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
