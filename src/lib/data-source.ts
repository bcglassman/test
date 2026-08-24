import type { Exercise, TrainingSession } from "./types";
import { seedExercises, seedSessions } from "./seed-data";

// ---------------------------------------------------------------------------
// Data access layer.
//
// Today this reads/writes browser localStorage, seeded from seed-data.ts.
// It exists so the rest of the app never touches storage directly — when a
// real headless CMS (Sanity, Contentful, Payload, etc.) is wired up, only
// this file needs to change: swap the bodies of these functions for CMS SDK
// calls / fetches, keep the same function signatures and return types, and
// every screen keeps working unmodified. See README.md for the CMS handoff
// notes.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "cookie-training:sessions:v1";

function readStore(): TrainingSession[] {
  if (typeof window === "undefined") return seedSessions;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedSessions;
    return JSON.parse(raw) as TrainingSession[];
  } catch {
    return seedSessions;
  }
}

function writeStore(sessions: TrainingSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export async function getExercises(): Promise<Exercise[]> {
  return seedExercises;
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return seedExercises.find((e) => e.id === id);
}

export async function getSessions(): Promise<TrainingSession[]> {
  return readStore();
}

export async function getSession(
  id: string,
): Promise<TrainingSession | undefined> {
  return readStore().find((s) => s.id === id);
}

export async function saveSession(
  session: TrainingSession,
): Promise<TrainingSession> {
  const sessions = readStore();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  writeStore(sessions);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  writeStore(readStore().filter((s) => s.id !== id));
}

export function newSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newMediaId(): string {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
