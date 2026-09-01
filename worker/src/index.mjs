#!/usr/bin/env node
/**
 * Worker CLI.
 *
 *   node src/index.mjs sources                 list configured sources
 *   node src/index.mjs ingest                  run every active source
 *   node src/index.mjs ingest --source <slug>  run one
 *   node src/index.mjs ingest --dry-run        fetch and map, write nothing
 */

import { createPool } from './db.mjs';
import { log } from './lib/log.mjs';
import { ingestSource } from './ingest/run.mjs';
import * as eventbrite from './ingest/sources/eventbrite.mjs';
import { enrichPending } from './enrich/run.mjs';
import { createModelCaller, DEFAULT_MODEL, DEFAULT_EFFORT } from './enrich/claude.mjs';
import { scheduleDays, findGaps, report, tomorrow, today } from './schedule/run.mjs';
import { generateVariants } from './variants/run.mjs';
import { createVariantWriter, DEFAULT_MODEL as VARIANT_MODEL, DEFAULT_EFFORT as VARIANT_EFFORT } from './variants/claude.mjs';
import { publishDue, remindPending } from './publish/run.mjs';

const ADAPTERS = new Map([[eventbrite.key, eventbrite]]);

const TOKENS = {
  eventbrite: () => process.env.EVENTBRITE_TOKEN,
};

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

async function listSources(pool) {
  const { rows } = await pool.query(
    `SELECT slug, type, is_active, last_polled_at, last_status, last_error
     FROM sources ORDER BY slug`,
  );
  if (rows.length === 0) return log.info('No sources configured. See docs/worker.md.');
  for (const s of rows) {
    const when = s.last_polled_at ? s.last_polled_at.toISOString().slice(0, 16).replace('T', ' ') : 'never';
    log.info(
      `${s.is_active ? '●' : '○'} ${s.slug.padEnd(28)} ${s.type.padEnd(10)} ` +
      `${when.padEnd(17)} ${s.last_status ?? '-'}${s.last_error ? ` — ${s.last_error}` : ''}`,
    );
  }
}

async function ingest(pool) {
  const only = arg('source');
  const dryRun = has('dry-run');

  const { rows: sources } = await pool.query(
    `SELECT id, slug, type, config FROM sources
     WHERE is_active = true ${only ? 'AND slug = $1' : ''}
     ORDER BY slug`,
    only ? [only] : [],
  );

  if (sources.length === 0) {
    log.warn(only ? `No active source named "${only}".` : 'No active sources.');
    return;
  }

  for (const source of sources) {
    const adapter = ADAPTERS.get(source.type === 'api' ? source.config?.adapter : source.type)
                 ?? ADAPTERS.get(source.config?.adapter);
    if (!adapter) {
      log.warn(`${source.slug}: no adapter for type "${source.type}" — skipping`);
      continue;
    }

    const token = TOKENS[adapter.key]?.();
    log.step(`${source.slug} (${adapter.key})${dryRun ? ' — dry run' : ''}`);

    if (dryRun) {
      let count = 0;
      for await (const item of adapter.fetchItems(source, { token })) {
        const activity = adapter.toActivity(item.payload);
        const relevant = !adapter.isRelevant || adapter.isRelevant(item.payload);
        log.info(`  ${relevant ? '+' : '-'} ${activity.title}`);
        log.info(`      ${activity.sessions[0]?.starts_at ?? 'no start time'} · ` +
                 `${activity.venue?.name ?? 'no venue'} · ${activity.cost_band ?? 'price unknown'}`);
        log.info(`      dedupe_key: ${adapter.dedupeKey(activity)}`);
        count += 1;
      }
      log.info(`  ${count} item(s). Nothing written.`);
      continue;
    }

    const stats = await ingestSource(pool, adapter, source, { token });
    log.info(`  seen ${stats.seen} · created ${stats.created} · updated ${stats.updated} · ` +
             `unchanged ${stats.unchanged} · skipped ${stats.skipped} · failed ${stats.failed}`);
  }
}

