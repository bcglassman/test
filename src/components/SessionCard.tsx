import type { SessionWithExercise } from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CategoryIcon,
} from "./icons";
import { MediaThumb } from "./MediaThumb";
import { formatSessionDate, formatSessionTime } from "@/lib/session-utils";

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
  const countLabel = session.passes
    ? `${session.sets ?? "—"} sets · ${session.passes} passes`
    : session.sets
      ? `${session.sets} sets · ${session.reps} reps`
      : undefined;

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

        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {session.ratings.map((r) => (
            <div key={r.key}>
              <dt className="text-xs text-[var(--color-ink-soft)]">{r.label}</dt>
              <dd className="text-lg font-semibold text-[var(--color-ink)]">
                {r.score}
              </dd>
            </div>
          ))}
        </dl>

        {countLabel && (
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-ink-soft)]">
            <span>{countLabel}</span>
            {session.restLabel && <span>Rest {session.restLabel}</span>}
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

      <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
        {session.media
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((m) => (
            <MediaThumb key={m.id} media={m} />
          ))}
      </div>
    </article>
  );
}
