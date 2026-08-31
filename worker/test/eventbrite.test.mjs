import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  toActivity, isRelevant, dedupeKey, costBand,
  eventIdFromUrl, regionFromPostalCode, validateConfig, fetchItems,
} from '../src/ingest/sources/eventbrite.mjs';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/eventbrite-organization-events.json', import.meta.url)),
);
const [run, webinar, wine] = fixture.events;

test('maps an event onto the canonical shape', () => {
  const activity = toActivity(run);
  assert.equal(activity.title, 'East Coast Sunrise 10K');
  assert.equal(activity.status, 'draft');
  assert.equal(activity.origin, 'ingested');
  assert.equal(activity.booking_platform, 'eventbrite');
  assert.equal(activity.capacity, 120);
  assert.equal(activity.price_min, 15);
  assert.equal(activity.price_max, 25);
  assert.equal(activity.cost_band, 'under_20');
  assert.equal(activity.organiser.name, 'East Coast Run Club');
  assert.equal(activity.venue.name, 'East Coast Park Area C');
  assert.equal(activity.sessions.length, 1);
  assert.equal(activity.sessions[0].starts_at, '2026-09-11T23:00:00Z');
  assert.equal(activity.sessions[0].timezone, 'Asia/Singapore');
});

test('never infers the soft-socializing attributes', () => {
  // Ingestion states facts. solo_friendly and newcomer_norm are judgements that
  // belong to the enrichment pass, with evidence and a human confirming - even
  // though this description says "all paces welcome" and mentions kopi after.
  const activity = toActivity(run);
  for (const field of ['solo_friendly', 'newcomer_norm', 'conversation_load',
                       'pressure_level', 'group_size', 'social_after']) {
    assert.equal(activity[field], undefined, `${field} must not be set at ingest`);
  }
});

test('filters out what does not belong', () => {
  assert.equal(isRelevant(run), true);
  assert.equal(isRelevant(webinar), false, 'online events are not places you turn up to');
  assert.equal(isRelevant(wine), false, 'food & drink is not an active social event');
  assert.equal(isRelevant({ ...run, status: 'draft' }), false);
});

test('an event with no category is left for a human to judge', () => {
  const { category_id, ...uncategorised } = run;
  assert.equal(isRelevant(uncategorised), true);
});

test('dedupe key is stable across re-fetches and distinct per day', () => {
  const first = dedupeKey(toActivity(run));
  assert.equal(first, dedupeKey(toActivity(structuredClone(run))));
  assert.match(first, /^east-coast-run-club\|east-coast-sunrise-10k\|2026-09-11$/);

  const nextWeek = structuredClone(run);
  nextWeek.start.utc = '2026-09-18T23:00:00Z';
  assert.notEqual(first, dedupeKey(toActivity(nextWeek)));
});

test('cost bands follow the schema', () => {
  assert.equal(costBand(0), 'free');
  assert.equal(costBand(19.99), 'under_20');
  assert.equal(costBand(20), '20_to_50');
  assert.equal(costBand(100), '50_to_100');
  assert.equal(costBand(101), 'over_100');
  assert.equal(costBand(null), null);
});

test('free events are priced at zero, not left unknown', () => {
  const free = structuredClone(run);
  free.is_free = true;
  delete free.ticket_availability;
  const activity = toActivity(free);
  assert.equal(activity.price_min, 0);
  assert.equal(activity.cost_band, 'free');
});

test('pulls the event id out of Eventbrite URL shapes', () => {
  assert.equal(eventIdFromUrl('https://www.eventbrite.sg/e/east-coast-sunrise-10k-tickets-987654321098'), '987654321098');
  assert.equal(eventIdFromUrl('https://www.eventbrite.com/e/some-run-tickets-123456789012?aff=x'), '123456789012');
  assert.equal(eventIdFromUrl('https://example.com/not-eventbrite'), null);
});

test('maps Singapore postal codes to planning regions', () => {
  assert.equal(regionFromPostalCode('449875'), 'east');
  assert.equal(regionFromPostalCode('018956'), 'central');
  assert.equal(regionFromPostalCode('730000'), 'north_east');
  assert.equal(regionFromPostalCode(null), null);
});

test('rejects a misconfigured source before any network call', () => {
  assert.throws(() => validateConfig({ mode: 'organization' }), /organization_id/);
  assert.throws(() => validateConfig({ mode: 'event_url' }), /urls/);
  assert.throws(() => validateConfig({ mode: 'search' }), /unknown mode/);
  assert.deepEqual(validateConfig({ organization_id: '1' }).mode, 'organization');
});

test('paginates using continuation tokens', async () => {
  const pages = [
    { events: [run], pagination: { has_more_items: true, continuation: 'page2' } },
    { events: [wine], pagination: { has_more_items: false } },
  ];
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, json: async () => pages.shift() };
  };

  const items = [];
  for await (const item of fetchItems(
    { config: { organization_id: '55501' } },
    { token: 'test-token', fetchImpl },
  )) items.push(item.externalId);

  assert.deepEqual(items, ['987654321098', '987654321100']);
  assert.match(seen[1], /continuation=page2/);
});

test('surfaces rate limiting as retryable rather than as data loss', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, text: async () => '' });
  await assert.rejects(
    (async () => { for await (const _ of fetchItems({ config: { organization_id: '1' } }, { token: 't', fetchImpl })) { /* drain */ } })(),
    (error) => error.retryable === true,
  );
});
