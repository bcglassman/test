"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManageGate } from "../ManageGate";
import { DogAvatar } from "@/components/DogAvatar";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { dogSubtitle, sessionsForDog } from "@/lib/dog-utils";

export default function ManageDogsPage() {
  return (
    <ManageGate>
      <ManageDogsContent />
    </ManageGate>
  );
}

function ManageDogsContent() {
  const { allDogs, dogs, allSessions, deleteDog, saveDog } = useSessions();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const router = useRouter();

  async function handleDelete(id: string) {
    const dog = allDogs.find((d) => d.id === id);
    if (!dog) return;
    const count = sessionsForDog(allSessions, id, dogs[0]?.id).length;
    const ok = await confirm({
      title: `Delete ${dog.name}?`,
      message:
        count > 0
          ? `${count} session(s) are logged against ${dog.name}. They stay in the database but will no longer belong to any dog. Archiving keeps everything intact instead.`
          : "This can't be undone. Archiving keeps the record instead.",
      confirmLabel: "Delete dog",
    });
    if (!ok) return;
    await deleteDog(id);
    showToast(`${dog.name} deleted`);
  }

  async function toggleArchived(id: string) {
    const dog = allDogs.find((d) => d.id === id);
    if (!dog) return;
    await saveDog({ ...dog, archived: !dog.archived });
    showToast(dog.archived ? `${dog.name} restored` : `${dog.name} archived`);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/manage"
            className="text-sm text-[var(--color-ink-soft)] hover:underline"
          >
            ← Admin
          </Link>
          <h1 className="font-serif text-2xl text-[var(--color-ink)]">Dogs</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/manage/dogs/new")}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          New dog
        </button>
      </div>

      {allDogs.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
          No dogs yet — add the first one to start logging sessions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {allDogs.map((dog) => {
            const count = sessionsForDog(allSessions, dog.id, dogs[0]?.id).length;
            return (
              <li
                key={dog.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
              >
                <DogAvatar dog={dog} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/manage/dogs/${dog.id}`}
                    className="font-medium text-[var(--color-ink)] hover:underline"
                  >
                    {dog.name}
                  </Link>
                  {dog.archived && (
                    <span className="ml-2 rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs text-[var(--color-ink-soft)]">
                      Archived
                    </span>
                  )}
                  <p className="truncate text-sm text-[var(--color-ink-soft)]">
                    {[dogSubtitle(dog), `${count} session${count === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dogs/${dog.id}`}
                    className="rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-sage)]"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleArchived(dog.id)}
                    className="rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-sage)]"
                  >
                    {dog.archived ? "Restore" : "Archive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(dog.id)}
                    aria-label={`Delete ${dog.name}`}
                    className="rounded-full p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-down)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
