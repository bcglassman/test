"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { useSessions } from "@/lib/sessions-context";

export default function EditExercisePage() {
  const params = useParams<{ id: string }>();
  const { exercises, user, loading, authLoading } = useSessions();
  const exercise = exercises.find((e) => e.id === params.id);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!user || !exercise) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            {user ? "No such exercise" : "Log in to edit exercises"}
          </h1>
          <Link
            href={user ? "/exercises" : "/admin/login"}
            className="mt-6 text-sm underline"
          >
            {user ? "Back to the library" : "Log in"}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="exercises" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link
          href={`/exercises/${exercise.id}`}
          className="text-sm text-[var(--color-ink-soft)] hover:underline"
        >
          ← {exercise.name}
        </Link>
        <h1 className="mb-6 font-serif text-2xl text-[var(--color-ink)]">
          Edit exercise
        </h1>
        {/* Keyed so switching exercise resets the form rather than merging. */}
        <ExerciseForm key={exercise.id} initial={exercise} />
      </main>
    </div>
  );
}
