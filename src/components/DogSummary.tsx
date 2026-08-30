import Link from "next/link";
import type { Dog, SessionWithExercise } from "@/lib/types";
import { DogAvatar } from "./DogAvatar";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon } from "./icons";
import { dogStats, dogSubtitle } from "@/lib/dog-utils";
import { formatSessionDate } from "@/lib/session-utils";

function Stat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-1 font-serif text-xl text-[var(--color-ink)]">
        {value}
        {trend !== undefined && trend !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 text-sm font-semibold ${
              trend > 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
            }`}
          >
            {trend > 0 ? (
              <ArrowUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownIcon className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend)}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * The band at the top of the feed: who we're looking at, what the
 * programme is working on, and how the last few sessions have gone.
 */
export function DogSummary({
  dog,
  sessions,
  showProfileLink = true,
}: {
  dog: Dog;
  sessions: SessionWithExercise[];
  /** Off on the profile page itself, where the link would point at the page you're on. */
  showProfileLink?: boolean;
}) {
  const stats = dogStats(sessions);

  return (
    <section className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start gap-4">
        <DogAvatar dog={dog} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl leading-tight text-[var(--color-ink)]">
            {dog.name}
          </h1>
          {dogSubtitle(dog) && (
            <p className="text-sm text-[var(--color-ink-soft)]">
              {dogSubtitle(dog)}
            </p>
          )}
          {dog.trainingFocus && (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-ink)]">
              {dog.trainingFocus}
            </p>
          )}
          {dog.restrictions && dog.restrictions.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {dog.restrictions.map((r, i) => (
                <li
                  key={i}
                  className="rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
                >
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
        {showProfileLink && (
          <Link
            href={`/dogs/${dog.id}`}
            className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-sage)]"
          >
            Profile
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-4">
        <Stat label="Sessions" value={String(stats.sessionCount)} />
        <Stat label="Last 7 days" value={String(stats.sessionsThisWeek)} />
        <Stat
          label="Avg overall"
          value={
            stats.averageOverall === undefined
              ? "—"
              : `${stats.averageOverall}/${stats.averageOverallMax}`
          }
          trend={stats.trend}
        />
        <Stat
          label="Last session"
          value={
            stats.lastSessionDate
              ? formatSessionDate(stats.lastSessionDate)
              : "—"
          }
        />
      </dl>
    </section>
  );
}
