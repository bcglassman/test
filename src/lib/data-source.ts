import type { Exercise as PayloadExercise, Session as PayloadSession } from "@/payload-types";
import type { Exercise, RatingDimension, TrainingSession } from "./types";
import {
  payloadDelete,
  payloadGet,
  payloadPatch,
  payloadPost,
} from "./payload-client";
import {
  exerciseToPayloadBody,
  mapExercise,
  mapSession,
  sessionToPayloadBody,
} from "./payload-mappers";

// ---------------------------------------------------------------------------
// Data access layer, backed by Payload CMS's REST API (see payload.config.ts
// and src/collections/*). Nothing outside this file (and payload-mappers.ts)
// knows Payload's document shape — every screen just works with the
// CMS-agnostic types in types.ts.
// ---------------------------------------------------------------------------

export async function getExercises(): Promise<Exercise[]> {
  const data = await payloadGet<{ docs: PayloadExercise[] }>(
    "exercises?limit=200&sort=name",
  );
  return data.docs.map(mapExercise);
}

export async function getSessions(): Promise<TrainingSession[]> {
  const data = await payloadGet<{ docs: PayloadSession[] }>(
    "sessions?limit=200&sort=-date&depth=2",
  );
  return data.docs.map(mapSession);
}

/** Empty id means "not yet created" — see SessionForm's blank-session state. */
export async function saveSession(
  session: TrainingSession,
): Promise<TrainingSession> {
  const body = sessionToPayloadBody(session);
  const { doc } = session.id
    ? await payloadPatch<{ doc: PayloadSession }>(
        `sessions/${session.id}`,
        body,
      )
    : await payloadPost<{ doc: PayloadSession }>("sessions", body);
  return mapSession(doc);
}

export async function deleteSession(id: string): Promise<void> {
  await payloadDelete(`sessions/${id}`);
}

export async function createExercise(exercise: {
  name: string;
  category: Exercise["category"];
  focus: string;
  description?: string;
  defaultRatings: Omit<RatingDimension, "score">[];
}): Promise<Exercise> {
  const body = exerciseToPayloadBody(exercise);
  const { doc } = await payloadPost<{ doc: PayloadExercise }>(
    "exercises",
    body,
  );
  return mapExercise(doc);
}
