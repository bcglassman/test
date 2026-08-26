"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { useSessions } from "@/lib/sessions-context";

/**
 * Shell for the admin area.
 *
 * It asks only for a login, not for the admin role. Roles here decide
 * which navigation a person is shown; they are not enforced by the API,
 * which answers every read the same way it did before. A role check here
 * would therefore secure nothing while being able to lock a real user out
 * of their own dogs — so the check is the one that actually means
 * something, which is whether you are signed in.
 */
export function ManageGate({ children }: { children: React.ReactNode }) {
  const { user, loading, authLoading } = useSessions();

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="manage" />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="manage" />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            Log in to reach the admin area
          </h1>
          <Link
            href="/admin/login"
            className="mt-6 rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
          >
            Log in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="manage" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
