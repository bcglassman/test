"use client";

import type { SessionSet } from "@/lib/types";
import type { TrackingMethod, Unit } from "@/lib/taxonomy";

/**
 * The measurement fields for one set, chosen by the exercise's tracking
 * methods.
 *
 * The library says how an exercise is measured; the session records the
 * numbers. A 60-minute walk, five carpetmill intervals and seven cavaletti
 * passes all come through here — the fields differ, the machinery doesn't.
 */

interface NumericField {
  key: keyof SessionSet;
  label: string;
  hint?: string;
  step?: number;
}

/**
 * Sets are the container, so "Sets" as a tracking method needs no field of
 * its own — adding a set card is how you record one.
 */
const FIELDS_FOR: Partial<Record<TrackingMethod, NumericField[]>> = {
  Duration: [
    { key: "durationSeconds", label: "Duration", hint: "minutes", step: 0.5 },
  ],
  "Active Duration": [
    {
      key: "activeDurationSeconds",
      label: "Active duration",
      hint: "seconds moving",
    },
  ],
  Distance: [{ key: "distanceMeters", label: "Distance", hint: "km", step: 0.01 }],
  Reps: [{ key: "reps", label: "Reps" }],
  "Reps per Side": [
    { key: "repsLeft", label: "Reps left" },
    { key: "repsRight", label: "Reps right" },
  ],
  Passes: [{ key: "passes", label: "Passes" }],
  Intervals: [{ key: "intervals", label: "Intervals" }],
  "Hold Time": [{ key: "holdSeconds", label: "Hold", hint: "seconds" }],
  Steps: [{ key: "steps", label: "Steps" }],
};

/** Minutes and kilometres read better than the seconds and metres stored. */
function toDisplay(key: keyof SessionSet, stored?: number): string {
  if (stored === undefined) return "";
  if (key === "durationSeconds") return String(Math.round((stored / 60) * 10) / 10);
  if (key === "distanceMeters") return String(Math.round((stored / 1000) * 100) / 100);
  return String(stored);
}

function toStored(key: keyof SessionSet, entered: string): number | undefined {
  if (entered === "") return undefined;
  const value = Number(entered);
  if (!Number.isFinite(value)) return undefined;
  if (key === "durationSeconds") return Math.round(value * 60);
  if (key === "distanceMeters") return Math.round(value * 1000);
  return value;
}

export function TrackingFields({
  set,
  trackingMethods,
  primaryUnit,
  onChange,
}: {
  set: SessionSet;
  trackingMethods: TrackingMethod[];
  primaryUnit?: Unit;
  onChange: (patch: Partial<SessionSet>) => void;
}) {
  // An exercise with nothing declared still needs somewhere to put a
  // number, so fall back to reps rather than showing an empty card.
  const methods: TrackingMethod[] =
    trackingMethods.length > 0 ? trackingMethods : ["Reps"];
  const fields = methods.flatMap((m) => FIELDS_FOR[m] ?? []);
  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fields.map((f) => {
        const hint =
          f.key === "distanceMeters" && primaryUnit === "Miles"
            ? "miles"
            : f.hint;
        return (
          <label key={String(f.key)} className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
              {f.label}
              {hint && <span className="ml-1 font-normal">({hint})</span>}
            </span>
            <input
              type="number"
              min={0}
              step={f.step ?? 1}
              value={toDisplay(f.key, set[f.key] as number | undefined)}
              onChange={(e) =>
                onChange({ [f.key]: toStored(f.key, e.target.value) })
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-sage)]"
            />
          </label>
        );
      })}
    </div>
  );
}
