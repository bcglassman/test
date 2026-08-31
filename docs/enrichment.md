# Soft-socializing enrichment

The attribute set that differentiates this platform, and the contract by which it gets
filled in: **AI proposes, a human confirms.** Nothing inferred reaches the public site
without a person's sign-off.

## Why these attributes

Listings almost never state the things that decide whether someone actually shows up.
An organiser writes "Tuesday 7pm, East Coast Park, 8km easy pace." A person deciding
whether to go is asking something else entirely: *will I be the only one there alone?*

That gap is the product. These fields make the implicit explicit, and they have to be
inferred, because no source publishes them.

## The attribute set

| Key | Values | What it answers | Typical evidence |
|---|---|---|---|
| `solo_friendly` | `yes`, `probably`, `unlikely`, `unknown` | Can I come alone without it being weird? | "all welcome", "no partner needed", open-play format, matchmaking built in. Court bookings that require a group of 4 are `unlikely` |
| `pressure_level` | `drop_in`, `rsvp`, `commit` | What am I signing up for? | "just turn up" vs. a booking link vs. a 6-week course or league season |
| `conversation_load` | `parallel`, `light`, `conversational` | How much talking is expected? | Pottery and life drawing are parallel; a run club is light; a book club or language exchange is conversational |
| `group_size` | `intimate` (≤8), `small` (9–20), `medium` (21–60), `large` (60+) | What kind of room am I walking into? | Stated capacity, court size, past attendance, venue type |
| `newcomer_norm` | `common`, `occasional`, `rare`, `unknown` | Will I be the only new face? | "beginners welcome", "new members every week", intro sessions, an active recruiting tone |
| `social_after` | bool | Is there a kopi/drinks element? | "coffee after", "we usually head to...", a named post-session spot |
| `intensity` | `gentle`, `moderate`, `vigorous`, `competitive` | Will I be able to keep up? | Pace, distance, "social pace", league or race framing |
| `cost_band` | `free`, `under_20`, `20_to_50`, `50_to_100`, `over_100` | Can I afford to just try it? | Stated price, court fee, race entry |

`intensity` and `cost_band` are usually stated outright and only need inference as a
fallback. The first six are almost always inferred.

## The proposal → confirmation contract

### `enrichment_proposals`

One row per proposed value. Proposals are never written directly onto the activity.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `activity` | uuid | → `activities`, cascade delete |
| `field_key` | string | one of the attribute keys above |
| `proposed_value` | jsonb | typed value |
| `confidence` | numeric | 0.00–1.00, self-reported by the model |
| `evidence` | text | **the quoted source text the inference rests on** |
| `reasoning` | text | one sentence, why this value |
| `model`, `prompt_version` | string | reproducibility |
| `status` | enum | `proposed`, `accepted`, `edited`, `rejected`, `superseded` |
| `final_value` | jsonb | what the human actually chose, when it differs |
| `reviewed_by`, `reviewed_at` | uuid, timestamptz | |

Unique on `(activity, field_key)` where `status = 'proposed'` — one open proposal per
field at a time.

### The loop

```
activity ingested (status: draft)
        │
        ▼
worker infers all 8 attributes ───► enrichment_proposals (status: proposed)
        │                            activities.enrichment_status = 'proposed'
        ▼
activity moves to pending_review
        │
        ▼
editor reviews each proposal in Directus
   accept ──► final_value = proposed_value
   edit   ──► final_value = human's choice     ─┐
   reject ──► field stays unknown              ─┤
        │                                       │
        ▼                                       ▼
accepted/edited values are copied onto the activity row,
field_key appended to activities.confirmed_fields
        │
        ▼
all attributes resolved ──► enrichment_status = 'confirmed'
        │
        ▼
approver can now move the activity to approved
```

The gate is enforced, not conventional: **`pending_review → approved` is blocked unless
`enrichment_status = 'confirmed'`.** A Directus Flow (or a database trigger) rejects the
transition otherwise.

### Why `evidence` is required

A reviewer confirming eight attributes across thirty activities a day will rubber-stamp
unless the review is cheap. Quoting the source text that drove each inference turns a
judgement call into a glance. A proposal without evidence should be treated as low
confidence regardless of what the model reported — and the worker should be configured to
emit `unknown` rather than invent evidence.

### `unknown` is a real answer

For `solo_friendly` and `newcomer_norm` especially, the honest answer is often unknown.
Publishing "solo-friendly: yes" on a listing where it turns out to be false is the single
worst failure mode this product has — someone shows up alone to something that isn't, and
does not come back. Bias the prompt toward `unknown`, and surface unknowns in the UI as
absent rather than negative.

