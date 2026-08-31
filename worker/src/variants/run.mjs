/**
 * Channel variant generation.
 *
 *   approved post → one model call covering every active channel
 *                 → hard validation per channel
 *                 → one repair round for whatever failed
 *                 → post_variants rows, status 'draft'
 *
 * All channels are written in a single call so the voice stays consistent
 * across them and the material is only paid for once.
 *
 * Variants are drafts. The publish worker only reads approved ones, so nothing
 * here can put copy in front of the public.
 */

import { withTransaction } from '../db.mjs';
import { log } from '../lib/log.mjs';
import { PROMPT_VERSION } from './prompt.mjs';
import { validateAll } from './validate.mjs';

const POSTS_NEEDING_COPY = `
  SELECT p.id, p.type, p.headline, p.body, p.scheduled_for, p.slot,
         a.id AS activity, a.title AS activity_title, a.summary, a.description,
         a.solo_friendly, a.newcomer_norm, a.conversation_load, a.group_size,
         a.intensity, a.social_after, a.price_min, a.currency, a.slug AS activity_slug,
         o.name AS organiser_name,
         v.name AS venue_name, v.nearest_mrt, v.region,
         (SELECT min(s.starts_at) FROM sessions s
           WHERE s.activity = a.id AND s.status = 'scheduled') AS starts_at,
         (SELECT sp.disclosure_label FROM sponsorships sp
           WHERE (sp.post = p.id OR sp.activity = a.id) AND sp.status = 'active'
             AND (sp.starts_at IS NULL OR sp.starts_at <= now())
             AND (sp.ends_at   IS NULL OR sp.ends_at   >= now())
           LIMIT 1) AS disclosure_label
  FROM posts p
  LEFT JOIN activities a ON a.id = p.activity
  LEFT JOIN organisers  o ON o.id = a.organiser
  LEFT JOIN venues      v ON v.id = a.venue
  WHERE p.status IN ('approved', 'scheduled')
    AND EXISTS (SELECT 1 FROM channels c WHERE c.is_active
                 AND NOT EXISTS (SELECT 1 FROM post_variants pv
                                  WHERE pv.post = p.id AND pv.channel = c.id))
  ORDER BY p.scheduled_for
  LIMIT $1
`;

export async function generateVariants(pool, writeVariants, {
  limit = 10, dryRun = false, siteUrl = process.env.SITE_URL ?? 'https://meetinmotion.sg',
} = {}) {
  const { rows: channels } = await pool.query(
    'SELECT id, key, name, config FROM channels WHERE is_active ORDER BY sort');
  const { rows: posts } = await pool.query(POSTS_NEEDING_COPY, [limit]);

  const stats = { posts: posts.length, written: 0, rejected: 0, repaired: 0, failed: 0, declined: 0 };

  for (const post of posts) {
    const missing = await channelsMissingCopy(pool, post.id, channels);
    if (missing.length === 0) continue;

    const context = {
      allowedUrls: [`${siteUrl.replace(/\/$/, '')}/e/${post.activity_slug}`],
      disclosureLabel: post.disclosure_label ?? null,
    };

    try {
      let { variants, model } = await writeVariants(post, missing, context);
      let { valid, rejected } = validateAll(variants, missing, context);

      // One repair round, aimed only at what failed.
      if (rejected.length > 0) {
        const retryChannels = rejected.map((r) => r.channel);
        const problems = rejected.flatMap((r) => r.problems.map((p) => `${r.channel.key}: ${p}`));
        try {
          const repair = await writeVariants(post, retryChannels, context, {
            feedback: { previous: pick(variants, retryChannels), problems },
          });
          const second = validateAll(repair.variants, retryChannels, context);
          stats.repaired += second.valid.length;
          valid = [...valid, ...second.valid];
          rejected = second.rejected;
        } catch (error) {
          log.warn(`  repair round failed: ${error.message}`);
        }
      }

      if (dryRun) {
        report(post, valid, rejected);
      } else {
        await writeToDatabase(pool, post, valid, rejected, model);
      }
      stats.written += valid.length;
      stats.rejected += rejected.length;
    } catch (error) {
      if (error.refusal) {
        stats.declined += 1;
        log.warn(`${post.headline}: ${error.message} — left for a human`);
      } else {
        stats.failed += 1;
        log.warn(`${post.headline}: ${error.message}`);
      }
    }
  }

  return stats;
}

async function channelsMissingCopy(pool, postId, channels) {
  const { rows } = await pool.query(
    'SELECT channel FROM post_variants WHERE post = $1', [postId]);
  const have = new Set(rows.map((r) => r.channel));
  return channels.filter((channel) => !have.has(channel.id));
}

function pick(variants, channels) {
  return Object.fromEntries(channels.map((c) => [c.key, variants[c.key]]).filter(([, v]) => v));
}

async function writeToDatabase(pool, post, valid, rejected, model) {
  await withTransaction(pool, async (client) => {
    for (const { channel, variant } of valid) {
      await client.query(
        `INSERT INTO post_variants
           (post, channel, headline, body, hashtags, status, generated_by, model, prompt_version, attempts)
         VALUES ($1,$2,$3,$4,$5,'draft','ai',$6,$7,1)
         ON CONFLICT (post, channel) DO UPDATE SET
           headline = EXCLUDED.headline, body = EXCLUDED.body,
           hashtags = EXCLUDED.hashtags, generation_note = NULL,
           attempts = post_variants.attempts + 1, date_updated = now()`,
        [post.id, channel.id, variant.headline, variant.body, variant.hashtags,
         model, PROMPT_VERSION]);
    }

    // A rejected variant is recorded with its reason rather than left absent,
    // so an editor can tell "the generator could not do this" from "nobody has
    // run the generator yet".
    for (const { channel, problems } of rejected) {
      await client.query(
        `INSERT INTO post_variants
           (post, channel, body, status, generated_by, model, prompt_version,
            generation_note, attempts)
         VALUES ($1,$2,NULL,'rejected','ai',$3,$4,$5,1)
         ON CONFLICT (post, channel) DO UPDATE SET
           status = 'rejected', generation_note = EXCLUDED.generation_note,
           attempts = post_variants.attempts + 1, date_updated = now()`,
        [post.id, channel.id, model, PROMPT_VERSION, problems.join('; ')]);
    }
  });
}

function report(post, valid, rejected) {
  log.info(`\n  ${post.headline}  (${post.scheduled_for?.toISOString?.().slice(0, 10) ?? ''} ${post.slot})`);
  for (const { channel, variant } of valid) {
    const limit = channel.config?.max_length;
    log.info(`    ✓ ${channel.key.padEnd(11)} ${variant.body.length}${limit ? `/${limit}` : ''} chars`);
    for (const line of variant.body.split('\n')) log.info(`        ${line}`);
    if (variant.hashtags) log.info(`        ${variant.hashtags}`);
  }
  for (const { channel, problems } of rejected) {
    log.info(`    ✗ ${channel.key.padEnd(11)} rejected`);
    for (const problem of problems) log.info(`        ${problem}`);
  }
}
