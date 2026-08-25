/**
 * Client-side video compression, applied before upload.
 *
 * Re-encodes in the browser rather than on the server: the droplet this runs
 * on is memory- and disk-constrained, and doing it here also shrinks what
 * has to travel over the wire. The cost is that MediaRecorder captures in
 * real time, so a 30-second clip takes ~30 seconds to process.
 *
 * Every failure path returns the original file — compression is an
 * optimisation, never a reason an upload can't happen.
 */

export interface CompressOptions {
  /** Longest edge of the output, in px. Larger videos are scaled down. */
  maxDimension?: number;
  /** Target video bitrate. */
  videoBitsPerSecond?: number;
  frameRate?: number;
  /** Files at or below this size are passed through untouched. */
  skipBelowBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1280,
  videoBitsPerSecond: 2_000_000,
  frameRate: 30,
  skipBelowBytes: 2 * 1024 * 1024,
};

/** First of these the browser can actually record, or null if none. */
function pickMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return (
    candidates.find(
      (t) =>
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported?.(t),
    ) ?? null
  );
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMimeType() !== null
  );
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Could not read that video."));
  });
}

/**
 * Routes the element's audio into a capturable stream without sending it to
 * the speakers, so the clip doesn't play aloud while it's being processed.
 * Returns null when the video has no audio or the browser won't allow it.
 */
function captureSilentAudio(
  video: HTMLVideoElement,
): { track: MediaStreamTrack; context: AudioContext } | null {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    const context = new AudioCtx();
    const source = context.createMediaElementSource(video);
    const destination = context.createMediaStreamDestination();
    // Deliberately not connected to context.destination — that would play it aloud.
    source.connect(destination);
    const track = destination.stream.getAudioTracks()[0];
    if (!track) {
      context.close();
      return null;
    }
    return { track, context };
  } catch {
    return null;
  }
}

/**
 * Returns a smaller re-encoded copy of `file`, or `file` itself when
 * compression isn't possible or wouldn't help.
 */
export async function compressVideo(
  file: File,
  options: CompressOptions = {},
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };
  const mimeType = pickMimeType();

  if (!file.type.startsWith("video/") || !isSupported() || !mimeType) {
    return file;
  }
  if (file.size <= opts.skipBelowBytes) return file;

  const url = URL.createObjectURL(file);
  let audio: ReturnType<typeof captureSilentAudio> = null;

  try {
    const video = await loadVideo(url);
    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return file;

    const scale = Math.min(1, opts.maxDimension / Math.max(w, h));
    const canvas = document.createElement("canvas");
    // Encoders reject odd dimensions, so round to even.
    canvas.width = Math.max(2, Math.round((w * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.round((h * scale) / 2) * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const stream = canvas.captureStream(opts.frameRate);
    audio = captureSilentAudio(video);
    if (audio) stream.addTrack(audio.track);

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: opts.videoBitsPerSecond,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // The recorder needs the full "video/webm;codecs=..." string, but the
    // uploaded file must carry only the base type: the ';' and ',' in the
    // codec suffix break the multipart Content-Type header, and the server
    // then sees the part as text/plain and rejects it.
    const baseType = mimeType.split(";")[0];

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: baseType }));
      recorder.onerror = () => reject(new Error("Recording failed."));
    });

    let rafId = 0;
    let lastReport = 0;
    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = performance.now();
      if (video.duration && now - lastReport > 200) {
        lastReport = now;
        onProgress?.(Math.min(1, video.currentTime / video.duration));
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    recorder.start();
    await video.play();
    drawFrame();

    // Capture runs in real time, so cap the wait rather than risk hanging the
    // upload forever if 'ended' never arrives.
    const timeoutMs = (video.duration || 0) * 1000 * 2 + 15_000;
    await Promise.race([
      new Promise<void>((resolve) => {
        video.onended = () => resolve();
      }),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    cancelAnimationFrame(rafId);
    video.pause();
    recorder.stop();

    // Must await the recorder's final chunk BEFORE tearing the tracks down —
    // stopping them first prevents 'stop' from ever firing.
    const blob = await finished;
    stream.getTracks().forEach((t) => t.stop());
    onProgress?.(1);

    // Re-encoding can inflate an already-efficient file; keep the smaller one.
    if (blob.size === 0 || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webm";
    return new File([blob], name, { type: baseType });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
    audio?.context.close().catch(() => {});
  }
}
