"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ManageGate } from "../../ManageGate";
import { DogForm } from "@/components/admin/DogForm";
import { useSessions } from "@/lib/sessions-context";
import { useToast } from "@/components/Toast";
import type { Dog } from "@/lib/types";

export default function EditDogPage() {
  return (
    <ManageGate>
      <EditDogContent />
    </ManageGate>
  );
}

function EditDogContent() {
  const params = useParams<{ id: string }>();
  const { allDogs, saveDog } = useSessions();
  const { showToast } = useToast();
  const router = useRouter();
  const dog = allDogs.find((d) => d.id === params.id);

  if (!dog) {
    return (
      <div className="py-16 text-center text-sm text-[var(--color-ink-soft)]">
        No such dog.{" "}
        <Link href="/manage/dogs" className="underline">
          Back to dogs
        </Link>
      </div>
    );
  }

  async function handleSave(next: Dog) {
    const saved = await saveDog(next);
    showToast(`${saved.name} saved`);
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
        {dog.name}
      </h1>
      <DogForm
        key={dog.id}
        dog={dog}
        onSave={handleSave}
        onCancel={() => router.push("/manage/dogs")}
      />
    </>
  );
}
