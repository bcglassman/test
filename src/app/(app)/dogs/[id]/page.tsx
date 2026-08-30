"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { DogSummary } from "@/components/DogSummary";
import { CategoryIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";
import { sessionsForDog } from "@/lib/dog-utils";
import type { ExerciseCategory } from "@/lib/types";
import { formatSessionDate, setSummary } from "@/lib/session-utils";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-[var(--color-ink)]">
        {children}
      </div>
    </section>
  );
}

export default function DogProfilePage() {
  const params = useParams<{ id: string }>();
  const { allSessions, dogs, allDogs, user, loading } = useSessions();
  const dog = allDogs.find((d) => d.id === params.id) ?? null;

  const sessions = useMemo(
    () => (dog ? sessionsForDog(allSessions, dog.id, dogs[0]?.id) : []),
    [allSessions, dog, dogs],
  );

  // How much work has gone into each exercise, most-trained first.
  const byExercise = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; category: ExerciseCategory; count: number }
    >();
    for (const s of sessions) {
      const row = counts.get(s.exerciseId);
      if (row) row.count += 1;
      else
        counts.set(s.exerciseId, {
          name: s.exercise.name,
          category: s.exercise.category,
          count: 1,
        });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            No such dog
          </h1>
          <Link href="/" className="mt-4 text-sm underline">
            Back to the feed
          </Link>
        </main>
      </div>
    );
  }

  const facts: [string, string][] = [
    ["Breed", dog.breed ?? "—"],
    [
      "Date of birth",
      dog.dateOfBirth ? formatSessionDate(dog.dateOfBirth) : "—",
    ],
    ["Sex", dog.sex ? (dog.sex === "male" ? "Male" : "Female") : "—"],
    ["Weight", dog.weightKg ? `${dog.weightKg} kg` : "—"],
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-[var(--color-ink-soft)] hover:underline"
            >
              ← Feed
            </Link>
            <Link
              href={`/dogs/${dog.id}/plan`}
              className="font-medium text-[var(--color-sage-dark)] hover:underline"
            >
              Weekly plan
            </Link>
          </div>
          {user && (
            <Link
              href={`/manage/dogs/${dog.id}`}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-sage)]"
            >
              Edit profile
            </Link>
          )}
        </div>

        {dog.archived && (
          <p className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            {dog.name} is archived — the record is kept, but they no longer
            appear in the dog selector.
          </p>
        )}

        <DogSummary dog={dog} sessions={sessions} showProfileLink={false} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-[var(--color-ink-soft)]">
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Training goals">
            {dog.trainingGoals && dog.trainingGoals.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {dog.trainingGoals.map((goal, i) => (
                  <li key={i}>{goal}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--color-ink-soft)]">
                No goals recorded yet.
              </p>
            )}
          </Panel>

          <Panel title="Movement observations">
            {dog.movementObservations ? (
              <p className="whitespace-pre-line">{dog.movementObservations}</p>
            ) : (
              <p className="text-[var(--color-ink-soft)]">
                Nothing recorded yet.
              </p>
            )}
          </Panel>

          <Panel title="Restrictions">
            {dog.restrictions && dog.restrictions.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {dog.restrictions.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--color-ink-soft)]">None recorded.</p>
            )}
          </Panel>

          {dog.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-line">{dog.notes}</p>
            </Panel>
          )}

          <Panel title="Work by exercise">
            {byExercise.length === 0 ? (
              <p className="text-[var(--color-ink-soft)]">
                No sessions logged yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {byExercise.map((row) => (
                  <li key={row.name} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]">
                      <CategoryIcon
                        category={row.category}
                        className="h-3.5 w-3.5"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span className="text-[var(--color-ink-soft)]">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-[var(--color-ink)]">
            Recent sessions
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">
              Nothing logged for {dog.name} yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[var(--color-ink)]">
                    {s.exercise.name}
                  </span>
                  <span className="text-[var(--color-ink-soft)]">
                    {formatSessionDate(s.date)}
                  </span>
                  {setSummary(s) && (
                    <span className="text-[var(--color-ink-soft)]">
                      {setSummary(s)}
                    </span>
                  )}
                  <span className="ml-auto font-semibold text-[var(--color-ink)]">
                    {s.overall}/{s.overallMax}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>
    </div>
  );
}
