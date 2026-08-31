"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { CategoryIcon, PencilIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";

function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <li
            key={v}
            className="rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
          >
            {v}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const { exercises, allSessions, user, saveExercise, loading } = useSessions();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const exercise = exercises.find((e) => e.id === params.id);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            No such exercise
          </h1>
          <Link href="/exercises" className="mt-4 text-sm underline">
            Back to the library
          </Link>
        </main>
      </div>
    );
  }

  const usedBy = allSessions.filter((s) => s.exerciseId === exercise.id).length;
  const archived = exercise.status === "archived";

  async function toggleArchive() {
    if (!exercise) return;
    setBusy(true);
    try {
      await saveExercise({
        ...exercise,
        status: archived ? "active" : "archived",
      });
      showToast(archived ? "Exercise restored" : "Exercise archived");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="exercises" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link
          href="/exercises"
          className="text-sm text-[var(--color-ink-soft)] hover:underline"
        >
          ← Exercise Library
        </Link>

        <div className="mt-2 mb-6 flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]">
            <CategoryIcon category={exercise.category} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl leading-tight text-[var(--color-ink)]">
              {exercise.name}
              {archived && (
                <span className="ml-2 rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 align-middle text-xs font-medium text-[var(--color-ink-soft)]">
                  Archived
                </span>
              )}
            </h1>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {exercise.category}
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <Link
                href={`/exercises/${exercise.id}/edit`}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-sage)]"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Edit
              </Link>
              <button
                type="button"
                onClick={toggleArchive}
                disabled={busy}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-sage)] disabled:opacity-60"
              >
                {archived ? "Restore" : "Archive"}
              </button>
            </div>
          )}
        </div>

        {archived && (
          <p className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            Archived, so it no longer appears when logging a new session. The{" "}
            {usedBy} session{usedBy === 1 ? "" : "s"} that used it — with every
            rating, video and note — are untouched.
          </p>
        )}

        <div className="flex flex-col gap-5">
          {exercise.description && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                Description
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
                {exercise.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Chips label="Focus" values={exercise.focus} />
            <Chips label="Tracking" values={exercise.trackingMethods} />
            <Chips label="Equipment" values={exercise.equipment} />
            {exercise.primaryUnit && (
              <Chips label="Primary unit" values={[exercise.primaryUnit]} />
            )}
          </div>

          {exercise.techniqueNotes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                Technique / setup
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
                {exercise.techniqueNotes}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Default ratings
            </p>
            {exercise.defaultRatings.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                None — a session logged against this will start with no ratings.
              </p>
            ) : (
              // Descriptors belong here: this is where you come to find out
              // what a 3 would mean before scoring one.
              <ol className="mt-2 flex flex-col gap-2">
                {exercise.defaultRatings.map((def, i) => (
                  <li
                    key={def.key}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      <span className="mr-2 text-[var(--color-ink-soft)]">
                        {i + 1}.
                      </span>
                      {def.label}
                      <span className="ml-1.5 text-xs font-normal text-[var(--color-ink-soft)]">
                        out of {def.max}
                      </span>
                    </p>
                    {def.scale && def.scale.length > 0 && (
                      <ol className="mt-1.5 flex flex-col gap-0.5">
                        {def.scale.map((level, n) => (
                          <li
                            key={n}
                            className="flex items-start gap-2 text-xs text-[var(--color-ink-soft)]"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-cream)] text-[10px] font-semibold">
                              {n + 1}
                            </span>
                            {level}
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-ink-soft)]">
            Logged in {usedBy} session{usedBy === 1 ? "" : "s"}.
          </p>
        </div>
      </main>
    </div>
  );
}
