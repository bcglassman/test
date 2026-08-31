# Deployment — DigitalOcean

Everything runs on DigitalOcean App Platform in the `sgp` region: Directus, the worker's
scheduled jobs, the public site, and a managed Postgres. The spec is `.do/app.yaml`.

```sh
doctl apps create --spec .do/app.yaml
doctl apps update <app-id> --spec .do/app.yaml     # to change it later
```

## What the spec does not carry

Secrets are declared as `type: SECRET` with no value — set them in the App Platform
console or with `doctl` after the first create. Nothing secret belongs in the repository.

| Secret | Where it comes from |
|---|---|
| `SECRET` | `openssl rand -base64 32` — signs Directus tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first Directus login. Change the password after signing in |
| `STORAGE_SPACES_KEY` / `_SECRET` | A Spaces access key, created under API → Spaces Keys |
| `EVENTBRITE_TOKEN` | Eventbrite → Developer Links → API Keys |
| `ANTHROPIC_API_KEY` | For the enrichment and copy passes |

## Before the first deploy

1. **Create a Spaces bucket** named `mim-media` in `sgp1`, and a Spaces access key.
   This is not optional and not cosmetic: App Platform container disk is **ephemeral**,
   so with the default local storage driver every uploaded image disappears on the next
   deploy. The spec points Directus at Spaces instead.
2. **Check the instance size slugs.** They change; `doctl apps tier instance-size list`
   shows what is current. A stale slug fails the create with an unhelpful message.
3. **Point the repo at the right branch.** The spec says `branch: main`. While the work
   lives on `claude/social-active-events-sg`, either change it or merge first.

## What happens on deploy

```
push to main
     │
     ▼
PRE_DEPLOY job: node src/migrate.mjs
     │   applies any schema/*.sql not yet applied, each in a transaction,
     │   recorded with a checksum. Refuses to run if an applied file was edited.
     ▼
services start · Directus at /admin
     │
     ▼
scheduled jobs run on their own cron
```

The migration job is `PRE_DEPLOY`, so a deployment cannot start serving against a database
missing the migration the new code expects. If it fails, the deploy stops.

After the first deploy, run the Directus bootstrap once from your machine against the
live instance — it registers the collections, field interfaces and access policies:

```sh
DIRECTUS_URL=https://<your-app>.ondigitalocean.app/admin \
DATABASE_URL='<managed db connection string>' \
npm --prefix directus/bootstrap start
```

## The daily pipeline

| Job | Time (SGT) | What |
|---|---|---|
| `ingest` | 02:00 | Fetch from configured sources |
| `enrich` | 03:00 | Propose soft attributes for new drafts |
| `schedule-posts` | 04:00 | Fill the next four days' slots |
| `variants` | 05:00 | Write channel copy for approved posts |
| `gap-check` | 05:30 | **Exits non-zero if a slot is unfilled** |

Each reads what the previous produced, so the order matters more than the exact times.

`gap-check` is deliberately a job that fails: a failed run is the alert that nothing goes
out that day. Wire App Platform's job-failure notification to wherever you will actually
see it.

Scheduled jobs are **capped at 30 minutes** and billed only while running. The `--limit`
values are set to stay well inside that; if `enrich` starts timing out, lower `--limit`
rather than raising the cap, since each activity is a separate model call.

## Things to know before they surprise you

**Directus runs at one instance.** `instance_count: 1` is deliberate. Directus caching and
websockets assume shared state across instances; scaling past one needs Redis (DO's
managed caching product) wired in as well. Raising the count without that will produce
intermittent, confusing staleness.

**`DB_SSL__REJECT_UNAUTHORIZED` is false** because DO managed Postgres presents its own CA.
The connection is still TLS. The alternative is mounting DO's CA certificate into the
container, which is tidier if you would rather not have that line.

**The site is commented out** of the spec because it does not exist yet. Uncomment the
`web` service once `site/` is built — App Platform will fail the deploy looking for a
directory that is not there.

**Costs**, very roughly: managed Postgres from about $15/month, each service and the
scheduled jobs a few dollars each, Spaces about $5. Expect $35–60/month at small scale.
Check current pricing rather than trusting this line.

## Verification status

The spec is valid YAML, uses no merge keys (DigitalOcean's Go parser does not support
them), and every job carries the environment it needs. The migration runner is tested
against PostgreSQL 16, including drift detection and rollback on failure.

**None of this has been deployed.** No DigitalOcean account was involved in writing it,
and `doctl` was never run. Expect to fix at least one thing on the first create —
most likely an instance size slug or the Spaces endpoint region.
