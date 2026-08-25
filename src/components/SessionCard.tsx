import type { SessionWithExercise } from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CategoryIcon,
} from "./icons";
import { MediaThumb } from "./MediaThumb";
import { formatSessionDate, formatSessionTime, setSummary } from "@/lib/session-utils";

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

  return (
    <article className="flex flex-col gap-5 border-b border-[var(--color-border)] py-8 first:pt-0 lg:flex-row">
      <div className="w-full shrink-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 lg:w-[380px]">
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

        <dl className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3 text-center">
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

        {session.environment && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Environment
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
              {session.environment}
            </p>
          </div>
        )}

        {session.notes && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Notes
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
              {session.notes}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {session.sets
          .filter(
            (set) =>
              set.notes ||
              session.media.some((m) => m.setNumber === set.setNumber),
          )
          .map((set) => {
            const setMedia = session.media
              .filter((m) => m.setNumber === set.setNumber)
              .sort((a, b) => a.order - b.order);
            const work =
              set.passes !== undefined
                ? `${set.passes} passes`
                : set.reps !== undefined
                  ? `${set.reps} reps`
                  : undefined;
            return (
              <div key={set.setNumber}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Set {set.setNumber}
                  {work && ` · ${work}`}
                </p>
                {set.notes && (
                  <p className="mb-2 text-sm leading-relaxed text-[var(--color-ink)]">
                    {set.notes}
                  </p>
                )}
                {setMedia.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {setMedia.map((m) => (
                      <MediaThumb key={m.id} media={m} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </article>
  );
}
