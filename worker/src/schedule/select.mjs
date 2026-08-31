/**
 * Choosing what to post, and why.
 *
 * Pure functions - no database, no clock. Everything the decision depends on is
 * passed in, so the rotation rules can be tested directly and the reasons shown
 * to an editor are the same ones that produced the choice.
 *
 * The scoring is deliberately legible rather than clever. An editor who
 * disagrees with a pick should be able to read why it won.
 */

export const WEIGHTS = {
  // A listing whose social attributes are unknown makes a worse post - it
  // cannot answer the question the platform exists to answer.
  soloKnown: 15,
  newcomerKnown: 10,

  // Sponsorship moves a listing up the queue. It never bypasses approval, and
  // it is smaller than the rotation penalties on purpose: paid placement should
  // not be able to buy the same organiser three days running.
  sponsored: 20,

  // Rotation. Larger than any boost, because a feed that repeats itself stops
  // being read.
  sameCategoryWithin3Days: -30,
  sameOrganiserWithin7Days: -40,
  activitySpotlightedWithin30Days: -60,

  // Timing. Far enough away to act on, close enough to feel current.
  idealLeadDays: [2, 21],
  tooSoon: -25,
  tooFar: -20,
};

const DAY = 86_400_000;

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

function startOfDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Scores one candidate for one date.
 *
 * `history` is the posts already scheduled or published - both what is in the
 * database and what earlier iterations of this run have planned, so a single
 * run cannot schedule the same organiser twice.
 */
export function score(candidate, { date, history = [] }) {
  const reasons = [];
  let total = candidate.quality_score ?? 0;
  reasons.push(`quality ${total}`);

  const add = (points, why) => {
    if (points === 0) return;
    total += points;
    reasons.push(`${points > 0 ? '+' : ''}${points} ${why}`);
  };

  if (candidate.solo_friendly && candidate.solo_friendly !== 'unknown') {
    add(WEIGHTS.soloKnown, 'solo-friendly known');
  }
  if (candidate.newcomer_norm && candidate.newcomer_norm !== 'unknown') {
    add(WEIGHTS.newcomerKnown, 'newcomer norm known');
  }
  if (candidate.is_sponsored) add(WEIGHTS.sponsored, 'sponsored');

  const lead = candidate.starts_at ? daysBetween(date, candidate.starts_at) : null;
  if (lead != null) {
    const [minLead, maxLead] = WEIGHTS.idealLeadDays;
    if (lead < minLead) add(WEIGHTS.tooSoon, `starts in ${lead}d`);
    else if (lead > maxLead) add(WEIGHTS.tooFar, `starts in ${lead}d`);
    else reasons.push(`starts in ${lead}d`);
  }

  const previous = history.filter((h) => h.scheduled_for);
  const within = (days, match) => previous.some(
    (h) => match(h) && Math.abs(daysBetween(date, h.scheduled_for)) <= days,
  );

  if (within(30, (h) => h.activity === candidate.id)) {
    add(WEIGHTS.activitySpotlightedWithin30Days, 'spotlighted recently');
  }
  if (candidate.organiser && within(7, (h) => h.organiser === candidate.organiser)) {
    add(WEIGHTS.sameOrganiserWithin7Days, 'same organiser this week');
  }
  if (candidate.category && within(3, (h) => h.category === candidate.category)) {
    add(WEIGHTS.sameCategoryWithin3Days, 'same category this week');
  }

  return { total, reasons };
}

/** True when the activity has a session still ahead of the post date. */
export function isStillUpcoming(candidate, date) {
  if (!candidate.starts_at) return false;
  return daysBetween(date, candidate.starts_at) >= 0;
}

/**
 * Ranks candidates for one date, best first. Candidates whose event has already
 * happened are dropped rather than scored - a post about a past event is not a
 * low-quality post, it is a wrong one.
 */
export function rank(candidates, { date, history = [] }) {
  return candidates
    .filter((candidate) => isStillUpcoming(candidate, date))
    .map((candidate) => ({ candidate, ...score(candidate, { date, history }) }))
    .sort((a, b) =>
      b.total - a.total ||
      // Deterministic tie-break: the sooner event, then a stable id order, so
      // the same inputs always produce the same schedule.
      new Date(a.candidate.starts_at) - new Date(b.candidate.starts_at) ||
      String(a.candidate.id).localeCompare(String(b.candidate.id)));
}

/**
 * Plans one slot. Returns the winner and the runners-up, so an editor swapping
 * a pick can see what else was considered.
 */
export function planSlot(candidates, { date, slot, type, history }) {
  const ranked = rank(candidates, { date, history });
  if (ranked.length === 0) {
    return { date, slot, type, chosen: null, alternatives: [], reason: 'no eligible activity' };
  }
  const [winner, ...rest] = ranked;
  return {
    date,
    slot,
    type,
    chosen: winner.candidate,
    score: winner.total,
    reasons: winner.reasons,
    alternatives: rest.slice(0, 3).map((r) => ({ id: r.candidate.id, title: r.candidate.title, score: r.total })),
  };
}
