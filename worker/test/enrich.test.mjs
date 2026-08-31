import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isQuoted, normaliseForMatch, verifyProposal, sourceTextFor } from '../src/enrich/evidence.mjs';
import { buildOutputSchema, buildUserMessage, SYSTEM_PROMPT } from '../src/enrich/prompt.mjs';

const LISTING = 'A friendly 10K along the East Coast park connector. All paces welcome — ' +
                'we split into three pace groups and nobody gets left behind. Kopi at the ' +
                'hawker centre afterwards for anyone who wants it.';

const ALLOWED = {
  solo_friendly: ['yes', 'probably', 'unlikely', 'unknown'],
  newcomer_norm: ['common', 'occasional', 'rare', 'unknown'],
  pressure_level: ['drop_in', 'rsvp', 'commit'],
  conversation_load: ['parallel', 'light', 'conversational'],
  group_size: ['intimate', 'small', 'medium', 'large'],
  intensity: ['gentle', 'moderate', 'vigorous', 'competitive'],
  cost_band: ['free', 'under_20', '20_to_50', '50_to_100', 'over_100'],
};

describe('evidence verification', () => {
  test('accepts a verbatim quote', () => {
    assert.equal(isQuoted('All paces welcome', LISTING), true);
  });

  test('accepts a quote across an ellipsis', () => {
    assert.equal(isQuoted('All paces welcome … Kopi at the hawker centre', LISTING), true);
  });

  test('is tolerant of quote marks, case and whitespace', () => {
    assert.equal(isQuoted('“all   paces\nwelcome”', LISTING), true);
  });

  test('rejects a quote that is not in the listing', () => {
    assert.equal(isQuoted('beginners especially welcome', LISTING), false);
  });

  test('rejects a plausible paraphrase — the failure mode that matters', () => {
    // Nothing in the listing says this. It is exactly what a fluent paraphrase
    // looks like, and exactly what a reviewer would wave through.
    assert.equal(isQuoted('new runners join us every week', LISTING), false);
  });

  test('normalises predictably', () => {
    assert.equal(normaliseForMatch('  “Hello   World” …'), 'hello world');
  });
});

describe('proposal verification', () => {
  const proposal = (over) => ({
    field_key: 'solo_friendly', value: 'yes', evidence: 'All paces welcome',
    reasoning: 'Open to any pace.', confidence: 0.8, ...over,
  });

  test('a verified quote passes through untouched', () => {
    const result = verifyProposal(proposal(), LISTING);
    assert.equal(result.verdict, 'verified');
    assert.equal(result.value, 'yes');
    assert.equal(result.confidence, 0.8);
  });

  test('an unverifiable quote is downgraded to unknown, not merely flagged', () => {
    const result = verifyProposal(proposal({ evidence: 'beginners especially welcome' }), LISTING);
    assert.equal(result.verdict, 'unverified_evidence');
    assert.equal(result.value, 'unknown', 'the claim must not survive');
    assert.equal(result.confidence, 0);
    assert.match(result.reasoning, /not found in the listing/);
  });

  test('a confident claim with no quote at all is downgraded', () => {
    const result = verifyProposal(proposal({ evidence: null, confidence: 0.95 }), LISTING);
    assert.equal(result.verdict, 'no_evidence');
    assert.equal(result.value, 'unknown');
  });

  test('abstaining needs no quote — silence is a correct answer', () => {
    const result = verifyProposal(proposal({ value: 'unknown', evidence: null }), LISTING);
    assert.equal(result.verdict, 'abstained');
    assert.equal(result.value, 'unknown');
  });

  test('a boolean attribute abstains with null, not false', () => {
    const result = verifyProposal(
      { field_key: 'social_after', value: null, evidence: null, confidence: null },
      LISTING, { unknownValue: null },
    );
    assert.equal(result.verdict, 'abstained');
    assert.equal(result.value, null);
  });

  test('a false boolean still needs a quote', () => {
    const result = verifyProposal(
      { field_key: 'social_after', value: false, evidence: 'no drinks afterwards', confidence: 0.7 },
      LISTING, { unknownValue: null },
    );
    assert.equal(result.verdict, 'unverified_evidence');
    assert.equal(result.value, null);
  });
});

describe('prompt', () => {
  test('only the listing text is quotable', () => {
    const text = sourceTextFor({
      title: 'East Coast Sunrise 10K', summary: 'All paces welcome.',
      description: null, organiser_name: 'East Coast Run Club',
      organiser_description: null, venue_name: 'East Coast Park',
    });
    assert.match(text, /East Coast Sunrise 10K/);
    assert.match(text, /All paces welcome/);
    assert.doesNotMatch(text, /undefined|null/);
  });

  test('the output schema is built from the values the database accepts', () => {
    const schema = buildOutputSchema(ALLOWED);
    const ok = schema.safeParse(fullAnswer('yes'));
    assert.equal(ok.success, true);

    const bad = schema.safeParse(fullAnswer('definitely'));
    assert.equal(bad.success, false, 'a value outside the CHECK constraint must not parse');
  });

  test('the user message states the allowed values and the known price', () => {
    const message = buildUserMessage(
      { title: 'Padel open play', capacity: 4, price_min: 30, price_max: 30, currency: 'SGD' },
      ALLOWED,
    );
    assert.match(message, /Allowed values: yes, probably, unlikely, unknown/);
    assert.match(message, /SGD 30/);
    assert.match(message, /Capacity: 4/);
  });

  test('the system prompt instructs abstention before anything else', () => {
    assert.match(SYSTEM_PROMPT, /Abstain by default/);
    assert.match(SYSTEM_PROMPT, /Quote or abstain/);
    assert.match(SYSTEM_PROMPT, /Never infer from the activity type/);
  });
});

function fullAnswer(soloValue) {
  const base = { evidence: 'x', reasoning: 'y', confidence: 0.5 };
  return {
    solo_friendly: { ...base, value: soloValue },
    newcomer_norm: { ...base, value: 'unknown' },
    pressure_level: { ...base, value: 'rsvp' },
    conversation_load: { ...base, value: 'light' },
    group_size: { ...base, value: 'medium' },
    intensity: { ...base, value: 'moderate' },
    social_after: { ...base, value: true },
    cost_band: { ...base, value: 'under_20' },
  };
}
