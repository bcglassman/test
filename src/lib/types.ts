// Content model. This shape is intentionally CMS-agnostic: a headless CMS
// (Sanity, Contentful, Payload, etc.) would define matching schemas for
// Exercise / Session / Media, and `data-source.ts` is the only file that
// would need to change to fetch from it instead of local storage.

export type MediaType = "video" | "image";

/** Who a person is in the app. Drives navigation and which screens exist. */
export type UserRole = "owner" | "trainer" | "admin";

/** A person with an account, as listed in the admin area. */
export interface AppUser {
  id: string;
  email: string;
  name?: string;
  /** Null on accounts created before roles existed — see roles.ts. */
  role?: UserRole;
}

/**
 * A dog being trained. Everything logged — sessions, media, ratings — hangs
 * off one of these, and the app is scoped to whichever dog is selected.
 */
export interface Dog {
  id: string;
  name: string;
  /** Profile photo URL, if one has been uploaded. */
  photoUrl?: string;
  /** CMS id of the photo asset, needed when saving. */
  photoId?: string;
  breed?: string;
  /** ISO 8601 date (no time); drives the displayed age. */
  dateOfBirth?: string;
  sex?: "male" | "female";
  weightKg?: number;
  /** What the current programme is working on. */
  trainingFocus?: string;
  trainingGoals?: string[];
  /** Standing observations about how this dog moves, carried across sessions. */
  movementObservations?: string;
  /** Things to avoid, e.g. "No jumping above hock height". */
  restrictions?: string[];
  notes?: string;
  /** User ids. Recorded for a later access change; nothing enforces them yet. */
  ownerIds?: string[];
  trainerIds?: string[];
  /** Archived dogs stay in the record but drop out of the dog selector. */
  archived?: boolean;
}

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
  /**
   * Seconds of actual movement in this clip. Prepopulated from the video's
   * own duration on upload, then editable — the raw clip usually includes
   * setup and rest that shouldn't count.
   */
  activeMovementSeconds?: number;
  /** Read-only file facts from the CMS, for the media info panel. */
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
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

/**
 * Something to watch for in a set, optionally pinned to a moment in that
 * set's clip — "left knee flaring" is easier to check when you know it
 * happens seven seconds in.
 */
export interface WatchItem {
  text: string;
  /** Seconds into the set's video. Absent when it isn't tied to a moment. */
  atSeconds?: number;
}

/**
 * One performed set. Everything that varies set to set lives here — the
 * work done, how it scored, and any note about that specific set. Media
 * belongs to a set too, but is stored on the session (see
 * `TrainingSession.media`) and joined by `setNumber`.
 */
export interface SessionSet {
  setNumber: number;
  reps?: number;
  /** Some exercises log "passes" instead of reps (e.g. cavaletti). */
  passes?: number;
  notes?: string;
  /** Short things to watch for in this set, e.g. "left knee flaring". */
  watchItems?: WatchItem[];
  ratings: RatingScore[];
}

/** A rating dimension's definition, without any score attached. */
export type RatingDefinition = Omit<RatingDimension, "score">;

export interface TrainingSession {
  id: string;
  /**
   * Which dog performed this session. Optional because sessions logged
   * before dogs existed have none until the migration backfills them.
   */
  dogId?: string;
  exerciseId: string;
  /** ISO 8601 timestamp. */
  date: string;
  /** The sets performed. Session-level scores are the average across these — see aggregateRatings(). */
  sets: SessionSet[];
  /**
   * This session's rating dimensions. Seeded from the exercise's
   * `defaultRatings` — which is only a template — then editable here, so a
   * session can add or drop dimensions without touching the exercise.
   * Empty on older sessions, which fall back to the exercise's definitions.
   */
  ratingDefs?: RatingDefinition[];
  /** Rest taken between sets — a property of the session, not any one set. */
  restLabel?: string;
  /** Notes about the session as a whole; per-set notes live on the set. */
  notes?: string;
  /** Where/under what conditions, e.g. "Outside — warm" or "Air-conditioned gym". */
  environment?: string;
  /** Where the session took place; drives the weather lookup. */
  locationName?: string;
  latitude?: number;
  longitude?: number;
  /** Conditions at this session's time and place, fetched once and stored. */
  weather?: {
    temperatureC?: number;
    humidityPercent?: number;
    description?: string;
    fetchedAt?: string;
  };
  media: MediaItem[];
}

export interface SessionWithExercise extends TrainingSession {
  exercise: Exercise;
  /** Per-dimension scores averaged across ratingSets, joined with the exercise's label/max/scale — see aggregateRatings(). */
  ratings: RatingDimension[];
  overall: number;
  previousOverall?: number;
}
