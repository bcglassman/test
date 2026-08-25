// Content model. This shape is intentionally CMS-agnostic: a headless CMS
// (Sanity, Contentful, Payload, etc.) would define matching schemas for
// Exercise / Session / Media, and `data-source.ts` is the only file that
// would need to change to fetch from it instead of local storage.

export type MediaType = "video" | "image";

export interface MediaItem {
  id: string;
  type: MediaType;
  /** Which set of the session this clip/photo belongs to. */
  setNumber: number;
  /** Object URL (local upload) or remote asset URL from a CMS. */
  url: string;
  /** Short caption shown as a chip, e.g. "Set 1" or "Annotated frame". */
  label: string;
  /** Freeform note shown under the media, e.g. "Good alignment early". */
  notes?: string;
  /** Display duration for videos, e.g. "0:12". */
  duration?: string;
  /**
   * When the clip/photo was actually recorded, as an ISO 8601 timestamp —
   * taken from the file's own metadata on upload, not the time it was
   * added. Absent when the source didn't report one.
   */
  capturedAt?: string;
  order: number;
  /**
   * The CMS's own id for the uploaded asset (e.g. Payload's `media`
   * collection doc id). Set once the file has actually been uploaded to
   * the CMS; used when saving a session to reference the asset. Not
   * meaningful for display.
   */
  fileId?: string;
}

export interface RatingDimension {
  /** Stable key, e.g. "form". Lets exercises define their own dimensions. */
  key: string;
  label: string;
  score: number;
  max: number;
  /**
   * Optional rubric: exactly 5 short descriptions for what a score of 1
   * through 5 means for this dimension on this exercise (e.g. score 4 on
   * "Form" -> "Maintains Good Form"). Lives on the Exercise, not per
   * session, so it stays consistent across every logged session.
   */
  scale?: string[];
}

export type ExerciseCategory =
  | "Strength"
  | "Mobility"
  | "Coordination"
  | "Cardio"
  | "Skill";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** Body area / focus, e.g. "Hind Limb", "General". */
  focus: string;
  description?: string;
  /** Default rating dimensions used when logging a new session. */
  defaultRatings: Omit<RatingDimension, "score">[];
}

export interface RatingScore {
  key: string;
  score: number;
}

/** One performed set's scores, keyed to the exercise's rating dimensions. */
export interface RatingSetEntry {
  setNumber: number;
  ratings: RatingScore[];
}

export interface TrainingSession {
  id: string;
  exerciseId: string;
  /** ISO 8601 timestamp. */
  date: string;
  /** Per-set scores. Session-level scores are the average across these — see aggregateRatings(). */
  ratingSets: RatingSetEntry[];
  sets?: number;
  reps?: number;
  /** Some exercises log "passes" instead of reps (e.g. cavaletti). */
  passes?: number;
  restLabel?: string;
  notes?: string;
  /** Where/under what conditions, e.g. "Outside — warm" or "Air-conditioned gym". */
  environment?: string;
  media: MediaItem[];
}

export interface SessionWithExercise extends TrainingSession {
  exercise: Exercise;
  /** Per-dimension scores averaged across ratingSets, joined with the exercise's label/max/scale — see aggregateRatings(). */
  ratings: RatingDimension[];
  overall: number;
  previousOverall?: number;
}
