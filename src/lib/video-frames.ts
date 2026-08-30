/**
 * Pulls still frames out of a clip around a moment, in the browser.
 *
 * Deliberately client-side, like the upload compressor: the video is
 * already downloaded and decodable here, and the alternative — shipping
 * clips back to the server to run ffmpeg — would be slow and memory-hungry
 * on the small droplet this deploys to.
 */

export interface CapturedFrame {
  /** JPEG data URL, for previewing in the UI. */
  dataUrl: string;
  /** Base64 payload without the data-URL prefix, for the API. */
  base64: string;
  /** Where in the clip this frame came from. */
  atSeconds: number;
}

/** Wide enough for detail, small enough to stay cheap to send and read. */
const MAX_WIDTH = 768;
const SEEK_TIMEOUT_MS = 4000;

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out seeking the video.")),
      SEEK_TIMEOUT_MS,
    );
    function done() {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    }
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

function loadMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out loading the video.")),
      SEEK_TIMEOUT_MS * 2,
    );
    video.addEventListener(
      "loadeddata",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Couldn't load the video."));
      },
      { once: true },
    );
  });
}

/**
 * Frames spanning `count` samples `spacing` seconds apart, centred on
 * `atSeconds` and clamped to the clip. Ordered earliest first, so what
 * reads them sees the movement in the order it happened.
 */
export async function captureFramesAround(
  url: string,
  atSeconds: number,
  { count = 7, spacing = 0.25 }: { count?: number; spacing?: number } = {},
): Promise<CapturedFrame[]> {
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Same-origin media, so the canvas stays untainted and readable.
  video.crossOrigin = "anonymous";

  await loadMetadata(video);

  const duration = Number.isFinite(video.duration) ? video.duration : undefined;
  const half = ((count - 1) / 2) * spacing;
  const wanted = Array.from({ length: count }, (_, i) => atSeconds - half + i * spacing)
    .map((t) => Math.max(0, duration === undefined ? t : Math.min(t, duration - 0.05)))
    .filter((t, i, all) => i === 0 || Math.abs(t - all[i - 1]) > 0.01);

  const scale = Math.min(1, MAX_WIDTH / (video.videoWidth || MAX_WIDTH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((video.videoWidth || MAX_WIDTH) * scale);
  canvas.height = Math.round((video.videoHeight || MAX_WIDTH) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read frames from this video.");

  const frames: CapturedFrame[] = [];
  for (const t of wanted) {
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    frames.push({
      dataUrl,
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
      atSeconds: Math.round(t * 100) / 100,
    });
  }

  video.src = "";
  return frames;
}