## Feedback loop

`interest_registrations.is_first_timer` is the cheapest correction signal you have: a
steady stream of first-timers on an activity is direct evidence for `newcomer_norm =
common`, regardless of what the listing text said. Once there is volume, use it to flag
activities whose confirmed attributes disagree with observed behaviour and send them back
for re-review. Don't wire this to auto-update — it should raise a flag for a human, on the
same principle as everything else here.

## Model choice

Use `claude-opus-5` for enrichment. It reads ambiguous, idiomatic listing copy — Singlish,
Telegram-group shorthand, Instagram captions — where the inference quality directly
determines whether the product's core promise holds.

`claude-haiku-4-5` is the cost option at roughly a fifth the input price, and is a
reasonable choice for the mechanical extraction pass (dates, prices, venue names) if that
is split out as a separate step. Don't use it for the social attributes: those are the
judgement calls, and the whole differentiator rests on them.

Set `thinking: {type: "adaptive"}` and request structured output via
`output_config.format` so proposals come back schema-valid and can be inserted without
parsing guesswork. Store `model` and `prompt_version` on every proposal — when a prompt
change shifts inference behaviour, you need to know which rows came from which version.

Rough cost at current pricing ($5/M input, $25/M output for Opus 5): a listing plus prompt
is on the order of 2K input tokens, with a few hundred output tokens for eight structured
proposals. Even at a few hundred activities a day this is not a meaningful line item —
the reviewer's time is the real cost, which is why `evidence` matters more than model
price.

---

# Implementation

Built in `worker/src/enrich/`. Run it with `node src/index.mjs enrich [--limit n]
[--dry-run] [--effort medium]`.

## The pass

```
draft activity, enrichment_status = not_started
        │
        ▼
one model call: 8 attributes, each with a value, a quote, a reason, a confidence
        │
        ▼
every quote verified against the listing text
        │
        ▼
enrichment_proposals rows, status = proposed
activity → pending_review, enrichment_status = proposed
```

**Nothing here writes an attribute onto the activity.** The value lands only when a human
accepts the proposal. There is a test asserting that `activities.solo_friendly` is still
`unknown` after a confident proposal of `yes`.

## Evidence is verified mechanically

Requiring a quote is not enough on its own — a fluent, plausible, unsupported quote is
worse than no quote, because it is exactly what a reviewer waves through. So every quote
is checked against the text the model was given. Matching is tolerant of case, whitespace,
quote marks and ellipses (a citation spanning two sentences is fair), and strict about
everything else.

A quote that cannot be found does not become a proposal a reviewer has to disprove. The
value is **downgraded to unknown** with confidence zero and the discrepancy written into
the reasoning. The reviewer's time is the scarce resource; the enrichment pass must not
spend it on claims it invented.

Abstentions need no quote — `unknown` is a correct answer and the one we want when a
listing is silent.

Watch the `downgraded` count in the run summary. A rising number means the prompt has
drifted toward confabulation and needs attention, and it is visible before any of it
reaches the public site.

## Prompt and schema come from the database

The allowed values for each attribute are read from the CHECK constraints on `activities`
at runtime — the same mechanism as the Directus dropdowns. They build both the prompt's
"Allowed values:" lines and the Zod output schema, so the model cannot be offered, and
cannot return, a value the database would reject. Add a value in a migration and it
appears in both without anyone editing `attributes.mjs`.

`prompt_version` and `model` are recorded on every proposal. When a prompt change shifts
behaviour, you can tell which rows came from which version.

## Model

`claude-opus-5` with adaptive thinking and structured outputs via
`client.messages.parse`. Effort defaults to `high`: these judgements are the product's
differentiator and a wrong `solo_friendly` costs more than tokens do. `medium` is the
step-down to measure once there is enough reviewed data to compare against —
`--effort medium` or `ENRICH_EFFORT`.

A policy decline (`stop_reason: "refusal"`) is caught, counted separately from a failure,
and leaves the activity queued. Server-side fallbacks are deliberately not wired up:
combining them with structured-output parsing is a shape I could not verify against the
installed SDK, and for benign listing text a decline is both unlikely and harmless — it
retries on the next run.

## Failure behaviour

A model error leaves the activity as a `draft` with `enrichment_status = not_started`, so
the next run picks it up. Re-running an already-enriched activity supersedes the previous
proposals rather than colliding with the partial unique index. Both are tested.
