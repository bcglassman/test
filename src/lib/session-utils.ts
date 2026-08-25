import type {
  Exercise,
  RatingDimension,
  SessionWithExercise,
  TrainingSession,
} from "./types";

/**
 * Per-dimension scores for a session, averaged across its rating sets and
 * joined with the exercise's current label/max/scale — so ratings always
 * reflect what the exercise defines today, not a stale per-session copy.
 */
export function aggregateRatings(
  session: TrainingSession,
  exercise: Exercise,
): RatingDimension[] {
  return exercise.defaultRatings.map((def) => {
    const scores = session.sets
      .map((set) => set.ratings.find((r) => r.key === def.key)?.score)
      .filter((s): s is number => typeof s === "number");
    const score = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : Math.round(def.max / 2);
    return { ...def, score };
  });
}

/**
 * Summarises the work done across a session's sets, e.g. "3 sets · 6 reps"
 * when every set matches, or "3 sets · 6/6/5 reps" when they differ.
 */
export function setSummary(session: TrainingSession): string | undefined {
  const count = session.sets.length;
  if (count === 0) return undefined;

  const unit = session.sets.some((s) => s.passes !== undefined)
    ? "passes"
    : "reps";
  const values = session.sets.map((s) =>
    unit === "passes" ? s.passes : s.reps,
  );

  const setsLabel = `${count} ${count === 1 ? "set" : "sets"}`;
  if (values.every((v) => v === undefined)) return setsLabel;

  const shown = values.map((v) => v ?? "—");
  const allSame = shown.every((v) => v === shown[0]);
  return `${setsLabel} · ${allSame ? shown[0] : shown.join("/")} ${unit}`;
}

export function overallScore(ratings: RatingDimension[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  return Math.round(sum / ratings.length);
}

/**
 * Joins sessions to their exercise, computes each session's overall score,
 * and — per exercise — the previous session's overall score so the feed can
 * show a trend indicator (see README: "trend, not charts").
 */
export function withExerciseAndTrend(
  sessions: TrainingSession[],
  exercises: Exercise[],
): SessionWithExercise[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const byExercise = new Map<string, TrainingSession[]>();
  for (const s of sessions) {
    const list = byExercise.get(s.exerciseId) ?? [];
    list.push(s);
    byExercise.set(s.exerciseId, list);
  }
  for (const list of byExercise.values()) {
    list.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  const result: SessionWithExercise[] = [];
  for (const session of sessions) {
    const exercise = exerciseById.get(session.exerciseId);
    if (!exercise) continue;
    const ratings = aggregateRatings(session, exercise);
    const history = byExercise.get(session.exerciseId) ?? [];
    const idx = history.findIndex((s) => s.id === session.id);
    const previous = idx > 0 ? history[idx - 1] : undefined;
    result.push({
      ...session,
      exercise,
      ratings,
      overall: overallScore(ratings),
      previousOverall: previous
        ? overallScore(aggregateRatings(previous, exercise))
        : undefined,
    });
  }

  return result.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
