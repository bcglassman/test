/**
 * Evidence verification.
 *
 * Every proposal must quote the source text it rests on. A quote that does not
 * appear in what the model was given is not evidence — whatever produced it,
 * it cannot be checked at a glance, which is the whole reason evidence exists.
 *
 * So we verify it mechanically. An unverifiable quote does not become a
 * proposal a reviewer has to disprove; the field is downgraded to unknown with
 * the discrepancy recorded. The reviewer's time is the scarce resource here,
 * and a plausible-looking false quote is the most expensive thing we could
 * put in front of them.
 */

/** Lowercase, strip quote marks and ellipses, collapse whitespace. */
export function normaliseForMatch(text) {
  return String(text ?? '')
    .replace(/[‘’“”"'`]/g, '')
    .replace(/[…]|\.\.\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * True when `quote` appears in `source`. A quote joined across an ellipsis is
 * checked fragment by fragment, since "all paces welcome … kopi after" is a
 * fair citation of two separate sentences.
 */
export function isQuoted(quote, source) {
  const haystack = normaliseForMatch(source);
  if (!haystack) return false;

  const fragments = String(quote ?? '')
    .split(/…|\.\.\./)
    .map(normaliseForMatch)
    .filter((f) => f.length >= 4);

  if (fragments.length === 0) return false;
  return fragments.every((fragment) => haystack.includes(fragment));
}

/**
 * Checks one proposal against the text the model was shown.
 * Returns the proposal, possibly downgraded, plus a verdict for the log.
 */
export function verifyProposal(proposal, sourceText, { unknownValue = 'unknown' } = {}) {
  const { field_key: key, value, evidence } = proposal;

  // "Nothing in the listing addresses this" is a legitimate answer, and it is
  // the one we want when the listing is silent. It needs no quote.
  const isAbstention = value === null || value === unknownValue;
  if (isAbstention) return { ...proposal, verdict: 'abstained' };

  if (!evidence || evidence.trim() === '') {
    return {
      ...proposal,
      value: unknownValue === 'unknown' ? 'unknown' : null,
      confidence: 0,
      verdict: 'no_evidence',
      reasoning: `${proposal.reasoning ?? ''} [downgraded: proposed ${JSON.stringify(value)} with no supporting quote]`.trim(),
    };
  }

  if (!isQuoted(evidence, sourceText)) {
    return {
      ...proposal,
      value: unknownValue === 'unknown' ? 'unknown' : null,
      confidence: 0,
      verdict: 'unverified_evidence',
      reasoning: `${proposal.reasoning ?? ''} [downgraded: quoted text not found in the listing]`.trim(),
    };
  }

  return { ...proposal, verdict: 'verified' };
}

/** The exact text a proposal may cite — nothing else is quotable. */
export function sourceTextFor(activity) {
  return [
    activity.title,
    activity.summary,
    activity.description,
    activity.organiser_name,
    activity.organiser_description,
    activity.venue_name,
  ].filter(Boolean).join('\n\n');
}
