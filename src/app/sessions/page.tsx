"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { SessionsSidebar } from "@/components/admin/SessionsSidebar";
import { SessionForm } from "@/components/admin/SessionForm";
import { useSessions } from "@/lib/sessions-context";
import type { TrainingSession } from "@/lib/types";

export default function SessionsAdminPage() {
  const { sessions, exercises, loading, saveSession, deleteSession } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "new">("new");
  // Bumped on every request for a blank form, so the form remounts (and
  // clears) even when clicking "Add session" or "Cancel" while already
  // in new mode, where selectedId/mode wouldn't otherwise change.
  const [newFormKey, setNewFormKey] = useState(0);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const activeSession: TrainingSession | null =
    mode === "edit" && selected
      ? {
          id: selected.id,
          exerciseId: selected.exerciseId,
          date: selected.date,
          ratings: selected.ratings,
          sets: selected.sets,
          reps: selected.reps,
          passes: selected.passes,
          restLabel: selected.restLabel,
          notes: selected.notes,
          media: selected.media,
        }
      : null;

  async function handleSave(session: TrainingSession) {
    await saveSession(session);
    setSelectedId(session.id);
    setMode("edit");
  }

  async function handleDelete(id: string) {
    await deleteSession(id);
    if (selectedId === id) {
      setSelectedId(null);
      setMode("new");
    }
  }

  if (loading || exercises.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="sessions" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="sessions" />
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
