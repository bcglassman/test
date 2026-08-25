/**
 * Google Drive import, via the Google Picker.
 *
 * The browser does the whole job: the user picks files in Google's own
 * dialog, we fetch the bytes straight from the Drive API (which, unlike
 * drive.google.com share links, serves CORS requests with an auth header),
 * and hand them to the normal upload path so they get compressed like any
 * other video. The droplet never downloads anything.
 *
 * Scope is `drive.file`, which grants access only to the files the user
 * actually picks — it's not one of Google's "restricted" scopes, so it
 * doesn't require app verification the way drive.readonly would.
 *
 * Configure with NEXT_PUBLIC_GOOGLE_CLIENT_ID / _API_KEY / _APP_ID; when
 * they're absent the feature simply reports itself unavailable and the UI
 * hides the button.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";

export function isGoogleDriveConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY);
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  /** ISO 8601 capture time, resolved from Drive's metadata — see fetchCapturedAt. */
  capturedAt?: string;
}

// --- Minimal shapes for the two Google globals we touch -------------------

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: unknown) => void;
      }): { requestAccessToken(overrides?: { prompt?: string }): void };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => DocsView;
    ViewId: { DOCS: unknown; DOCS_VIDEOS: unknown };
    Action: { PICKED: string; CANCEL: string };
    Feature: { MULTISELECT_ENABLED: unknown };
  };
}

interface DocsView {
  setIncludeFolders(v: boolean): DocsView;
  setMimeTypes(v: string): DocsView;
  setSelectFolderEnabled(v: boolean): DocsView;
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface PickerCallbackData {
  action: string;
  docs?: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes?: string | number;
  }[];
}

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: {
      load(name: string, cb: () => void): void;
    };
  }
}

// --- Script loading -------------------------------------------------------

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

async function loadPickerApi(): Promise<void> {
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("Google API script loaded but gapi is missing."));
      return;
    }
    window.gapi.load("picker", () => resolve());
  });
}

// --- OAuth ----------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  await loadScript("https://accounts.google.com/gsi/client");
  const google = window.google;
  if (!google) throw new Error("Google Identity Services failed to load.");

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Google sign-in was cancelled."));
          return;
        }
        // Google's tokens last an hour; expire ours early to avoid races.
        cachedToken = {
          value: response.access_token,
          expiresAt: Date.now() + 50 * 60 * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: () =>
        reject(new Error("Google sign-in was cancelled.")),
    });
    client.requestAccessToken();
  });
}

// --- Picker ---------------------------------------------------------------

/**
 * Opens the Google Picker and resolves with the chosen files (empty if the
 * user cancels).
 */
export async function pickDriveFiles(): Promise<DriveFile[]> {
  if (!isGoogleDriveConfigured()) {
    throw new Error("Google Drive import isn't configured.");
  }

  const token = await getAccessToken();
  await loadPickerApi();

  const google = window.google;
  if (!google?.picker) throw new Error("Google Picker failed to load.");

  return new Promise<DriveFile[]>((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(
        "video/mp4,video/quicktime,video/webm,video/x-m4v,image/jpeg,image/png,image/heic",
      );

    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setTitle("Select training clips")
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              sizeBytes:
                d.sizeBytes === undefined ? undefined : Number(d.sizeBytes),
            })),
          );
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      });

    // Required for drive.file scope to grant access to the picked files.
    if (APP_ID) builder.setAppId(APP_ID);

    builder.build().setVisible(true);
  });
}

/**
 * Asks Drive when the file was actually shot. Prefers the camera's own EXIF
 * timestamp (photos) or the recording time (videos), falling back to Drive's
 * createdTime. Returns undefined rather than failing the import — the
 * capture time is a nice-to-have.
 */
export async function fetchCapturedAt(
  fileId: string,
): Promise<string | undefined> {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId,
      )}?fields=createdTime,imageMediaMetadata(time),videoMediaMetadata(durationMillis)&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return undefined;
    const meta = (await response.json()) as {
      createdTime?: string;
      imageMediaMetadata?: { time?: string };
    };

    // EXIF time comes back as "YYYY:MM:DD HH:MM:SS", which Date can't parse.
    const exif = meta.imageMediaMetadata?.time;
    if (exif) {
      const normalised = exif.replace(
        /^(\d{4}):(\d{2}):(\d{2})[ T]/,
        "$1-$2-$3T",
      );
      const parsed = new Date(normalised);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    if (meta.createdTime) {
      const parsed = new Date(meta.createdTime);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Downloads one picked Drive file's bytes into a File, ready to upload. */
export async function downloadDriveFile(file: DriveFile): Promise<File> {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      file.id,
    )}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`Couldn't download "${file.name}" from Google Drive.`);
  }
  const blob = await response.blob();
  return new File([blob], file.name, {
    type: file.mimeType || blob.type || "application/octet-stream",
  });
}
