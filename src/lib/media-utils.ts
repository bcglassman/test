import type { Media as PayloadMedia } from "@/payload-types";
import type { MediaItem, MediaType } from "./types";
import { payloadUpload } from "./payload-client";
import { compressVideo } from "./video-compress";

/**
 * Local-only id for a media row, used as a React key while editing. The CMS
 * assigns the real ids on save.
 *
 * Deliberately not `crypto.randomUUID()`: browsers only expose that in a
 * secure context, so it is undefined when the app is served over plain HTTP
 * from a bare IP or LAN host — which threw and made every upload look like it
 * had failed, even though the file had uploaded fine.
 */
let mediaRowCounter = 0;
function localMediaId(): string {
  mediaRowCounter += 1;
  return `row-${Date.now().toString(36)}-${mediaRowCounter}`;
}

/**
 * Uploads a file to the CMS's media library and returns a ready-to-use
 * MediaItem. Videos are re-encoded smaller first (see video-compress.ts);
 * `onCompressProgress` reports that phase, which runs in real time.
 */
export async function mediaFromFile(
  file: File,
  order: number,
  setNumber: number,
  onCompressProgress?: (fraction: number) => void,
  /** Overrides the capture time, for sources that report a better one than the file itself (e.g. Drive). */
  capturedAt?: string,
): Promise<MediaItem> {
  const type: MediaType = file.type.startsWith("video") ? "video" : "image";
  // Read this before compressing — re-encoding produces a brand-new File
  // whose lastModified is "now", which would lose the original capture time.
  const captured = capturedAt ?? capturedAtFromFile(file);
  const upload =
    type === "video" ? await compressVideo(file, {}, onCompressProgress) : file;
  const { doc } = await payloadUpload<{ doc: PayloadMedia }>("media", upload, {
    alt: file.name,
  });
  return {
    id: localMediaId(),
    type,
    setNumber,
    url: doc.url ?? "",
    fileId: String(doc.id),
    label: `Set ${setNumber}`,
    notes: "",
    capturedAt: captured,
    order,
  };
}

/**
 * Best available capture time for a locally-picked file. Browsers don't
 * expose EXIF, so `lastModified` is what there is — accurate for files
 * straight off a camera or phone, less so for ones that have been copied
 * around. Undefined rather than a guess when it looks unusable.
 */
function capturedAtFromFile(file: File): string | undefined {
  if (!file.lastModified) return undefined;
  const date = new Date(file.lastModified);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return undefined;
  // Guard against clock-skewed files dated in the future.
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return undefined;
  return date.toISOString();
}
