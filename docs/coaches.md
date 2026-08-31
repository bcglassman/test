# Coaches

A directory of coaches surfaced beside the events they suit — you're looking at a 10k,
and here are people who could get you round it. Both professional and peer coaches, in
the CoachUp sense. Implemented in `schema/003_assisted_publish_and_coaches.sql`.

## Why it fits

Every other part of this platform helps someone take a first step alone. Coaching is the
same job one level up: the person who wants to do the race but doesn't believe they can
yet. It also arrives with revenue attached, which discovery and daily posting do not.

The contextual placement is a join, not a curation task: `coach_categories` uses the same
category vocabulary as `activities.category`, so "run coaches for a running event" falls
out of the data. `activity_coaches` exists for deliberate exceptions — editorial picks and
paid placement.

## Professional and peer are both real, and never blurred

`coaches.coach_type` is `professional` or `peer`, and it shows on every surface.

An experienced club runner who will pace you through your first 10k is a genuine, useful
offering — often better for a nervous beginner than a certified coach, and much cheaper.
Pretending they are a certified professional is the failure mode. So the type is a
required column, not an inference, and it is never hidden in the UI.

## Trust, and the two constraints that carry it

`verification_status` moves through:

| Value | Meaning |
|---|---|
| `unverified` | Nothing checked. Cannot be published |
| `self_declared` | A human read the profile; claims are plausible and internally consistent |
| `documents_checked` | Certification or insurance actually seen |
| `rejected` | Reviewed and refused |

Only a person sets this. The enrichment worker never touches it — same rule as resource
credibility.

Three things the database refuses:

1. **An unverified coach cannot be published.** No profile reaches the public site
   without a human having read it.
2. **A coach who works with minors must be `documents_checked`.** Self-declaration is
   not sufficient, by construction. Coaching under-18s is the highest-consequence thing
   on the platform, and a policy that lives only in a checklist is one busy afternoon
   away from being skipped.
3. **A `professional` cannot be published with no credentials recorded.** "Professional"
   is a claim about credentials; the claim needs something written down behind it.

A `peer` coach needs no credentials — that is the honest difference between the two, and
encoding it means the distinction survives contact with a rushed reviewer.

**A recommendation beyond the schema:** default to adults only in v1. Turning off
`works_with_minors` entirely until you have a real safeguarding process is a one-line
policy now and a much harder retrofit later.

## Enquiries, not bookings

`coach_enquiries` is a lead. We pass an introduction along and stay out of the money.

Taking payment would make you responsible for delivery — refunds, no-shows, disputes,
and a duty of care toward what happens in the session. That is a different business
needing different agreements and probably insurance. The same line the rest of the
platform holds: discovery, not participation.

`consent_share_contact` is required before an enquiry can be `forwarded` — the database
enforces it. Passing someone's email to a coach without explicit consent is a PDPA
problem, and it is exactly the kind of thing that gets skipped under delivery pressure.

`coach_enquiries.activity` records which event the person was looking at when they
enquired. That is the whole point of contextual placement and the only way to know
whether it works.

## Money

Coaches are the most natural paid product on the platform: featured placement on
relevant activity pages, a `coach` post type for spotlights, and `sponsorships.coach` for
boosted listings — carrying the same non-optional `disclosure_label` as every other paid
surface.

Charging coaches for placement while presenting the directory as a neutral recommendation
is the trap. Disclosure is structural here for the same reason it is everywhere else: a
reader who discovers the "recommended" coach paid for the slot has lost trust in every
other recommendation on the site.
