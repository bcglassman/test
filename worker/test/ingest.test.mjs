/**
 * End-to-end ingest against a real database.
 *
 * Skipped unless TEST_DATABASE_URL points at a database carrying schema/*.sql.
 * Eventbrite is stubbed; everything below the adapter is the real code path.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPool } from '../src/db.mjs';
import { ingestSource } from '../src/ingest/run.mjs';
import * as eventbrite from '../src/ingest/sources/eventbrite.mjs';

const url = process.env.TEST_DATABASE_URL;

describe('ingest', { skip: url ? false : 'set TEST_DATABASE_URL to run' }, () => {
  let pool;
  let source;
  let fixture;

  const stub = (payload) => async () => ({ ok: true, status: 200, json: async () => payload });

  before(async () => {
    fixture = JSON.parse(await readFile(new URL('../fixtures/eventbrite-organization-events.json', import.meta.url)));
    pool = createPool(url);
    await pool.query(`TRUNCATE raw_items, sessions, activities, organisers, venues, sources RESTART IDENTITY CASCADE`);
    const { rows } = await pool.query(
      `INSERT INTO sources (name, slug, type, config, terms_note)
       VALUES ('Eventbrite — ECRC', 'eventbrite-ecrc', 'api',
               '{"adapter":"eventbrite","mode":"organization","organization_id":"55501"}'::jsonb,
               'Organiser authorised us via OAuth.')
       RETURNING id, slug, type, config`);
    source = rows[0];
  });

  after(async () => { await pool?.end(); });

  test('creates activities as drafts, filtering what does not belong', async () => {
    const stats = await ingestSource(pool, eventbrite, source, {
      token: 't', fetchImpl: stub(fixture),
    });

    assert.equal(stats.seen, 3);
    assert.equal(stats.created, 1);
    assert.equal(stats.skipped, 2, 'the webinar and the wine tasting are filtered');

    const { rows } = await pool.query(
      `SELECT title, status, origin, cost_band, price_min, enrichment_status, solo_friendly
       FROM activities`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'East Coast Sunrise 10K');
    assert.equal(rows[0].status, 'draft');
    assert.equal(rows[0].origin, 'ingested');
    assert.equal(rows[0].cost_band, 'under_20');
    // untouched by ingest, ready for the enrichment pass
    assert.equal(rows[0].enrichment_status, 'not_started');
    assert.equal(rows[0].solo_friendly, 'unknown');
  });

  test('the organiser, venue and session all land', async () => {
    const { rows: [row] } = await pool.query(
      `SELECT o.name AS organiser, v.name AS venue, v.region, s.starts_at, s.timezone
       FROM activities a
       JOIN organisers o ON o.id = a.organiser
       JOIN venues v     ON v.id = a.venue
       JOIN sessions s   ON s.activity = a.id`);
    assert.equal(row.organiser, 'East Coast Run Club');
    assert.equal(row.venue, 'East Coast Park Area C');
    assert.equal(row.region, 'east');
    assert.equal(row.timezone, 'Asia/Singapore');
    assert.equal(row.starts_at.toISOString(), '2026-09-11T23:00:00.000Z');
  });

  test('re-running changes nothing — a cron that fires twice is safe', async () => {
    const stats = await ingestSource(pool, eventbrite, source, {
      token: 't', fetchImpl: stub(fixture),
    });
    assert.equal(stats.unchanged, 3);
    assert.equal(stats.created, 0);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM activities');
    assert.equal(rows[0].n, 1, 'still exactly one activity');
    const { rows: sessions } = await pool.query('SELECT count(*)::int AS n FROM sessions');
    assert.equal(sessions[0].n, 1, 'sessions were not duplicated');
  });

  test('a price change updates facts but never editorial state', async () => {
    // an editor has meanwhile reviewed and enriched this activity
    await pool.query(`UPDATE activities SET status = 'pending_review',
                        solo_friendly = 'yes', newcomer_norm = 'common',
                        enrichment_status = 'confirmed',
                        summary = 'Editor rewrote this summary.'`);

    // 35 minimum against a stale 25 maximum: an inverted range the database
    // would reject. The adapter normalises it rather than losing the event.
    const changed = structuredClone(fixture);
    changed.events[0].ticket_availability.minimum_ticket_price.major_value = '35.00';
    changed.events[0].capacity = 150;

    const stats = await ingestSource(pool, eventbrite, source, {
      token: 't', fetchImpl: stub(changed),
    });
    assert.equal(stats.updated, 1);

    const { rows: [row] } = await pool.query(
      `SELECT price_min, price_max, capacity, cost_band, status, solo_friendly,
              newcomer_norm, enrichment_status, summary FROM activities`);

    assert.equal(Number(row.price_min), 25, 'inverted range normalised, not rejected');
    assert.equal(Number(row.price_max), 35);
    assert.equal(row.capacity, 150);
    assert.equal(row.cost_band, '20_to_50');

    assert.equal(row.status, 'pending_review', 'workflow state survived');
    assert.equal(row.solo_friendly, 'yes', 'confirmed attribute survived');
    assert.equal(row.newcomer_norm, 'common');
    assert.equal(row.enrichment_status, 'confirmed');
    assert.equal(row.summary, 'Editor rewrote this summary.',
      'ingest must not overwrite an editor’s summary on an already-reviewed activity');
  });

  test('a cancelled session is not resurrected by the next fetch', async () => {
    await pool.query(`UPDATE sessions SET status = 'cancelled'`);
    await ingestSource(pool, eventbrite, source, {
      token: 't', fetchImpl: stub(structuredClone(fixture)) });

    const { rows } = await pool.query('SELECT status FROM sessions');
    assert.equal(rows.length, 1, 'no duplicate created alongside the cancelled one');
    assert.equal(rows[0].status, 'cancelled', 'the cancellation stands');
  });

  test('every fetched item is kept for audit, with its verdict', async () => {
    const { rows } = await pool.query(
      `SELECT external_id, status, dedupe_note FROM raw_items ORDER BY external_id`);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].status, 'parsed');
    assert.equal(rows[1].dedupe_note, 'not relevant to this platform');
    assert.equal(rows[2].dedupe_note, 'not relevant to this platform');
  });

  test('source poll state is recorded', async () => {
    const { rows: [row] } = await pool.query(
      'SELECT last_status, last_polled_at, last_error FROM sources');
    assert.equal(row.last_status, 'ok');
    assert.equal(row.last_error, null);
    assert.ok(row.last_polled_at instanceof Date);
  });

  test('one bad item does not abort the run', async () => {
    const broken = structuredClone(fixture);
    broken.events.push({ id: 'broken-1', name: { text: 'No start time' }, status: 'live',
                         online_event: false, category_id: '108' });
    const stats = await ingestSource(pool, eventbrite, source, {
      token: 't', fetchImpl: stub(broken) });
    assert.equal(stats.seen, 4);
    assert.ok(stats.skipped >= 1, 'the item with no start time was skipped, not fatal');
  });
});
