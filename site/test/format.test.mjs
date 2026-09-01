import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  lookup, SOLO_FRIENDLY, NEWCOMER_NORM, priceLabel, formatSession, relativeDay,
} from '../lib/format.js';

describe('unknown attributes', () => {
  test('unknown renders as nothing, never as a negative', () => {
    // The most important rule on the site: a listing that does not say whether
    // you can come alone must not read as "no".
    assert.equal(lookup(SOLO_FRIENDLY, 'unknown'), null);
    assert.equal(lookup(SOLO_FRIENDLY, null), null);
    assert.equal(lookup(SOLO_FRIENDLY, undefined), null);
    assert.equal(lookup(NEWCOMER_NORM, 'unknown'), null);
  });

  test('a value outside the vocabulary renders as nothing rather than raw', () => {
    assert.equal(lookup(SOLO_FRIENDLY, 'maybe_someday'), null);
  });

  test('known values become the readers question, not the field name', () => {
    assert.equal(lookup(SOLO_FRIENDLY, 'yes').label, 'Come alone');
    assert.equal(lookup(SOLO_FRIENDLY, 'unlikely').label, 'Bring someone');
    assert.equal(lookup(SOLO_FRIENDLY, 'unlikely').tone, 'warn');
  });
});

describe('price', () => {
  test('zero is Free, not $0', () => {
    assert.equal(priceLabel({ price_min: 0 }), 'Free');
  });

  test('a single price drops the redundant range', () => {
    assert.equal(priceLabel({ price_min: 32, price_max: 32, currency: 'SGD' }), 'SGD 32');
  });

  test('a real range is shown as one', () => {
    assert.equal(priceLabel({ price_min: 90, price_max: 110, currency: 'SGD' }), 'SGD 90–110');
  });

  test('cents are kept only when there are any', () => {
    assert.equal(priceLabel({ price_min: 12.5, currency: 'SGD' }), 'SGD 12.50');
    assert.equal(priceLabel({ price_min: 12, currency: 'SGD' }), 'SGD 12');
  });

  test('falls back to the band when no figure was captured', () => {
    assert.equal(priceLabel({ cost_band: '20_to_50' }), '$20–50');
  });

  test('shows nothing rather than guessing', () => {
    assert.equal(priceLabel({}), null);
  });
});

describe('times', () => {
  test('renders in Singapore time regardless of server timezone', () => {
    // 23:00 UTC is 07:00 the next morning in Singapore.
    assert.equal(formatSession('2026-09-07T23:00:00Z'), 'Tue, 8 Sept, 7am');
  });

  test('keeps the minutes when they are not on the hour', () => {
    assert.equal(formatSession('2026-09-10T22:45:00Z'), 'Fri, 11 Sept, 6:45am');
  });

  test('nothing in, nothing out', () => {
    assert.equal(formatSession(null), null);
  });
});

describe('relative days', () => {
  const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

  test('names the near future in words', () => {
    assert.equal(relativeDay(inDays(0)), 'today');
    assert.equal(relativeDay(inDays(1)), 'tomorrow');
    assert.equal(relativeDay(inDays(3)), 'in 3 days');
  });

  test('says nothing when it is far off or already past', () => {
    assert.equal(relativeDay(inDays(20)), null);
    assert.equal(relativeDay(inDays(-2)), null);
  });
});
