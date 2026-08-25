"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { useSessions } from "@/lib/sessions-context";

export default function NewExercisePage() {
  const { user, authLoading, refresh } = useSessions();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="sessions" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="sessions" />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            Log in to add an exercise
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
      <Header active="sessions" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <ExerciseForm
          onCreated={async () => {
            await refresh();
            router.push("/sessions");
          }}
          onCancel={() => router.push("/sessions")}
        />
      </main>
    </div>
  );
}
