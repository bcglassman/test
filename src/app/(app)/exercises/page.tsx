"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { CategoryIcon, PlusIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";

export default function ExercisesListPage() {
  const { exercises, loading, user, authLoading } = useSessions();

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            Log in to view exercises
          </h1>
          <Link
            href="/admin/login"
            className="mt-6 rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
          >
            Log in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="exercises" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">Exercises</h1>
          <Link
            href="/exercises/new"
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New exercise
          </Link>
        </div>

        {exercises.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
            No exercises yet — add one to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {exercises.map((ex) => (
              <li
                key={ex.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]">
                    <CategoryIcon category={ex.category} className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-lg text-[var(--color-ink)]">{ex.name}</h2>
                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {ex.category} · {ex.focus}
                    </p>
                    {ex.description && (
                      <p className="mt-1 text-sm text-[var(--color-ink)]">{ex.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ex.defaultRatings.map((r) => (
                        <span
                          key={r.key}
                          className="rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
                        >
                          {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
