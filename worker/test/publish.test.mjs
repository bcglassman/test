/**
 * The publish worker end to end. Telegram is stubbed; everything below it is
 * the real path. Skipped unless TEST_DATABASE_URL is set.
 */

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPool } from '../src/db.mjs';
import { publishDue, remindPending } from '../src/publish/run.mjs';
import * as telegram from '../src/publish/telegram.mjs';

const url = process.env.TEST_DATABASE_URL;

describe('telegram adapter', () => {
  const channel = { key: 'telegram', config: { chat_id: '@mim_sg', username: 'mim_sg' } };

  test('sends and returns the message link', async () => {
    let sent = null;
    const fetchImpl = async (endpoint, init) => {
      sent = { endpoint, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 42 } }) };
    };
    const result = await telegram.send({ body: 'Tuesday run, 7am.' }, channel,
                                       { token: 't', fetchImpl });
    assert.equal(result.externalId, '42');
    assert.equal(result.url, 'https://t.me/mim_sg/42');
    assert.equal(sent.body.chat_id, '@mim_sg');
    assert.equal(sent.body.text, 'Tuesday run, 7am.');
    assert.equal(sent.body.parse_mode, undefined,
      'copy is sent as plain text — a stray underscore in a club name must not break it');
  });

  test('rate limiting is retryable, not a rejection', async () => {
    const fetchImpl = async () => ({
      ok: false, status: 429, json: async () => ({ ok: false, parameters: { retry_after: 12 } }) });
    await assert.rejects(
      telegram.send({ body: 'x' }, channel, { token: 't', fetchImpl }),
      (error) => error.retryable === true && error.retryAfter === 12);
  });

  test('a bad request is not retryable', async () => {
    const fetchImpl = async () => ({
      ok: false, status: 400, json: async () => ({ ok: false, description: 'chat not found' }) });
    await assert.rejects(
      telegram.send({ body: 'x' }, channel, { token: 't', fetchImpl }),
      (error) => error.retryable === false && /chat not found/.test(error.message));
  });

  test('refuses to run without configuration', async () => {
    await assert.rejects(telegram.send({ body: 'x' }, { key: 'telegram', config: {} },
                                       { token: 't', fetchImpl: async () => {} }), /chat_id/);
  });
});

