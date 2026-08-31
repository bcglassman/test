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

async function main() {
  const command = process.argv[2];
  const pool = createPool();
  try {
    if (command === 'sources') await listSources(pool);
    else if (command === 'ingest') await ingest(pool);
    else if (command === 'enrich') await enrich(pool);
    else {
      console.log('Usage: node src/index.mjs <sources|ingest|enrich> [options]\n' +
                  '  ingest  [--source <slug>] [--dry-run]\n' +
                  '  enrich  [--limit <n>] [--model <id>] [--effort <level>] [--dry-run]');
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
