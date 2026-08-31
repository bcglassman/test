# Accounts, social proof and event supply

Decisions taken after the v1 product review, implemented in
`schema/002_accounts_and_supply.sql`. This supersedes the "no user accounts in v1"
line in the original scope.

## Event types

Two independent axes. An activity has one of each.

**Structural type** (`activities.format`) — what the record *is*:

| Format | Example | Why it matters |
|---|---|---|
| `recurring` | Tuesday run club, weekly open play | **The backbone.** Habit-forming, low-stakes, most often solo-friendly |
| `one_off` | A jam, a festival, a one-time meetup | Good spotlight material, no repeat value |
| `race` | HYROX, a 10k, a trail ultra | Big draws; the natural anchor for prep resources and gym promotions |
| `course` | 6-week learn-to-padel, beginner running | High commitment, high conversion |
| `open_play` | Court open play, gym open session | The lowest-pressure entry point that exists |
| `league` | Social football season | Commitment, but the strongest community formation |
| `social` | Post-run kopi, club social | Barely athletic — often the actual point |

**Activity category** (`activities.category`) — what it is *about*. Seeded in migration 002:
running & endurance · racket & court · team & pickup · strength & studio · water ·
climbing & movement · outdoor & walking · mind & body.

A weekly bouldering meetup is `recurring` × climbing & movement. HYROX is `race` ×
running & endurance. The grid of the two is the browse experience.

## Accounts: magic link, no passwords

`auth_tokens` issues single-use sign-in links; `auth_sessions` holds the resulting
session. Both store a **SHA-256 hash of the token, never the token itself** — a database
leak must not hand someone a working login. Tokens expire in 15 minutes and set
`consumed_at` on first use, so a forwarded email cannot be replayed.

There is no password column, no reset flow, and no credential to leak. That is the point
of choosing magic link: it removes an entire category of work and risk.

`person_interests` records what someone is into, reusing the same category vocabulary as
activities. Two things fall out of it: a person can be sent only what they care about,
and "my registrations" becomes a reason to return.

### Avatars

None in v1. `people.display_name` plus `people.avatar_color` render an initials chip.
No uploads, no storage, no moderation surface.

If you later want real avatars, the **only** legitimate route for a Telegram photo is the
Telegram Login button, where the person consents and Telegram hands over the photo URL.
WhatsApp exposes no profile photo API at all. Deriving either from a handle would be
scraping personal data and a PDPA problem — there is no version of this that is merely a
technical shortcut.

## Social proof

`activity_interest_stats` is a view returning `interested_count`, `first_timer_count` and
`committed_count` per activity, excluding withdrawn and no-show registrations so the
number stays honest.

**Counts only — never names or emails.** `interest_registrations.show_publicly` exists,
defaults to `false`, and even when true v1 surfaces nothing identifying.

The number that matters is `first_timer_count`. "8 interested · 3 first-timers" tells a
hesitant reader that other people also arrived not knowing anyone, which is the exact
reassurance the product exists to give.

## Three supply modes

`activities.origin` records which mode produced a record: `ingested`, `submitted`,
`organiser` or `editorial`.

### 1. Aggregation — fast, not durable
Already handled by `sources` and `raw_items` from migration 001. Eventbrite and Peatix
have real APIs; race calendars are structured. Several sites restrict scraping, and the
racket-sport platforms are competitors as much as sources. Use this to look alive on day
one, not as the foundation.

### 2. Community submissions — cheap, finds the hidden supply
`submissions` holds a public proposal in whatever shape it arrived; parsing happens
during review. Three constraints keep the queue honest: an accepted submission must point
at the activity it produced, every submission must have some way to contact the
submitter, and anything reviewed must carry a review timestamp.

Submissions land in the same review queue as ingested items, so there is one place to
look. A submission is never an activity until a human accepts it.

### 3. Organiser-claimed pages — the durable answer
`organiser_claims` records a person's claim on an organiser with evidence and a
verification method; `organiser_members` is what an approved claim grants.

**Claims are always human-reviewed — there is no auto-approval path.** Handing the wrong
person control of a real club's page is unrecoverable.

Self-service is a supply channel, not a bypass: an organiser-authored activity still
carries `origin = 'organiser'` and still passes through the enrichment gate and approval
from migration 001, unchanged.

### Sequencing
Aggregate to look alive, open submissions immediately, build claiming once you have
enough traffic that claiming is worth an organiser's time. Mode 3 is what makes supply
stop depending on scrapers you don't control and on your own daily labour.
