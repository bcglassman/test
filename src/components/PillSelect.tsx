"use client";

import { ChevronDownIcon } from "./icons";

export function PillSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-4 pr-9 text-sm font-medium text-[var(--color-ink)] outline-none hover:border-[var(--color-sage)] focus:border-[var(--color-sage)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-soft)]" />
    </div>
  );
}
