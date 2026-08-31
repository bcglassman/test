/**
 * The ingest loop, shared by every source adapter.
 *
 *   fetch → raw_items (audit) → dedupe → activities (draft) → sessions
 *
 * Two properties matter more than throughput:
 *
 *   Re-running is safe. An unchanged payload updates last_verified_at and
 *   nothing else, so a cron that fires twice cannot duplicate anything.
 *
 *   Editorial work is never overwritten. Ingest owns facts - times, prices,
 *   capacity. It never touches status, the soft attributes, or any field a
 *   human has confirmed.
 */

import { contentHash } from '../lib/hash.mjs';
import { log } from '../lib/log.mjs';
import { withTransaction } from '../db.mjs';

/**
 * Facts ingest may always refresh - the source stays authoritative about these
 * however far through review an activity has travelled.
 */
const FACTS = ['price_min', 'price_max', 'currency', 'cost_band', 'capacity',
               'booking_url', 'source_url'];

/**
 * Prose ingest may refresh only while the activity is still a draft. Once a
 * human has looked at it, their summary stands: re-fetching an event must not
 * silently undo an editor's rewrite.
 */
const DRAFT_ONLY = ['summary', 'description'];

export async function ingestSource(pool, adapter, source, context = {}) {
  const stats = { seen: 0, skipped: 0, unchanged: 0, created: 0, updated: 0, failed: 0 };

  try {
    for await (const item of adapter.fetchItems(source, context)) {
      stats.seen += 1;
      try {
        const outcome = await ingestItem(pool, adapter, source, item);
        stats[outcome] += 1;
      } catch (error) {
        stats.failed += 1;
        log.warn(`${source.slug}: ${item.externalId} failed — ${error.message}`);
        await recordFailure(pool, source, item, error);
      }
    }
    await markPolled(pool, source, stats.failed > 0 ? 'partial' : 'ok', null);
  } catch (error) {
    await markPolled(pool, source, 'error', error.message);
    throw error;
  }

  return stats;
}

