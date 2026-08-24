import type { MediaItem, MediaType } from "./types";
import { newMediaId } from "./data-source";

export function mediaFromFile(file: File, order: number): MediaItem {
  const type: MediaType = file.type.startsWith("video") ? "video" : "image";
  return {
    id: newMediaId(),
    type,
    url: URL.createObjectURL(file),
    label: type === "video" ? "New clip" : "New image",
    notes: "",
    order,
  };
}
