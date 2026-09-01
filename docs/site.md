# The public site

Next.js 15 (App Router) reading from Directus. `site/`.

```sh
cd site && npm install
node mock/server.mjs &                       # a stand-in Directus for local work
DIRECTUS_URL=http://127.0.0.1:8055 npm run dev
npm test
```

## What it renders

| Route | What |
|---|---|
| `/` | Lead with what someone arriving alone can use, then everything else |
| `/browse` | Filter by **how it feels** — fine alone, just turn up, free — as well as activity and region |
| `/e/[slug]` | The listing page: what it's like, when, who's interested, register interest |
| `/coaches` | Professional and peer coaches, with which is which always shown |

## The rules that matter in the UI

**Unknown renders as absence, never as a negative.** A listing that does not say whether
you can come alone must not read as "no". `lookup()` returns null for `unknown`, missing,
and unrecognised values alike, and the chips and answer rows simply do not render. There
are tests for this because it is the first thing a well-meaning refactor would break.

**The soft attributes lead.** On a card, the first chip is whether you can come alone. On
a listing page, the first row of "What it's like" answers the same question. Everything
else — time, place, price — is below it. That ordering is the product.

**Counts, never names.** The "who's interested" panel shows a number and a first-timer
count. `getInterestStats` fails soft: if the view is unavailable the panel disappears
rather than breaking the page.

**Interest is not a booking**, and the form says so twice. Consent is a separate, unticked
box, worded for this event only, and the API records `consent_at` and
`consent_text_version` — which is what `people.consent_text_version` exists for.

## Data access

Everything runs server-side; the Directus token never reaches the browser. Pages set
`revalidate` (5 minutes for listings, an hour for the coach directory) so a busy day does
not become one API call per visitor.

Every fetch is wrapped: if Directus is unreachable, the page renders an honest empty state
instead of a stack trace. A listings site whose backend hiccups should look quiet, not
broken.

## The mock

`site/mock/server.mjs` serves the handful of read endpoints from `mock/fixtures.json`. It
is for local development and screenshots only and is never deployed — it exists so the
site can be run and reviewed without Directus, Postgres and the worker all up.

## Verification status

`next build` passes, all four routes return 200, the API route rejects bad email and
missing consent, and both light and dark themes were rendered and reviewed at desktop and
mobile widths.

**The site has never run against a real Directus** — only the mock. Expect the field
selections in `lib/directus.js` to need adjusting the first time, particularly the nested
`organiser.name` / `venue.nearest_mrt` expansions and the `activity_interest_stats` view,
which Directus must be told to expose as a collection.
