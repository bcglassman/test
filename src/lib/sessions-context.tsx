"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Dog,
  Exercise,
  Plan,
  RatingDimensionDoc,
  SessionWithExercise,
  TrainingSession,
  UserRole,
} from "./types";
import {
  deleteDog as deleteDogFromStore,
  deleteSession as deleteSessionFromStore,
  getDogs,
  getExercises,
  getPlans,
  getRatingDimensions,
  getSessions,
  saveExercise as saveExerciseToStore,
  savePlan as savePlanToStore,
  saveDog as saveDogToStore,
  saveSession as saveSessionToStore,
} from "./data-source";
import { withExerciseAndTrend } from "./session-utils";
import { resolveRole } from "./roles";
import { sessionsForDog } from "./dog-utils";
import { type CurrentUser, getCurrentUser, logout as logoutRequest } from "./payload-client";

/** Remembers the chosen dog across Feed, Sessions and reloads. */
const SELECTED_DOG_KEY = "cookie-training:selected-dog";

function readStoredDogId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_DOG_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

interface SessionsContextValue {
  /** Sessions for the selected dog only. */
  sessions: SessionWithExercise[];
  /** Every session, whichever dog it belongs to — used by the admin area. */
  allSessions: SessionWithExercise[];
  exercises: Exercise[];
  /** Dogs still in the selector (archived ones excluded). */
  dogs: Dog[];
  /** Including archived, for the admin area. */
  allDogs: Dog[];
  selectedDog: Dog | null;
  selectDog: (id: string) => void;
  /** Every dog's plans; the calendar picks the active one for its dog. */
  plans: Plan[];
  savePlan: (plan: Plan) => Promise<Plan>;
  /** The global Rating Library. */
  ratingDimensions: RatingDimensionDoc[];
  saveExercise: (
    exercise: Omit<Exercise, "defaultRatings"> & { id: string },
  ) => Promise<Exercise>;
  loading: boolean;
  saveSession: (session: TrainingSession) => Promise<TrainingSession>;
  deleteSession: (id: string) => Promise<void>;
  saveDog: (dog: Dog) => Promise<Dog>;
  deleteDog: (id: string) => Promise<void>;
  /** Re-fetches everything — call after creating an exercise elsewhere. */
  refresh: () => Promise<void>;
  user: CurrentUser | null;
  /** Presentation-only: decides navigation and screens, never API access. */
  role: UserRole | null;
  authLoading: boolean;
  logout: () => Promise<void>;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const [rawSessions, setRawSessions] = useState<TrainingSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allDogs, setAllDogs] = useState<Dog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ratingDimensions, setRatingDimensions] = useState<RatingDimensionDoc[]>(
    [],
  );
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, e, d, p, r] = await Promise.all([
      getSessions(),
      getExercises(),
      getDogs(),
      getPlans(),
      getRatingDimensions(),
    ]);
    setRawSessions(s);
    setExercises(e);
    setAllDogs(d);
    setPlans(p);
    setRatingDimensions(r);
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    const currentUser = await getCurrentUser().catch(() => null);
    setUser(currentUser);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async load from storage, not a render-loop
    refresh();
    refreshAuth();
  }, [refresh, refreshAuth]);

  const dogs = useMemo(() => allDogs.filter((d) => !d.archived), [allDogs]);

  // Settle on a dog once they've loaded: the remembered one if it's still
  // selectable, otherwise the first. Runs again if that dog is deleted or
  // archived, so the app never sits on a dog that isn't there.
  useEffect(() => {
    if (dogs.length === 0) return;
    if (selectedDogId && dogs.some((d) => d.id === selectedDogId)) return;
    const stored = readStoredDogId();
    const next = dogs.find((d) => d.id === stored) ?? dogs[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling with freshly loaded data
    setSelectedDogId(next.id);
  }, [dogs, selectedDogId]);

  const selectDog = useCallback((id: string) => {
    setSelectedDogId(id);
    try {
      window.localStorage.setItem(SELECTED_DOG_KEY, id);
    } catch {
      // Storage unavailable — the choice just won't survive a reload.
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const saveSession = useCallback(
    async (session: TrainingSession) => {
      const saved = await saveSessionToStore(session);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteSessionFromStore(id);
      await refresh();
    },
    [refresh],
  );

  const saveDog = useCallback(
    async (dog: Dog) => {
      const saved = await saveDogToStore(dog);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const saveExercise = useCallback(
    async (exercise: Omit<Exercise, "defaultRatings"> & { id: string }) => {
      const saved = await saveExerciseToStore(exercise);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const savePlan = useCallback(
    async (plan: Plan) => {
      const saved = await savePlanToStore(plan);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const deleteDog = useCallback(
    async (id: string) => {
      await deleteDogFromStore(id);
      await refresh();
    },
    [refresh],
  );

  const allSessions = useMemo(
    () => withExerciseAndTrend(rawSessions, exercises),
    [rawSessions, exercises],
  );

  // Scoped per dog, and the trend is recomputed within that dog so a
  // session is only ever compared against the same dog's previous one.
  //
  // Sessions logged before dogs existed have no `dogId` and are shown
  // against the first dog, so nothing disappears from the feed on the day
  // this ships; the migration then stamps them properly.
  const sessions = useMemo(() => {
    if (!selectedDogId) return allSessions;
    const mine = sessionsForDog(rawSessions, selectedDogId, dogs[0]?.id);
    return withExerciseAndTrend(mine, exercises);
  }, [rawSessions, exercises, selectedDogId, dogs, allSessions]);

  const selectedDog = useMemo(
    () => dogs.find((d) => d.id === selectedDogId) ?? null,
    [dogs, selectedDogId],
  );

  const role = useMemo(() => resolveRole(user), [user]);

  const value = useMemo(
    () => ({
      sessions,
      allSessions,
      exercises,
      dogs,
      allDogs,
      selectedDog,
      selectDog,
      plans,
      savePlan,
      ratingDimensions,
      saveExercise,
      loading,
      saveSession,
      deleteSession,
      saveDog,
      deleteDog,
      refresh,
      user,
      role,
      authLoading,
      logout,
    }),
    [
      sessions,
      allSessions,
      exercises,
      dogs,
      allDogs,
      selectedDog,
      selectDog,
      plans,
      savePlan,
      ratingDimensions,
      saveExercise,
      loading,
      saveSession,
      deleteSession,
      saveDog,
      deleteDog,
      refresh,
      user,
      role,
      authLoading,
      logout,
    ],
  );

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used within SessionsProvider");
  return ctx;
}
