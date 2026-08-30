"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import {
  ImageIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PawIcon,
  PlayIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "./icons";

/** A gentle deterministic gradient so placeholder cards aren't all identical. */
function gradientFor(seed: string) {
  const gradients = [
    "from-[#e4e1d8] to-[#c9c4b4]",
    "from-[#dfe3dc] to-[#bcc4b4]",
    "from-[#e8ded2] to-[#c7b9a3]",
    "from-[#dde2e6] to-[#b9c2c9]",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

// Down to 0.1x for frame-by-frame form review. Browsers mute audio below
// ~0.5x anyway, which is fine here since clips start muted.
const SPEEDS = [1, 0.5, 0.25, 0.1];

function finiteDuration(video: HTMLVideoElement): number | undefined {
  return Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : undefined;
}

/** 8.42 -> "0:08", or "0:08.4" when tenths matter (slow-motion review). */
function formatPlaybackTime(seconds: number, withTenths: boolean): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  const whole = String(Math.floor(secs)).padStart(2, "0");
  if (!withTenths) return `${mins}:${whole}`;
  const tenths = Math.floor((secs - Math.floor(secs)) * 10);
  return `${mins}:${whole}.${tenths}`;
}

function VideoPlayer({ media }: { media: MediaItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Audio starts off: the feed can show several clips at once, and these are
  // form-review videos where the picture is the point.
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = SPEEDS[speedIndex];
  }, [speedIndex]);

  // React doesn't reliably reflect `muted` as an attribute on first render,
  // so mirror it onto the element directly.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Below 1x you are stepping through frames, so tenths are the useful unit.
  const showTenths = SPEEDS[speedIndex] < 1;

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setHasStarted(true);
    } else {
      v.pause();
    }
  }

  function cycleSpeed(e: React.MouseEvent) {
    e.stopPropagation();
    setSpeedIndex((i) => (i + 1) % SPEEDS.length);
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    setIsMuted((m) => !m);
  }

  function toggleFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black data-[fullscreen=true]:aspect-auto data-[fullscreen=true]:h-full data-[fullscreen=true]:w-full"
      data-fullscreen={isFullscreen}
    >
      <video
        ref={videoRef}
        src={media.url}
        playsInline
        muted={isMuted}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        // A stream the browser reports as unbounded has no duration to
        // show. WebM written by MediaRecorder — which is what the uploader
        // produces (see video-compress.ts) — often reports a short or
        // infinite duration until the browser has played through it, and
        // refines it later, so take the update whenever it comes.
        onLoadedMetadata={(e) => setDuration(finiteDuration(e.currentTarget))}
        onDurationChange={(e) => setDuration(finiteDuration(e.currentTarget))}
        onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onClick={togglePlay}
        className={`absolute inset-0 h-full w-full cursor-pointer ${
          isFullscreen ? "object-contain" : "object-cover"
        }`}
      />

      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/10 text-white transition-colors hover:bg-black/20"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <PlayIcon className="h-6 w-6 translate-x-0.5" />
          </span>
        </button>
      )}

      {hasStarted && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5"
        >
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute" : "Mute"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"
          >
            {isMuted ? (
              <VolumeOffIcon className="h-4 w-4" />
            ) : (
              <VolumeOnIcon className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label="Playback speed"
            title="Playback speed — 1x, slow, slower, ultra-slow"
            className="rounded-md px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
          >
            {SPEEDS[speedIndex]}×
          </button>
          {/* Where you are in the clip. Watch items are pinned to a time,
              so this is what you match them against. Below 1x it shows
              tenths, since that is the speed you step frames at. */}
          <span className="ml-1 select-none font-mono text-xs tabular-nums text-white/90">
            {formatPlaybackTime(currentTime, showTenths)}
            {duration !== undefined && (
              <span className="text-white/55">
                {" / "}
                {/* Same precision on both sides, and never a total below
                    where we already are — otherwise 5.9s of a 5.9s clip
                    reads as "0:05.9 / 0:05". See onDurationChange above. */}
                {formatPlaybackTime(Math.max(duration, currentTime), showTenths)}
              </span>
            )}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Maximize"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"
          >
            {isFullscreen ? (
              <MinimizeIcon className="h-4 w-4" />
            ) : (
              <MaximizeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {media.label}
      </span>
      {!hasStarted && media.duration && (
        <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <PlayIcon className="h-3 w-3" />
          {media.duration}
        </span>
      )}
    </div>
  );
}

/** "12 Aug, 3:40 PM" — when the clip was actually shot, if known. */
function CapturedAt({ iso }: { iso?: string }) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
      {date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}
    </p>
  );
}

export function MediaThumb({ media }: { media: MediaItem }) {
  if (media.url && media.type === "video") {
    return (
      <figure className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <VideoPlayer media={media} />
        {(media.notes || media.capturedAt) && (
          <figcaption className="whitespace-pre-line px-3 py-2.5 text-sm text-[var(--color-ink-soft)]">
            {media.notes}
            <CapturedAt iso={media.capturedAt} />
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${gradientFor(
          media.id,
        )}`}
      >
        {media.url && media.type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.label}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {media.label}
        </span>
        {media.type === "image" && !media.url && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-black/55 p-1.5 text-white backdrop-blur-sm">
            <ImageIcon className="h-3.5 w-3.5" />
          </span>
        )}
        {!media.url && <PawIcon className="h-10 w-10 text-white/70" />}
      </div>
      {(media.notes || media.capturedAt) && (
        <figcaption className="whitespace-pre-line px-3 py-2.5 text-sm text-[var(--color-ink-soft)]">
          {media.notes}
          <CapturedAt iso={media.capturedAt} />
        </figcaption>
      )}
    </figure>
  );
}
