/**
 * Records interest in an activity.
 *
 * Runs on the server so the Directus token never reaches the browser. Consent
 * is required and recorded with a timestamp and the version of the wording the
 * person actually agreed to — PDPA, and the reason `consent_text_version`
 * exists on `people`.
 */

const DIRECTUS = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN ?? '';
const CONSENT_VERSION = '2026-08-31';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function directus(path, init = {}) {
  const response = await fetch(`${DIRECTUS}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Directus ${response.status} on ${path}`);
  const body = await response.json().catch(() => ({}));
  return body.data;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(payload.email ?? '').trim().toLowerCase();
  const name = String(payload.name ?? '').trim().slice(0, 200);

  if (!EMAIL.test(email)) return Response.json({ error: 'That email address does not look right.' }, { status: 400 });
  if (!name)              return Response.json({ error: 'Please add a name.' }, { status: 400 });
  if (payload.consent !== true) {
    return Response.json({ error: 'We need your consent before emailing you.' }, { status: 400 });
  }

  try {
    const [activity] = await directus(
      `/items/activities?filter[slug][_eq]=${encodeURIComponent(payload.activity)}` +
      `&filter[status][_eq]=published&fields=id&limit=1`);
    if (!activity) return Response.json({ error: 'That event is no longer listed.' }, { status: 404 });

    const [existing] = await directus(
      `/items/people?filter[email][_eq]=${encodeURIComponent(email)}&fields=id&limit=1`);

    const person = existing ?? await directus('/items/people', {
      method: 'POST',
      body: JSON.stringify({
        email, display_name: name, name,
        consent_at: new Date().toISOString(),
        consent_text_version: CONSENT_VERSION,
        status: 'active',
      }),
    });

    await directus('/items/interest_registrations', {
      method: 'POST',
      body: JSON.stringify({
        activity: activity.id,
        person: person.id,
        is_first_timer: payload.first_timer === true,
        channel: 'website',
        status: 'registered',
      }),
    });

    return Response.json({ ok: true });
  } catch (error) {
    // A duplicate registration is the unique constraint doing its job, and from
    // the reader's side nothing is wrong — they already told us.
    if (/40[09]/.test(error.message)) return Response.json({ ok: true });
    console.error('interest registration failed:', error.message);
    return Response.json({ error: 'We could not save that. Please try again shortly.' }, { status: 502 });
  }
}
