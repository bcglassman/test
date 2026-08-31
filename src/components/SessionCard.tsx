"use client";

import { useState } from "react";
import type {
  MediaItem,
  RatingDefinition,
  SessionSet,
  SessionWithExercise,
  WatchItem,
} from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CategoryIcon,
} from "./icons";
import { MediaThumb, type SeekRequest } from "./MediaThumb";
import {
  formatSessionDate,
  formatSessionTime,
  formatTimecode,
  resolveRatingDefs,
  setSummary,
  sortWatchItems,
} from "@/lib/session-utils";
import { formatWeather } from "@/lib/weather";
import { WatchItemsEditor } from "./admin/WatchItemsEditor";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "./Toast";
import { PencilIcon } from "./icons";

function Trend({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === current) return null;
  const delta = current - previous;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-semibold ${
        up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
      }`}
    >
      {up ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
      {Math.abs(delta)}
    </span>
  );
}

export function SessionCard({ session }: { session: SessionWithExercise }) {
  const { exercise } = session;
  const countLabel = setSummary(session);
  const ratingDefs = resolveRatingDefs(session, exercise);
  // Flattened so the card can list them all together, each tagged with its set.
  const watchItems = session.sets.flatMap((set) =>
    sortWatchItems(set.watchItems ?? [])
      .filter((w) => w.text.trim())
      .map((w) => ({ setNumber: set.setNumber, ...w })),
  );

  return (
    <article className="flex flex-col gap-5 border-b border-[var(--color-border)] py-8 first:pt-0 lg:flex-row">
      <div className="w-full shrink-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 lg:w-[460px]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]">
            <CategoryIcon category={exercise.category} className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl leading-tight text-[var(--color-ink)]">
              {exercise.name}
            </h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {exercise.category}
              {exercise.focus.length > 0 && ` · ${exercise.focus.join(", ")}`}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatSessionDate(session.date)} · {formatSessionTime(session.date)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-baseline gap-2 border-t border-[var(--color-border)] pt-4">
          <span className="text-sm font-medium text-[var(--color-ink-soft)]">
            Overall
          </span>
          <span className="font-serif text-lg text-[var(--color-ink)]">
            {session.overall}/{session.overallMax}
          </span>
          <Trend current={session.overall} previous={session.previousOverall} />
        </div>

        <dl className="mt-4 grid grid-cols-5 gap-x-2 gap-y-3 text-center">
          {session.ratings.map((r) => {
            const scaleText = r.scale?.[r.score - 1];
            return (
              <div
                key={r.key}
                title={scaleText}
                className="flex flex-col items-center"
              >
                <dt className="flex min-h-[2rem] items-center justify-center text-xs leading-tight text-[var(--color-ink-soft)]">
                  {r.label}
                </dt>
                <dd className="text-lg font-semibold text-[var(--color-ink)]">
                  {r.score}
                  <span className="text-xs font-normal text-[var(--color-ink-soft)]">
                    /{r.max}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        {countLabel && (
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-ink-soft)]">
            <span>{countLabel}</span>
            {session.restLabel && <span>Rest {session.restLabel}</span>}
          </div>
        )}

        {(session.environment || session.weather) && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Environment
            </p>
            {session.environment && (
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
                {session.environment}
              </p>
            )}
            {formatWeather(session.weather) && (
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {session.locationName ? `${session.locationName} · ` : ""}
                {formatWeather(session.weather)}
              </p>
            )}
          </div>
        )}

        {session.notes && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
              {session.notes}
            </p>
          </div>
        )}

        {watchItems.length > 0 && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Watch items
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {watchItems.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--color-ink)]">
                  <span className="shrink-0 rounded bg-[var(--color-cream)] px-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
                    Set {w.setNumber}
                  </span>
                  <span className="leading-5">
                    {w.text}
                    {w.atSeconds !== undefined && (
                      <span className="ml-1.5 tabular-nums text-[var(--color-ink-soft)]">
                        {formatTimecode(w.atSeconds)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {session.sets
          .filter(
            (set) =>
              set.notes ||
              set.ratings.length > 0 ||
              (set.watchItems ?? []).some((w) => w.text.trim()) ||
              session.media.some((m) => m.setNumber === set.setNumber),
          )
          .map((set) => (
            <SetBlock
              key={set.setNumber}
              session={session}
              set={set}
              ratingDefs={ratingDefs}
              media={session.media
                .filter((m) => m.setNumber === set.setNumber)
                .sort((a, b) => a.order - b.order)}
            />
          ))}
      </div>
    </article>
  );
}

/**
 * One set on the feed: its scores, note, watch items and clips.
 *
 * It owns the seek request so a watch item pinned to a moment can jump the
 * set's clip to it — the timestamp is only useful if you can get there.
 * A new nonce each click is what makes clicking the same timestamp twice
 * work, since the seconds alone wouldn't change.
 */
function SetBlock({
  session,
  set,
  ratingDefs,
  media,
}: {
  session: SessionWithExercise;
  set: SessionSet;
  ratingDefs: RatingDefinition[];
  media: MediaItem[];
}) {
  const { user, saveSession, allDogs } = useSessions();
  // Standing notes on how this dog moves, as context for reading frames.
  const dogObservations = allDogs.find((d) => d.id === session.dogId)
    ?.movementObservations;
  const { showToast } = useToast();
  const [seekTo, setSeekTo] = useState<SeekRequest | null>(null);
  const [draft, setDraft] = useState<WatchItem[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const watchItems = sortWatchItems(set.watchItems ?? []).filter((w) =>
    w.text.trim(),
  );

  // Editing writes to the same API the sessions screen does, and that API
  // requires a login (Sessions.access.update). So the check here is the
  // real one, not decoration: a signed-out visitor reads the feed.
  const canEdit = Boolean(user);

  async function saveWatchItems() {
    if (!draft) return;
    setIsSaving(true);
    try {
      await saveSession({
        ...session,
        sets: session.sets.map((s) =>
          s.setNumber === set.setNumber
            ? {
                ...s,
                watchItems: sortWatchItems(
                  draft.filter((w) => w.text.trim()),
                ),
              }
            : s,
        ),
      });
      setDraft(null);
      showToast("Watch items saved");
    } catch {
      showToast("Couldn't save — check you're still logged in.");
    } finally {
      setIsSaving(false);
    }
  }
  // Everything this set recorded, in the order it reads naturally.
  const work = [
    set.reps !== undefined && `${set.reps} reps`,
    set.repsLeft !== undefined && `${set.repsLeft}L`,
    set.repsRight !== undefined && `${set.repsRight}R`,
    set.passes !== undefined && `${set.passes} passes`,
    set.steps !== undefined && `${set.steps} steps`,
    set.intervals !== undefined && `${set.intervals} intervals`,
    set.distanceMeters !== undefined &&
      `${Math.round((set.distanceMeters / 1000) * 100) / 100} km`,
    set.durationSeconds !== undefined &&
      `${Math.round(set.durationSeconds / 60)} min`,
    set.activeDurationSeconds !== undefined &&
      `${set.activeDurationSeconds}s active`,
    set.holdSeconds !== undefined && `${set.holdSeconds}s hold`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Timestamps point at the set's clip. With more than one, the first is
  // the one they mean; with none there is nothing to jump to, so the
  // timestamp stays a label rather than pretending to be a control.
  const firstVideoId = media.find((m) => m.type === "video" && m.url)?.id;

  return (
    // Each set is its own card with a banded header, matching the set
    // containers in the session form — with several sets, plus their
    // clips, a run of headings alone didn't separate them.
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-baseline justify-between gap-3 bg-[var(--color-sage-dark)] px-4 py-2.5 text-white">
        <h3 className="font-serif text-base leading-none">Set {set.setNumber}</h3>
        {work && <span className="text-xs text-white/75">{work}</span>}
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {ratingDefs.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1">
            {ratingDefs.map((def) => {
              const score = set.ratings.find((r) => r.key === def.key)?.score;
              if (score === undefined) return null;
              return (
                <div key={def.key} className="flex gap-1.5 text-sm">
                  <dt className="text-[var(--color-ink-soft)]">{def.label}</dt>
                  <dd
                    className="font-semibold text-[var(--color-ink)]"
                    title={def.scale?.[Math.round(score) - 1]}
                  >
                    {score}
                    <span className="font-normal text-[var(--color-ink-soft)]">
                      /{def.max}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {set.notes && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
            {set.notes}
          </p>
        )}

        {/* Also listed under Notes on the left, gathered across the whole
            session; here they sit with the set and its clips, which is
            where you look while watching one back. Editable in place, so
            noticing something while watching doesn't mean a trip to the
            sessions screen. */}
        {draft !== null ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] p-3">
            <span className="mb-2 block text-xs font-medium text-[var(--color-ink-soft)]">
              Watch items
              <span className="ml-1.5 font-normal">
                · optional time in the clip
              </span>
            </span>
            <WatchItemsEditor
              items={draft}
              onChange={setDraft}
              exerciseName={session.exercise.name}
              videoUrl={media.find((m) => m.type === "video" && m.url)?.url}
              dogObservations={dogObservations}
              autoFocusLast
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={saveWatchItems}
                disabled={isSaving}
                className="rounded-full bg-[var(--color-sage)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          (watchItems.length > 0 || canEdit) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDraft(set.watchItems ?? [])}
                  className="flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-ink)]"
                >
                  <PencilIcon className="h-3 w-3" />
                  {watchItems.length > 0 ? "Edit watch items" : "Add watch item"}
                </button>
              )}
              <ul className="flex flex-wrap gap-1.5">
            {watchItems.map((w, i) => {
              const seekable = w.atSeconds !== undefined && firstVideoId;
              const body = (
                <>
                  {w.atSeconds !== undefined && (
                    <span
                      className={`rounded bg-[var(--color-sage-tint)] px-1.5 font-semibold tabular-nums text-[var(--color-sage-dark)] ${
                        seekable ? "group-hover:bg-[var(--color-sage)] group-hover:text-white" : ""
                      }`}
                    >
                      {formatTimecode(w.atSeconds)}
                    </span>
                  )}
                  {w.text}
                </>
              );
              return (
                <li key={i}>
                  {seekable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSeekTo((prev) => ({
                          seconds: w.atSeconds!,
                          nonce: (prev?.nonce ?? 0) + 1,
                        }))
                      }
                      title={`Jump to ${formatTimecode(w.atSeconds!)} in this set's clip`}
                      className="group flex items-center gap-1.5 rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-left text-xs text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-sage-tint)] hover:text-[var(--color-ink)]"
                    >
                      {body}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]">
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
              </ul>
            </div>
          )
        )}

        {media.length > 0 && (
          // One per row: the caption under a clip is the description of
          // what to look for, and at half width it was clipped to a few
          // words.
          <div className="grid grid-cols-1 gap-4">
            {media.map((m) => (
              <MediaThumb
                key={m.id}
                media={m}
                seekTo={m.id === firstVideoId ? seekTo : null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
