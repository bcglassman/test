import type { MediaItem } from "@/lib/types";
import { ImageIcon, PawIcon, PlayIcon } from "./icons";

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

export function MediaThumb({ media }: { media: MediaItem }) {
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
        {media.url && media.type === "video" && (
          <video
            src={media.url}
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {media.label}
        </span>
        {media.type === "video" && media.duration && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <PlayIcon className="h-3 w-3" />
            {media.duration}
          </span>
        )}
        {media.type === "image" && !media.url && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-black/55 p-1.5 text-white backdrop-blur-sm">
            <ImageIcon className="h-3.5 w-3.5" />
          </span>
        )}
        {!media.url && <PawIcon className="h-10 w-10 text-white/70" />}
      </div>
      {media.notes && (
        <figcaption className="px-3 py-2.5 text-sm text-[var(--color-ink-soft)]">
          {media.notes}
        </figcaption>
      )}
    </figure>
  );
}
