"use client";

import Link from "next/link";
import type { PlannedCell } from "@/lib/plan-utils";
import { formatPlannedDuration } from "@/lib/plan-utils";
import { PLAN_INTENSITY_LABELS } from "@/lib/types";
import { INTENSITY_STYLE } from "./intensity";
import { CalendarIcon, PencilIcon, PlusIcon } from "../icons";

const STATUS_BADGE: Record<PlannedCell["status"], { label: string; className: string } | null> = {
  done: {
    label: "Done",
    className: "bg-[var(--color-up)] text-white",
  },
  missed: {
    label: "Not logged",
    className: "bg-[var(--color-down)] text-white",
  },
  upcoming: null,
  untracked: null,
};

/** One planned activity inside a calendar cell. */
export function PlannedItemCard({
  cell,
  canEdit,
  onEdit,
  logHref,
}: {
  cell: PlannedCell;
  canEdit: boolean;
  onEdit: () => void;
  /** Prefilled session form for this item's day; absent without an exercise. */
  logHref?: string;
}) {
  const { item, status } = cell;
  const style = INTENSITY_STYLE[item.intensity];
  const duration = formatPlannedDuration(item);
  const badge = item.optional && status === "missed" ? null : STATUS_BADGE[status];

  return (
    <div className={`rounded-lg border p-2.5 text-left ${style.cell}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase leading-tight tracking-wide text-[var(--color-ink)]">
          {item.optional && (
            <span className="font-normal normal-case text-[var(--color-ink-soft)]">
              Optional ·{" "}
            </span>
          )}
          {item.title}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.title}`}
            className="shrink-0 rounded p-0.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-soft)]">
        <span className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {PLAN_INTENSITY_LABELS[item.intensity]}
        </span>
        {duration && <span>{duration}</span>}
      </p>

      {item.detail && (
        <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-[var(--color-ink)]">
          {item.detail}
        </p>
      )}

      {item.stopRule && (
        // Kept out of the instructions on purpose: this is the line that
        // says when to stop, and it shouldn't have to be read for.
        <p className="mt-1.5 rounded border border-[var(--color-down)]/35 bg-white/60 px-1.5 py-1 text-[11px] font-medium text-[var(--color-down)]">
          {item.stopRule}
        </p>
      )}

      {item.alternatives && item.alternatives.length > 0 && (
        <div className="mt-1.5 border-t border-black/10 pt-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Or instead
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {item.alternatives.map((alt, i) => (
              <li key={i} className="text-[11px] leading-snug text-[var(--color-ink)]">
                <span className="font-medium">{alt.title}</span>
                {alt.detail && (
                  <span className="text-[var(--color-ink-soft)]"> — {alt.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
        {/* Only worth saying once the day has gone: on a future day it is
            just noise on every unlinked item, and there are a lot of them. */}
        {status === "untracked" && cell.dayIsPast && (
          <span
            title="No exercise is linked, so a logged session can't be matched to this"
            className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-soft)]"
          >
            Not tracked
          </span>
        )}
        {status === "done" && cell.session && (
          <span className="text-[10px] text-[var(--color-ink-soft)]">
            {cell.session.overall}/{cell.session.overallMax}
          </span>
        )}
        {logHref && status !== "done" && (
          <Link
            href={logHref}
            className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[var(--color-sage-dark)] hover:bg-white"
          >
            <PlusIcon className="h-2.5 w-2.5" />
            Log
          </Link>
        )}
      </div>
    </div>
  );
}

/** A logged session as it appears in the Actual view. */
export function ActualItemCard({
  entry,
}: {
  entry: { session: { id: string; date: string; overall: number; overallMax: number; exercise: { name: string } }; onPlan: boolean };
}) {
  const { session, onPlan } = entry;
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        onPlan
          ? "border-[var(--color-up)]/35 bg-[var(--color-up)]/10"
          : "border-dashed border-[var(--color-down)]/40 bg-[var(--color-down)]/5"
      }`}
    >
      <p className="text-xs font-semibold leading-tight text-[var(--color-ink)]">
        {session.exercise.name}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--color-ink-soft)]">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {new Date(session.date).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span>
          {session.overall}/{session.overallMax}
        </span>
      </p>
      <span
        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          onPlan
            ? "bg-[var(--color-up)] text-white"
            : "bg-[var(--color-down)] text-white"
        }`}
      >
        {onPlan ? "On plan" : "Off plan"}
      </span>
    </div>
  );
}
