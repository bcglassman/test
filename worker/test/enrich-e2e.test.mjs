/**
 * The enrichment pass end to end against a real database, with the model
 * stubbed. Skipped unless TEST_DATABASE_URL is set.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.mjs';
import { enrichPending } from '../src/enrich/run.mjs';

const url = process.env.TEST_DATABASE_URL;

const LISTING = 'A friendly 10K along the East Coast park connector. All paces welcome — ' +
                'nobody gets left behind. Kopi at the hawker centre afterwards.';

/** A model that answers well: real quotes, honest abstentions. */
const goodModel = async () => ({
  model: 'stub-model',
  attributes: {
    solo_friendly:     { value: 'yes', evidence: 'All paces welcome', reasoning: 'Open to any pace.', confidence: 0.8 },
    social_after:      { value: true, evidence: 'Kopi at the hawker centre afterwards', reasoning: 'Stated.', confidence: 0.9 },
    newcomer_norm:     { value: 'unknown', evidence: null, reasoning: 'Not addressed.', confidence: 0.2 },
    pressure_level:    { value: 'rsvp', evidence: 'A friendly 10K', reasoning: 'A ticketed race.', confidence: 0.6 },
    conversation_load: { value: 'light', evidence: 'nobody gets left behind', reasoning: 'Group run.', confidence: 0.5 },
    group_size:        { value: 'medium', evidence: 'A friendly 10K', reasoning: 'Race scale.', confidence: 0.4 },
    intensity:         { value: 'moderate', evidence: 'All paces welcome', reasoning: 'Social pace.', confidence: 0.7 },
    cost_band:         { value: 'unknown', evidence: null, reasoning: 'Price already known.', confidence: 0.1 },
  },
});

/** A model that fabricates a fluent, plausible, unsupported quote. */
const fabricatingModel = async () => {
  const answer = await goodModel();
  answer.attributes.newcomer_norm = {
    value: 'common',
    evidence: 'new runners join us every week',   // nowhere in the listing
    reasoning: 'Explicitly welcomes new runners.',
    confidence: 0.9,
  };
  return answer;
};

describe('enrichment pass', { skip: url ? false : 'set TEST_DATABASE_URL to run' }, () => {
  let pool;

  const seed = async () => {
    await pool.query('TRUNCATE enrichment_proposals, sessions, activities, organisers RESTART IDENTITY CASCADE');
    const { rows } = await pool.query(
      `INSERT INTO activities (title, slug, dedupe_key, summary, description, status, origin, cost_band)
       VALUES ('East Coast Sunrise 10K','ecs-10k','k-enrich',$1,$1,'draft','ingested','under_20')
       RETURNING id`, [LISTING]);
    return rows[0].id;
  };

  before(async () => { pool = createPool(url); });
  after(async () => { await pool?.end(); });

  test('writes one proposal per attribute and moves the activity to review', async () => {
    const id = await seed();
    const stats = await enrichPending(pool, goodModel, { limit: 10 });

    assert.equal(stats.enriched, 1);
    assert.equal(stats.downgraded, 0);

    const { rows } = await pool.query(
      'SELECT field_key, proposed_value, confidence, evidence, status, model, prompt_version FROM enrichment_proposals WHERE activity = $1 ORDER BY field_key', [id]);
    assert.equal(rows.length, 8, 'one proposal per attribute');
    assert.ok(rows.every((r) => r.status === 'proposed'));
    assert.ok(rows.every((r) => r.model === 'stub-model' && r.prompt_version));

    const solo = rows.find((r) => r.field_key === 'solo_friendly');
    assert.equal(solo.proposed_value, 'yes');
    assert.equal(solo.evidence, 'All paces welcome');

    const { rows: [activity] } = await pool.query(
      'SELECT status, enrichment_status, solo_friendly FROM activities WHERE id = $1', [id]);
    assert.equal(activity.status, 'pending_review');
    assert.equal(activity.enrichment_status, 'proposed');
    // the crucial one: proposing does not set the value
    assert.equal(activity.solo_friendly, 'unknown',
      'a proposal must never write the attribute onto the activity');
  });

  test('a fabricated quote is downgraded before a reviewer ever sees it', async () => {
    const id = await seed();
    const stats = await enrichPending(pool, fabricatingModel, { limit: 10 });

    assert.equal(stats.downgraded, 1);

    const { rows: [row] } = await pool.query(
      `SELECT proposed_value, confidence, reasoning FROM enrichment_proposals
       WHERE activity = $1 AND field_key = 'newcomer_norm'`, [id]);
    assert.equal(row.proposed_value, 'unknown', 'the unsupported claim did not survive');
    assert.equal(Number(row.confidence), 0);
    assert.match(row.reasoning, /not found in the listing/);
  });

  test('the approval gate still blocks an unconfirmed activity', async () => {
    const id = await seed();
    await enrichPending(pool, goodModel, { limit: 10 });
    await assert.rejects(
      pool.query(`UPDATE activities SET status = 'approved' WHERE id = $1`, [id]),
      /activities_publishable_requires_confirmed_enrichment/,
      'proposed is not confirmed, and the database knows it',
    );
  });

  test('re-running supersedes the previous pass rather than colliding', async () => {
    const id = await seed();
    await enrichPending(pool, goodModel, { limit: 10 });
    // put it back in the queue as a fresh draft
    await pool.query(`UPDATE activities SET status='draft', enrichment_status='not_started' WHERE id=$1`, [id]);
    await enrichPending(pool, goodModel, { limit: 10 });

    const { rows } = await pool.query(
      `SELECT status, count(*)::int AS n FROM enrichment_proposals
       WHERE activity = $1 GROUP BY status ORDER BY status`, [id]);
    assert.deepEqual(rows, [{ status: 'proposed', n: 8 }, { status: 'superseded', n: 8 }]);
  });

  test('an already-enriched activity is not picked up again', async () => {
    await seed();
    await enrichPending(pool, goodModel, { limit: 10 });
    const stats = await enrichPending(pool, goodModel, { limit: 10 });
    assert.equal(stats.considered, 0);
  });

  test('a model failure leaves the activity untouched for the next run', async () => {
    const id = await seed();
    const failing = async () => { throw new Error('upstream timeout'); };
    const stats = await enrichPending(pool, failing, { limit: 10 });

    assert.equal(stats.failed, 1);
    const { rows: [activity] } = await pool.query(
      'SELECT status, enrichment_status FROM activities WHERE id = $1', [id]);
    assert.equal(activity.status, 'draft');
    assert.equal(activity.enrichment_status, 'not_started', 'still queued for a retry');
  });

  test('a model refusal is counted separately from a failure', async () => {
    await seed();
    const declining = async () => {
      throw Object.assign(new Error('model declined: unspecified'), { refusal: true });
    };
    const stats = await enrichPending(pool, declining, { limit: 10 });
    assert.equal(stats.declined, 1);
    assert.equal(stats.failed, 0);
  });

  test('dry run writes nothing', async () => {
    const id = await seed();
    await enrichPending(pool, goodModel, { limit: 10, dryRun: true });
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM enrichment_proposals WHERE activity = $1', [id]);
    assert.equal(rows[0].n, 0);
  });
});
