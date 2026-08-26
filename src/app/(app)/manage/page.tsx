"use client";

import Link from "next/link";
import { ManageGate } from "./ManageGate";
import { ChevronRightIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";

function Card({
  href,
  title,
  description,
  meta,
  external,
}: {
  href: string;
  title: string;
  description: string;
  meta?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <h2 className="font-serif text-lg text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        {meta}
        <ChevronRightIcon className="h-4 w-4" />
      </div>
    </>
  );
  const className =
    "flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 hover:border-[var(--color-sage)]";
  return external ? (
    <a href={href} className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export default function ManageHomePage() {
  return (
    <ManageGate>
      <ManageHomeContent />
    </ManageGate>
  );
}

function ManageHomeContent() {
  const { allDogs, exercises, allSessions } = useSessions();

  return (
    <>
      <h1 className="mb-1 font-serif text-2xl text-[var(--color-ink)]">Admin</h1>
      <p className="mb-6 text-sm text-[var(--color-ink-soft)]">
        Dogs, exercises and accounts. Roles decide what each person is shown;
        they don&rsquo;t yet restrict what the API returns.
      </p>
      <div className="flex flex-col gap-3">
        <Card
          href="/manage/dogs"
          title="Dogs"
          description="Profiles, goals, restrictions and who they belong to."
          meta={`${allDogs.length} dog${allDogs.length === 1 ? "" : "s"}`}
        />
        <Card
          href="/exercises"
          title="Exercises"
          description="The exercise library and its rating templates."
          meta={`${exercises.length}`}
        />
        <Card
          href="/sessions"
          title="Sessions"
          description="Log and edit training sessions."
          meta={`${allSessions.length}`}
        />
        <Card
          href="/admin/collections/users"
          external
          title="People"
          description="Accounts and roles, in the CMS admin."
        />
      </div>
    </>
  );
}
