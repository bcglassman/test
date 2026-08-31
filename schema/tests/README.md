# Schema constraint checks

`constraint_checks.sql` exercises the invariants the design depends on. Tests 1, 3, 5, 7,
8, 9 and 10 are **expected to raise errors** — that is the assertion. `ON_ERROR_STOP` is
deliberately off so the whole file runs.

| # | Asserts |
|---|---|
| 1 | An activity cannot be approved while its soft attributes are unconfirmed |
| 2 | It can be approved once enrichment is confirmed |
| 3 | A resource cannot be published unless a human marked it reputable |
| 4 | A reputable resource publishes |
| 5 | An `event_spotlight` post must reference an activity |
| 6 | A well-formed spotlight inserts |
| 7 | Two spotlights cannot occupy the same day and slot |
| 8 | The same post cannot be published twice to one channel — a fresh idempotency key does not get you a second row |
| 9 | Only one open enrichment proposal per field per activity |
| 10 | Marketing consent cannot be recorded without a consent timestamp (PDPA) |
| 11 | Unfilled slots in a day are queryable, so a gap in the daily calendar can be alerted on |

## Running

```sh
initdb -D /tmp/pg/data -U postgres
pg_ctl -D /tmp/pg/data -o "-k /tmp/pg -p 5433" -l /tmp/pg/pg.log start -w
psql -h /tmp/pg -p 5433 -U postgres -c 'CREATE DATABASE activesg'
psql -h /tmp/pg -p 5433 -U postgres -d activesg -v ON_ERROR_STOP=1 -f schema/001_init.sql
psql -h /tmp/pg -p 5433 -U postgres -d activesg -f schema/tests/constraint_checks.sql
```

Verified against PostgreSQL 16.

---

# constraint_checks_002.sql

Covers migration 002. Tests 2, 3, 5, 6, 7, 8, 9, 10 and 13 are **expected to raise
errors**.

| # | Asserts |
|---|---|
| 1 | `social` is a valid activity format |
| 2 | An unknown format is still rejected |
| 3 | An accepted submission must point at the activity it produced |
| 4 | An accepted submission linked to an activity is fine |
| 5 | A submission must carry some way to contact the submitter |
| 6 | A reviewed submission must carry a review timestamp |
| 7 | One person cannot have two pending claims on the same organiser |
| 8 | An approved claim must be timestamped |
| 9 | Magic-link token hashes are unique |
| 10 | A person cannot record the same interest twice |
| 11 | Interest counts exclude withdrawn and no-show registrations |
| 12 | `show_publicly` defaults to opt-out |
| 13 | The enrichment gate from 001 still holds after the migration |

Run it after applying both migrations in order.
