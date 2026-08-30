import type {
  Plan,
  PlanCategory,
  PlanItem,
  SessionWithExercise,
} from "./types";
import { PLAN_CATEGORIES } from "./types";

// ---------------------------------------------------------------------------
// Projecting a weekly plan onto a real week, and comparing it with what was
// actually logged. The plan is a template — nothing here writes a copy per
// week, so editing the plan changes what future weeks expect without
// rewriting the record of what already happened.
// ---------------------------------------------------------------------------

/** Weeks run Sunday to Saturday, matching the planner's own columns. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addWeeks(weekStart: Date, delta: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

/** The seven dates of the week beginning at `weekStart`. */
export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const from = weekStart.toLocaleDateString(undefined, opts);
  const to = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : opts,
  );
  return `${from} – ${to} ${end.getFullYear()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "45–60 min", "30 min", or nothing when no duration was planned. */
export function formatPlannedDuration(item: PlanItem): string | undefined {
  const { durationMinMinutes: min, durationMaxMinutes: max } = item;
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined && min !== max) {
    return `${min}–${max} min`;
  }
  return `${min ?? max} min`;
}

/** Midpoint of a planned range, for totalling a week's load. */
function plannedMinutes(item: PlanItem): number {
  const { durationMinMinutes: min, durationMaxMinutes: max } = item;
  if (min !== undefined && max !== undefined) return (min + max) / 2;
  return min ?? max ?? 0;
}

/**
 * How a session's exercise category lands in the planner's rows. The two
 * vocabularies are deliberately separate — the planner's categories are
 * programme-level, and "Enrichment / mental" is not an exercise in the
 * library sense — so an actual session is placed by this mapping unless a
 * plan item claims it.
 */
const CATEGORY_FROM_EXERCISE: Record<string, PlanCategory> = {
  Cardio: "cardio",
  Strength: "strength",
  Mobility: "flexibility",
  Coordination: "bodyAwareness",
  Skill: "sport",
};

export function planCategoryForSession(
  session: SessionWithExercise,
): PlanCategory {
  return CATEGORY_FROM_EXERCISE[session.exercise.category] ?? "sport";
}

export type PlannedStatus =
  /** A session that week, on this day, for this item's exercise. */
  | "done"
  /** The day has passed and nothing matched. */
  | "missed"
  /** The day hasn't come yet. */
  | "upcoming"
  /**
   * No exercise is linked, so nothing can be matched to it. Enrichment —
   * "Kong Wobbler for dinner" — mostly lands here, and calling that
   * "missed" would be inventing a fact.
   */
  | "untracked";

export interface PlannedCell {
  item: PlanItem;
  date: Date;
  status: PlannedStatus;
  /** The item's day has been and gone. */
  dayIsPast: boolean;
  /** The session that satisfied it, when one did. */
  session?: SessionWithExercise;
}

export interface ActualEntry {
  session: SessionWithExercise;
  date: Date;
  category: PlanCategory;
  /** True when it answers a plan item for that day. */
  onPlan: boolean;
}

export interface WeekView {
  weekStart: Date;
  dates: Date[];
  /** Planned items, keyed `category:dayOfWeek`. */
  planned: Map<string, PlannedCell[]>;
  /** Logged sessions, keyed the same way. */
  actual: Map<string, ActualEntry[]>;
  summary: {
    plannedCount: number;
    doneCount: number;
    missedCount: number;
    upcomingCount: number;
    untrackedCount: number;
    /** Planned items that could be matched at all — the honest denominator. */
    trackedCount: number;
    /** Sessions that answered no plan item for their day. */
    offPlanCount: number;
    plannedMinutes: number;
    /** Planned minutes per category, for seeing where a week tilts. */
    plannedMinutesByCategory: Record<PlanCategory, number>;
  };
}

export function cellKey(category: PlanCategory, dayOfWeek: number): string {
  return `${category}:${dayOfWeek}`;
}

/**
 * Builds one week: what was planned, what was logged, and how they line up.
 *
 * A session answers a plan item when it falls on that item's day and uses
 * that item's exercise. Anything else the dog did is still shown — off the
 * plan, in the row its exercise belongs to — because a week where the work
 * happened on the wrong days is exactly the thing worth seeing.
 */
export function buildWeekView(
  plan: Plan | null,
  sessions: SessionWithExercise[],
  weekStart: Date,
  now: Date = new Date(),
): WeekView {
  const dates = weekDates(weekStart);
  const weekEnd = addWeeks(weekStart, 1);
  const inWeek = sessions.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });

  const planned = new Map<string, PlannedCell[]>();
  const actual = new Map<string, ActualEntry[]>();
  const claimed = new Set<string>();

  const summary = {
    plannedCount: 0,
    doneCount: 0,
    missedCount: 0,
    upcomingCount: 0,
    untrackedCount: 0,
    trackedCount: 0,
    offPlanCount: 0,
    plannedMinutes: 0,
    plannedMinutesByCategory: Object.fromEntries(
      PLAN_CATEGORIES.map((c) => [c, 0]),
    ) as Record<PlanCategory, number>,
  };

  const items = (plan?.items ?? [])
    .slice()
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  for (const item of items) {
    const date = dates[item.dayOfWeek];
    if (!date) continue;

    const match = item.exerciseId
      ? inWeek.find(
          (s) =>
            !claimed.has(s.id) &&
            s.exerciseId === item.exerciseId &&
            new Date(s.date).getDay() === item.dayOfWeek,
        )
      : undefined;
    if (match) claimed.add(match.id);

    const dayIsPast = date.getTime() < startOfDay(now).getTime();
    const status: PlannedStatus = !item.exerciseId
      ? "untracked"
      : match
        ? "done"
        : dayIsPast
          ? "missed"
          : "upcoming";

    const key = cellKey(item.category, item.dayOfWeek);
    planned.set(key, [
      ...(planned.get(key) ?? []),
      { item, date, status, dayIsPast, session: match },
    ]);

    summary.plannedCount += 1;
    if (status === "done") summary.doneCount += 1;
    // Optional items are a suggestion, not a commitment, so not doing one
    // is not a miss.
    else if (status === "missed" && !item.optional) summary.missedCount += 1;
    else if (status === "upcoming") summary.upcomingCount += 1;
    else if (status === "untracked") summary.untrackedCount += 1;
    if (status !== "untracked") summary.trackedCount += 1;

    const mins = plannedMinutes(item);
    summary.plannedMinutes += mins;
    summary.plannedMinutesByCategory[item.category] += mins;
  }

  for (const session of inWeek) {
    const category = planCategoryForSession(session);
    const day = new Date(session.date).getDay();
    const onPlan = claimed.has(session.id);
    if (!onPlan) summary.offPlanCount += 1;
    const key = cellKey(category, day);
    actual.set(key, [
      ...(actual.get(key) ?? []),
      { session, date: new Date(session.date), category, onPlan },
    ]);
  }

  return { weekStart, dates, planned, actual, summary };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
