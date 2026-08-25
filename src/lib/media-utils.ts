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
): Promise<MediaItem> {
  const type: MediaType = file.type.startsWith("video") ? "video" : "image";
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
    order,
  };
}
