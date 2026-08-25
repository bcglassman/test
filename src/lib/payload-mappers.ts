// Translates between Payload's generated collection types (payload-types.ts)
// and this app's CMS-agnostic types (types.ts). This is the only file that
// needs to know Payload's document shape — everything else in the app just
// works with Exercise / TrainingSession / MediaItem.

import type {
  Exercise as PayloadExercise,
  Media as PayloadMedia,
  Session as PayloadSession,
} from "@/payload-types";
import type {
  Exercise,
  MediaItem,
  RatingDimension,
  RatingSetEntry,
  TrainingSession,
} from "./types";

export function mapExercise(doc: PayloadExercise): Exercise {
  return {
    id: String(doc.id),
    name: doc.name,
    category: doc.category,
    focus: doc.focus,
    description: doc.description ?? undefined,
    defaultRatings: (doc.defaultRatings ?? []).map((r) => ({
      key: r.key,
      label: r.label,
      max: r.max,
      scale: r.scale ?? undefined,
    })),
  };
}

/** Request body for POST /api/exercises, built from our app's Exercise shape. */
export function exerciseToPayloadBody(exercise: {
  name: string;
  category: Exercise["category"];
  focus: string;
  description?: string;
  defaultRatings: Omit<RatingDimension, "score">[];
}) {
  return {
    name: exercise.name,
    category: exercise.category,
    focus: exercise.focus,
    description: exercise.description ?? null,
    defaultRatings: exercise.defaultRatings.map((r) => ({
      key: r.key,
      label: r.label,
      max: r.max,
      scale: r.scale && r.scale.length === 5 ? r.scale : undefined,
    })),
  };
}

function mediaURL(file: number | PayloadMedia): string {
  return typeof file === "number" ? "" : (file.url ?? "");
}

function mediaFileId(file: number | PayloadMedia): string {
  return String(typeof file === "number" ? file : file.id);
}

function mapMediaItem(
  item: NonNullable<PayloadSession["media"]>[number],
  index: number,
): MediaItem {
  return {
    id: item.id ?? `row-${index}`,
    type: item.type,
    setNumber: item.setNumber,
    url: mediaURL(item.file),
    fileId: mediaFileId(item.file),
    label: item.label ?? "",
    notes: item.notes ?? undefined,
    duration: item.duration ?? undefined,
    order: item.order ?? index,
  };
}

function mapRatingSet(
  set: NonNullable<PayloadSession["ratingSets"]>[number],
): RatingSetEntry {
  return {
    setNumber: set.setNumber,
    ratings: (set.ratings ?? []).map((r) => ({ key: r.key, score: r.score })),
  };
}

export function mapSession(doc: PayloadSession): TrainingSession {
  return {
    id: String(doc.id),
    exerciseId: String(
      typeof doc.exercise === "number" ? doc.exercise : doc.exercise.id,
    ),
    date: doc.date,
    ratingSets: (doc.ratingSets ?? []).map(mapRatingSet),
    sets: doc.sets ?? undefined,
    reps: doc.reps ?? undefined,
    passes: doc.passes ?? undefined,
    restLabel: doc.restLabel ?? undefined,
    notes: doc.notes ?? undefined,
    media: (doc.media ?? []).map(mapMediaItem),
  };
}

/** Request body for POST/PATCH /api/sessions, built from our app's TrainingSession. */
export function sessionToPayloadBody(session: TrainingSession) {
  return {
    exercise: Number(session.exerciseId),
    date: session.date,
    ratingSets: session.ratingSets.map((s) => ({
      setNumber: s.setNumber,
      ratings: s.ratings.map((r) => ({ key: r.key, score: r.score })),
    })),
    sets: session.sets ?? null,
    reps: session.reps ?? null,
    passes: session.passes ?? null,
    restLabel: session.restLabel ?? null,
    notes: session.notes ?? null,
    media: session.media
      .filter((m) => m.fileId)
      .map((m) => ({
        setNumber: m.setNumber,
        type: m.type,
        file: Number(m.fileId),
        label: m.label,
        notes: m.notes ?? null,
        duration: m.duration ?? null,
        order: m.order,
      })),
  };
}
