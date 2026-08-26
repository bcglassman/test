"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManageGate } from "../ManageGate";
import { DogAvatar } from "@/components/DogAvatar";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { useSessions } from "@/lib/sessions-context";
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
  const { allDogs, dogs, allSessions, saveDog } = useSessions();
  const { showToast } = useToast();
  const router = useRouter();

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

      <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
        Archiving keeps a dog&rsquo;s record and its sessions while taking them
        out of the dog selector — it&rsquo;s what you want almost every time.
        Deleting a dog outright is done in the{" "}
        <Link href="/admin/collections/dogs" className="underline">
          CMS admin panel
        </Link>
        .
      </p>

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
                  <Link
                    href={`/manage/dogs/${dog.id}`}
                    aria-label={`Edit ${dog.name}`}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-sage)]"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