async function enrich(pool) {
  const dryRun = has('dry-run');
  const limit = Number(arg('limit') ?? 25);
  const model = arg('model') ?? process.env.ENRICH_MODEL ?? DEFAULT_MODEL;
  const effort = arg('effort') ?? process.env.ENRICH_EFFORT ?? DEFAULT_EFFORT;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    log.warn('No ANTHROPIC_API_KEY set — the SDK will look for an `ant auth login` profile.');
  }

  log.step(`enrich · ${model} · effort ${effort} · up to ${limit}${dryRun ? ' — dry run' : ''}`);
  const stats = await enrichPending(pool, createModelCaller({ model, effort }), { limit, dryRun });

  log.info(`\n  considered ${stats.considered} · enriched ${stats.enriched} · ` +
           `declined ${stats.declined} · failed ${stats.failed}`);
  log.info(`  proposals: ${stats.verified} with verified quotes · ${stats.abstained} unknown · ` +
           `${stats.downgraded} downgraded`);
  if (stats.downgraded > 0) {
    log.warn(`  ${stats.downgraded} proposal(s) cited text not present in the listing and were ` +
             'downgraded to unknown. A rising count here means the prompt needs attention.');
  }
}

async function schedule(pool) {
  const dryRun = has('dry-run');
  const days = Number(arg('days') ?? 3);
  const from = arg('from') ?? tomorrow();

  log.step(`schedule · ${days} day(s) from ${from}${dryRun ? ' — dry run' : ''}`);
  const results = await scheduleDays(pool, { from, days, dryRun });
  report(results);
}

async function gaps(pool) {
  const days = Number(arg('days') ?? 7);
  const from = arg('from') ?? today();

  const found = await findGaps(pool, { from, days });
  if (found.length === 0) {
    log.info(`No gaps in the next ${days} day(s).`);
    return;
  }
  log.warn(`${found.length} unfilled slot(s):`);
  for (const gap of found) log.info(`  ${gap.date}  ${gap.slot}  ${gap.type}`);
  process.exitCode = 1;   // so a cron can alert on it
}

async function variants(pool) {
  const dryRun = has('dry-run');
  const limit = Number(arg('limit') ?? 10);
  const model = arg('model') ?? process.env.VARIANT_MODEL ?? VARIANT_MODEL;
  const effort = arg('effort') ?? process.env.VARIANT_EFFORT ?? VARIANT_EFFORT;

  log.step(`variants · ${model} · effort ${effort} · up to ${limit} post(s)${dryRun ? ' — dry run' : ''}`);
  const stats = await generateVariants(pool, createVariantWriter({ model, effort }), { limit, dryRun });

  log.info(`\n  ${stats.posts} post(s) · ${stats.written} variant(s) written` +
           `${stats.repaired ? ` (${stats.repaired} after repair)` : ''} · ` +
           `${stats.rejected} rejected · ${stats.declined} declined · ${stats.failed} failed`);
  if (stats.rejected > 0) {
    log.warn('  Rejected variants carry their reason in generation_note. That channel has ' +
             'no copy until someone writes it or the generator is re-run.');
  }
}

async function publish(pool) {
  const dryRun = has('dry-run');
  log.step(`publish${dryRun ? ' — dry run' : ''}`);
  const stats = await publishDue(pool, { dryRun });
  log.info(`\n  ${stats.due} due · ${stats.sent} sent · ${stats.awaiting} awaiting you · ` +
           `${stats.failed} failed · ${stats.skipped} already handled`);
  if (stats.failed > 0) process.exitCode = 1;
}

async function remind(pool) {
  const { reminded } = await remindPending(pool);
  log.info(reminded === 0 ? 'Nothing waiting to be sent.' : `Nudged ${reminded} unsent post(s).`);
}

async function main() {
  const command = process.argv[2];
  const pool = createPool();
  try {
    if (command === 'sources') await listSources(pool);
    else if (command === 'ingest') await ingest(pool);
    else if (command === 'enrich') await enrich(pool);
    else if (command === 'schedule') await schedule(pool);
    else if (command === 'gaps') await gaps(pool);
    else if (command === 'variants') await variants(pool);
    else if (command === 'publish') await publish(pool);
    else if (command === 'remind') await remind(pool);
    else {
      console.log('Usage: node src/index.mjs <sources|ingest|enrich|schedule|gaps|variants|publish|remind> [options]\n' +
                  '  ingest    [--source <slug>] [--dry-run]\n' +
                  '  enrich    [--limit <n>] [--model <id>] [--effort <level>] [--dry-run]\n' +
                  '  schedule  [--from <YYYY-MM-DD>] [--days <n>] [--dry-run]\n' +
                  '  gaps      [--from <YYYY-MM-DD>] [--days <n>]\n' +
                  '  variants  [--limit <n>] [--model <id>] [--effort <level>] [--dry-run]\n' +
                  '  publish   [--dry-run]\n' +
                  '  remind');
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  log.error(error.message);
  process.exit(1);
});
