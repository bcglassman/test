"use client";

import { useMemo, useState } from "react";
import type { Dog, Plan, PlanCategory, PlanItem, SessionWithExercise } from "@/lib/types";
import { PLAN_CATEGORIES, PLAN_CATEGORY_LABELS, PLAN_INTENSITY_LABELS } from "@/lib/types";
import {
  DAY_LABELS,
  addWeeks,
  buildWeekView,
  cellKey,
  formatWeekRange,
  isSameDay,
  startOfWeek,
} from "@/lib/plan-utils";
import { ActualItemCard, PlannedItemCard } from "./PlannedItemCard";
import { INTENSITY_STYLE } from "./intensity";
import { ChevronRightIcon, PlusIcon } from "../icons";

type View = "planned" | "actual";

/** Prefills the session form for a plan item on a specific day. */
function logHrefFor(item: PlanItem, date: Date, dogId: string): string | undefined {
  if (!item.exerciseId) return undefined;
  // Local noon, so the date survives the form's timezone-local input.
  const at = new Date(date);
  at.setHours(12, 0, 0, 0);
  const params = new URLSearchParams({
    exercise: item.exerciseId,
    date: at.toISOString(),
    dog: dogId,
  });
  return `/sessions?${params.toString()}`;
}

export function PlanCalendar({
  dog,
  plan,
  sessions,
  canEdit,
  onEditItem,
  onAddItem,
}: {
  dog: Dog;
  plan: Plan | null;
  sessions: SessionWithExercise[];
  canEdit: boolean;
  onEditItem: (item: PlanItem) => void;
  onAddItem: (category: PlanCategory, dayOfWeek: number) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<View>("planned");

  const week = useMemo(
    () => buildWeekView(plan, sessions, weekStart),
    [plan, sessions, weekStart],
  );
  const today = new Date();
  const isThisWeek = isSameDay(weekStart, startOfWeek(today));
  const { summary } = week;

  return (
    <div>
      {/* Week navigation and view switch */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            aria-label="Previous week"
            className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-sage)]"
          >
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            aria-label="Next week"
            className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-sage)]"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <p className="font-serif text-lg leading-tight text-[var(--color-ink)]">
            {formatWeekRange(weekStart)}
          </p>
          {!isThisWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="text-xs text-[var(--color-sage-dark)] hover:underline"
            >
              Back to this week
            </button>
          )}
        </div>

        <div className="ml-auto flex rounded-full border border-[var(--color-border)] p-0.5">
          {(["planned", "actual"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v
                  ? "bg-[var(--color-sage)] text-white"
                  : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              }`}
            >
              {v === "planned" ? "Planned" : "Actual"}
            </button>
          ))}
        </div>
      </div>

      {/* How the week is going */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm">
        {/* Counted against what can actually be matched. Saying "0 of 23"
            when 19 of those have no exercise linked would read as a failed
            week rather than an untracked one. */}
        <span className="text-[var(--color-ink)]">
          <strong>{summary.doneCount}</strong> of {summary.trackedCount} tracked
          done
        </span>
        <span className="text-[var(--color-ink-soft)]">
          {summary.plannedCount} planned
        </span>
        {summary.missedCount > 0 && (
          <span className="text-[var(--color-down)]">
            {summary.missedCount} not logged
          </span>
        )}
        {summary.offPlanCount > 0 && (
          <span className="text-[var(--color-down)]">
            {summary.offPlanCount} off plan
          </span>
        )}
        {summary.untrackedCount > 0 && (
          <span
            className="text-[var(--color-ink-soft)]"
            title="Planned items with no exercise linked — nothing can be matched to them"
          >
            {summary.untrackedCount} not tracked
          </span>
        )}
        <span className="ml-auto text-[var(--color-ink-soft)]">
          {Math.round(summary.plannedMinutes)} min planned
        </span>
      </div>

      {/* Desktop: the grid, categories down and days across, as the
          spreadsheet had it. Below lg it becomes a day-at-a-time list —
          seven columns of dense text is unreadable on a phone. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-32 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                Category
              </th>
              {week.dates.map((date, day) => (
                <th
                  key={day}
                  className={`px-2 py-1 text-center text-xs font-semibold ${
                    isSameDay(date, today)
                      ? "rounded-md bg-[var(--color-sage-tint)] text-[var(--color-sage-dark)]"
                      : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  <span className="block uppercase tracking-wide">
                    {DAY_LABELS[day].slice(0, 3)}
                  </span>
                  <span className="block font-normal">
                    {date.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_CATEGORIES.map((category) => (
              <tr key={category}>
                <th className="rounded-md bg-[var(--color-cream)] px-2 py-2 text-left align-top text-xs font-semibold text-[var(--color-ink)]">
                  {PLAN_CATEGORY_LABELS[category]}
                </th>
                {week.dates.map((date, day) => {
                  const key = cellKey(category, day);
                  const cells = week.planned.get(key) ?? [];
                  const entries = week.actual.get(key) ?? [];
                  return (
                    <td
                      key={day}
                      className="group w-[13%] align-top rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-1.5"
                    >
                      <div className="flex flex-col gap-1.5">
                        {view === "planned"
                          ? cells.map((cell) => (
                              <PlannedItemCard
                                key={cell.item.id}
                                cell={cell}
                                canEdit={canEdit}
                                onEdit={() => onEditItem(cell.item)}
                                logHref={logHrefFor(cell.item, date, dog.id)}
                              />
                            ))
                          : entries.map((entry) => (
                              <ActualItemCard key={entry.session.id} entry={entry} />
                            ))}
                        {view === "planned" && canEdit && (
                          <button
                            type="button"
                            onClick={() => onAddItem(category, day)}
                            aria-label={`Add to ${PLAN_CATEGORY_LABELS[category]} on ${DAY_LABELS[day]}`}
                            // Always offered in an empty cell; elsewhere it
                            // waits for the pointer, so 42 dashed buttons
                            // don't compete with the plan itself.
                            className={`flex items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-border)] py-1 text-[10px] text-[var(--color-ink-soft)] transition-opacity hover:border-[var(--color-sage)] hover:text-[var(--color-ink)] focus-visible:opacity-100 ${
                              cells.length > 0
                                ? "opacity-0 group-hover:opacity-100"
                                : ""
                            }`}
                          >
                            <PlusIcon className="h-2.5 w-2.5" />
                            Add
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one day at a time */}
      <div className="flex flex-col gap-4 lg:hidden">
        {week.dates.map((date, day) => {
          const dayCells = PLAN_CATEGORIES.flatMap((c) =>
            (week.planned.get(cellKey(c, day)) ?? []).map((cell) => ({ c, cell })),
          );
          const dayEntries = PLAN_CATEGORIES.flatMap((c) =>
            (week.actual.get(cellKey(c, day)) ?? []).map((entry) => ({ c, entry })),
          );
          const empty =
            view === "planned" ? dayCells.length === 0 : dayEntries.length === 0;
          return (
            <section
              key={day}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
            >
              <h3
                className={`mb-2 text-sm font-semibold ${
                  isSameDay(date, today)
                    ? "text-[var(--color-sage-dark)]"
                    : "text-[var(--color-ink)]"
                }`}
              >
                {DAY_LABELS[day]}
                <span className="ml-2 font-normal text-[var(--color-ink-soft)]">
                  {date.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </h3>
              {empty ? (
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {view === "planned" ? "Nothing planned." : "Nothing logged."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {view === "planned"
                    ? dayCells.map(({ c, cell }) => (
                        <div key={cell.item.id}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                            {PLAN_CATEGORY_LABELS[c]}
                          </p>
                          <PlannedItemCard
                            cell={cell}
                            canEdit={canEdit}
                            onEdit={() => onEditItem(cell.item)}
                            logHref={logHrefFor(cell.item, date, dog.id)}
                          />
                        </div>
                      ))
                    : dayEntries.map(({ c, entry }) => (
                        <div key={entry.session.id}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                            {PLAN_CATEGORY_LABELS[c]}
                          </p>
                          <ActualItemCard entry={entry} />
                        </div>
                      ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-ink-soft)]">
        <span className="font-medium">Intensity</span>
        {(Object.keys(PLAN_INTENSITY_LABELS) as (keyof typeof PLAN_INTENSITY_LABELS)[]).map(
          (key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded border ${INTENSITY_STYLE[key].cell}`}
              />
              {PLAN_INTENSITY_LABELS[key]}
            </span>
          ),
        )}
        {view === "actual" && (
          <>
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-[var(--color-up)]/35 bg-[var(--color-up)]/10" />
              On plan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-[var(--color-down)]/40 bg-[var(--color-down)]/5" />
              Off plan
            </span>
          </>
        )}
      </div>
    </div>
  );
}
