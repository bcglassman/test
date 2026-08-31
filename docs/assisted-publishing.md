# Assisted publishing

How a channel with no publishing API gets posted to daily without a gray-market
gateway and without a real chore. Implemented in `schema/003_assisted_publish_and_coaches.sql`.

## Why this exists

WhatsApp Channels have the better reach in Singapore, but the official Cloud API does not
publish to them. The unofficial gateways that do it link a personal WhatsApp account by
QR code, which violates WhatsApp's terms; the reported outcome is account restriction.
The asymmetry is bad: two minutes a day saved against losing the audience the channel
exists to serve.

The official Cloud API *can* message people 1:1, but it bills per message, so a daily
broadcast to a few thousand subscribers becomes a real monthly bill for something a
Channel does free and unlimited. Right tool, wrong job.

So: everything is automated except the final tap.

## `channels.delivery_mode`

- `api` — the worker publishes directly. Telegram, website, newsletter, push.
- `assisted` — the worker prepares everything; a person taps send. WhatsApp.

This is a permanent property of the channel, not a fallback for when automation breaks.
Adding a channel of either kind stays a row plus a prompt.

## The flow

```
post reaches `scheduled`
        │
        ▼
worker generates the variant + image as for any channel
        │
        ▼
publications row created, status = awaiting_manual
   manual_token_hash set, expires in 48h
        │
        ▼
notification fires at slot time (Telegram DM or push)
        │
        ▼
person opens /publish/<token> on their phone
        │
   ┌────┴──────────────────────────┐
   │  Copy text · Save image       │
   │  Open WhatsApp                │
   │  [ Mark sent ]                │
   └────┬──────────────────────────┘
        ▼
status = published, published_at + marked_sent_by + payload_hash stamped
```

Roughly fifteen seconds. No terms-of-service exposure, no per-message cost, and the
publication ledger stays authoritative — so idempotency, staleness detection and retries
work exactly as they do for API channels.

## The publish page

One screen, phone-first, no navigation. Reached by a single-use link; **no login**, because
requiring a session on a phone at 7am is how a fifteen-second job becomes a skipped day.
The token is the credential.

| Element | Behaviour |
|---|---|
| Post preview | Rendered exactly as it will appear, at WhatsApp's width, with the character count against the channel's `max_length` |
| **Copy text** | One tap to clipboard; button confirms "Copied" |
| **Save image** | Downloads the generated image at the channel's aspect ratio |
| **Open WhatsApp** | `whatsapp://` deep link straight to the Channel |
| **Mark sent** | The only state change. Stamps `published_at`, `marked_sent_by`, `payload_hash` |
| **Skip** | Sets `skipped` with a reason. A deliberate skip is data; a silent one is a gap |

Notes that matter:

- **Never auto-mark on "Open WhatsApp".** Opening the app is not sending. Marking sent
  when nothing was sent corrupts the ledger, and the ledger is what stops double-posts.
- The link expires in 48 hours and is single-use for state changes; the page stays
  readable after so a person can confirm what went out.
- `manual_token_hash` stores only a SHA-256 hash — a forwarded message must not let
  someone else mark a post sent.
- `manual_opened_at` distinguishes "never saw it" from "saw it and didn't send", which
  are different problems.

## Not sending is visible

`pending_manual_publications` lists everything still awaiting a person, oldest first,
with `reminder_count`. Two consequences:

- A nudge can fire when a slot time passes with the post unsent, incrementing
  `reminder_count`.
- A rising `reminder_count` across weeks is the signal that the assisted channel has
  become a chore in practice. That is the number to watch before deciding WhatsApp is
  worth more engineering — or worth dropping.

## When to revisit

Reconsider if any of these become true: Meta ships an official Channels publishing API;
the daily tap is reliably missed (watch `reminder_count`); or the audience justifies paid
1:1 messaging. Until then this is the right shape — and the Cloud API still earns its
cost for low-volume, high-value sends: registration confirmations, event-day reminders,
the first-timer follow-up.
