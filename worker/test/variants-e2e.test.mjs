/**
 * Variant generation against a real database, model stubbed.
 * Skipped unless TEST_DATABASE_URL is set.
 */

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.mjs';
import { generateVariants } from '../src/variants/run.mjs';

const url = process.env.TEST_DATABASE_URL;
const SITE = 'https://meetinmotion.sg';
const LINK = `${SITE}/e/tuesday-run`;

describe('variant generation', { skip: url ? false : 'set TEST_DATABASE_URL to run' }, () => {
  let pool;
  let postId;

  before(async () => { pool = createPool(url); });
  after(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('TRUNCATE post_variants, posts, sessions, activities, organisers, sponsorships RESTART IDENTITY CASCADE');
    await pool.query(`UPDATE channels SET is_active = (key IN ('telegram','whatsapp'))`);
    const { rows: [activity] } = await pool.query(
      `INSERT INTO activities (title, slug, dedupe_key, summary, solo_friendly, newcomer_norm,
                               enrichment_status, status, price_min, currency)
       VALUES ('Tuesday Easy 8km','tuesday-run','k','A friendly run.','yes','common',
               'confirmed','approved',0,'SGD') RETURNING id`);
    const { rows: [post] } = await pool.query(
      `INSERT INTO posts (type, activity, headline, scheduled_for, slot, status)
       VALUES ('event_spotlight',$1,'Tuesday Easy 8km','2026-10-05','morning','approved')
       RETURNING id`, [activity.id]);
    postId = post.id;
  });

  const goodCopy = async () => ({ model: 'stub', variants: {
    telegram: { headline: 'Tuesday Easy 8km', body: `A friendly 8km along the East Coast. ${LINK}`, hashtags: null },
    whatsapp: { headline: null, body: 'Tuesday Easy 8km — 7am, East Coast Park. All paces.', hashtags: null },
  }});

  test('writes one draft variant per active channel', async () => {
    const stats = await generateVariants(pool, goodCopy, { siteUrl: SITE });
    assert.equal(stats.written, 2);
    assert.equal(stats.rejected, 0);

    const { rows } = await pool.query(
      `SELECT c.key, pv.status, pv.generated_by, pv.model, pv.prompt_version, pv.attempts, pv.body
       FROM post_variants pv JOIN channels c ON c.id = pv.channel ORDER BY c.key`);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.status === 'draft'), 'variants are drafts, never approved');
    assert.ok(rows.every((r) => r.generated_by === 'ai' && r.model === 'stub' && r.prompt_version));
    assert.equal(rows[0].attempts, 1);
  });

  test('a variant that breaks a hard limit is repaired and saved', async () => {
    let call = 0;
    const writer = async (post, channels, context, options) => {
      call += 1;
      if (call === 1) {
        return { model: 'stub', variants: {
          telegram: { headline: 'T', body: `Fine. ${LINK}`, hashtags: null },
          whatsapp: { headline: null, body: 'x'.repeat(1200), hashtags: null },   // over 1024
        }};
      }
      // the repair round is told what failed, and asked only for that channel
      assert.deepEqual(channels.map((c) => c.key), ['whatsapp']);
      assert.match(options.feedback.problems[0], /over the 1024 limit/);
      return { model: 'stub', variants: {
        whatsapp: { headline: null, body: 'Tuesday Easy 8km — 7am, East Coast.', hashtags: null },
      }};
    };

    const stats = await generateVariants(pool, writer, { siteUrl: SITE });
    assert.equal(call, 2);
    assert.equal(stats.repaired, 1);
    assert.equal(stats.written, 2);
    assert.equal(stats.rejected, 0);
  });

  test('copy that still fails after repair is stored as rejected with its reason', async () => {
    const stubborn = async () => ({ model: 'stub', variants: {
      telegram: { headline: 'T', body: `Fine. ${LINK}`, hashtags: null },
      whatsapp: { headline: null, body: `Sign up at https://bit.ly/evil`, hashtags: null },
    }});

    const stats = await generateVariants(pool, stubborn, { siteUrl: SITE });
    assert.equal(stats.rejected, 1);

    const { rows: [row] } = await pool.query(
      `SELECT pv.status, pv.body, pv.generation_note FROM post_variants pv
       JOIN channels c ON c.id = pv.channel WHERE c.key = 'whatsapp'`);
    assert.equal(row.status, 'rejected');
    assert.equal(row.body, null, 'the bad copy is not stored where it could be published');
    assert.match(row.generation_note, /not the canonical one/);
  });

  test('a sponsored post without its disclosure label never reaches the database as usable copy', async () => {
    const { rows: [org] } = await pool.query(
      `INSERT INTO organisers (name, slug, status) VALUES ('Gym','gym','active') RETURNING id`);
    await pool.query(
      `INSERT INTO sponsorships (advertiser, post, tier, status, disclosure_label)
       VALUES ($1,$2,'featured','active','Sponsored')`, [org.id, postId]);

    const undisclosed = async () => ({ model: 'stub', variants: {
      telegram: { headline: 'T', body: `A great run. ${LINK}`, hashtags: null },
      whatsapp: { headline: null, body: 'A great run, 7am.', hashtags: null },
    }});

    const stats = await generateVariants(pool, undisclosed, { siteUrl: SITE });
    assert.equal(stats.written, 0);
    assert.equal(stats.rejected, 2, 'both channels rejected for missing disclosure');

    const { rows } = await pool.query(`SELECT status, generation_note FROM post_variants`);
    assert.ok(rows.every((r) => r.status === 'rejected'));
    assert.ok(rows.every((r) => /disclosure label/.test(r.generation_note)));
  });

  test('the prompt is told about the sponsorship rather than left to guess', async () => {
    const { rows: [org] } = await pool.query(
      `INSERT INTO organisers (name, slug, status) VALUES ('Gym','gym','active') RETURNING id`);
    await pool.query(
      `INSERT INTO sponsorships (advertiser, post, tier, status, disclosure_label)
       VALUES ($1,$2,'featured','active','Paid partnership')`, [org.id, postId]);

    let seen = null;
    const writer = async (post, channels, context) => {
      seen = context;
      return { model: 'stub', variants: {
        telegram: { headline: 'T', body: `Paid partnership — a run. ${LINK}`, hashtags: null },
        whatsapp: { headline: null, body: 'Paid partnership — a run, 7am.', hashtags: null },
      }};
    };
    await generateVariants(pool, writer, { siteUrl: SITE });
    assert.equal(seen.disclosureLabel, 'Paid partnership');
    assert.deepEqual(seen.allowedUrls, [LINK]);
  });

  test('only channels missing copy are regenerated', async () => {
    await generateVariants(pool, goodCopy, { siteUrl: SITE });
    await pool.query(
      `DELETE FROM post_variants WHERE channel = (SELECT id FROM channels WHERE key='whatsapp')`);

    let asked = null;
    const writer = async (post, channels) => {
      asked = channels.map((c) => c.key);
      return { model: 'stub', variants: { whatsapp: { headline: null, body: 'Short one.', hashtags: null } } };
    };
    await generateVariants(pool, writer, { siteUrl: SITE });
    assert.deepEqual(asked, ['whatsapp'], 'the telegram variant is not rewritten');
  });

  test('a post with every channel covered is not picked up', async () => {
    await generateVariants(pool, goodCopy, { siteUrl: SITE });
    const stats = await generateVariants(pool, goodCopy, { siteUrl: SITE });
    assert.equal(stats.posts, 0);
  });

  test('only approved posts get copy', async () => {
    await pool.query(`UPDATE posts SET status = 'draft'`);
    const stats = await generateVariants(pool, goodCopy, { siteUrl: SITE });
    assert.equal(stats.posts, 0);
  });

  test('a refusal is counted separately and writes nothing', async () => {
    const declining = async () => {
      throw Object.assign(new Error('model declined: unspecified'), { refusal: true });
    };
    const stats = await generateVariants(pool, declining, { siteUrl: SITE });
    assert.equal(stats.declined, 1);
    assert.equal(stats.failed, 0);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM post_variants');
    assert.equal(rows[0].n, 0);
  });

  test('dry run writes nothing', async () => {
    await generateVariants(pool, goodCopy, { siteUrl: SITE, dryRun: true });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM post_variants');
    assert.equal(rows[0].n, 0);
  });
});
