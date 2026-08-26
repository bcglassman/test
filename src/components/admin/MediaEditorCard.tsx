"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  InfoIcon,
  PawIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";
import { MediaInfoModal } from "./MediaInfoModal";

/** ISO -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in local time. */
function toDateTimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function MediaEditorCard({
  media,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
  setCount,
}: {
  media: MediaItem;
  onChange: (patch: Partial<MediaItem>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
  /** How many sets this session has, so this item can be reassigned. */
  setCount: number;
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e9e6dd] sm:w-[42%]">
          {media.url && media.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt={media.label}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {media.url && media.type === "video" && (
            <video
              src={media.url}
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
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

        <div className="flex min-w-0 flex-1 flex-col">
          <label className="mb-2 flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1.5">
            <PencilIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-soft)]" />
            <input
              value={media.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Label, e.g. Set 1"
              className="w-full text-sm outline-none"
            />
          </label>

          <textarea
            value={media.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Notes for this clip — what to look for, what went well or badly"
            rows={4}
            className="mb-2 min-h-[5.5rem] w-full flex-1 resize-y rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm leading-relaxed outline-none focus:border-[var(--color-sage)]"
          />

          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Captured at
              </span>
              <input
                type="datetime-local"
                value={toDateTimeLocal(media.capturedAt)}
                onChange={(e) =>
                  onChange({
                    capturedAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-sage)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Active movement (sec)
              </span>
              <input
                type="number"
                min={0}
                value={media.activeMovementSeconds ?? ""}
                onChange={(e) =>
                  onChange({
                    activeMovementSeconds:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-sage)]"
              />
            </label>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
            Set
            <select
              value={media.setNumber}
              onChange={(e) => onChange({ setNumber: Number(e.target.value) })}
              className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-sage)]"
            >
              {Array.from({ length: setCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Set {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-[var(--color-border)] pt-2.5">
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Remove
        </button>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
        >
          <InfoIcon className="h-3.5 w-3.5" />
          Media info
        </button>
      </div>

      {showInfo && (
        <MediaInfoModal media={media} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
