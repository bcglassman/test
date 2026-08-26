"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchRatingLibrary,
  type LibraryRating,
} from "@/lib/rating-library";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";

/**
 * Searchable picker over the rating catalogue. It's a combobox rather than a
 * <select> because the library runs to dozens of entries across many
 * categories — scrolling a flat option list isn't workable.
 */
export function RatingLibraryPicker({
  onPick,
  label = "Start from the library",
  placeholder = "Search ratings…",
}: {
  onPick: (entry: LibraryRating) => void;
  label?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => searchRatingLibrary(query), [query]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function choose(entry: LibraryRating) {
    onPick(entry);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[highlighted]) {
      // Don't submit the surrounding form — this Enter picks a rating.
      e.preventDefault();
      choose(matches[highlighted]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-ink-soft)]">
        {label}
      </span>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="rating-library-list"
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] py-2 pl-3 pr-16 text-sm outline-none focus:border-[var(--color-sage)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHighlighted(0);
            }}
            aria-label="Clear search"
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide ratings" : "Show ratings"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul
          id="rating-library-list"
          ref={listRef}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-3 text-sm text-[var(--color-ink-soft)]">
              No ratings match “{query}”.
            </li>
          )}
          {matches.map((entry, i) => {
            // Heading only where the category changes from the row above.
            const showCategory = entry.category !== matches[i - 1]?.category;
            return (
              <li key={entry.key}>
                {showCategory && (
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                    {entry.category}
                  </p>
                )}
                <button
                  type="button"
                  data-index={i}
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => choose(entry)}
                  className={`block w-full px-3 py-1.5 text-left ${
                    i === highlighted ? "bg-[var(--color-sage-tint)]" : ""
                  }`}
                >
                  <span className="block text-sm text-[var(--color-ink)]">
                    {entry.label}
                  </span>
                  <span className="block text-xs leading-snug text-[var(--color-ink-soft)]">
                    {entry.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
