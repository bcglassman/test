# Daily publishing

Posts go out **every day**, not as a weekly digest. That cadence is a product decision
with real machinery behind it: a queue that never runs dry, a calendar with visible gaps,
and publication that cannot double-send.

## The editorial unit

A `post` is one thing published on one day. It is not the activity — an activity may be
posted about several times over its life (announcement, one week out, last call), and each
of those is a separate post.

Four post types carry the daily rhythm:

| Type | Source | Purpose |
|---|---|---|
| `event_spotlight` | an activity | the core daily unit — one thing to go to |
| `resource` | a resource | context: how to prepare for HYROX, running in heat and humidity |
| `promotion` | a promotion | a gym's trial offer ahead of a race |
| `roundup` | several activities | "five drop-in things this weekend" |

A `post` references exactly one of `activity`, `promotion` or `resource` (or none, for a
roundup), enforced by a CHECK constraint rather than convention.

## Slots

Each day has three slots — `morning`, `midday`, `evening` — and `posts` is unique on
`(scheduled_for, slot, type)`. Two consequences:

1. Two spotlights can't collide in the same slot.
2. **Empty slots are queryable.** A gap in tomorrow's calendar is a row that doesn't
   exist, so a daily job can detect it and alert before it becomes a silent missed day.

You do not have to fill all three every day. Start with one `event_spotlight` in the
morning and add slots as supply justifies it.

## The daily cycle

```
T-7 days   ingestion runs continuously; activities accumulate in draft
T-3 days   selection job proposes posts for the day, filling empty slots
           from approved activities ranked by quality_score
T-2 days   editor reviews and approves posts; AI drafts channel variants
T-1 day    variants approved; posts move to scheduled
T-0        publish worker fires per slot, writes publications
```

Selection ranks candidates on `quality_score`, weighted by: soft attributes confirmed
(an activity with unknown `solo_friendly` ranks lower — it makes a worse post), session
proximity, category rotation (don't post padel three days running), organiser rotation,
and whether the activity has already been spotlighted recently.

Sponsorship boosts placement but never bypasses approval, and always renders its
`disclosure_label`.

## Pairing: activity + promotion + resource

The thing that makes a daily post more than a listing is the context around it. A HYROX
spotlight can carry a gym's prep-course promotion and a vetted technique video, drawn
through `activity_promotions` and `activity_resources` by `relevance_score`.

`campaigns` is the tool for the deliberate version of this: a "HYROX prep week" campaign
groups the race spotlight, two gym promotions and three preparation resources across five
days, so the arc is planned rather than coincidental.

Two rules that keep this honest:

- A resource must be `credibility = 'reputable'`, human-set, before it can be attached to
  a post. AI can propose resources; it cannot vouch for them.
- A paid promotion attached to an editorial spotlight carries the disclosure label on
  every channel it renders on.

## Idempotency

This is the part to get right on day one, because the failure is public and irreversible.

`publications` is unique on `(post, channel)`, with an `idempotency_key` of
`{post_id}:{channel_key}`, also unique. The publish worker:

1. Inserts the `publications` row **first**, status `pending`, before calling any channel
   API. A conflicting insert means someone else already has it — stop.
2. Moves it to `sending`, calls the channel API, and records `external_post_id`.
3. On failure, increments `attempts`, records `last_error`, sets status `failed`.

A retry updates that same row. There is no code path that inserts a second row for the
same post and channel, so a worker restart mid-publish cannot double-post to a Telegram
channel with thousands of subscribers.

`payload_hash` stores a hash of what was actually sent. If a variant is edited after
publication, the hash mismatch tells you the live post is stale and needs an edit or a
correction rather than a repost.

## Channels

Each channel's `config` JSON carries its constraints — `max_length`, `supports_links`,
`image_aspect`, `hashtag_limit` — and variant generation reads them rather than
hard-coding per-channel rules in the worker. Adding a channel is then a row plus a
prompt, not a code change.

Practical shapes for the launch set:

| Channel | Shape |
|---|---|
| `website` | full post, canonical URL, the SEO surface |
| `telegram` | short, links work and preview well — the best fit for a daily feed |
| `whatsapp` | shortest, no link previews, put the essential detail in the text |
| `instagram` | image-led, link in bio only, hashtags matter |
| `newsletter` | daily or weekly digest of the day's posts |
| `push` | one line, use sparingly — the fastest way to lose an audience |

## Supply

A daily cadence needs roughly 30 publishable activities a month at one post a day, with
enough surplus to allow category and organiser rotation. Aim for 3–5× that in the approved
pool before committing to daily publishing publicly.

If supply is thin in week one, `roundup` and `resource` posts are the buffer — a resource
post needs no new event supply at all, and there is a deep well of genuinely useful
preparation content. Better a good resource post than a thin spotlight on something
nobody should go to.
