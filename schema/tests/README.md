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
