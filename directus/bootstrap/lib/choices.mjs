/**
 * Derives dropdown choices for Directus from the database's own CHECK
 * constraints.
 *
 * The schema already states, in one place, that `activities.solo_friendly` is
 * one of yes/probably/unlikely/unknown. Re-typing that list into a Directus
 * field configuration creates two sources of truth that drift the first time
 * someone adds a value in SQL. So we read the constraints instead: the
 * dropdowns cannot disagree with what the database will accept.
 */

const SINGLE_QUOTED = /'((?:[^']|'')*)'/g;

/**
 * Pulls the allowed values out of a single-column CHECK constraint of the
 * shape `col = ANY (ARRAY['a'::text, 'b'::text])` - which is how Postgres
 * normalises `col IN ('a','b')`.
 *
 * Returns null for CHECK constraints that are not simple value lists
 * (ranges, cross-column rules, the enrichment gate), which have no dropdown.
 */
export function parseChoices(definition) {
  if (!definition) return null;

  // Only simple membership tests. A definition mentioning more than one
  // column, or any comparison operator, is a rule rather than a value list.
  if (!/=\s*ANY\s*\(/i.test(definition)) return null;
  if (/\b(AND|OR|<|>|<>|!=)\b/i.test(definition)) return null;

  const values = [];
  let match;
  while ((match = SINGLE_QUOTED.exec(definition)) !== null) {
    values.push(match[1].replace(/''/g, "'"));
  }
  SINGLE_QUOTED.lastIndex = 0;

  return values.length > 0 ? values : null;
}

/** `awaiting_manual` -> `Awaiting manual`, `20_to_50` -> `20 to 50` */
export function humanise(value) {
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Reads every single-column CHECK constraint in the public schema.
 * Returns { [`table.column`]: ["a", "b", ...] }.
 */
export async function readChoices(pg) {
  const { rows } = await pg.query(`
    SELECT rel.relname                        AS table_name,
           att.attname                        AS column_name,
           pg_get_constraintdef(con.oid)      AS definition
    FROM pg_constraint con
    JOIN pg_class rel        ON rel.oid = con.conrelid
    JOIN pg_namespace nsp    ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute att    ON att.attrelid = rel.oid AND att.attnum = k.attnum
    WHERE con.contype = 'c'
      AND nsp.nspname = 'public'
      AND array_length(con.conkey, 1) = 1
    ORDER BY rel.relname, att.attname
  `);

  const choices = {};
  for (const row of rows) {
    const values = parseChoices(row.definition);
    if (!values) continue;
    const key = `${row.table_name}.${row.column_name}`;
    // A column with several CHECK constraints keeps the intersection of what
    // they allow; the union would offer values the database rejects.
    choices[key] = choices[key]
      ? choices[key].filter((v) => values.includes(v))
      : values;
  }
  return choices;
}

/** Shapes a value list into what a Directus select interface expects. */
export function toDirectusChoices(values) {
  return values.map((value) => ({ text: humanise(value), value }));
}
