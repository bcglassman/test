import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { score, rank, planSlot, isStillUpcoming, daysBetween, WEIGHTS } from '../src/schedule/select.mjs';
import { addDays } from '../src/schedule/run.mjs';

const DATE = '2026-09-10';

const activity = (over = {}) => ({
  id: 'a1', title: 'Tuesday Run', quality_score: 50,
  category: 'cat-run', organiser: 'org-ecrc',
  solo_friendly: 'unknown', newcomer_norm: 'unknown',
  starts_at: `${addDays(DATE, 7)}T11:00:00Z`, is_sponsored: false, ...over,
});

describe('scoring', () => {
  test('starts from the activity quality score', () => {
    assert.equal(score(activity({ quality_score: 42 }), { date: DATE }).total, 42);
  });

  test('a listing whose social attributes are known outranks one that is not', () => {
    const known = score(activity({ solo_friendly: 'yes', newcomer_norm: 'common' }), { date: DATE });
    const unknown = score(activity(), { date: DATE });
    assert.equal(known.total - unknown.total, WEIGHTS.soloKnown + WEIGHTS.newcomerKnown);
  });

  test('penalises an event that is too soon to act on', () => {
    const soon = score(activity({ starts_at: `${addDays(DATE, 1)}T11:00:00Z` }), { date: DATE });
    assert.ok(soon.reasons.some((r) => r.includes('starts in 1d')));
    assert.equal(soon.total, 50 + WEIGHTS.tooSoon);
  });

  test('penalises an event too far out to feel current', () => {
    const far = score(activity({ starts_at: `${addDays(DATE, 60)}T11:00:00Z` }), { date: DATE });
    assert.equal(far.total, 50 + WEIGHTS.tooFar);
  });

  test('rotation penalties apply against what is already scheduled', () => {
    const history = [{ activity: 'other', scheduled_for: addDays(DATE, -2),
                       category: 'cat-run', organiser: 'org-ecrc' }];
    const result = score(activity(), { date: DATE, history });
    assert.equal(result.total, 50 + WEIGHTS.sameCategoryWithin3Days + WEIGHTS.sameOrganiserWithin7Days);
    assert.ok(result.reasons.some((r) => r.includes('same category')));
    assert.ok(result.reasons.some((r) => r.includes('same organiser')));
  });

  test('a category repeat outside the window is not penalised', () => {
    const history = [{ activity: 'other', scheduled_for: addDays(DATE, -9),
                       category: 'cat-run', organiser: 'org-other' }];
    assert.equal(score(activity(), { date: DATE, history }).total, 50);
  });

  test('re-spotlighting the same activity is the heaviest penalty', () => {
    const history = [{ activity: 'a1', scheduled_for: addDays(DATE, -10),
                       category: 'x', organiser: 'y' }];
    const result = score(activity(), { date: DATE, history });
    assert.equal(result.total, 50 + WEIGHTS.activitySpotlightedWithin30Days);
  });

  test('sponsorship cannot outweigh organiser rotation — paid placement does not buy the week', () => {
    const history = [{ activity: 'other', scheduled_for: addDays(DATE, -1),
                       category: 'other-cat', organiser: 'org-ecrc' }];
    const sponsored = score(activity({ is_sponsored: true }), { date: DATE, history });
    const plain = score(activity({ id: 'a2', organiser: 'org-fresh' }), { date: DATE, history });
    assert.ok(plain.total > sponsored.total,
      'an unsponsored listing from a rested organiser must still win');
  });

  test('sponsorship does help when nothing else separates them', () => {
    const sponsored = score(activity({ is_sponsored: true }), { date: DATE });
    const plain = score(activity(), { date: DATE });
    assert.equal(sponsored.total - plain.total, WEIGHTS.sponsored);
  });

  test('reasons explain the score an editor sees', () => {
    const result = score(activity({ solo_friendly: 'yes', is_sponsored: true }), { date: DATE });
    assert.deepEqual(result.reasons, ['quality 50', '+15 solo-friendly known', '+20 sponsored', 'starts in 7d']);
  });
});

describe('eligibility', () => {
  test('an event in the past is dropped, not merely scored low', () => {
    const past = activity({ starts_at: `${addDays(DATE, -1)}T11:00:00Z` });
    assert.equal(isStillUpcoming(past, DATE), false);
    assert.equal(rank([past], { date: DATE }).length, 0);
  });

  test('an activity with no upcoming session is dropped', () => {
    assert.equal(rank([activity({ starts_at: null })], { date: DATE }).length, 0);
  });

  test('an event later the same day still counts', () => {
    assert.equal(isStillUpcoming(activity({ starts_at: `${DATE}T23:00:00Z` }), DATE), true);
  });
});

describe('planning a slot', () => {
  test('picks the highest score and shows the runners-up', () => {
    const result = planSlot(
      [activity({ id: 'a1', quality_score: 40 }),
       activity({ id: 'a2', title: 'Padel', quality_score: 80, category: 'cat-padel', organiser: 'org-p' }),
       activity({ id: 'a3', title: 'Swim', quality_score: 60, category: 'cat-swim', organiser: 'org-s' })],
      { date: DATE, slot: 'morning', type: 'event_spotlight', history: [] });

    assert.equal(result.chosen.id, 'a2');
    assert.equal(result.score, 80);
    assert.deepEqual(result.alternatives.map((a) => a.id), ['a3', 'a1']);
  });

  test('reports a gap rather than inventing a post', () => {
    const result = planSlot([], { date: DATE, slot: 'morning', type: 'event_spotlight', history: [] });
    assert.equal(result.chosen, null);
    assert.equal(result.reason, 'no eligible activity');
  });

  test('is deterministic — same inputs, same schedule', () => {
    const pool = [activity({ id: 'b', quality_score: 50 }), activity({ id: 'a', quality_score: 50 })];
    assert.equal(planSlot(pool, { date: DATE, history: [] }).chosen.id,
                 planSlot([...pool].reverse(), { date: DATE, history: [] }).chosen.id);
  });
});

describe('dates', () => {
  test('counts whole days regardless of time of day', () => {
    assert.equal(daysBetween('2026-09-10', '2026-09-12T23:00:00Z'), 2);
    assert.equal(daysBetween('2026-09-10', '2026-09-09T01:00:00Z'), -1);
  });

  test('addDays crosses month boundaries', () => {
    assert.equal(addDays('2026-09-29', 3), '2026-10-02');
  });
});
