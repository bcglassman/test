"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Exercise, SessionWithExercise, TrainingSession } from "./types";
import {
  deleteSession as deleteSessionFromStore,
  getExercises,
  getSessions,
  saveSession as saveSessionToStore,
} from "./data-source";
import { withExerciseAndTrend } from "./session-utils";
import { type CurrentUser, getCurrentUser, logout as logoutRequest } from "./payload-client";

interface SessionsContextValue {
  sessions: SessionWithExercise[];
  exercises: Exercise[];
  loading: boolean;
  saveSession: (session: TrainingSession) => Promise<TrainingSession>;
  deleteSession: (id: string) => Promise<void>;
  user: CurrentUser | null;
  authLoading: boolean;
  logout: () => Promise<void>;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const [rawSessions, setRawSessions] = useState<TrainingSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, e] = await Promise.all([getSessions(), getExercises()]);
    setRawSessions(s);
    setExercises(e);
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

  const sessions = useMemo(
    () => withExerciseAndTrend(rawSessions, exercises),
    [rawSessions, exercises],
  );

  const value = useMemo(
    () => ({
      sessions,
      exercises,
      loading,
      saveSession,
      deleteSession,
      user,
      authLoading,
      logout,
    }),
    [sessions, exercises, loading, saveSession, deleteSession, user, authLoading, logout],
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
