"use client";

import { useEffect, useRef, useState } from "react";
import type { AppUser, Dog } from "@/lib/types";
import { DogAvatar } from "../DogAvatar";
import { StringListEditor } from "./StringListEditor";
import { UploadIcon } from "../icons";
import { uploadImage } from "@/lib/media-utils";
import { getUsers } from "@/lib/data-source";
import { ROLE_LABELS } from "@/lib/roles";

export function blankDog(): Dog {
  // Empty id marks a dog that hasn't been created yet — saveDog() uses it
  // to decide POST (create) vs PATCH (update).
  return { id: "", name: "", trainingGoals: [], restrictions: [], archived: false };
}

/** Payload stores dates as ISO; the date input wants YYYY-MM-DD. */
function toDateInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)]";

export function DogForm({
  dog,
  onSave,
  onCancel,
}: {
  dog: Dog;
  onSave: (dog: Dog) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Dog>(dog);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only a signed-in request gets the user list; without it the owner and
    // trainer pickers simply don't appear.
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  function patch(next: Partial<Dog>) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handlePhoto(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const { id, url } = await uploadImage(file);
      patch({ photoId: id, photoUrl: url });
    } catch {
      setError("Couldn't upload that photo. Make sure you're logged in.");
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function toggleAssignment(field: "ownerIds" | "trainerIds", userId: string) {
    const current = form[field] ?? [];
    patch({
      [field]: current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Give the dog a name.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        // Blank rows are an artefact of the list editor, not data.
        trainingGoals: (form.trainingGoals ?? []).filter((g) => g.trim()),
        restrictions: (form.restrictions ?? []).filter((r) => r.trim()),
      });
    } catch {
      setError("Couldn't save this dog. Make sure you're logged in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <DogAvatar dog={form} size="lg" />
        <div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
            }}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-sage)] disabled:opacity-60"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            {isUploading
              ? "Uploading…"
              : form.photoUrl
                ? "Replace photo"
                : "Add photo"}
          </button>
          {form.photoUrl && (
            <button
              type="button"
              onClick={() => patch({ photoId: undefined, photoUrl: undefined })}
              className="ml-3 text-sm text-[var(--color-ink-soft)] hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Breed">
          <input
            type="text"
            value={form.breed ?? ""}
            onChange={(e) => patch({ breed: e.target.value || undefined })}
            className={inputClass}
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={toDateInput(form.dateOfBirth)}
            onChange={(e) =>
              patch({
                dateOfBirth: e.target.value
                  ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
                  : undefined,
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Sex">
          <select
            value={form.sex ?? ""}
            onChange={(e) =>
              patch({ sex: (e.target.value || undefined) as Dog["sex"] })
            }
            className={inputClass}
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Weight (kg)">
          <input
            type="number"
            step="0.1"
            min="0"
            value={form.weightKg ?? ""}
            onChange={(e) =>
              patch({
                weightKg: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Training focus">
          <input
            type="text"
            value={form.trainingFocus ?? ""}
            placeholder="e.g. Hind-limb strength after CCL repair"
            onChange={(e) =>
              patch({ trainingFocus: e.target.value || undefined })
            }
            className={inputClass}
          />
        </Field>
      </div>

      <StringListEditor
        label="Training goals"
        items={form.trainingGoals ?? []}
        onChange={(trainingGoals) => patch({ trainingGoals })}
        placeholder="e.g. Even weight-bearing through both hind limbs"
        addLabel="Add goal"
      />

      <StringListEditor
        label="Restrictions"
        items={form.restrictions ?? []}
        onChange={(restrictions) => patch({ restrictions })}
        placeholder="e.g. No jumping above hock height"
        addLabel="Add restriction"
      />

      <Field label="Movement observations">
        <textarea
          rows={3}
          value={form.movementObservations ?? ""}
          onChange={(e) =>
            patch({ movementObservations: e.target.value || undefined })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value || undefined })}
          className={inputClass}
        />
      </Field>

      {users.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">
            People
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Who this dog belongs to and who trains them. This is recorded for
            the record only — it does not yet limit what anyone can see.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {(["ownerIds", "trainerIds"] as const).map((field) => (
              <div key={field}>
                <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
                  {field === "ownerIds" ? "Owners" : "Trainers"}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {users.map((u) => (
                    <li key={u.id}>
                      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={(form[field] ?? []).includes(u.id)}
                          onChange={() => toggleAssignment(field, u.id)}
                        />
                        <span>
                          {u.name || u.email}
                          {u.role && (
                            <span className="ml-1.5 text-xs text-[var(--color-ink-soft)]">
                              {ROLE_LABELS[u.role]}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
        <input
          type="checkbox"
          checked={form.archived ?? false}
          onChange={(e) => patch({ archived: e.target.checked })}
        />
        Archived — keep the record but hide from the dog selector
      </label>

      {error && (
        <p className="text-sm text-[var(--color-down)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[var(--color-sage)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-sage-dark)] disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save dog"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
