/**
 * The soft-socializing attributes, and how they are asked about.
 *
 * The allowed values are NOT listed here. They are read from the database's
 * CHECK constraints at runtime, the same way the Directus dropdowns are, so a
 * value added in a migration reaches the prompt and the output schema without
 * anyone remembering to update this file.
 */

export const ATTRIBUTES = [
  {
    key: 'solo_friendly',
    type: 'enum',
    question: 'Could someone turn up alone without it being awkward?',
    guidance:
      'Open matchmaking, "all welcome", "no partner needed", or a large public race point to yes. ' +
      'A court booking needing a group of four, or "bring your friends", points to unlikely. ' +
      'This is the most consequential field: a wrong "yes" sends someone alone to something that is not, ' +
      'and they do not come back. When the listing does not address it, the answer is unknown.',
  },
  {
    key: 'newcomer_norm',
    type: 'enum',
    question: 'Would a first-timer be unusual here?',
    guidance:
      '"Beginners welcome", "new faces every week", an intro session, or recruiting language point to common. ' +
      'A closed squad, invite-only session, or advanced-only entry requirement points to rare. ' +
      'Most listings say nothing about this. Say unknown.',
  },
  {
    key: 'pressure_level',
    type: 'enum',
    question: 'What is someone committing to?',
    guidance:
      'drop_in: just turn up, no booking. rsvp: a booking or ticket for a single occasion. ' +
      'commit: a course, season, league, or multi-week programme.',
  },
  {
    key: 'conversation_load',
    type: 'enum',
    question: 'How much talking is expected?',
    guidance:
      'parallel: people do the thing side by side with little talking. ' +
      'light: chat happens naturally but nobody has to carry it — most runs and classes. ' +
      'conversational: talking is the activity, e.g. a book club or language exchange.',
  },
  {
    key: 'group_size',
    type: 'enum',
    question: 'How many people will be there?',
    guidance:
      'Use stated capacity when there is one: intimate up to 8, small 9-20, medium 21-60, large above 60. ' +
      'A court booking is intimate. A mass-participation race is large. Do not guess from the venue alone.',
  },
  {
    key: 'intensity',
    type: 'enum',
    question: 'How physically hard is it?',
    guidance:
      'gentle: a walk, restorative yoga. moderate: a social-pace run, a beginner class. ' +
      'vigorous: a hard training session, a long run. competitive: racing, leagues, timed events.',
  },
  {
    key: 'social_after',
    type: 'boolean',
    question: 'Is there a social element afterwards — coffee, kopi, drinks, a meal?',
    guidance:
      'True only when the listing actually says so. A venue that happens to have a cafe is not evidence. ' +
      'When it is not mentioned, answer null rather than false — no mention is not the same as no coffee.',
  },
  {
    key: 'cost_band',
    type: 'enum',
    question: 'What does it cost to attend?',
    guidance:
      'Only infer this when no price was captured at ingest. Prefer a stated price over any inference.',
  },
];

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

/**
 * Reads the allowed values for the enum attributes from the CHECK constraints
 * on `activities`, so the prompt cannot offer a value the database rejects.
 */
export async function readAllowedValues(pool) {
  const { rows } = await pool.query(`
    SELECT att.attname AS column_name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel     ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
    WHERE con.contype = 'c' AND nsp.nspname = 'public'
      AND rel.relname = 'activities'
      AND array_length(con.conkey, 1) = 1
      AND att.attname = ANY($1)
  `, [ATTRIBUTE_KEYS]);

  const allowed = {};
  for (const row of rows) {
    if (!/=\s*ANY\s*\(/i.test(row.definition)) continue;
    const values = [...row.definition.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]);
    if (values.length > 0) allowed[row.column_name] = values;
  }

  const missing = ATTRIBUTES.filter((a) => a.type === 'enum' && !allowed[a.key]);
  if (missing.length > 0) {
    throw new Error(
      `No CHECK constraint found for: ${missing.map((a) => a.key).join(', ')}. ` +
      'Has the schema changed? The prompt is built from these constraints.',
    );
  }
  return allowed;
}
