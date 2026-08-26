/**
 * Reads a file's real capture time out of its own bytes.
 *
 * The File API only exposes `lastModified` — the filesystem timestamp, which
 * is the moment the file was written, not shot. Copy a clip off a phone,
 * download it, or let a tool re-save it, and that time is simply wrong. The
 * capture time the camera recorded lives inside the file:
 *
 *   - JPEG: an EXIF `DateTimeOriginal` tag inside the APP1 segment.
 *   - MP4/MOV: `creation_time` in the `mvhd` atom.
 *
 * Both are parsed here, reading only the leading chunk of the file rather
 * than the whole thing. Anything unparseable falls back to `lastModified`.
 */

/** EXIF stores "YYYY:MM:DD HH:MM:SS" in local time, with no zone. */
function parseExifDateTime(value: string): Date | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Walks a JPEG's APP1/TIFF structure to DateTimeOriginal (0x9003), falling
 * back to DateTime (0x0132) when the original isn't recorded.
 */
function readExifDate(buffer: ArrayBuffer): Date | undefined {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return undefined; // not JPEG

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      // APP1: "Exif\0\0" then a TIFF header.
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return undefined;
      const le = view.getUint16(tiff) === 0x4949; // "II" = little-endian
      const ifd0 = tiff + view.getUint32(tiff + 4, le);
      const dates = new Map<number, string>();

      const readIfd = (start: number): number | undefined => {
        if (start + 2 > view.byteLength) return undefined;
        const count = view.getUint16(start, le);
        let exifIfdPointer: number | undefined;
        for (let i = 0; i < count; i++) {
          const entry = start + 2 + i * 12;
          if (entry + 12 > view.byteLength) break;
          const tag = view.getUint16(entry, le);
          const length = view.getUint32(entry + 4, le);
          const valueOffset = tiff + view.getUint32(entry + 8, le);
          if (tag === 0x8769) {
            exifIfdPointer = tiff + view.getUint32(entry + 8, le);
          } else if (tag === 0x9003 || tag === 0x0132) {
            if (valueOffset + length <= view.byteLength) {
              let text = "";
              for (let c = 0; c < length - 1; c++) {
                text += String.fromCharCode(view.getUint8(valueOffset + c));
              }
              dates.set(tag, text);
            }
          }
        }
        return exifIfdPointer;
      };

      const exifIfd = readIfd(ifd0);
      if (exifIfd) readIfd(exifIfd);

      const raw = dates.get(0x9003) ?? dates.get(0x0132);
      return raw ? parseExifDateTime(raw) : undefined;
    }
    if (marker === 0xda) break; // start of scan — no more metadata
    offset += 2 + size;
  }
  return undefined;
}

/**
 * Finds the `mvhd` atom in an MP4/MOV and reads its creation time, which is
 * counted in seconds from 1904-01-01 (the QuickTime epoch).
 */
function readMp4Date(buffer: ArrayBuffer): Date | undefined {
  const view = new DataView(buffer);
  const EPOCH_OFFSET_SECONDS = 2_082_844_800; // 1904-01-01 -> 1970-01-01

  for (let i = 0; i + 12 < view.byteLength; i++) {
    // 'mvhd'
    if (
      view.getUint8(i) === 0x6d &&
      view.getUint8(i + 1) === 0x76 &&
      view.getUint8(i + 2) === 0x68 &&
      view.getUint8(i + 3) === 0x64
    ) {
      const version = view.getUint8(i + 4);
      let seconds: number;
      if (version === 1) {
        if (i + 20 > view.byteLength) return undefined;
        // 64-bit; the high word is zero for any realistic date.
        seconds = Number(view.getBigUint64(i + 8));
      } else {
        if (i + 12 > view.byteLength) return undefined;
        seconds = view.getUint32(i + 8);
      }
      if (!seconds) return undefined;
      const date = new Date((seconds - EPOCH_OFFSET_SECONDS) * 1000);
      const year = date.getFullYear();
      // Reject nonsense rather than recording a 1904 or far-future date.
      if (year < 1990 || year > new Date().getFullYear() + 1) return undefined;
      return date;
    }
  }
  return undefined;
}

async function head(file: File, bytes: number): Promise<ArrayBuffer> {
  return file.slice(0, Math.min(bytes, file.size)).arrayBuffer();
}

/**
 * The capture time recorded inside the file, or undefined when it carries
 * none. Callers fall back to `lastModified`.
 */
export async function readCaptureTimeFromFile(
  file: File,
): Promise<string | undefined> {
  try {
    if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
      // EXIF lives near the start; 128KB is ample even with a thumbnail.
      const date = readExifDate(await head(file, 128 * 1024));
      return date?.toISOString();
    }
    if (file.type.startsWith("video/")) {
      // mvhd is usually in the leading moov, but trails the media in some
      // recorders — check the head, then the tail before giving up.
      const fromHead = readMp4Date(await head(file, 1024 * 1024));
      if (fromHead) return fromHead.toISOString();
      const tailStart = Math.max(0, file.size - 1024 * 1024);
      if (tailStart > 0) {
        const tail = await file.slice(tailStart).arrayBuffer();
        return readMp4Date(tail)?.toISOString();
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}
