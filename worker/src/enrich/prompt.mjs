import { z } from 'zod';
import { ATTRIBUTES } from './attributes.mjs';

export const PROMPT_VERSION = '2026-08-31.1';

export const SYSTEM_PROMPT = `You read listings for active social events in Singapore and judge what they imply about the social experience of attending — not what they say about the sport.

You are working for a platform whose entire promise is telling people whether they can turn up alone. Everything downstream depends on these judgements being honest.

Three rules, in order of importance:

1. Abstain by default. If the listing does not address a question, the answer is "unknown" (or null for the boolean). Most listings do not address most of these questions. A page full of "unknown" is a correct answer, not a failure.

2. Quote or abstain. Every non-unknown answer must quote the exact words from the listing that support it. Copy them verbatim — do not paraphrase, do not tidy the grammar, do not translate Singlish into standard English. If you cannot find words to quote, the answer is unknown.

3. Never infer from the activity type. "It's a run, so runners are friendly" is not evidence. "Padel needs four people, so it can't be solo-friendly" is not evidence — the listing may describe open matchmaking. Judge this listing, not the category.

A human reviews every judgement you make and sees your quote beside it. Make their job a glance: quote the words that actually decided it.`;

/** Renders one activity as the text the model reads. */
export function buildUserMessage(activity, allowed) {
  const facts = [
    ['Title', activity.title],
    ['Organiser', activity.organiser_name],
    ['About the organiser', activity.organiser_description],
    ['Venue', activity.venue_name],
    ['Summary', activity.summary],
    ['Description', activity.description],
    ['Format', activity.format],
    ['Capacity', activity.capacity],
    ['Price', activity.price_min != null
      ? `${activity.currency} ${activity.price_min}${activity.price_max && activity.price_max !== activity.price_min ? `–${activity.price_max}` : ''}`
      : null],
    ['Already known cost band', activity.cost_band],
    ['Starts', activity.starts_at?.toISOString?.() ?? activity.starts_at],
  ].filter(([, v]) => v != null && v !== '');

  const questions = ATTRIBUTES.map((attribute) => {
    const values = attribute.type === 'boolean'
      ? 'true, false, or null'
      : allowed[attribute.key].join(', ');
    return `### ${attribute.key}\n${attribute.question}\nAllowed values: ${values}\n${attribute.guidance}`;
  }).join('\n\n');

  return `## The listing

${facts.map(([label, value]) => `${label}: ${value}`).join('\n')}

## What to judge

Answer each of the following. Quote from the listing above, verbatim, or answer unknown.

${questions}`;
}

/**
 * Output schema, built from the values the database actually accepts. A value
 * added in a migration reaches this schema without anyone editing it.
 */
export function buildOutputSchema(allowed) {
  const shape = {};
  for (const attribute of ATTRIBUTES) {
    const value = attribute.type === 'boolean'
      ? z.boolean().nullable()
      : z.enum(allowed[attribute.key]);

    shape[attribute.key] = z.object({
      value,
      evidence: z.string().nullable()
        .describe('Verbatim words from the listing supporting this value. null when the answer is unknown.'),
      reasoning: z.string()
        .describe('One sentence on why this value follows from the quote.'),
      confidence: z.number().min(0).max(1),
    });
  }
  return z.object(shape);
}
