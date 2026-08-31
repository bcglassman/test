#!/usr/bin/env node
/**
 * Registers the Meet in Motion content model in Directus.
 *
 * The database owns the schema; this makes Directus a usable editing surface on
 * top of it. Idempotent - run it after every migration and after any change to
 * model.mjs. Nothing here creates or alters a table.
 *
 *   node index.mjs            apply
 *   node index.mjs --dry-run  print what would change, touch nothing
 */

import pgpkg from 'pg';
import { Directus } from './lib/api.mjs';
import { readChoices, toDirectusChoices } from './lib/choices.mjs';
import { groups, collections, fields, policies } from './model.mjs';

const DRY = process.argv.includes('--dry-run');
const log = (...a) => console.log(...a);
const plan = (...a) => log(DRY ? '  would' : '  ', ...a);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

// ---------------------------------------------------------------------------

async function ensureGroups(api, existing) {
  log('\nSidebar groups');
  for (const group of groups) {
    if (existing.has(group.collection)) { plan('skip', group.collection, '(exists)'); continue; }
    plan('create folder', group.collection);
    if (DRY) continue;
    // schema: null makes a presentation-only folder, not a table.
    await api.post('/collections', {
      collection: group.collection,
      schema: null,
      meta: { icon: group.icon, note: group.note, collapse: 'open' },
    });
  }
}

async function ensureCollections(api, existing) {
  log('\nCollections');
  for (const c of collections) {
    const meta = {
      icon: c.icon ?? 'table_rows',
      note: c.note ?? null,
      display_template: c.display ?? null,
      hidden: c.hidden ?? false,
      group: c.group ?? null,
      sort: c.sort ?? null,
      sort_field: c.sortField ?? null,
      archive_field: c.archive ? 'status' : null,
      archive_value: c.archive ?? null,
      unarchive_value: c.archive ? 'draft' : null,
    };

    if (existing.has(c.name)) {
      plan('update meta', c.name);
      if (!DRY) await api.patch(`/collections/${c.name}`, { meta });
      continue;
    }

    plan('register', c.name);
    if (DRY) continue;
    // The table already exists; Directus adopts it and imports its columns.
    await api.post('/collections', { collection: c.name, meta });
  }
}

async function ensureFieldMeta(api, choices) {
  log('\nField interfaces');
  let dropdowns = 0;
  let overrides = 0;

  for (const c of collections) {
    let present;
    try {
      present = await api.get(`/fields/${c.name}`);
    } catch (error) {
      log(`  ! could not read fields for ${c.name}: ${error.message}`);
      continue;
    }

    for (const field of present) {
      const key = `${c.name}.${field.field}`;
      const meta = {};

      // Dropdowns come from the database's CHECK constraints, never from a
      // hand-maintained list - see lib/choices.mjs.
      if (choices[key]) {
        meta.interface = 'select-dropdown';
        meta.options = { choices: toDirectusChoices(choices[key]) };
        meta.display = 'labels';
        dropdowns += 1;
      }

      const override = fields[key];
      if (override) {
        Object.assign(meta, override);
        if (override.options && choices[key]) {
          // an explicit override wins, but keep derived choices if it set none
          meta.options = { ...meta.options, ...override.options };
        }
        overrides += 1;
      }

      if (Object.keys(meta).length === 0) continue;
      if (!DRY) await api.patch(`/fields/${c.name}/${field.field}`, { meta });
    }
  }
  plan(`configure ${dropdowns} derived dropdowns and ${overrides} field overrides`);
}

async function ensureAccess(api) {
  log('\nAccess policies');
  const existing = await api.get('/policies?limit=-1');
  const byName = new Map(existing.map((p) => [p.name, p]));

  for (const policy of policies) {
    let record = byName.get(policy.name);

    if (record) {
      plan('reuse policy', policy.name);
    } else {
      plan('create policy', policy.name);
      if (!DRY) {
        record = await api.post('/policies', {
          name: policy.name,
          icon: policy.icon,
          description: policy.description,
          app_access: !policy.name.toLowerCase().includes('bot'),
          admin_access: false,
        });
      }
    }
    if (DRY) continue;

    // Replace this policy's permissions wholesale so the file is the source of
    // truth - an edit in the Data Studio is overwritten on the next run.
    const current = await api.get(`/permissions?filter[policy][_eq]=${record.id}&limit=-1`);
    for (const permission of current) await api.request('DELETE', `/permissions/${permission.id}`);

    for (const rule of policy.permissions) {
      for (const action of rule.actions) {
        await api.post('/permissions', {
          policy: record.id,
          collection: rule.collection,
          action,
          fields: rule.fields ?? ['*'],
          permissions: rule.filter ?? {},
          validation: rule.validation ?? {},
        });
      }
    }
    plan(`set ${policy.permissions.length} permission rules on ${policy.name}`);
  }

  log('\n  Roles are not created here. In the Data Studio, make a role per person');
  log('  and attach these policies — that is what the policy model is for.');
}

// ---------------------------------------------------------------------------

async function main() {
  const directusUrl = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
  const databaseUrl = required('DATABASE_URL');

  log(`Meet in Motion — Directus bootstrap${DRY ? ' (dry run)' : ''}`);
  log(`  Directus: ${directusUrl}`);

  const pg = new pgpkg.Client({ connectionString: databaseUrl });
  await pg.connect();
  const choices = await readChoices(pg);
  await pg.end();
  log(`  Derived dropdown choices for ${Object.keys(choices).length} columns from CHECK constraints`);

  const api = new Directus(directusUrl);
  await api.login(required('DIRECTUS_ADMIN_EMAIL'), required('DIRECTUS_ADMIN_PASSWORD'));

  const registered = new Set((await api.get('/collections?limit=-1')).map((c) => c.collection));

  await ensureGroups(api, registered);
  await ensureCollections(api, registered);
  await ensureFieldMeta(api, choices);
  await ensureAccess(api);

  log(DRY ? '\nDry run complete. Nothing changed.' : '\nDone.');
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
