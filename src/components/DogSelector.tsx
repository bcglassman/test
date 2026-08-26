"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, PlusIcon } from "./icons";
import { DogAvatar } from "./DogAvatar";
import { useSessions } from "@/lib/sessions-context";
import { dogSubtitle } from "@/lib/dog-utils";

/**
 * Which dog the app is looking at. The choice is held in the sessions
 * context and remembered in localStorage, so it follows the user between
 * the Feed and Sessions and survives a reload.
 */
export function DogSelector() {
  // Managing dogs keys off being signed in, not off a role. Roles here are
  // presentation only — they never gate what the API returns — so hanging
  // data entry off one just risks locking out an account whose role isn't
  // what you expect.
  const { dogs, selectedDog, selectDog, user } = useSessions();
  const canManage = Boolean(user);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!selectedDog) {
    // No dogs on record. An admin gets the way in; anyone else gets nothing
    // rather than a control that leads nowhere.
    if (!canManage) return null;
    return (
      <Link
        href="/manage/dogs/new"
        className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-sage)] hover:text-[var(--color-ink)]"
      >
        <PlusIcon className="h-3 w-3" />
        Add a dog
      </Link>
    );
  }

  // One dog and no way to add another: a picker would be a dead control.
  const pickable = dogs.length > 1 || canManage;
  if (!pickable) {
    return (
      <Link
        href={`/dogs/${selectedDog.id}`}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-2 py-1.5 pr-3.5 text-sm hover:border-[var(--color-sage)]"
      >
        <DogAvatar dog={selectedDog} size="sm" />
        <span className="font-medium text-[var(--color-ink)]">
          {selectedDog.name}
        </span>
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected dog: ${selectedDog.name}. Change dog`}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-2 py-1.5 pr-3 text-sm hover:border-[var(--color-sage)]"
      >
        <DogAvatar dog={selectedDog} size="sm" />
        <span className="font-medium text-[var(--color-ink)]">
          {selectedDog.name}
        </span>
        <ChevronDownIcon className="h-3 w-3 text-[var(--color-ink-soft)]" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-lg"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {dogs.map((dog) => (
              <li key={dog.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={dog.id === selectedDog.id}
                  onClick={() => {
                    selectDog(dog.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--color-cream)] ${
                    dog.id === selectedDog.id ? "bg-[var(--color-sage-tint)]" : ""
                  }`}
                >
                  <DogAvatar dog={dog} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--color-ink)]">
                      {dog.name}
                    </span>
                    {dogSubtitle(dog) && (
                      <span className="block truncate text-xs text-[var(--color-ink-soft)]">
                        {dogSubtitle(dog)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--color-border)]">
            <Link
              href={`/dogs/${selectedDog.id}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
            >
              View {selectedDog.name}&rsquo;s profile
            </Link>
            {canManage && (
              <>
                <Link
                  href={`/manage/dogs/${selectedDog.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
                >
                  Edit {selectedDog.name}
                </Link>
                <Link
                  href="/manage/dogs/new"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
                >
                  Add a dog
                </Link>
                <Link
                  href="/manage/dogs"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
                >
                  Manage dogs
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
