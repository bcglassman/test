"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { CategoryIcon, PlusIcon } from "@/components/icons";
import { PillSelect } from "@/components/PillSelect";
import { useSessions } from "@/lib/sessions-context";
import { EXERCISE_CATEGORIES } from "@/lib/taxonomy";

type StatusFilter = "active" | "archived" | "all";

export default function ExerciseLibraryPage() {
  const { exercises, loading, user, authLoading } = useSessions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [focus, setFocus] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("active");

  // Only the focus values actually in use — a filter listing values nothing
  // carries is just a list of dead ends.
  const focusOptions = useMemo(() => {
    const seen = new Set<string>();
    exercises.forEach((e) => e.focus.forEach((f) => seen.add(f)));
    return [
      { value: "all", label: "Focus" },
      ...Array.from(seen)
        .sort()
        .map((f) => ({ value: f, label: f })),
    ];
  }, [exercises]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (category !== "all" && e.category !== category) return false;
      if (focus !== "all" && !e.focus.includes(focus)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        e.focus.some((f) => f.toLowerCase().includes(q)) ||
        e.equipment.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [exercises, query, category, focus, status]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="exercises" />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="exercises" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-[var(--color-ink)]">
              Exercise Library
            </h1>
            <p className="text-sm text-[var(--color-ink-soft)]">
              What the exercise is, what it trains, how it&rsquo;s measured and
              how it should be rated.
            </p>
          </div>
          {user && (
            <Link
              href="/exercises/new"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              New exercise
            </Link>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            aria-label="Search exercises"
            className="w-56 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
          />
          <PillSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "Category" },
              ...EXERCISE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
          <PillSelect
            label="Focus"
            value={focus}
            onChange={setFocus}
            options={focusOptions}
          />
          <PillSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ]}
          />
          <span className="ml-auto text-sm text-[var(--color-ink-soft)]">
            {visible.length} of {exercises.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
            Nothing matches these filters.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((ex) => (
              <li key={ex.id}>
                <Link
                  href={`/exercises/${ex.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 hover:border-[var(--color-sage)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]">
                    <CategoryIcon category={ex.category} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-serif text-lg text-[var(--color-ink)]">
                      {ex.name}
                    </span>
                    {ex.status === "archived" && (
                      <span className="ml-2 rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs text-[var(--color-ink-soft)]">
                        Archived
                      </span>
                    )}
                    <span className="block text-sm text-[var(--color-ink-soft)]">
                      {ex.category}
                      {ex.focus.length > 0 && ` · ${ex.focus.join(", ")}`}
                    </span>
                    {ex.trackingMethods.length > 0 && (
                      <span className="mt-1.5 block text-xs text-[var(--color-ink-soft)]">
                        Tracks: {ex.trackingMethods.join(" · ")}
                      </span>
                    )}
                    {/* Labels only here; the 1-5 wording lives on the
                        exercise's own page, where there's room to read it. */}
                    {ex.defaultRatings.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {ex.defaultRatings.map((r) => (
                          <span
                            key={r.key}
                            className="rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)]"
                          >
                            {r.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
