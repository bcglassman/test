"use client";

import type { MediaItem } from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  PawIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";

export function MediaEditorCard({
  media,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  media: MediaItem;
  onChange: (patch: Partial<MediaItem>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="relative mb-2.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#e9e6dd]">
        {media.url && media.type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.label}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {media.url && media.type === "video" && (
          <video src={media.url} muted className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!media.url && <PawIcon className="h-8 w-8 text-[var(--color-ink-soft)]/50" />}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white">
          {media.type === "video" ? (
            <PlayIcon className="h-3 w-3" />
          ) : (
            <ImageIcon className="h-3 w-3" />
          )}
          {media.duration ?? (media.type === "video" ? "video" : "image")}
        </span>
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove("up")}
            className="rounded-md bg-black/55 p-1 text-white disabled:opacity-30"
            aria-label="Move earlier"
          >
            <ArrowUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove("down")}
            className="rounded-md bg-black/55 p-1 text-white disabled:opacity-30"
            aria-label="Move later"
          >
            <ArrowDownIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <label className="mb-2 flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1.5">
        <PencilIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-soft)]" />
        <input
          value={media.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label, e.g. Set 1"
          className="w-full text-sm outline-none"
        />
      </label>
      <input
        value={media.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Note for this clip"
        className="mb-2 w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
      />

      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  );
}
