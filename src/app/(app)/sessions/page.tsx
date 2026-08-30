"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { SessionsSidebar } from "@/components/admin/SessionsSidebar";
import { SessionForm } from "@/components/admin/SessionForm";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { TrainingSession } from "@/lib/types";
import { formatSessionDate } from "@/lib/session-utils";

/**
 * useSearchParams needs a Suspense boundary above it or the page can't be
 * prerendered — it depends on the request URL, which isn't known at build
 * time. The fallback is the same "Loading…" the page shows while its data
 * arrives, so nothing flashes.
 */
export default function SessionsAdminPage() {
  return (
    <Suspense fallback={<SessionsLoading />}>
      <SessionsAdminContent />
    </Suspense>
  );
}

function SessionsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header active="sessions" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
        Loading…
      </main>
    </div>
  );
}

function SessionsAdminContent() {
  const {
    sessions,
    exercises,
    selectedDog,
    dogs,
    loading,
    saveSession,
    deleteSession,
    user,
    authLoading,
  } = useSessions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "new">("new");
  // Bumped on every request for a blank form, so the form remounts (and
  // clears) even when clicking "Add session" or "Cancel" while already
  // in new mode, where selectedId/mode wouldn't otherwise change.
  const [newFormKey, setNewFormKey] = useState(0);

  // Arriving from a plan cell: "/sessions?exercise=3&date=…&dog=1" opens a
  // blank form already pointed at that exercise on that day. Held in state
  // rather than read on every render so that editing the form afterwards
  // isn't fighting the URL.
  const searchParams = useSearchParams();
  const [prefill, setPrefill] = useState<{
    exerciseId?: string;
    date?: string;
  } | null>(null);
  const prefillExercise = searchParams.get("exercise");
  const prefillDate = searchParams.get("date");
  useEffect(() => {
    if (!prefillExercise && !prefillDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on arrival
    setPrefill({
      exerciseId: prefillExercise ?? undefined,
      date: prefillDate ?? undefined,
    });
    setSelectedId(null);
    setMode("new");
    setNewFormKey((k) => k + 1);
  }, [prefillExercise, prefillDate]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const activeSession: TrainingSession | null =
    mode === "edit" && selected
      ? {
          id: selected.id,
          dogId: selected.dogId,
          exerciseId: selected.exerciseId,
          date: selected.date,
          sets: selected.sets,
          restLabel: selected.restLabel,
          notes: selected.notes,
          environment: selected.environment,
          locationName: selected.locationName,
          latitude: selected.latitude,
          longitude: selected.longitude,
          weather: selected.weather,
          media: selected.media,
        }
      : null;

  async function handleSave(session: TrainingSession) {
    setPrefill(null);
    const isNew = !session.id;
    const saved = await saveSession(session);
    setSelectedId(saved.id);
    setMode("edit");
    showToast(isNew ? "Session added" : "Session saved");
  }

  async function handleDelete(id: string) {
    const target = sessions.find((s) => s.id === id);
    const ok = await confirm({
      title: "Delete this session?",
      message: target
        ? `${target.exercise.name} on ${formatSessionDate(target.date)}, with its ${target.sets.length} set(s) and ${target.media.length} media item(s). This can't be undone.`
        : "This can't be undone.",
      confirmLabel: "Delete session",
    });
    if (!ok) return;
    await deleteSession(id);
    if (selectedId === id) {
      setSelectedId(null);
      setMode("new");
    }
    showToast("Session deleted");
  }

  if (loading || authLoading) {
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
            Log in to add or edit sessions
          </h1>
          <p className="mt-2 max-w-sm text-sm text-[var(--color-ink-soft)]">
            The training feed is open to everyone, but logging a session
            requires an account.
          </p>
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

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="sessions" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          No exercises yet —{" "}
          <Link href="/exercises/new" className="underline">
            add one
          </Link>{" "}
          before logging a session.
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="sessions" />
      {dogs.length === 0 && (
        // Not a gate: existing sessions still need to be readable and
        // editable. A session logged now simply has no dog attached, which
        // is the same state every session was in before dogs existed.
        <p className="mx-auto w-full max-w-6xl px-6 pt-6 text-sm text-[var(--color-ink-soft)]">
          No dogs on record yet — sessions logged now won&rsquo;t be attached to
          one.{" "}
          <Link href="/manage/dogs/new" className="underline">
            Add a dog
          </Link>
          .
        </p>
      )}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:flex-row">
        <SessionsSidebar
          sessions={sessions}
          selectedId={mode === "edit" ? selectedId : null}
          onSelect={(id) => {
            setSelectedId(id);
            setMode("edit");
          }}
          onAddNew={() => {
            setSelectedId(null);
            setMode("new");
            setNewFormKey((k) => k + 1);
          }}
          onDelete={handleDelete}
        />
        <SessionForm
          key={mode === "edit" ? selectedId ?? "new" : `new-${newFormKey}`}
          exercises={exercises}
          dog={selectedDog}
          prefill={mode === "new" ? prefill : null}
          session={activeSession}
          onSave={handleSave}
          onCancel={() => {
            setSelectedId(null);
            setMode("new");
            setNewFormKey((k) => k + 1);
          }}
        />
      </main>
    </div>
  );
}
