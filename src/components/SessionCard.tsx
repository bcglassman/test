import type { SessionWithExercise } from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CategoryIcon,
} from "./icons";
import { MediaThumb } from "./MediaThumb";
import {
  formatSessionDate,
  formatSessionTime,
  formatTimecode,
  resolveRatingDefs,
  setSummary,
} from "@/lib/session-utils";
import { formatWeather } from "@/lib/weather";

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
    (set.watchItems ?? [])
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
              {exercise.category} · {exercise.focus}
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
            {session.overall}/10
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
          .map((set) => {
            const setMedia = session.media
              .filter((m) => m.setNumber === set.setNumber)
              .sort((a, b) => a.order - b.order);
            const setWatchItems = (set.watchItems ?? []).filter((w) =>
              w.text.trim(),
            );
            const work =
              set.passes !== undefined
                ? `${set.passes} passes`
                : set.reps !== undefined
                  ? `${set.reps} reps`
                  : undefined;
            return (
              // Each set is its own card with a banded header, matching the
              // set containers in the session form — with several sets, plus
              // their clips, a run of headings alone didn't separate them.
              <div
                key={set.setNumber}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
              >
                <div className="flex items-baseline justify-between gap-3 bg-[var(--color-sage-dark)] px-4 py-2.5 text-white">
                  <h3 className="font-serif text-base leading-none">
                    Set {set.setNumber}
                  </h3>
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
                {/* Also listed under Notes on the left, gathered across the
                    whole session; here they sit with the set and its clips,
                    which is where you look while watching one back. */}
                {setWatchItems.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {setWatchItems.map((w, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5 rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
                      >
                        {w.atSeconds !== undefined && (
                          <span className="rounded bg-[var(--color-sage-tint)] px-1.5 font-semibold tabular-nums text-[var(--color-sage-dark)]">
                            {formatTimecode(w.atSeconds)}
                          </span>
                        )}
                        {w.text}
                      </li>
                    ))}
                  </ul>
                )}
                {setMedia.length > 0 && (
                  // One per row: the caption under a clip is the description
                  // of what to look for, and at half width it was clipped to
                  // a few words.
                  <div className="grid grid-cols-1 gap-4">
                    {setMedia.map((m) => (
                      <MediaThumb key={m.id} media={m} />
                    ))}
                  </div>
                )}
                </div>
              </div>
            );
          })}
      </div>
    </article>
  );
}
