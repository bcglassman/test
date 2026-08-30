"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { DogAvatar } from "@/components/DogAvatar";
import { PlanCalendar } from "@/components/plan/PlanCalendar";
import { PlanItemModal } from "@/components/plan/PlanItemModal";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { sessionsForDog } from "@/lib/dog-utils";
import type { Plan, PlanCategory, PlanItem } from "@/lib/types";

/** A blank item, so the modal has something to edit when adding. */
function blankItem(category: PlanCategory, dayOfWeek: number, order: number): PlanItem {
  return {
    id: "",
    dayOfWeek,
    category,
    title: "",
    intensity: "low",
    optional: false,
    alternatives: [],
    order,
  };
}

export default function DogPlanPage() {
  const params = useParams<{ id: string }>();
  const { allDogs, dogs, allSessions, exercises, plans, savePlan, user, loading } =
    useSessions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PlanItem | null>(null);

  const dog = allDogs.find((d) => d.id === params.id) ?? null;
  const plan = useMemo(
    () => plans.find((p) => p.dogId === dog?.id && p.active) ?? null,
    [plans, dog],
  );
  const sessions = useMemo(
    () => (dog ? sessionsForDog(allSessions, dog.id, dogs[0]?.id) : []),
    [allSessions, dog, dogs],
  );

  // The plan is data like any other: editing it needs a login, which is
  // what the API enforces on `plans` too.
  const canEdit = Boolean(user);

  async function commit(items: PlanItem[], message: string) {
    if (!dog) return;
    const next: Plan = plan
      ? { ...plan, items }
      : {
          id: "",
          name: `${dog.name}'s weekly plan`,
          dogId: dog.id,
          active: true,
          items,
        };
    await savePlan(next);
    setEditing(null);
    showToast(message);
  }

  async function handleSaveItem(item: PlanItem) {
    const existing = plan?.items ?? [];
    const isNew = !item.id;
    const items = isNew
      ? [...existing, { ...item, id: `new-${Date.now()}` }]
      : existing.map((i) => (i.id === item.id ? item : i));
    await commit(items, isNew ? "Added to the plan" : "Plan updated");
  }

  async function handleDeleteItem(item: PlanItem) {
    const ok = await confirm({
      title: `Remove "${item.title}" from the plan?`,
      message: "Sessions already logged against it are not affected.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    await commit(
      (plan?.items ?? []).filter((i) => i.id !== item.id),
      "Removed from the plan",
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 text-center text-sm text-[var(--color-ink-soft)]">
          Loading…
        </main>
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">
            No such dog
          </h1>
          <Link href="/" className="mt-4 text-sm underline">
            Back to the feed
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <DogAvatar dog={dog} />
          <div>
            <h1 className="font-serif text-2xl leading-tight text-[var(--color-ink)]">
              {dog.name}
            </h1>
            <nav className="mt-1 flex gap-3 text-sm">
              <Link
                href={`/dogs/${dog.id}`}
                className="text-[var(--color-ink-soft)] hover:underline"
              >
                Profile
              </Link>
              <span aria-current="page" className="font-medium text-[var(--color-ink)]">
                Weekly plan
              </span>
            </nav>
          </div>
          <Link
            href="/"
            className="ml-auto text-sm text-[var(--color-ink-soft)] hover:underline"
          >
            ← Feed
          </Link>
        </div>

        {!plan && (
          <p className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            No plan yet for {dog.name}.{" "}
            {canEdit
              ? "Use the Add buttons in the grid to build the week."
              : "Log in to build one."}
          </p>
        )}

        <PlanCalendar
          dog={dog}
          plan={plan}
          sessions={sessions}
          canEdit={canEdit}
          onEditItem={setEditing}
          onAddItem={(category, dayOfWeek) =>
            setEditing(
              blankItem(category, dayOfWeek, (plan?.items.length ?? 0) + 1),
            )
          }
        />
      </main>

      {editing && (
        <PlanItemModal
          initial={editing}
          exercises={exercises}
          onSave={handleSaveItem}
          onDelete={
            editing.id ? () => handleDeleteItem(editing) : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
