// Content model. This shape is intentionally CMS-agnostic: a headless CMS
// (Sanity, Contentful, Payload, etc.) would define matching schemas for
// Exercise / Session / Media, and `data-source.ts` is the only file that
// would need to change to fetch from it instead of local storage.

export type MediaType = "video" | "image";

export interface MediaItem {
  id: string;
  type: MediaType;
  /** Object URL (local upload) or remote asset URL from a CMS. */
  url: string;
  /** Short caption shown as a chip, e.g. "Set 1" or "Annotated frame". */
  label: string;
  /** Freeform note shown under the media, e.g. "Good alignment early". */
  notes?: string;
  /** Display duration for videos, e.g. "0:12". */
  duration?: string;
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

export interface TrainingSession {
  id: string;
  exerciseId: string;
  /** ISO 8601 timestamp. */
  date: string;
  ratings: RatingDimension[];
  sets?: number;
  reps?: number;
  /** Some exercises log "passes" instead of reps (e.g. cavaletti). */
  passes?: number;
  restLabel?: string;
  notes?: string;
  media: MediaItem[];
}

export interface SessionWithExercise extends TrainingSession {
  exercise: Exercise;
  overall: number;
  previousOverall?: number;
}
