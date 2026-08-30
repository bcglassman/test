import type {
  Exercise,
  RatingDefinition,
  RatingDimension,
  SessionWithExercise,
  TrainingSession,
  WatchItem,
} from "./types";
import { DEFAULT_RATING_MAX } from "./types";

/**
 * Per-dimension scores for a session, averaged across its rating sets and
 * joined with the exercise's current label/max/scale — so ratings always
 * reflect what the exercise defines today, not a stale per-session copy.
 */
/**
 * The rating dimensions in force for a session. The exercise's own
 * `defaultRatings` are only a template: once a session has its own
 * `ratingDefs` those win, so editing or dropping a dimension in one session
 * doesn't disturb the exercise or any other session.
 */
export function resolveRatingDefs(
  session: Pick<TrainingSession, "ratingDefs">,
  exercise: Exercise,
): RatingDefinition[] {
  if (!session.ratingDefs?.length) return exercise.defaultRatings;
  // A session's own definitions win, but one saved without wording borrows
  // it from the exercise's template for the same dimension. Sessions logged
  // before the rating editor could store a scale would otherwise show a
  // bare number forever, even though the exercise says what it means.
  return session.ratingDefs.map((def) => {
    if (def.scale?.length) return def;
    const fromExercise = exercise.defaultRatings.find((d) => d.key === def.key);
    return fromExercise?.scale?.length
      ? { ...def, scale: fromExercise.scale }
      : def;
  });
}

/**
 * The scale wording for a score. Scores can land on half marks, which no
 * single level describes — those read as a range between the two levels
 * they sit between.
 */
export function describeScore(
  def: RatingDefinition,
  score: number,
): string | undefined {
  if (!def.scale?.length) return undefined;
  const at = (level: number) => def.scale?.[Math.round(level) - 1];
  if (Number.isInteger(score)) return at(score);
  const lower = at(Math.floor(score));
  const upper = at(Math.ceil(score));
  if (lower && upper) return `Between: ${lower} → ${upper}`;
  return lower ?? upper;
}

/** Seconds of movement across a session's clips — see MediaItem.activeMovementSeconds. */
export function totalActiveMovementSeconds(
  session: Pick<TrainingSession, "media">,
): number {
  return session.media.reduce((sum, m) => sum + (m.activeMovementSeconds ?? 0), 0);
}

/**
 * Watch items in the order you'd work through them: earliest moment in the
 * clip first, then the ones not tied to a moment. Stable within each group,
 * so untimed items keep the order they were written in.
 */
export function sortWatchItems(items: WatchItem[]): WatchItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const at = a.item.atSeconds;
      const bt = b.item.atSeconds;
      if (at === undefined && bt === undefined) return a.index - b.index;
      if (at === undefined) return 1;
      if (bt === undefined) return -1;
      return at - bt || a.index - b.index;
    })
    .map(({ item }) => item);
}

/** 7 -> "0:07", a position in a clip rather than a length. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * "0:07", "07", ":7" or "1:02" -> seconds. Undefined for anything that
 * isn't a time, including the empty string, which is how a watch item says
 * it isn't tied to a moment.
 */
export function parseTimecode(input: string): number | undefined {
  const text = input.trim();
  if (!text) return undefined;
  const parts = text.split(":");
  if (parts.length > 2) return undefined;
  const nums = parts.map((p) => (p === "" ? 0 : Number(p)));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  const seconds = parts.length === 2 ? nums[0] * 60 + nums[1] : nums[0];
  return Math.round(seconds);
}

/** 134 -> "2m 14s"; 45 -> "45s". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export function aggregateRatings(
  session: TrainingSession,
  exercise: Exercise,
): RatingDimension[] {
  return resolveRatingDefs(session, exercise).map((def) => {
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
 * What `overallScore` is out of. Each dimension carries its own `max` — 5
 * by default — so the overall, being their mean, is out of the mean of
 * those maxima. Never assume 10: that was the scale before dimensions had
 * a max of their own, and it made a 4-out-of-5 session read as 4/10.
 */
export function overallMax(ratings: RatingDimension[]): number {
  if (ratings.length === 0) return DEFAULT_RATING_MAX;
  const sum = ratings.reduce((acc, r) => acc + r.max, 0);
  return Math.round(sum / ratings.length) || DEFAULT_RATING_MAX;
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
      overallMax: overallMax(ratings),
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
