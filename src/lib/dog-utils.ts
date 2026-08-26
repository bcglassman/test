import type { Dog, SessionWithExercise } from "./types";

/** Human age from a date of birth, e.g. "4 yr 2 mo". Undefined without one. */
export function dogAge(dateOfBirth?: string): string | undefined {
  if (!dateOfBirth) return undefined;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return undefined;
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 +
    (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return undefined;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  if (rest === 0) return `${years} yr`;
  return `${years} yr ${rest} mo`;
}

/** One-line summary under the dog's name, e.g. "Border Collie · 4 yr · 18 kg". */
export function dogSubtitle(dog: Dog): string {
  return [dog.breed, dogAge(dog.dateOfBirth), dog.weightKg && `${dog.weightKg} kg`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A dog's sessions. Sessions logged before dogs existed carry no `dogId`
 * and belong to `fallbackDogId` (the first dog) until the migration stamps
 * them, so nothing vanishes from the feed the day this ships. Every caller
 * goes through here so that rule lives in exactly one place.
 */
export function sessionsForDog<T extends { dogId?: string }>(
  sessions: T[],
  dogId: string,
  fallbackDogId?: string,
): T[] {
  return sessions.filter((s) => (s.dogId ?? fallbackDogId) === dogId);
}

export interface DogStats {
  sessionCount: number;
  lastSessionDate?: string;
  /** Sessions in the last 7 days. */
  sessionsThisWeek: number;
  /** Mean overall score across every session, rounded to one decimal. */
  averageOverall?: number;
  /** Change in mean overall: last 3 sessions vs. the 3 before them. */
  trend?: number;
}

/** Rolls a dog's sessions up into the numbers shown on the dog summary. */
export function dogStats(sessions: SessionWithExercise[]): DogStats {
  if (sessions.length === 0) return { sessionCount: 0, sessionsThisWeek: 0 };
  const byDateDesc = sessions
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsThisWeek = byDateDesc.filter(
    (s) => new Date(s.date).getTime() >= weekAgo,
  ).length;

  const mean = (list: SessionWithExercise[]) =>
    list.reduce((sum, s) => sum + s.overall, 0) / list.length;

  const recent = byDateDesc.slice(0, 3);
  const prior = byDateDesc.slice(3, 6);
  const trend =
    prior.length > 0
      ? Math.round((mean(recent) - mean(prior)) * 10) / 10
      : undefined;

  return {
    sessionCount: byDateDesc.length,
    lastSessionDate: byDateDesc[0].date,
    sessionsThisWeek,
    averageOverall: Math.round(mean(byDateDesc) * 10) / 10,
    trend,
  };
}
