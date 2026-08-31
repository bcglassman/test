#!/usr/bin/env node
/**
 * Applies schema/*.sql in order, once each.
 *
 * Runs as a pre-deploy job, so a deployment cannot start serving against a
 * database that is missing the migration the new code expects.
 *
 *   node src/migrate.mjs            apply anything outstanding
 *   node src/migrate.mjs --dry-run  list what would run
 *
 * Each file is applied inside a transaction and recorded with a checksum. If a
 * file already applied is later edited, this refuses to continue rather than
 * papering over it: the database and the repository would otherwise disagree
 * with nothing to show for it.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, withTransaction } from './db.mjs';
import { log } from './lib/log.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(here, '../../schema');

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    checksum    text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

export async function readMigrations(dir = DEFAULT_DIR) {
  const entries = await readdir(dir);
  const files = entries.filter((name) => /^\d+.*\.sql$/.test(name)).sort();

  return Promise.all(files.map(async (filename) => {
    const sql = await readFile(path.join(dir, filename), 'utf8');
    return { filename, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

export async function migrate(pool, { dir = DEFAULT_DIR, dryRun = false } = {}) {
  await pool.query(LEDGER);

  const migrations = await readMigrations(dir);
  const { rows } = await pool.query('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  const drifted = migrations.filter(
    (m) => applied.has(m.filename) && applied.get(m.filename) !== m.checksum,
  );
  if (drifted.length > 0) {
    throw new Error(
      `Already-applied migration(s) have changed on disk: ${drifted.map((m) => m.filename).join(', ')}. ` +
      'The database no longer matches the repository. Add a new migration instead of editing an applied one.',
    );
  }

  const pending = migrations.filter((m) => !applied.has(m.filename));
  if (pending.length === 0) {
    log.info(`Schema up to date (${migrations.length} migration(s) applied).`);
    return { applied: [], total: migrations.length };
  }

  for (const migration of pending) {
    if (dryRun) {
      log.info(`  would apply ${migration.filename}`);
      continue;
    }
    log.step(`applying ${migration.filename}`);
    await withTransaction(pool, async (client) => {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [migration.filename, migration.checksum],
      );
    });
  }

  return { applied: pending.map((m) => m.filename), total: migrations.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = createPool();
  try {
    const result = await migrate(pool, { dryRun: process.argv.includes('--dry-run') });
    if (result.applied.length > 0) log.info(`Applied ${result.applied.length} migration(s).`);
  } catch (error) {
    log.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
