import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';
import MarkSent from '../../../components/MarkSent';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send this post', robots: { index: false, follow: false } };

const DIRECTUS = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN ?? '';

async function directus(path) {
  const response = await fetch(`${DIRECTUS}${path}`, {
    headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Directus ${response.status}`);
  return (await response.json()).data;
}

/**
 * The assisted-publish page.
 *
 * Reached by a single-use link, with no login: requiring a session on a phone
 * at 7am is how a fifteen-second job becomes a skipped day. The token is the
 * credential, and only its hash is stored.
 */
export default async function PublishPage({ params }) {
  const { token } = await params;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  let publication = null;
  try {
    const query = new URLSearchParams({
      fields: ['id', 'status', 'manual_token_expires_at', 'published_at',
               'channel.key', 'channel.name', 'channel.config',
               'variant.body', 'variant.hashtags',
               'post.headline', 'post.scheduled_for', 'post.slot'].join(','),
      'filter[manual_token_hash][_eq]': tokenHash,
      limit: '1',
    });
    [publication] = await directus(`/items/publications?${query}`);
  } catch {
    publication = null;
  }

  if (!publication) notFound();

  const expired = publication.manual_token_expires_at &&
                  new Date(publication.manual_token_expires_at) < new Date();
  const alreadySent = publication.status === 'published';
  const body = publication.variant?.body ?? '';
  const limit = publication.channel?.config?.max_length ?? null;

  return (
    <div className="wrap narrow" style={{ padding: '1.5rem 0 4rem', maxWidth: '32rem' }}>
      <p className="label">{publication.channel?.name} · {publication.post?.slot}</p>
      <h1 style={{ fontSize: '1.5rem' }}>{publication.post?.headline}</h1>

      {alreadySent ? (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h3>Already sent</h3>
          <p className="note">
            Marked sent{publication.published_at
              ? ` at ${new Date(publication.published_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
              : ''}. Nothing more to do.
          </p>
        </div>
      ) : expired ? (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h3>This link has expired</h3>
          <p className="note">
            The post is still waiting. Re-run the publish job to get a fresh link,
            or send it from Directus.
          </p>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginTop: '1.25rem' }}>
            <p className="label" style={{ marginBottom: '.5rem' }}>
              {body.length}{limit ? ` / ${limit}` : ''} characters
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              font: 'inherit', fontSize: '.98rem', lineHeight: 1.5,
            }}>{body}</pre>
          </div>

          <MarkSent
            publicationId={publication.id}
            token={token}
            body={body}
            channelKey={publication.channel?.key}
          />
        </>
      )}
    </div>
  );
}
