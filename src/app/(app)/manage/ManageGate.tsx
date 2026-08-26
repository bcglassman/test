"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { useSessions } from "@/lib/sessions-context";

/**
 * Shell for the admin area. It decides what to *show* — the API still
 * answers every read the same way it did before, so nothing behind this
 * gate is a secret. See lib/roles.ts.
 */
export function ManageGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading, authLoading } = useSessions();

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

  if (role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header active="manage" />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            The admin area is for admins
          </h1>
          <p className="mt-2 max-w-sm text-sm text-[var(--color-ink-soft)]">
            Ask an admin to change your role if you need to manage dogs.
          </p>
          <Link href="/" className="mt-6 text-sm underline">
            Back to the feed
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
