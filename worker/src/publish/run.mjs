/**
 * The publish worker.
 *
 *   post due today, approved, with an approved variant
 *        │
 *        ├── channel delivery_mode 'api'      → send now
 *        └── channel delivery_mode 'assisted' → awaiting_manual + a link to the
 *                                               admin's phone
 *
 * The publication row is written BEFORE any channel API is called. If the
 * process dies mid-send, the row already exists and the unique constraint on
 * (post, channel) stops a restart sending the same post twice. That ordering is
 * the whole reason a reader never sees a duplicate.
 */

import { randomBytes, createHash } from 'node:crypto';
import { log } from '../lib/log.mjs';
import * as telegram from './telegram.mjs';

const SENDERS = new Map([[telegram.key, telegram]]);

/** How long an assisted-publish link stays usable. */
const MANUAL_TOKEN_TTL_HOURS = 48;

const DUE = `
  SELECT p.id, p.headline, p.scheduled_for, p.slot,
         pv.id AS variant, pv.body, pv.headline AS variant_headline, pv.hashtags,
         c.id AS channel, c.key AS channel_key, c.name AS channel_name,
         c.config AS channel_config, c.delivery_mode
  FROM posts p
  JOIN post_variants pv ON pv.post = p.id AND pv.status = 'approved'
  JOIN channels c       ON c.id = pv.channel AND c.is_active
  WHERE p.status IN ('approved', 'scheduled')
    AND p.scheduled_for <= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM publications pub
      WHERE pub.post = p.id AND pub.channel = c.id
        AND pub.status IN ('published', 'sending', 'awaiting_manual', 'skipped')
    )
  ORDER BY p.scheduled_for, c.sort
`;

export async function publishDue(pool, {
  dryRun = false, siteUrl = process.env.SITE_URL ?? 'https://meetinmotion.sg',
  notify = telegram.sendDirect, senders = SENDERS,
} = {}) {
  const { rows: due } = await pool.query(DUE);
  const stats = { due: due.length, sent: 0, awaiting: 0, failed: 0, skipped: 0 };

  for (const item of due) {
    const idempotencyKey = `${item.id}:${item.channel_key}`;

    if (dryRun) {
      log.info(`  would ${item.delivery_mode === 'assisted' ? 'queue for you' : 'send'}: ` +
               `${item.channel_key} — ${item.headline}`);
      stats[item.delivery_mode === 'assisted' ? 'awaiting' : 'sent'] += 1;
      continue;
    }

    // Claim the slot first. A conflict means another run already has it.
    const claimed = await claim(pool, item, idempotencyKey);
    if (!claimed) {
      stats.skipped += 1;
      continue;
    }

    if (item.delivery_mode === 'assisted') {
      await queueForPerson(pool, item, claimed.id, { siteUrl, notify });
      stats.awaiting += 1;
      continue;
    }

    const sender = senders.get(item.channel_key);
    if (!sender) {
      await markFailed(pool, claimed.id, `no sender for channel "${item.channel_key}"`);
      stats.failed += 1;
      continue;
    }

    try {
      await pool.query(`UPDATE publications SET status = 'sending', attempts = attempts + 1,
                        date_updated = now() WHERE id = $1`, [claimed.id]);

      const result = await sender.send(
        { body: item.body, headline: item.variant_headline, hashtags: item.hashtags },
        { key: item.channel_key, config: item.channel_config },
      );

      await pool.query(
        `UPDATE publications
         SET status = 'published', published_at = now(),
             external_post_id = $2, external_url = $3,
             payload_hash = $4, last_error = NULL, date_updated = now()
         WHERE id = $1`,
        [claimed.id, result.externalId, result.url, hash(item.body)]);

      log.info(`  sent ${item.channel_key}: ${item.headline}${result.url ? ` → ${result.url}` : ''}`);
      stats.sent += 1;
    } catch (error) {
      await markFailed(pool, claimed.id, error.message);
      stats.failed += 1;
      log.warn(`  ${item.channel_key} failed: ${error.message}` +
               (error.retryable ? ' (will retry on the next run)' : ''));
    }
  }

  return stats;
}

/**
 * Inserts the publication row. Returns null when another run already holds it —
 * the unique constraint is the lock.
 */
async function claim(pool, item, idempotencyKey) {
  const { rows } = await pool.query(
    `INSERT INTO publications (post, channel, variant, idempotency_key, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (post, channel) DO UPDATE
       SET status = 'pending', date_updated = now()
       WHERE publications.status IN ('failed', 'pending')
     RETURNING id`,
    [item.id, item.channel, item.variant, idempotencyKey]);
  return rows[0] ?? null;
}

/**
 * Assisted channels: everything is prepared, and a single-use link goes to the
 * admin's phone. Only the hash is stored, so a forwarded message cannot let
 * someone else mark a post sent.
 */
async function queueForPerson(pool, item, publicationId, { siteUrl, notify }) {
  const token = randomBytes(24).toString('base64url');

  await pool.query(
    `UPDATE publications
     SET status = 'awaiting_manual', manual_token_hash = $2,
         manual_token_expires_at = now() + ($3 || ' hours')::interval,
         date_updated = now()
     WHERE id = $1`,
    [publicationId, hash(token), String(MANUAL_TOKEN_TTL_HOURS)]);

  const link = `${siteUrl.replace(/\/$/, '')}/publish/${token}`;
  const message = `${item.channel_name} post ready — ${item.headline}\n\n${link}\n\n` +
                  `Copy, send, then tap Mark sent. Link expires in ${MANUAL_TOKEN_TTL_HOURS}h.`;

  try {
    await notify(message);
    await pool.query(
      `UPDATE publications SET reminder_sent_at = now(), reminder_count = reminder_count + 1
       WHERE id = $1`, [publicationId]);
    log.info(`  queued for you: ${item.channel_key} — ${item.headline}`);
  } catch (error) {
    // The work is still queued and visible in pending_manual_publications; only
    // the nudge failed, and that must not lose the publication.
    log.warn(`  queued ${item.channel_key} but could not notify: ${error.message}`);
  }
}

async function markFailed(pool, publicationId, message) {
  await pool.query(
    `UPDATE publications SET status = 'failed', last_error = $2, date_updated = now()
     WHERE id = $1`, [publicationId, message.slice(0, 1000)]);
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

/** Nudges anything still unsent past its slot. */
export async function remindPending(pool, { notify = telegram.sendDirect, maxReminders = 3 } = {}) {
  const { rows } = await pool.query(
    `SELECT publication, headline, channel_name, reminder_count
     FROM pending_manual_publications WHERE reminder_count < $1`, [maxReminders]);

  for (const row of rows) {
    try {
      await notify(`Still unsent: ${row.channel_name} — ${row.headline}`);
      await pool.query(
        `UPDATE publications SET reminder_sent_at = now(),
         reminder_count = reminder_count + 1 WHERE id = $1`, [row.publication]);
    } catch (error) {
      log.warn(`reminder failed: ${error.message}`);
    }
  }
  return { reminded: rows.length };
}
