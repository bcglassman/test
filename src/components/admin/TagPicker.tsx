"use client";

import { useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";

/**
 * Multi-select over a suggested list, with custom values allowed.
 *
 * Focus and Equipment are both open vocabularies: the seeded values cover
 * the common cases and keep wording consistent for filtering later, but a
 * library that can't name something new isn't much of a library.
 */
export function TagPicker({
  label,
  hint,
  options,
  selected,
  onChange,
  allowCustom = true,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState("");

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  function addCustom() {
    const value = custom.trim();
    if (!value || selected.includes(value)) {
      setCustom("");
      return;
    }
    onChange([...selected, value]);
    setCustom("");
  }

  // Anything chosen that isn't in the suggested list — shown so it can be
  // removed as easily as a suggested one.
  const extras = selected.filter((v) => !options.includes(v));

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
        {label}
        {hint && <span className="ml-1.5 font-normal">· {hint}</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-[var(--color-sage)] bg-[var(--color-sage)] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink-soft)] hover:border-[var(--color-sage)]"
              }`}
            >
              {option}
            </button>
          );
        })}
        {extras.map((extra) => (
          <span
            key={extra}
            className="flex items-center gap-1 rounded-full border border-[var(--color-sage)] bg-[var(--color-sage)] px-3 py-1 text-xs font-medium text-white"
          >
            {extra}
            <button
              type="button"
              onClick={() => toggle(extra)}
              aria-label={`Remove ${extra}`}
              className="hover:opacity-70"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {allowCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add your own…"
            className="w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
          />
          <button
            type="button"
            onClick={addCustom}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
          >
            <PlusIcon className="h-3 w-3" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
