"use client";

import { useEffect } from "react";
import type { MediaItem } from "@/lib/types";
import { CloseIcon } from "@/components/icons";

function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function formatWhen(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Read-only detail panel for one clip or photo, with inline playback. */
export function MediaInfoModal({
  media,
  onClose,
}: {
  media: MediaItem;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: [string, string | undefined][] = [
    ["File name", media.fileName],
    ["Type", media.mimeType ?? media.type],
    ["Size", formatBytes(media.fileSize)],
    [
      "Dimensions",
      media.width && media.height ? `${media.width} × ${media.height}` : undefined,
    ],
    ["Duration", media.duration],
    [
      "Active movement",
      media.activeMovementSeconds === undefined
        ? undefined
        : `${media.activeMovementSeconds}s`,
    ],
    ["Captured at", formatWhen(media.capturedAt)],
    ["Set", `Set ${media.setNumber}`],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media details"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-serif text-xl text-[var(--color-ink)]">
            {media.label || media.fileName || "Media"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {media.url && (
          <div className="mb-4 overflow-hidden rounded-xl bg-black">
            {media.type === "video" ? (
              <video
                src={media.url}
                controls
                playsInline
                className="max-h-[50vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.url}
                alt={media.label}
                className="max-h-[50vh] w-full object-contain"
              />
            )}
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows
            .filter(([, value]) => value)
            .map(([term, value]) => (
              <div key={term} className="flex justify-between gap-3 border-b border-[var(--color-border)] py-1.5">
                <dt className="text-sm text-[var(--color-ink-soft)]">{term}</dt>
                <dd className="min-w-0 break-all text-right text-sm text-[var(--color-ink)]">
                  {value}
                </dd>
              </div>
            ))}
        </dl>

        {media.notes && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Notes
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
              {media.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
