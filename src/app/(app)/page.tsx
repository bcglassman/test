"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PillSelect } from "@/components/PillSelect";
import { SessionCard } from "@/components/SessionCard";
import { DogSummary } from "@/components/DogSummary";
import { useSessions } from "@/lib/sessions-context";
import type { ExerciseCategory } from "@/lib/types";

type SortOrder = "newest" | "oldest";

export default function HomePage() {
  const { sessions, exercises, dogs, selectedDog, loading } = useSessions();
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [exerciseId, setExerciseId] = useState<string>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const categoryOptions = useMemo(() => {
    const seen = new Set<ExerciseCategory>();
    exercises.forEach((e) => seen.add(e.category));
    return [
      { value: "all", label: "Category" },
      ...Array.from(seen).map((c) => ({ value: c, label: c })),
    ];
  }, [exercises]);

  const exerciseOptions = useMemo(
    () => [
      { value: "all", label: "Exercise" },
      ...exercises.map((e) => ({ value: e.id, label: e.name })),
    ],
    [exercises],
  );

  const visible = useMemo(() => {
    let list = sessions;
    if (category !== "all") {
      list = list.filter((s) => s.exercise.category === category);
    }
    if (exerciseId !== "all") {
      list = list.filter((s) => s.exerciseId === exerciseId);
    }
    list = list.slice().sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sort === "newest" ? -diff : diff;
    });
    return list;
  }, [sessions, category, exerciseId, sort]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="feed" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {selectedDog && <DogSummary dog={selectedDog} sessions={sessions} />}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCategory("all");
              setExerciseId("all");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === "all" && exerciseId === "all"
                ? "bg-[var(--color-sage)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-sage)]"
            }`}
          >
            All
          </button>
          <PillSelect
            label="Category"
            value={category}
            onChange={(v) => setCategory(v as ExerciseCategory | "all")}
            options={categoryOptions}
          />
          <PillSelect
            label="Exercise"
            value={exerciseId}
            onChange={setExerciseId}
            options={exerciseOptions}
          />
          <div className="ml-auto">
            <PillSelect
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as SortOrder)}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
            Loading sessions…
          </p>
        ) : dogs.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
            No dogs yet — add one in the Admin area to start logging sessions.
          </p>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
            {selectedDog
              ? `No sessions for ${selectedDog.name} match these filters yet.`
              : "No sessions match these filters yet."}
          </p>
        ) : (
          <div>
            {visible.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
