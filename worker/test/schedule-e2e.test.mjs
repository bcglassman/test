/**
 * The daily post job against a real database.
 * Skipped unless TEST_DATABASE_URL is set.
 */

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.mjs';
import { scheduleDays, findGaps, addDays } from '../src/schedule/run.mjs';

const url = process.env.TEST_DATABASE_URL;
const FROM = '2026-10-05';

describe('daily post job', { skip: url ? false : 'set TEST_DATABASE_URL to run' }, () => {
  let pool;
  let categories = {};
  let organisers = {};

  before(async () => { pool = createPool(url); });
  after(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('TRUNCATE posts, sessions, activities, organisers, categories, sponsorships RESTART IDENTITY CASCADE');
    categories = {};
    organisers = {};
    for (const slug of ['run', 'padel', 'swim']) {
      const { rows } = await pool.query(
        `INSERT INTO categories (name, slug) VALUES ($1,$1) RETURNING id`, [slug]);
      categories[slug] = rows[0].id;
    }
    for (const slug of ['ecrc', 'padel-club', 'swim-club']) {
      const { rows } = await pool.query(
        `INSERT INTO organisers (name, slug, status) VALUES ($1,$1,'active') RETURNING id`, [slug]);
      organisers[slug] = rows[0].id;
    }
  });

  const approve = async ({ slug, category, organiser, quality = 50, startsIn = 7,
                           solo = 'yes', status = 'approved' }) => {
    const { rows } = await pool.query(
      `INSERT INTO activities (title, slug, dedupe_key, summary, category, organiser,
                               quality_score, solo_friendly, newcomer_norm,
                               enrichment_status, status)
       VALUES ($1,$1,$1,'A summary.',$2,$3,$4,$5,'common','confirmed',$6)
       RETURNING id`,
      [slug, categories[category], organisers[organiser], quality, solo, status]);
    await pool.query(
      `INSERT INTO sessions (activity, starts_at) VALUES ($1, $2::date + TIME '19:00')`,
      [rows[0].id, addDays(FROM, startsIn)]);
    return rows[0].id;
  };

  test('creates a draft post — selection proposes, a person approves', async () => {
    await approve({ slug: 'tuesday-run', category: 'run', organiser: 'ecrc' });
    const results = await scheduleDays(pool, { from: FROM, days: 1 });

    assert.equal(results[0].outcome, 'created');
    const { rows } = await pool.query(
      'SELECT type, headline, slot, scheduled_for, status, activity FROM posts');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'event_spotlight');
    assert.equal(rows[0].headline, 'tuesday-run');
    assert.equal(rows[0].slot, 'morning');
    assert.equal(rows[0].status, 'draft', 'never scheduled or published by this job');
    assert.equal(rows[0].scheduled_for.toISOString().slice(0, 10), FROM);
  });

  test('only the approved pool is eligible', async () => {
    await approve({ slug: 'draft-one', category: 'run', organiser: 'ecrc', status: 'draft' });
    await approve({ slug: 'review-one', category: 'padel', organiser: 'padel-club', status: 'pending_review' });
    const results = await scheduleDays(pool, { from: FROM, days: 1 });
    assert.equal(results[0].outcome, 'gap');
  });

  test('rotates organiser and category across consecutive days', async () => {
    await approve({ slug: 'run-a',   category: 'run',   organiser: 'ecrc',        quality: 90 });
    await approve({ slug: 'run-b',   category: 'run',   organiser: 'ecrc',        quality: 88 });
    await approve({ slug: 'padel-a', category: 'padel', organiser: 'padel-club',  quality: 60 });
    await approve({ slug: 'swim-a',  category: 'swim',  organiser: 'swim-club',   quality: 55 });

    await scheduleDays(pool, { from: FROM, days: 3 });

    const { rows } = await pool.query(
      `SELECT p.scheduled_for, a.slug, c.slug AS category, o.slug AS organiser
       FROM posts p JOIN activities a ON a.id = p.activity
       JOIN categories c ON c.id = a.category
       JOIN organisers o ON o.id = a.organiser
       ORDER BY p.scheduled_for`);

    assert.equal(rows.length, 3);
    assert.equal(rows[0].slug, 'run-a', 'highest score goes first');
    // run-b is the next highest raw score but shares category and organiser
    assert.notEqual(rows[1].organiser, 'ecrc', 'the same organiser does not run twice');
    assert.notEqual(rows[1].category, 'run', 'nor the same category three days running');
    assert.equal(new Set(rows.map((r) => r.slug)).size, 3, 'no activity repeats');
  });

  test('a single run does not schedule the same activity twice', async () => {
    await approve({ slug: 'only-one', category: 'run', organiser: 'ecrc' });
    const results = await scheduleDays(pool, { from: FROM, days: 3 });
    assert.equal(results.filter((r) => r.outcome === 'created').length, 1);
    assert.equal(results.filter((r) => r.outcome === 'gap').length, 2);
  });

  test('an already-filled slot is left alone', async () => {
    await approve({ slug: 'tuesday-run', category: 'run', organiser: 'ecrc' });
    await scheduleDays(pool, { from: FROM, days: 1 });
    const second = await scheduleDays(pool, { from: FROM, days: 1 });

    assert.equal(second[0].outcome, 'already_scheduled');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM posts');
    assert.equal(rows[0].n, 1, 'running twice does not duplicate the day');
  });

  test('an event that has already happened is never posted about', async () => {
    await approve({ slug: 'past-run', category: 'run', organiser: 'ecrc', startsIn: -3 });
    const results = await scheduleDays(pool, { from: FROM, days: 1 });
    assert.equal(results[0].outcome, 'gap');
  });

  test('sponsorship boosts but does not bypass approval', async () => {
    const id = await approve({ slug: 'sponsored-draft', category: 'padel',
                               organiser: 'padel-club', quality: 99, status: 'draft' });
    await pool.query(
      `INSERT INTO sponsorships (advertiser, activity, tier, status)
       VALUES ($1, $2, 'featured', 'active')`, [organisers['padel-club'], id]);

    const results = await scheduleDays(pool, { from: FROM, days: 1 });
    assert.equal(results[0].outcome, 'gap', 'a sponsored but unapproved activity is not eligible');
  });

  test('an active sponsorship outranks a higher-quality unsponsored listing', async () => {
    await approve({ slug: 'plain', category: 'run', organiser: 'ecrc', quality: 65 });
    const id = await approve({ slug: 'boosted', category: 'padel', organiser: 'padel-club', quality: 50 });
    await pool.query(
      `INSERT INTO sponsorships (advertiser, activity, tier, status)
       VALUES ($1, $2, 'featured', 'active')`, [organisers['padel-club'], id]);

    await scheduleDays(pool, { from: FROM, days: 1 });
    const { rows } = await pool.query(
      `SELECT a.slug FROM posts p JOIN activities a ON a.id = p.activity`);
    assert.equal(rows[0].slug, 'boosted');
  });

  test('an expired sponsorship stops boosting', async () => {
    await approve({ slug: 'plain', category: 'run', organiser: 'ecrc', quality: 65 });
    const id = await approve({ slug: 'was-boosted', category: 'padel', organiser: 'padel-club', quality: 50 });
    await pool.query(
      `INSERT INTO sponsorships (advertiser, activity, tier, status, ends_at)
       VALUES ($1, $2, 'featured', 'active', now() - INTERVAL '1 day')`,
      [organisers['padel-club'], id]);

    await scheduleDays(pool, { from: FROM, days: 1 });
    const { rows } = await pool.query(
      `SELECT a.slug FROM posts p JOIN activities a ON a.id = p.activity`);
    assert.equal(rows[0].slug, 'plain');
  });

  test('dry run writes nothing', async () => {
    await approve({ slug: 'tuesday-run', category: 'run', organiser: 'ecrc' });
    const results = await scheduleDays(pool, { from: FROM, days: 1, dryRun: true });
    assert.equal(results[0].outcome, 'would_create');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM posts');
    assert.equal(rows[0].n, 0);
  });

  test('gaps are reported for the days nothing fills', async () => {
    await approve({ slug: 'tuesday-run', category: 'run', organiser: 'ecrc' });
    await scheduleDays(pool, { from: FROM, days: 1 });

    const gaps = await findGaps(pool, { from: FROM, days: 3 });
    assert.equal(gaps.length, 2);
    assert.deepEqual(gaps.map((g) => g.date), [addDays(FROM, 1), addDays(FROM, 2)]);
  });

  test('the unique slot constraint is respected under a concurrent run', async () => {
    await approve({ slug: 'tuesday-run', category: 'run', organiser: 'ecrc' });
    await Promise.all([
      scheduleDays(pool, { from: FROM, days: 1 }),
      scheduleDays(pool, { from: FROM, days: 1 }),
    ]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM posts');
    assert.equal(rows[0].n, 1, 'two simultaneous runs cannot double-book a slot');
  });
});
