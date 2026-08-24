import type { Media as PayloadMedia } from "@/payload-types";
import type { MediaItem, MediaType } from "./types";
import { payloadUpload } from "./payload-client";

/** Uploads a file to the CMS's media library and returns a ready-to-use MediaItem. */
export async function mediaFromFile(
  file: File,
  order: number,
): Promise<MediaItem> {
  const type: MediaType = file.type.startsWith("video") ? "video" : "image";
  const { doc } = await payloadUpload<{ doc: PayloadMedia }>("media", file, {
    alt: file.name,
  });
  return {
    id: crypto.randomUUID(),
    type,
    url: doc.url ?? "",
    fileId: String(doc.id),
    label: type === "video" ? "New clip" : "New image",
    notes: "",
    order,
  };
}
