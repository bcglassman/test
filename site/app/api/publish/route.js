import { createHash } from 'node:crypto';

/**
 * Records that an assisted post was sent (or deliberately skipped).
 *
 * The token in the link is the credential; only its hash is stored, and it must
 * still match an unexpired publication. A forwarded message cannot let someone
 * else mark a post sent.
 */

const DIRECTUS = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN ?? '';

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
  return (await response.json().catch(() => ({}))).data;
}

export async function POST(request) {
  const payload = await request.json().catch(() => null);
  if (!payload?.token || !payload?.publicationId) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const status = payload.status === 'skipped' ? 'skipped' : 'published';
  const tokenHash = createHash('sha256').update(payload.token).digest('hex');

  try {
    const query = new URLSearchParams({
      fields: 'id,status,manual_token_expires_at,variant.body',
      'filter[manual_token_hash][_eq]': tokenHash,
      'filter[id][_eq]': payload.publicationId,
      limit: '1',
    });
    const [publication] = await directus(`/items/publications?${query}`);

    if (!publication) return Response.json({ error: 'That link is not valid.' }, { status: 404 });
    if (publication.status === 'published') return Response.json({ ok: true });   // already done
    if (publication.manual_token_expires_at &&
        new Date(publication.manual_token_expires_at) < new Date()) {
      return Response.json({ error: 'That link has expired.' }, { status: 410 });
    }

    await directus(`/items/publications/${publication.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
        // Records what was actually sent, so a later edit to the variant shows
        // up as a mismatch rather than silently looking published-and-current.
        payload_hash: status === 'published'
          ? createHash('sha256').update(publication.variant?.body ?? '').digest('hex')
          : null,
        manual_token_hash: null,   // single use
      }),
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('mark sent failed:', error.message);
    return Response.json({ error: 'Could not save that. Try again.' }, { status: 502 });
  }
}
