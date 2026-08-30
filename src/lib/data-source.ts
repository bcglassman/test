import type {
  User as PayloadUser,
  Dog as PayloadDog,
  Plan as PayloadPlan,
  Exercise as PayloadExercise,
  Session as PayloadSession,
} from "@/payload-types";
import type {
  AppUser,
  Dog,
  Exercise,
  Plan,
  RatingDimension,
  TrainingSession,
} from "./types";
import {
  payloadDelete,
  payloadGet,
  payloadPatch,
  payloadPost,
} from "./payload-client";
import {
  dogToPayloadBody,
  mapPlan,
  mapUser,
  planToPayloadBody,
  exerciseToPayloadBody,
  mapDog,
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

/**
 * Everyone with an account, for assigning owners and trainers to a dog.
 * Payload only returns this to a signed-in request; callers should treat a
 * failure as "no list available" rather than an error worth surfacing.
 */
export async function getUsers(): Promise<AppUser[]> {
  const data = await payloadGet<{ docs: PayloadUser[] }>(
    "users?limit=200&sort=email",
  );
  return data.docs.map(mapUser);
}

export async function getDogs(): Promise<Dog[]> {
  const data = await payloadGet<{ docs: PayloadDog[] }>(
    "dogs?limit=200&sort=name&depth=1",
  );
  return data.docs.map(mapDog);
}

/** Empty id means "not yet created". */
export async function saveDog(dog: Dog): Promise<Dog> {
  const body = dogToPayloadBody(dog);
  const { doc } = dog.id
    ? await payloadPatch<{ doc: PayloadDog }>(`dogs/${dog.id}`, body)
    : await payloadPost<{ doc: PayloadDog }>("dogs", body);
  return mapDog(doc);
}

export async function deleteDog(id: string): Promise<void> {
  await payloadDelete(`dogs/${id}`);
}

export async function getPlans(): Promise<Plan[]> {
  const data = await payloadGet<{ docs: PayloadPlan[] }>(
    "plans?limit=100&depth=1",
  );
  return data.docs.map(mapPlan);
}

/** Empty id means "not yet created". */
export async function savePlan(plan: Plan): Promise<Plan> {
  const body = planToPayloadBody(plan);
  const { doc } = plan.id
    ? await payloadPatch<{ doc: PayloadPlan }>(`plans/${plan.id}`, body)
    : await payloadPost<{ doc: PayloadPlan }>("plans", body);
  return mapPlan(doc);
}

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
