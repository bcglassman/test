// Translates between Payload's generated collection types (payload-types.ts)
// and this app's CMS-agnostic types (types.ts). This is the only file that
// needs to know Payload's document shape — everything else in the app just
// works with Exercise / TrainingSession / MediaItem.

import type {
  User as PayloadUser,
  Dog as PayloadDog,
  Exercise as PayloadExercise,
  Media as PayloadMedia,
  Session as PayloadSession,
} from "@/payload-types";
import type {
  AppUser,
  Dog,
  Exercise,
  MediaItem,
  RatingDimension,
  RatingDefinition,
  SessionSet,
  TrainingSession,
  WatchItem,
} from "./types";

/** Relationship rows arrive as either a bare id or the joined document. */
function relationIds(
  rows: (number | { id: number })[] | null | undefined,
): string[] | undefined {
  if (!rows || rows.length === 0) return undefined;
  return rows.map((r) => String(typeof r === "number" ? r : r.id));
}

export function mapUser(doc: PayloadUser): AppUser {
  return {
    id: String(doc.id),
    email: doc.email,
    name: doc.name ?? undefined,
    role: doc.role ?? undefined,
  };
}

export function mapDog(doc: PayloadDog): Dog {
  const photo = doc.photo ?? undefined;
  return {
    id: String(doc.id),
    name: doc.name,
    photoUrl: photo && typeof photo !== "number" ? (photo.url ?? undefined) : undefined,
    photoId: photo ? String(typeof photo === "number" ? photo : photo.id) : undefined,
    breed: doc.breed ?? undefined,
    dateOfBirth: doc.dateOfBirth ?? undefined,
    sex: doc.sex ?? undefined,
    weightKg: doc.weightKg ?? undefined,
    trainingFocus: doc.trainingFocus ?? undefined,
    trainingGoals: doc.trainingGoals ?? undefined,
    movementObservations: doc.movementObservations ?? undefined,
    restrictions: doc.restrictions ?? undefined,
    notes: doc.notes ?? undefined,
    ownerIds: relationIds(doc.owners),
    trainerIds: relationIds(doc.trainers),
    archived: doc.archived ?? false,
  };
}

/** Request body for POST/PATCH /api/dogs. Omitted keys are left untouched. */
export function dogToPayloadBody(dog: Omit<Dog, "id">) {
  return {
    name: dog.name,
    photo: dog.photoId ? Number(dog.photoId) : null,
    breed: dog.breed ?? null,
    dateOfBirth: dog.dateOfBirth ?? null,
    sex: dog.sex ?? null,
    weightKg: dog.weightKg ?? null,
    trainingFocus: dog.trainingFocus ?? null,
    trainingGoals: dog.trainingGoals ?? [],
    movementObservations: dog.movementObservations ?? null,
    restrictions: dog.restrictions ?? [],
    notes: dog.notes ?? null,
    owners: (dog.ownerIds ?? []).map(Number),
    trainers: (dog.trainerIds ?? []).map(Number),
    archived: dog.archived ?? false,
  };
}

/**
 * Payload returns `[]` — not null — for a `hasMany` text field that was
 * never filled in. An empty array is not a scale, and treating it as one
 * left the rating editor rendering zero rows to type into and the session
 * form showing no wording under the slider.
 */
function scaleOrUndefined(scale: string[] | null | undefined): string[] | undefined {
  return scale && scale.length > 0 ? scale : undefined;
}

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
      scale: scaleOrUndefined(r.scale),
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

/** File facts Payload records on upload; absent when the doc wasn't joined. */
function mediaFileFacts(file: number | PayloadMedia) {
  if (typeof file === "number") return {};
  return {
    fileName: file.filename ?? undefined,
    fileSize: file.filesize ?? undefined,
    mimeType: file.mimeType ?? undefined,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
  };
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
    capturedAt: item.capturedAt ?? undefined,
    activeMovementSeconds: item.activeMovementSeconds ?? undefined,
    ...mediaFileFacts(item.file),
    order: item.order ?? index,
  };
}

/**
 * Watch items used to be a plain list of strings; they can now carry a
 * timestamp, so they live in `watchPoints`. Sessions saved before that
 * still have the old strings, which read as untimed items until the seed's
 * backfill copies them across.
 */
