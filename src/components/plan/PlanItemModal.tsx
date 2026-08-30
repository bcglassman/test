"use client";

import { useEffect, useState } from "react";
import type { Exercise, PlanCategory, PlanItem } from "@/lib/types";
import {
  PLAN_CATEGORIES,
  PLAN_CATEGORY_LABELS,
  PLAN_INTENSITY_LABELS,
} from "@/lib/types";
import { DAY_LABELS } from "@/lib/plan-utils";
import { CloseIcon, PlusIcon, TrashIcon } from "../icons";

const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]";

/** Add or edit one planned activity. */
export function PlanItemModal({
  initial,
  exercises,
  onSave,
  onDelete,
  onClose,
}: {
  initial: PlanItem;
  exercises: Exercise[];
  onSave: (item: PlanItem) => void;
  /** Absent when adding. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [item, setItem] = useState<PlanItem>(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function patch(next: Partial<PlanItem>) {
    setItem((v) => ({ ...v, ...next }));
  }

  const isNew = !initial.title;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add planned activity" : "Edit planned activity"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-[var(--color-ink)]">
            {isNew ? "Add to the plan" : "Edit planned activity"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Title
            </span>
            <input
              value={item.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Jog/trot intervals"
              autoFocus
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Day
            </span>
            <select
              value={item.dayOfWeek}
              onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
              className={field}
            >
              {DAY_LABELS.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Category
            </span>
            <select
              value={item.category}
              onChange={(e) =>
                patch({ category: e.target.value as PlanCategory })
              }
              className={field}
            >
              {PLAN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PLAN_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Intensity
            </span>
            <select
              value={item.intensity}
              onChange={(e) =>
                patch({ intensity: e.target.value as PlanItem["intensity"] })
              }
              className={field}
            >
              {(
                Object.keys(PLAN_INTENSITY_LABELS) as PlanItem["intensity"][]
              ).map((key) => (
                <option key={key} value={key}>
                  {PLAN_INTENSITY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Duration (min)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={item.durationMinMinutes ?? ""}
                onChange={(e) =>
                  patch({
                    durationMinMinutes: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="min"
                className={field}
              />
              <span className="text-sm text-[var(--color-ink-soft)]">–</span>
              <input
                type="number"
                min={0}
                value={item.durationMaxMinutes ?? ""}
                onChange={(e) =>
                  patch({
                    durationMaxMinutes: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="max"
                className={field}
              />
            </div>
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Exercise
              <span className="ml-1.5 font-normal">
                · links the plan to a logged session; without it this can&rsquo;t
                be ticked off
              </span>
            </span>
            <select
              value={item.exerciseId ?? ""}
              onChange={(e) =>
                patch({ exerciseId: e.target.value || undefined })
              }
              className={field}
            >
              <option value="">Not linked</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Detail
            </span>
            <textarea
              rows={3}
              value={item.detail ?? ""}
              onChange={(e) => patch({ detail: e.target.value || undefined })}
              placeholder="How to run it"
              className={field}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Stop rule
            </span>
            <input
              value={item.stopRule ?? ""}
              onChange={(e) => patch({ stopRule: e.target.value || undefined })}
              placeholder="e.g. Stop if gait changes"
              className={field}
            />
          </label>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
              Alternatives
              <span className="ml-1.5 font-normal">· any one of them counts</span>
            </span>
            <div className="flex flex-col gap-2">
              {(item.alternatives ?? []).map((alt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={alt.title}
                    onChange={(e) =>
                      patch({
                        alternatives: (item.alternatives ?? []).map((a, j) =>
                          j === i ? { ...a, title: e.target.value } : a,
                        ),
                      })
                    }
                    placeholder="e.g. Canicross"
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        alternatives: (item.alternatives ?? []).filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    aria-label={`Remove alternative ${i + 1}`}
                    className="rounded-md p-2 text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  alternatives: [...(item.alternatives ?? []), { title: "" }],
                })
              }
              className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
            >
              <PlusIcon className="h-3 w-3" />
              Add alternative
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] sm:col-span-2">
            <input
              type="checkbox"
              checked={item.optional ?? false}
              onChange={(e) => patch({ optional: e.target.checked })}
              className="accent-[var(--color-sage)]"
            />
            Optional — do it if the day allows, never counted as missed
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={!item.title.trim()}
            onClick={() =>
              onSave({
                ...item,
                title: item.title.trim(),
                alternatives: (item.alternatives ?? []).filter((a) =>
                  a.title.trim(),
                ),
              })
            }
            className="rounded-full bg-[var(--color-sage)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)]"
          >
            Cancel
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-sm font-medium text-[var(--color-down)] hover:underline"
            >
              Remove from plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