async function ingestItem(pool, adapter, source, item) {
  const hash = contentHash(item.payload);

  // Unchanged since last time: record that we looked, do nothing else.
  const { rows: prior } = await pool.query(
    'SELECT id, content_hash, activity FROM raw_items WHERE source = $1 AND external_id = $2',
    [source.id, item.externalId],
  );
  if (prior[0]?.content_hash === hash) {
    if (prior[0].activity) {
      await pool.query('UPDATE activities SET last_verified_at = now() WHERE id = $1', [prior[0].activity]);
    }
    return 'unchanged';
  }

  if (adapter.isRelevant && !adapter.isRelevant(item.payload)) {
    await upsertRawItem(pool, source, item, hash, { status: 'rejected', note: 'not relevant to this platform' });
    return 'skipped';
  }

  const activity = adapter.toActivity(item.payload);
  if (activity.sessions.length === 0) {
    await upsertRawItem(pool, source, item, hash, { status: 'rejected', note: 'no start time' });
    return 'skipped';
  }

  return withTransaction(pool, async (client) => {
    const organiserId = activity.organiser ? await upsertOrganiser(client, activity.organiser) : null;
    const venueId = activity.venue ? await upsertVenue(client, activity.venue) : null;
    const key = adapter.dedupeKey(activity);

    const { rows: existing } = await client.query(
      'SELECT id, status FROM activities WHERE dedupe_key = $1',
      [key],
    );

    let activityId;
    let outcome;

    if (existing[0]) {
      activityId = existing[0].id;
      outcome = 'updated';

      // Facts always; prose only while nobody has reviewed it. Never status,
      // never the soft attributes, never a confirmed value.
      const updatable = existing[0].status === 'draft' ? [...FACTS, ...DRAFT_ONLY] : FACTS;
      await client.query(
        `UPDATE activities SET ${updatable.map((f, i) => `${f} = $${i + 2}`).join(', ')},
                content_hash = $${updatable.length + 2},
                last_verified_at = now(),
                date_updated = now()
         WHERE id = $1`,
        [activityId, ...updatable.map((f) => activity[f] ?? null), hash],
      );
    } else {
      outcome = 'created';
      const { rows } = await client.query(
        `INSERT INTO activities
           (title, slug, summary, description, organiser, venue, source, source_url,
            dedupe_key, content_hash, format, origin, status, capacity,
            price_min, price_max, currency, cost_band, booking_url, booking_platform)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [activity.title, await uniqueSlug(client, activity.slug), activity.summary,
         activity.description, organiserId, venueId, source.id, activity.source_url,
         key, hash, activity.format, activity.origin, activity.capacity,
         activity.price_min, activity.price_max, activity.currency, activity.cost_band,
         activity.booking_url, activity.booking_platform],
      );
      activityId = rows[0].id;
    }

    await syncSessions(client, activityId, venueId, activity.sessions);
    await upsertRawItem(client, source, item, hash, { status: 'parsed', activity: activityId });
    return outcome;
  });
}

/**
 * Sessions are replaced rather than merged: the source is authoritative about
 * when its own event happens. Cancelled sessions are preserved - a cancellation
 * is information a reader needs, and losing it would silently resurrect an
 * event that is not happening.
 */
async function syncSessions(client, activityId, venueId, sessions) {
  await client.query(
    `DELETE FROM sessions WHERE activity = $1 AND status <> 'cancelled'`,
    [activityId],
  );
  for (const session of sessions) {
    await client.query(
      `INSERT INTO sessions (activity, starts_at, ends_at, timezone, venue, capacity)
       SELECT $1, $2::timestamptz, $3::timestamptz, $4, $5, $6
       WHERE NOT EXISTS (
         SELECT 1 FROM sessions
         WHERE activity = $1 AND starts_at = $2::timestamptz AND status = 'cancelled'
       )`,
      [activityId, session.starts_at, session.ends_at, session.timezone, venueId, session.capacity],
    );
  }
}

async function upsertOrganiser(client, organiser) {
  const { rows } = await client.query(
    `INSERT INTO organisers (name, slug, website, description, status)
     VALUES ($1, $2, $3, $4, 'draft')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, date_updated = now()
     RETURNING id`,
    [organiser.name, organiser.slug, organiser.website, organiser.description],
  );
  return rows[0].id;
}

async function upsertVenue(client, venue) {
  const { rows } = await client.query(
    `INSERT INTO venues (name, slug, address, postal_code, region, latitude, longitude, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, date_updated = now()
     RETURNING id`,
    [venue.name, venue.slug, venue.address, venue.postal_code, venue.region,
     venue.latitude, venue.longitude],
  );
  return rows[0].id;
}

async function uniqueSlug(client, base) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { rows } = await client.query('SELECT 1 FROM activities WHERE slug = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function upsertRawItem(client, source, item, hash, { status, note = null, activity = null }) {
  await client.query(
    `INSERT INTO raw_items (source, external_id, url, raw_payload, content_hash, status, dedupe_note, activity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (source, external_id) DO UPDATE SET
       url = EXCLUDED.url, raw_payload = EXCLUDED.raw_payload,
       content_hash = EXCLUDED.content_hash, status = EXCLUDED.status,
       dedupe_note = EXCLUDED.dedupe_note,
       activity = COALESCE(EXCLUDED.activity, raw_items.activity),
       fetched_at = now()`,
    [source.id, item.externalId, item.url, item.payload, hash, status, note, activity],
  );
}

async function recordFailure(pool, source, item, error) {
  await pool.query(
    `INSERT INTO raw_items (source, external_id, url, raw_payload, content_hash, status, parse_error)
     VALUES ($1,$2,$3,$4,$5,'error',$6)
     ON CONFLICT (source, external_id) DO UPDATE SET
       status = 'error', parse_error = EXCLUDED.parse_error, fetched_at = now()`,
    [source.id, item.externalId, item.url ?? null, item.payload ?? {},
     contentHash(item.payload ?? {}), error.message],
  ).catch(() => { /* the failure log must never mask the original error */ });
}

async function markPolled(pool, source, status, error) {
  await pool.query(
    'UPDATE sources SET last_polled_at = now(), last_status = $2, last_error = $3 WHERE id = $1',
    [source.id, status, error],
  );
}
