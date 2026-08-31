/**
 * The daily post job.
 *
 * Fills the coming days' slots from the approved pool and leaves what it could
 * not fill visible as a gap. It creates posts as drafts - selection proposes,
 * a person approves. Nothing here publishes anything.
 *
 * Run it daily, a few days ahead of the horizon, so an editor always has
 * tomorrow's post to look at rather than this morning's.
 */

import { withTransaction } from '../db.mjs';
import { log } from '../lib/log.mjs';
import { planSlot, daysBetween } from './select.mjs';

/**
 * What a day looks like. Start with one spotlight in the morning and add slots
 * as supply justifies it - an unfilled slot is more visible than a missing one,
 * which is the point, but a permanently empty evening slot is just noise.
 */
export const DEFAULT_PLAN = [{ slot: 'morning', type: 'event_spotlight' }];

const CANDIDATES = `
  SELECT a.id, a.title, a.summary, a.hero_image, a.category, a.organiser,
         a.quality_score, a.solo_friendly, a.newcomer_norm, a.cost_band,
         v.name AS venue_name, v.nearest_mrt,
         (SELECT min(s.starts_at) FROM sessions s
           WHERE s.activity = a.id AND s.status = 'scheduled'
             AND s.starts_at >= now()) AS starts_at,
         EXISTS (
           SELECT 1 FROM sponsorships sp
           WHERE sp.activity = a.id AND sp.status = 'active'
             AND (sp.starts_at IS NULL OR sp.starts_at <= now())
             AND (sp.ends_at   IS NULL OR sp.ends_at   >= now())
         ) AS is_sponsored
  FROM activities a
  LEFT JOIN venues v ON v.id = a.venue
  WHERE a.status = 'approved'
`;

/** Everything already on the calendar, for the rotation rules. */
const HISTORY = `
  SELECT p.id, p.activity, p.scheduled_for, a.category, a.organiser
  FROM posts p
  LEFT JOIN activities a ON a.id = p.activity
  WHERE p.scheduled_for >= $1::date - INTERVAL '30 days'
    AND p.status <> 'archived'
`;

const EXISTING_FOR_DATE = `
  SELECT slot, type FROM posts
  WHERE scheduled_for = $1::date AND status <> 'archived'
`;

export async function scheduleDays(pool, {
  from = tomorrow(), days = 3, plan = DEFAULT_PLAN, dryRun = false,
} = {}) {
  const { rows: candidates } = await pool.query(CANDIDATES);
  const { rows: history } = await pool.query(HISTORY, [from]);

  const planned = [...history];
  const results = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const { rows: existing } = await pool.query(EXISTING_FOR_DATE, [date]);

    for (const { slot, type } of plan) {
      if (existing.some((e) => e.slot === slot && e.type === type)) {
        results.push({ date, slot, type, outcome: 'already_scheduled' });
        continue;
      }

      const available = candidates.filter(
        (c) => !planned.some((p) => p.activity === c.id),
      );
      const proposal = planSlot(available, { date, slot, type, history: planned });

      if (!proposal.chosen) {
        results.push({ date, slot, type, outcome: 'gap', reason: proposal.reason });
        continue;
      }

      if (!dryRun) {
        await createPost(pool, proposal);
      }
      planned.push({
        activity: proposal.chosen.id,
        scheduled_for: date,
        category: proposal.chosen.category,
        organiser: proposal.chosen.organiser,
      });
      results.push({ date, slot, type, outcome: dryRun ? 'would_create' : 'created', proposal });
    }
  }

  return results;
}

async function createPost(pool, proposal) {
  const activity = proposal.chosen;
  return withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO posts (type, activity, headline, body, hero_image, scheduled_for, slot, status)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, 'draft')
       ON CONFLICT (scheduled_for, slot, type) DO NOTHING`,
      [proposal.type, activity.id, headlineFor(activity), activity.summary,
       activity.hero_image, proposal.date, proposal.slot],
    );
  });
}

/**
 * The headline is the activity's own title. Channel-specific copy is generated
 * later, per channel, from the canonical record - writing it here would be
 * writing it twice.
 */
function headlineFor(activity) {
  return activity.title.slice(0, 300);
}

/** Unfilled slots across the horizon - the daily gap check. */
export async function findGaps(pool, { from = today(), days = 7, plan = DEFAULT_PLAN } = {}) {
  const gaps = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const { rows: existing } = await pool.query(EXISTING_FOR_DATE, [date]);
    for (const { slot, type } of plan) {
      const post = existing.find((e) => e.slot === slot && e.type === type);
      if (!post) gaps.push({ date, slot, type });
    }
  }
  return gaps;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrow() {
  return addDays(today(), 1);
}

export function addDays(date, days) {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function report(results) {
  for (const result of results) {
    const label = `${result.date} ${result.slot}`;
    if (result.outcome === 'already_scheduled') {
      log.info(`  ${label}  already scheduled`);
      continue;
    }
    if (result.outcome === 'gap') {
      log.warn(`  ${label}  GAP — ${result.reason}`);
      continue;
    }
    const { chosen, score, reasons, alternatives } = result.proposal;
    log.info(`  ${label}  ${chosen.title}`);
    log.info(`      score ${score}: ${reasons.join(', ')}`);
    if (alternatives.length > 0) {
      log.info(`      also considered: ${alternatives.map((a) => `${a.title} (${a.score})`).join(', ')}`);
    }
  }

  const gaps = results.filter((r) => r.outcome === 'gap').length;
  const made = results.filter((r) => r.outcome === 'created' || r.outcome === 'would_create').length;
  log.info(`\n  ${made} post(s) planned · ${gaps} gap(s)`);
  if (gaps > 0) {
    log.warn('  A gap means nothing goes out that day. Approve more activities, or ' +
             'fill it with a resource or roundup post.');
  }
}
