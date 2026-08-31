import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChoices, humanise, toDirectusChoices } from '../lib/choices.mjs';

test('reads a value list out of a normalised IN constraint', () => {
  assert.deepEqual(
    parseChoices("CHECK ((slot = ANY (ARRAY['morning'::text, 'midday'::text, 'evening'::text])))"),
    ['morning', 'midday', 'evening'],
  );
});

test('ignores range checks - they are rules, not dropdowns', () => {
  assert.equal(parseChoices('CHECK ((quality_score >= 0 AND quality_score <= 100))'), null);
});

test('ignores cross-column rules such as the enrichment gate', () => {
  assert.equal(
    parseChoices("CHECK ((status <> 'published'::text OR published_at IS NOT NULL))"),
    null,
  );
});

test('ignores an empty or missing definition', () => {
  assert.equal(parseChoices(''), null);
  assert.equal(parseChoices(undefined), null);
});

test('humanises underscored values without mangling numbers', () => {
  assert.equal(humanise('awaiting_manual'), 'Awaiting manual');
  assert.equal(humanise('20_to_50'), '20 to 50');
  assert.equal(humanise('yes'), 'Yes');
});

test('shapes choices the way a Directus select expects', () => {
  assert.deepEqual(toDirectusChoices(['professional', 'peer']), [
    { text: 'Professional', value: 'professional' },
    { text: 'Peer', value: 'peer' },
  ]);
});