describe('publish worker', { skip: url ? false : 'set TEST_DATABASE_URL to run' }, () => {
  let pool;
  let ids = {};

  before(async () => { pool = createPool(url); });
  after(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('TRUNCATE publications, post_variants, posts, activities RESTART IDENTITY CASCADE');
    await pool.query(`UPDATE channels SET is_active = (key IN ('telegram','whatsapp')),
                        config = jsonb_set(config, '{chat_id}', '"@mim_sg"')
                      WHERE key = 'telegram'`);

    const { rows: [activity] } = await pool.query(
      `INSERT INTO activities (title, slug, dedupe_key, enrichment_status, status)
       VALUES ('Tuesday Easy 8km','t8','k','confirmed','published') RETURNING id`);
    const { rows: [post] } = await pool.query(
      `INSERT INTO posts (type, activity, headline, scheduled_for, slot, status)
       VALUES ('event_spotlight',$1,'Tuesday Easy 8km', CURRENT_DATE, 'morning','approved')
       RETURNING id`, [activity.id]);
    ids = { activity: activity.id, post: post.id };

    for (const key of ['telegram', 'whatsapp']) {
      await pool.query(
        `INSERT INTO post_variants (post, channel, body, status, generated_by)
         SELECT $1, id, $2, 'approved', 'ai' FROM channels WHERE key = $3`,
        [post.id, `Copy for ${key}.`, key]);
    }
  });

  const okSender = () => {
    const calls = [];
    return {
      calls,
      senders: new Map([['telegram', {
        send: async (variant) => { calls.push(variant.body); return { externalId: '77', url: 'https://t.me/mim_sg/77' }; },
      }]]),
    };
  };
  const noNotify = async () => {};

  test('sends API channels and queues assisted ones', async () => {
    const { senders, calls } = okSender();
    const notes = [];
    const stats = await publishDue(pool, { senders, notify: async (m) => notes.push(m),
                                           siteUrl: 'https://meetinmotion.sg' });

    assert.equal(stats.sent, 1);
    assert.equal(stats.awaiting, 1);
    assert.deepEqual(calls, ['Copy for telegram.']);

    const { rows } = await pool.query(
      `SELECT c.key, p.status, p.external_url, p.manual_token_hash, p.published_at
       FROM publications p JOIN channels c ON c.id = p.channel ORDER BY c.key`);
    const telegramRow = rows.find((r) => r.key === 'telegram');
    const whatsappRow = rows.find((r) => r.key === 'whatsapp');

    assert.equal(telegramRow.status, 'published');
    assert.equal(telegramRow.external_url, 'https://t.me/mim_sg/77');
    assert.ok(telegramRow.published_at);

    assert.equal(whatsappRow.status, 'awaiting_manual');
    assert.ok(whatsappRow.manual_token_hash, 'a link was minted');
    assert.match(notes[0], /https:\/\/meetinmotion\.sg\/publish\//);
  });

  test('only the hash of the publish token is stored', async () => {
    const notes = [];
    await publishDue(pool, { senders: okSender().senders, notify: async (m) => notes.push(m) });

    const raw = notes[0].match(/\/publish\/([A-Za-z0-9_-]+)/)[1];
    const { rows: [row] } = await pool.query(
      `SELECT manual_token_hash FROM publications WHERE manual_token_hash IS NOT NULL`);
    assert.equal(row.manual_token_hash, createHash('sha256').update(raw).digest('hex'));
    assert.notEqual(row.manual_token_hash, raw);
  });

  test('running twice does not send twice', async () => {
    const { senders, calls } = okSender();
    await publishDue(pool, { senders, notify: noNotify });
    const second = await publishDue(pool, { senders, notify: noNotify });

    assert.equal(calls.length, 1, 'the channel API was called exactly once');
    assert.equal(second.due, 0, 'nothing is due the second time');
  });

  test('two concurrent runs cannot double-post', async () => {
    const { senders, calls } = okSender();
    await Promise.all([
      publishDue(pool, { senders, notify: noNotify }),
      publishDue(pool, { senders, notify: noNotify }),
    ]);
    assert.equal(calls.length, 1);
  });

  test('a send failure is recorded and retried on the next run', async () => {
    let attempt = 0;
    const senders = new Map([['telegram', { send: async () => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('telegram: rate limited'), { retryable: true });
      return { externalId: '78', url: null };
    } }]]);

    const first = await publishDue(pool, { senders, notify: noNotify });
    assert.equal(first.failed, 1);

    const { rows: [failed] } = await pool.query(
      `SELECT status, last_error, attempts FROM publications
       WHERE channel = (SELECT id FROM channels WHERE key='telegram')`);
    assert.equal(failed.status, 'failed');
    assert.match(failed.last_error, /rate limited/);

    const second = await publishDue(pool, { senders, notify: noNotify });
    assert.equal(second.sent, 1, 'a failed publication is picked up again');
  });

  test('only approved variants are published', async () => {
    await pool.query(`UPDATE post_variants SET status = 'draft'`);
    const stats = await publishDue(pool, { senders: okSender().senders, notify: noNotify });
    assert.equal(stats.due, 0);
  });

  test('a post scheduled for tomorrow is not sent today', async () => {
    await pool.query(`UPDATE posts SET scheduled_for = CURRENT_DATE + 1`);
    const stats = await publishDue(pool, { senders: okSender().senders, notify: noNotify });
    assert.equal(stats.due, 0);
  });

  test('a failed notification still leaves the post queued', async () => {
    const failing = async () => { throw new Error('telegram unreachable'); };
    await publishDue(pool, { senders: okSender().senders, notify: failing });

    const { rows } = await pool.query(
      `SELECT status FROM publications WHERE status = 'awaiting_manual'`);
    assert.equal(rows.length, 1, 'the work survives a failed nudge');
  });

  test('reminders nudge what is still unsent, and stop after a few', async () => {
    await publishDue(pool, { senders: okSender().senders, notify: noNotify });
    const notes = [];
    await remindPending(pool, { notify: async (m) => notes.push(m) });
    assert.equal(notes.length, 1);
    assert.match(notes[0], /Still unsent/);

    await pool.query(`UPDATE publications SET reminder_count = 3 WHERE status = 'awaiting_manual'`);
    const { reminded } = await remindPending(pool, { notify: async () => {} });
    assert.equal(reminded, 0, 'it gives up rather than nagging forever');
  });

  test('dry run sends nothing', async () => {
    const { senders, calls } = okSender();
    await publishDue(pool, { senders, notify: noNotify, dryRun: true });
    assert.equal(calls.length, 0);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM publications');
    assert.equal(rows[0].n, 0);
  });
});
