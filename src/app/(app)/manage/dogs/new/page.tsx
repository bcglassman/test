"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManageGate } from "../../ManageGate";
import { DogForm, blankDog } from "@/components/admin/DogForm";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";
import type { Dog } from "@/lib/types";

export default function NewDogPage() {
  return (
    <ManageGate>
      <NewDogContent />
    </ManageGate>
  );
}

function NewDogContent() {
  const { saveDog, selectDog } = useSessions();
  const { showToast } = useToast();
  const router = useRouter();

  async function handleSave(dog: Dog) {
    const saved = await saveDog(dog);
    // A dog you just added is almost certainly the one you want to look at.
    selectDog(saved.id);
    showToast(`${saved.name} added`);
    router.push("/manage/dogs");
  }

  return (
    <>
      <Link
        href="/manage/dogs"
        className="text-sm text-[var(--color-ink-soft)] hover:underline"
      >
        ← Dogs
      </Link>
      <h1 className="mb-6 font-serif text-2xl text-[var(--color-ink)]">
        New dog
      </h1>
      <DogForm
        dog={blankDog()}
        onSave={handleSave}
        onCancel={() => router.push("/manage/dogs")}
      />
    </>
  );
}
