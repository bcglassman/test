/**
 * The Exercise Library's shared vocabulary.
 *
 * Category says what *type* of exercise it is; Focus says what it trains.
 * They are deliberately separate — "Conditioning" with focus "Cardio, Hind
 * Limb, Muscular Endurance" says more than either could alone.
 */

export const EXERCISE_CATEGORIES = [
  "Walking & General Activity",
  "Conditioning",
  "Strength",
  "Coordination & Proprioception",
  "Mobility",
  "Speed & Power",
  "Recovery / Low Impact",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** Seeded suggestions. Anyone who can edit an exercise may add their own. */
export const FOCUS_VALUES = [
  "General",
  "Cardio",
  "Conditioning",
  "Muscular Endurance",
  "Strength",
  "Power",
  "Hind Limb",
  "Forelimb",
  "Core",
  "Spine",
  "Neck",
  "Mobility",
  "Balance",
  "Stability",
  "Coordination",
  "Proprioception",
  "Body Awareness",
  "Paw Awareness",
  "Movement Control",
  "Directional Control",
  "Gait",
  "Recovery",
  "Low Impact",
] as const;

export const TRACKING_METHODS = [
  "Duration",
  "Active Duration",
  "Distance",
  "Reps",
  "Reps per Side",
  "Sets",
  "Passes",
  "Intervals",
  "Hold Time",
  "Steps",
] as const;
export type TrackingMethod = (typeof TRACKING_METHODS)[number];

export const UNITS = [
  "Seconds",
  "Minutes",
  "Hours",
  "Meters",
  "Kilometers",
  "Miles",
  "Reps",
  "Passes",
  "Steps",
  "Intervals",
] as const;
export type Unit = (typeof UNITS)[number];

/** Which units make sense for a tracking method, for narrowing the picker. */
export const UNITS_FOR_TRACKING: Record<TrackingMethod, Unit[]> = {
  Duration: ["Seconds", "Minutes", "Hours"],
  "Active Duration": ["Seconds", "Minutes"],
  Distance: ["Meters", "Kilometers", "Miles"],
  Reps: ["Reps"],
  "Reps per Side": ["Reps"],
  Sets: ["Reps", "Passes", "Intervals"],
  Passes: ["Passes"],
  Intervals: ["Intervals", "Seconds"],
  "Hold Time": ["Seconds"],
  Steps: ["Steps"],
};

export const EQUIPMENT_VALUES = [
  "None",
  "Treadmill",
  "Carpetmill",
  "Slatmill",
  "Underwater Treadmill",
  "Pool",
  "Cavaletti Poles",
  "Platform",
  "Step",
  "Balance Pad",
  "Cones",
  "Target",
] as const;

export type ExerciseStatus = "active" | "archived";

/**
 * Old five-value categories mapped onto the seven. `Skill` had no direct
 * heir — it was used for pole and target work — so it lands in
 * Coordination & Proprioception.
 */
export const LEGACY_CATEGORY_MAP: Record<string, ExerciseCategory> = {
  Strength: "Strength",
  Mobility: "Mobility",
  Coordination: "Coordination & Proprioception",
  Cardio: "Conditioning",
  Skill: "Coordination & Proprioception",
};

/** Units the app stores internally, whatever the exercise's display unit. */
export function metersToDisplay(meters: number, unit?: Unit): string {
  if (unit === "Miles") return `${(meters / 1609.344).toFixed(2)} mi`;
  if (unit === "Meters") return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
