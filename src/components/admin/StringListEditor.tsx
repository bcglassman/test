"use client";

import { PlusIcon, TrashIcon } from "../icons";

/** Editable list of short one-line entries — goals, restrictions, and so on. */
export function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel = "Add",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
        {label}
      </span>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = items.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
              className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${label.toLowerCase()} entry ${i + 1}`}
              className="rounded-full p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)] hover:text-[var(--color-down)]"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-sage-dark)] hover:underline"
      >
        <PlusIcon className="h-3 w-3" />
        {addLabel}
      </button>
    </div>
  );
}