function mapWatchItems(
  set: NonNullable<PayloadSession["sets"]>[number],
): WatchItem[] | undefined {
  if (set.watchPoints?.length) {
    return set.watchPoints.map((w) => ({
      text: w.text,
      atSeconds: w.atSeconds ?? undefined,
    }));
  }
  if (set.watchItems?.length) return set.watchItems.map((text) => ({ text }));
  return undefined;
}

function mapSessionSet(
  set: NonNullable<PayloadSession["sets"]>[number],
): SessionSet {
  return {
    setNumber: set.setNumber,
    reps: set.reps ?? undefined,
    passes: set.passes ?? undefined,
    notes: set.notes ?? undefined,
    watchItems: mapWatchItems(set),
    ratings: (set.ratings ?? []).map((r) => ({ key: r.key, score: r.score })),
  };
}

export function mapSession(doc: PayloadSession): TrainingSession {
  return {
    id: String(doc.id),
    dogId: doc.dog
      ? String(typeof doc.dog === "number" ? doc.dog : doc.dog.id)
      : undefined,
    exerciseId: String(
      typeof doc.exercise === "number" ? doc.exercise : doc.exercise.id,
    ),
    date: doc.date,
    sets: (doc.sets ?? []).map(mapSessionSet),
    ratingDefs: (doc.ratingDefs ?? []).map(
      (d): RatingDefinition => ({
        key: d.key,
        label: d.label,
        max: d.max,
        scale: scaleOrUndefined(d.scale),
      }),
    ),
    restLabel: doc.restLabel ?? undefined,
    notes: doc.notes ?? undefined,
    environment: doc.environment ?? undefined,
    locationName: doc.locationName ?? undefined,
    latitude: doc.latitude ?? undefined,
    longitude: doc.longitude ?? undefined,
    weather: doc.weather
      ? {
          temperatureC: doc.weather.temperatureC ?? undefined,
          humidityPercent: doc.weather.humidityPercent ?? undefined,
          description: doc.weather.description ?? undefined,
          fetchedAt: doc.weather.fetchedAt ?? undefined,
        }
      : undefined,
    media: (doc.media ?? []).map(mapMediaItem),
  };
}

/** Request body for POST/PATCH /api/sessions, built from our app's TrainingSession. */
export function sessionToPayloadBody(session: TrainingSession) {
  return {
    dog: session.dogId ? Number(session.dogId) : null,
    exercise: Number(session.exerciseId),
    date: session.date,
    sets: session.sets.map((s) => ({
      setNumber: s.setNumber,
      reps: s.reps ?? null,
      passes: s.passes ?? null,
      notes: s.notes ?? null,
      // Written only to watchPoints; the legacy string list is cleared so
      // the two can't drift apart.
      watchItems: [],
      watchPoints: (s.watchItems ?? [])
        .filter((w) => w.text.trim())
        .map((w) => ({
          text: w.text.trim(),
          atSeconds: w.atSeconds ?? null,
        })),
      ratings: s.ratings.map((r) => ({ key: r.key, score: r.score })),
    })),
    ratingDefs: (session.ratingDefs ?? []).map((d) => ({
      key: d.key,
      label: d.label,
      max: d.max,
      scale: d.scale && d.scale.length ? d.scale : undefined,
    })),
    restLabel: session.restLabel ?? null,
    notes: session.notes ?? null,
    environment: session.environment ?? null,
    locationName: session.locationName ?? null,
    latitude: session.latitude ?? null,
    longitude: session.longitude ?? null,
    weather: session.weather
      ? {
          temperatureC: session.weather.temperatureC ?? null,
          humidityPercent: session.weather.humidityPercent ?? null,
          description: session.weather.description ?? null,
          fetchedAt: session.weather.fetchedAt ?? null,
        }
      : null,
    media: session.media
      .filter((m) => m.fileId)
      .map((m) => ({
        setNumber: m.setNumber,
        type: m.type,
        file: Number(m.fileId),
        label: m.label,
        notes: m.notes ?? null,
        duration: m.duration ?? null,
        capturedAt: m.capturedAt ?? null,
        activeMovementSeconds: m.activeMovementSeconds ?? null,
        order: m.order,
      })),
  };
}
