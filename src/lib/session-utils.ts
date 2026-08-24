import type {
  Exercise,
  SessionWithExercise,
  TrainingSession,
} from "./types";

export function overallScore(session: TrainingSession): number {
  if (session.ratings.length === 0) return 0;
  const sum = session.ratings.reduce((acc, r) => acc + r.score, 0);
  return Math.round(sum / session.ratings.length);
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
    const history = byExercise.get(session.exerciseId) ?? [];
    const idx = history.findIndex((s) => s.id === session.id);
    const previous = idx > 0 ? history[idx - 1] : undefined;
    result.push({
      ...session,
      exercise,
      overall: overallScore(session),
      previousOverall: previous ? overallScore(previous) : undefined,
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
