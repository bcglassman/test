// Thin fetch wrapper around Payload's auto-generated REST API. Every
// request is same-origin, so the browser attaches the `payload-token`
// auth cookie automatically once the user has logged in at /admin/login —
// no token handling needed here.

export class PayloadRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.errors?.[0]?.message ?? body?.message ?? res.statusText;
    throw new PayloadRequestError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function payloadGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, { credentials: "same-origin" });
  return unwrap<T>(res);
}

export async function payloadPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export async function payloadPatch<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export async function payloadDelete<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  return unwrap<T>(res);
}

export async function payloadUpload<T>(
  path: string,
  file: File,
  extraFields: Record<string, unknown> = {},
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  form.append("_payload", JSON.stringify(extraFields));
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  return unwrap<T>(res);
}

export interface CurrentUser {
  id: string;
  email: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const data = await payloadGet<{ user: CurrentUser | null }>("users/me");
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/users/logout", { method: "POST", credentials: "same-origin" });
}
