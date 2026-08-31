/**
 * The migration runner against a real, empty database.
 * Skipped unless TEST_MIGRATE_URL is set — it needs a database it can own.
 */

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPool } from '../src/db.mjs';
import { migrate, readMigrations } from '../src/migrate.mjs';

const url = process.env.TEST_MIGRATE_URL;

describe('migration runner', { skip: url ? false : 'set TEST_MIGRATE_URL to run' }, () => {
  let pool;
  let dir;

  before(async () => { pool = createPool(url); });
  after(async () => { await pool?.end(); await rm(dir, { recursive: true, force: true }); });

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await rm(dir ?? '', { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(path.join(tmpdir(), 'mig-'));
    await writeFile(path.join(dir, '001_first.sql'), 'CREATE TABLE alpha (id int);');
    await writeFile(path.join(dir, '002_second.sql'), 'CREATE TABLE beta (id int);');
  });

  test('applies files in order and records them', async () => {
    const result = await migrate(pool, { dir });
    assert.deepEqual(result.applied, ['001_first.sql', '002_second.sql']);

    const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
    assert.deepEqual(rows.map((r) => r.filename), ['001_first.sql', '002_second.sql']);
    await pool.query('SELECT 1 FROM alpha');   // throws if the table is missing
    await pool.query('SELECT 1 FROM beta');
  });

  test('running twice applies nothing the second time', async () => {
    await migrate(pool, { dir });
    const second = await migrate(pool, { dir });
    assert.deepEqual(second.applied, []);
  });

  test('a new file is applied without re-running the old ones', async () => {
    await migrate(pool, { dir });
    await writeFile(path.join(dir, '003_third.sql'), 'CREATE TABLE gamma (id int);');
    const result = await migrate(pool, { dir });
    assert.deepEqual(result.applied, ['003_third.sql']);
  });

  test('refuses to continue when an applied migration was edited', async () => {
    await migrate(pool, { dir });
    await writeFile(path.join(dir, '001_first.sql'), 'CREATE TABLE alpha (id int, extra text);');
    await assert.rejects(migrate(pool, { dir }), /no longer matches the repository/);
  });

  test('a failing migration rolls back and is not recorded', async () => {
    await writeFile(path.join(dir, '003_bad.sql'), 'CREATE TABLE delta (id int); SELECT nonexistent_fn();');
    await assert.rejects(migrate(pool, { dir }));

    const { rows } = await pool.query('SELECT filename FROM schema_migrations');
    assert.equal(rows.length, 2, 'the failed migration is not recorded');
    await assert.rejects(pool.query('SELECT 1 FROM delta'), /does not exist/,
      'and its partial work was rolled back');
  });

  test('dry run applies nothing', async () => {
    await migrate(pool, { dir, dryRun: true });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    assert.equal(rows[0].n, 0);
  });

  test('the real schema directory is discovered and ordered', async () => {
    const migrations = await readMigrations();
    assert.ok(migrations.length >= 4);
    assert.equal(migrations[0].filename, '001_init.sql');
    assert.deepEqual([...migrations].sort((a, b) => a.filename.localeCompare(b.filename)).map(m => m.filename),
                     migrations.map((m) => m.filename), 'already in order');
  });
});
