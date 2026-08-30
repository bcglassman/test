"use client";

import { useState } from "react";
import type { WatchItem } from "@/lib/types";
import {
  formatTimecode,
  parseTimecode,
  sortWatchItems,
} from "@/lib/session-utils";
import { CloseIcon, ImageIcon, PlusIcon, SparkleIcon } from "../icons";
import { refineWatchItem } from "@/lib/actions/refine-watch-item";
import {
  suggestWatchItemFromFrames,
  type WatchItemSuggestion,
} from "@/lib/actions/suggest-watch-item";
import { captureFramesAround, type CapturedFrame } from "@/lib/video-frames";

/**
 * The rows for editing a set's watch items — short things to look for,
 * each optionally pinned to a moment in that set's clip.
 *
 * Shared by the session form and the feed's inline editor so the two can't
 * drift apart; the timecode parsing in particular is fiddly enough that
 * one copy is the point.
 */
export function WatchItemsEditor({
  items,
  onChange,
  autoFocusLast = false,
  exerciseName,
  videoUrl,
  dogObservations,
}: {
  items: WatchItem[];
  onChange: (items: WatchItem[]) => void;
  /** Focus a freshly added row — useful when adding is the way in. */
  autoFocusLast?: boolean;
  /** Context for the AI rewrite; it words things better knowing the exercise. */
  exerciseName?: string;
  /** This set's clip. Without one there are no frames to look at. */
  videoUrl?: string;
  /** Standing notes on how this dog moves, as context for the frames. */
  dogObservations?: string;
}) {
  // What each timecode box shows while it's being typed. Without this,
  // "0:" would be parsed to 0 and reformatted to "0:00" under the cursor.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  // What each row said before the AI rewrote it, so a bad rewrite is one
  // click away from being put back.
  const [beforeRefine, setBeforeRefine] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [lookingIndex, setLookingIndex] = useState<number | null>(null);
  const [proposal, setProposal] = useState<{
    index: number;
    frames: CapturedFrame[];
    result: WatchItemSuggestion;
  } | null>(null);

  function timecodeValue(index: number, item: WatchItem) {
    const draft = drafts[index];
    if (draft !== undefined) return draft;
    return item.atSeconds === undefined ? "" : formatTimecode(item.atSeconds);
  }

  function update(index: number, patch: Partial<WatchItem>) {
    onChange(items.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  async function refine(index: number) {
    const original = items[index].text.trim();
    if (!original) {
      setError("Write the observation first, then refine it.");
      return;
    }
    setError(null);
    setRefiningIndex(index);
    try {
      const rewritten = await refineWatchItem(original, exerciseName);
      setBeforeRefine((b) => ({ ...b, [index]: original }));
      update(index, { text: rewritten });
    } catch {
      setError("Couldn't reach the AI. Your wording is unchanged.");
    } finally {
      setRefiningIndex(null);
    }
  }

  /**
   * Samples frames either side of the row's timestamp and asks what is
   * visible there. Nothing is written into the note until the handler
   * accepts it — see the action for why that matters.
   */
  async function suggestFromVideo(index: number) {
    const at = items[index].atSeconds;
    if (!videoUrl || at === undefined) return;
    setError(null);
    setProposal(null);
    setLookingIndex(index);
    try {
      const frames = await captureFramesAround(videoUrl, at);
      const result = await suggestWatchItemFromFrames(
        frames.map((f) => ({ base64: f.base64, atSeconds: f.atSeconds })),
        { exerciseName, atSeconds: at, draft: items[index].text, dogObservations },
      );
      setProposal({ index, frames, result });
    } catch {
      setError("Couldn't read the clip or reach the AI. Nothing was changed.");
    } finally {
      setLookingIndex(null);
    }
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-ink-soft)]">
          Nothing flagged for this set.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
              <input
                value={item.text}
                onChange={(e) => update(i, { text: e.target.value })}
                maxLength={140}
                autoFocus={autoFocusLast && i === items.length - 1}
                placeholder="e.g. left knee flaring"
                className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-sage)]"
              />
              <input
                value={timecodeValue(i, item)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDrafts((d) => ({ ...d, [i]: raw }));
                  update(i, { atSeconds: parseTimecode(raw) });
                }}
                onBlur={() => {
                  // Re-order on commit rather than on every keystroke —
                  // rows shuffling under the cursor while you type a time
                  // would be unusable. Drafts are keyed by position, so
                  // they have to go when the positions change.
                  setDrafts({});
                  onChange(sortWatchItems(items));
                }}
                placeholder="0:07"
                aria-label={`Video timestamp for watch item ${i + 1}`}
                title="Where in this set's video it shows, e.g. 0:07"
                className="w-16 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[var(--color-sage)]"
              />
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => suggestFromVideo(i)}
                  disabled={item.atSeconds === undefined || lookingIndex !== null}
                  aria-label={`Suggest watch item ${i + 1} from the video`}
                  title={
                    item.atSeconds === undefined
                      ? "Set a timestamp first — that's the moment it looks at"
                      : "Look at the frames around this moment and suggest a note"
                  }
                  className="rounded-md p-1.5 text-[var(--color-sage-dark)] hover:bg-[var(--color-sage-tint)] disabled:opacity-40"
                >
                  <ImageIcon
                    className={`h-4 w-4 ${lookingIndex === i ? "animate-pulse" : ""}`}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => refine(i)}
                disabled={refiningIndex !== null}
                aria-label={`Reword watch item ${i + 1}`}
                title="Reword in canine-rehab terminology — says the same thing, in the field's vocabulary"
                className="rounded-md p-1.5 text-[var(--color-sage-dark)] hover:bg-[var(--color-sage-tint)] disabled:opacity-50"
              >
                <SparkleIcon
                  className={`h-4 w-4 ${refiningIndex === i ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  // Drafts and undo text are keyed by position, so they'd
                  // point at the wrong rows once one is removed.
                  setDrafts({});
                  setBeforeRefine({});
                  onChange(items.filter((_, j) => j !== i));
                }}
                aria-label={`Remove watch item ${i + 1}`}
                className="rounded-md p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-down)]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
              </div>
              {proposal?.index === i && (
                <FramesProposal
                  proposal={proposal}
                  onUse={() => {
                    update(i, { text: proposal.result.suggestion });
                    setProposal(null);
                  }}
                  onDismiss={() => setProposal(null)}
                />
              )}
              {beforeRefine[i] !== undefined &&
                beforeRefine[i] !== item.text && (
                  <p className="pl-1 text-xs text-[var(--color-ink-soft)]">
                    Was: &ldquo;{beforeRefine[i]}&rdquo;{" "}
                    <button
                      type="button"
                      onClick={() => {
                        update(i, { text: beforeRefine[i] });
                        setBeforeRefine((b) => {
                          const next = { ...b };
                          delete next[i];
                          return next;
                        });
                      }}
                      className="font-medium text-[var(--color-sage-dark)] hover:underline"
                    >
                      Undo
                    </button>
                  </p>
                )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-down)]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, { text: "" }])}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--color-sage-dark)] hover:underline"
      >
        <PlusIcon className="h-3 w-3" />
        Add watch item
      </button>
    </div>
  );
}

const CONFIDENCE_STYLE: Record<
  WatchItemSuggestion["confidence"],
  { label: string; className: string }
> = {
  high: { label: "Clearly visible", className: "bg-[var(--color-up)] text-white" },
  medium: {
    label: "Partly visible",
    className: "bg-[#c9a13c] text-white",
  },
  low: {
    label: "Frames don't really show this",
    className: "bg-[var(--color-down)] text-white",
  },
};

/**
 * What the frames were and what came back from them.
 *
 * The frames are shown deliberately: the suggestion is only as good as
 * what the camera caught, and the handler needs to be able to see for
 * themselves before accepting a sentence into their own record. The
 * confidence and limitations sit next to the Use button for the same
 * reason — they are the reason to hesitate, so they belong where the
 * decision is made.
 */
function FramesProposal({
  proposal,
  onUse,
  onDismiss,
}: {
  proposal: { frames: CapturedFrame[]; result: WatchItemSuggestion };
  onUse: () => void;
  onDismiss: () => void;
}) {
  const { frames, result } = proposal;
  const confidence = CONFIDENCE_STYLE[result.confidence];

  return (
    <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-white p-2.5">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {frames.map((f) => (
          <figure key={f.atSeconds} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- a canvas data URL, not a served asset */}
            <img
              src={f.dataUrl}
              alt={`Frame at ${f.atSeconds} seconds`}
              className="h-16 rounded border border-[var(--color-border)]"
            />
            <figcaption className="mt-0.5 text-center text-[10px] tabular-nums text-[var(--color-ink-soft)]">
              {f.atSeconds}s
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-2 text-sm text-[var(--color-ink)]">{result.suggestion}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${confidence.className}`}
        >
          {confidence.label}
        </span>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--color-ink-soft)]">
          {result.limitations}
        </p>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onUse}
          className="rounded-full bg-[var(--color-sage)] px-3.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-sage-dark)]"
        >
          Use this wording
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-[var(--color-border)] px-3.5 py-1 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-cream)]"
        >
          Dismiss
        </button>
        <span className="text-[11px] text-[var(--color-ink-soft)]">
          You&rsquo;re accepting this into your own record — check it against
          the clip.
        </span>
      </div>
    </div>
  );
}
