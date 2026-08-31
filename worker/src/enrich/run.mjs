/**
 * The enrichment pass.
 *
 *   draft activity → model proposes 8 attributes with quotes
 *                  → every quote verified against the listing
 *                  → enrichment_proposals rows, status 'proposed'
 *                  → activity moves to pending_review
 *
 * Nothing here writes an attribute onto the activity. Proposals are what a
 * human accepts or corrects; the value only lands when they do. The database
 * refuses to approve an activity whose enrichment is unconfirmed, so a bug in
 * this file cannot put an inferred value on the public site.
 */

import { withTransaction } from '../db.mjs';
import { log } from '../lib/log.mjs';
import { ATTRIBUTES, readAllowedValues } from './attributes.mjs';
import { PROMPT_VERSION } from './prompt.mjs';
import { sourceTextFor, verifyProposal } from './evidence.mjs';

const SELECT_CANDIDATES = `
  SELECT a.id, a.title, a.summary, a.description, a.format, a.capacity,
         a.price_min, a.price_max, a.currency, a.cost_band,
         o.name AS organiser_name, o.description AS organiser_description,
         v.name AS venue_name,
         (SELECT min(s.starts_at) FROM sessions s
           WHERE s.activity = a.id AND s.status = 'scheduled') AS starts_at
  FROM activities a
  LEFT JOIN organisers o ON o.id = a.organiser
  LEFT JOIN venues v     ON v.id = a.venue
  WHERE a.status = 'draft'
    AND a.enrichment_status = 'not_started'
  ORDER BY a.first_seen_at
  LIMIT $1
`;

export async function enrichPending(pool, callModel, { limit = 25, dryRun = false } = {}) {
  const allowed = await readAllowedValues(pool);
  const { rows: candidates } = await pool.query(SELECT_CANDIDATES, [limit]);

  const stats = { considered: candidates.length, enriched: 0, failed: 0, declined: 0,
                  verified: 0, abstained: 0, downgraded: 0 };

  for (const activity of candidates) {
    try {
      const { attributes, model } = await callModel(activity, allowed);
      const proposals = verifyAll(activity, attributes);

      for (const proposal of proposals) {
        if (proposal.verdict === 'verified') stats.verified += 1;
        else if (proposal.verdict === 'abstained') stats.abstained += 1;
        else stats.downgraded += 1;
      }

      if (dryRun) {
        report(activity, proposals);
      } else {
        await writeProposals(pool, activity, proposals, model);
      }
      stats.enriched += 1;
    } catch (error) {
      if (error.refusal) {
        stats.declined += 1;
        log.warn(`${activity.title}: ${error.message} — left for a human`);
      } else {
        stats.failed += 1;
        log.warn(`${activity.title}: ${error.message}`);
      }
    }
  }

  return stats;
}

function verifyAll(activity, attributes) {
  const sourceText = sourceTextFor(activity);

  return ATTRIBUTES.map((attribute) => {
    const raw = attributes[attribute.key] ?? {};
    const proposal = {
      field_key: attribute.key,
      value: raw.value ?? (attribute.type === 'boolean' ? null : 'unknown'),
      evidence: raw.evidence ?? null,
      reasoning: raw.reasoning ?? null,
      confidence: clampConfidence(raw.confidence),
    };
    return verifyProposal(proposal, sourceText, {
      unknownValue: attribute.type === 'boolean' ? null : 'unknown',
    });
  });
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

async function writeProposals(pool, activity, proposals, model) {
  await withTransaction(pool, async (client) => {
    // Supersede anything still open for this activity, so a re-run replaces
    // rather than collides with the previous pass.
    await client.query(
      `UPDATE enrichment_proposals
       SET status = 'superseded', reviewed_at = now()
       WHERE activity = $1 AND status = 'proposed'`,
      [activity.id],
    );

    for (const proposal of proposals) {
      await client.query(
        `INSERT INTO enrichment_proposals
           (activity, field_key, proposed_value, confidence, evidence, reasoning,
            model, prompt_version, status)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,'proposed')`,
        [activity.id, proposal.field_key, JSON.stringify(proposal.value),
         proposal.confidence, proposal.evidence, proposal.reasoning,
         model, PROMPT_VERSION],
      );
    }

    // The activity is now ready for a person. It is still a draft as far as
    // publishing is concerned - enrichment_status is what the approval gate reads.
    await client.query(
      `UPDATE activities
       SET enrichment_status = 'proposed', status = 'pending_review', date_updated = now()
       WHERE id = $1`,
      [activity.id],
    );
  });
}

function report(activity, proposals) {
  log.info(`\n  ${activity.title}`);
  for (const proposal of proposals) {
    const mark = { verified: '✓', abstained: '·', no_evidence: '✗', unverified_evidence: '✗' }[proposal.verdict];
    const value = JSON.stringify(proposal.value);
    log.info(`    ${mark} ${proposal.field_key.padEnd(18)} ${String(value).padEnd(12)} ` +
             `${proposal.confidence ?? '-'}`);
    if (proposal.evidence && proposal.verdict === 'verified') {
      log.info(`        “${truncate(proposal.evidence, 90)}”`);
    }
    if (proposal.verdict === 'unverified_evidence') {
      log.info(`        quote not found in the listing — downgraded to unknown`);
    }
  }
}

function truncate(text, length) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}
