# Launch runbook

From an empty DigitalOcean account to the first live Telegram post. Five phases, in
order. Phases 1–3 are a focused day; phase 4 takes weeks and is the actual business.

---

## Phase 1 — Accounts and names (~1 hour, any order)

**1.1 Register meetinmotion.sg.** Any SGNIC-accredited registrar. A plain `.sg` is open
to individuals; `.com.sg` requires an ACRA-registered entity — confirm which you are
buying before paying. The domain is baked into every generated post, every canonical link
and Directus's public URL, so it is not a "sort out later".

**1.2 Merge the branch to main.** The deploy spec builds from `main`.

```sh
git checkout main
git merge claude/social-active-events-sg
git push origin main
```

**1.3 DigitalOcean account + doctl.** `doctl auth init`, then `doctl account get` should
print your account.

**1.4 Spaces bucket and key.** Bucket `mim-media` in `sgp1`; API → Spaces Keys.
**Not optional** — App Platform disk is ephemeral, and with local storage every uploaded
image disappears on the next deploy, silently.

**1.5 Telegram bot and channel.** See `telegram-setup.md`. The one that catches everyone:
a bot cannot post to a channel it does not administer, and the error says "chat not found".

**1.6 Anthropic API key.** console.anthropic.com, for the enrichment and copy passes.

---

## Phase 2 — Deploy (~1 hour, strictly in order)

**2.1 Check instance size slugs.** `doctl apps tier instance-size list`. The spec uses
`apps-s-1vcpu-1gb` and `apps-s-1vcpu-0.5gb`; edit `.do/app.yaml` if those are gone.

**2.2 Create the app.** `doctl apps create --spec .do/app.yaml`. The first build fails
until secrets are set — expected.

**2.3 Set the secrets** in the console, then redeploy:

| Key | Source |
|---|---|
| `SECRET` | `openssl rand -base64 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your first Directus login |
| `STORAGE_SPACES_KEY` / `_SECRET` | Step 1.4 |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | Your own chat ID |
| `ANTHROPIC_API_KEY` | Anthropic console |
| `DIRECTUS_TOKEN` | Blank for now — created in 2.7 |

**2.4 Confirm migrations ran.** The `migrate` job log should list `001_init.sql` through
`005_seed_singapore_clubs.sql`.

**2.5 Log into Directus** at `/admin` and change the admin password — it came from an
environment variable and is now in your deploy history.

**2.6 Run the Directus bootstrap** from your machine. **Dry run first.**

```sh
cd directus/bootstrap && npm install
DIRECTUS_URL=https://<app>.ondigitalocean.app/admin \
DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
DATABASE_URL='<managed db connection string>' \
npm run plan && npm start
```

**Expect trouble here** — this has never run against a live Directus. The likely sticking
point is registering collections for tables that already exist; the error names the
collection, and you can add it by hand in Data Model settings and re-run.

**2.7 Create a read token for the site.** Read-only access to published activities,
sessions, categories, coaches and the interest-stats view. Put it in `DIRECTUS_TOKEN`.
Read-only matters: this token lives in the site's server environment.

**2.8 Point the domain.** Add it in App Platform, follow the DNS instructions.
`https://meetinmotion.sg` should show the site — most likely with an honest "Nothing
published yet" empty state, which is correct.

---

## Phase 3 — Prove the pipeline by hand (~1 hour)

**Do this before touching a single source.** Create one event manually and push it all the
way to a live Telegram post. Wiring scrapers first means debugging ingestion, enrichment
and publishing at once with no known-good path to compare against.

**3.1** Create one organiser, venue and activity in Directus — a real session you have
actually been to. Leave status `draft` and the social attributes alone.

**3.2** `node src/index.mjs enrich --dry-run`, read the proposals and their quotes, then
run it for real. Anything the listing did not address should read `unknown` — correct
behaviour, not a failure.

**3.3** Confirm each proposal in Directus, then set the activity to `approved`. If that is
refused with a constraint error about confirmed enrichment, the gate is working.

**3.4** `node src/index.mjs schedule --days 2` (dry run first — it shows what it picked
and why), then approve the post.

**3.5** `node src/index.mjs variants`. **Read the copy properly** — first sight of the
voice. If it is wrong, fix the system prompt in `worker/src/variants/prompt.mjs`, not each
post. Approve each variant.

**3.6** `node src/index.mjs publish`. The post appears in Telegram; a DM arrives with the
WhatsApp link. That is the whole product working — everything after is volume.

**3.7** Check the site. Register interest on your own event to test the form.
**Most likely first failure:** the site's field selections have only run against a mock —
if a page 500s, look at the nested expansions and the `activity_interest_stats` view in
`site/lib/directus.js`.

---

## Phase 4 — Supply (weeks — the actual business)

Daily posting needs ~30 publishable activities a month, with three to five times that
approved so rotation has room.

**4.1 Contact five clubs, not twenty-seven.** All 27 are seeded as drafts. Start with ones
you know. Ask the two questions that are the product:

> Hi — I'm building Meet in Motion, a Singapore guide to active sessions people can turn
> up to on their own. I'd like to list your weekly runs, free, with a link back to you.
> Two questions: is it OK for someone to come alone without knowing anyone, and do you get
> new faces most weeks? Those two things are what the site actually answers, and I'd
> rather have it from you than guess.

That is `solo_friendly` and `newcomer_norm` straight from the organiser, which beats any
inference.

**4.2 Add sources as clubs agree.** Most publish on Instagram only: you see a post, you
submit the link, it lands in the review queue. **Do not build an Instagram scraper** — it
breaks Meta's terms and gets blocked. Manual submission is slower and keeps working.

**4.3 Set clubs live only once confirmed.** Being on a list is not consent.

**4.4 Do not announce a daily cadence until you can hold it.** Run quietly for two weeks;
`node src/index.mjs gaps --days 7` tells you whether you could have posted every day.

---

## Phase 5 — The daily rhythm (~20 minutes)

| Time (SGT) | Runs | Your move |
|---|---|---|
| 02:00 | ingest | — |
| 03:00 | enrich | — |
| 04:00 | schedule posts | — |
| 05:00 | channel copy | — |
| 05:30 | gap check | **Fails if a slot is empty** — that is the alert |
| 07:00 | publish | Telegram goes out; tap through the WhatsApp DM |
| 12:00 | reminder | Nudges you if WhatsApp is still unsent |

Plus in Directus: clear the enrichment queue, approve tomorrow's post and variants.

**Two numbers to watch.** *Downgraded proposals* in the enrich output — the model citing
text not in the listing; rising means the prompt has drifted toward confabulation.
*Reminder count* on unsent WhatsApp posts — rising means the assisted channel has become a
chore in practice, and that is the signal to reconsider WhatsApp rather than try harder.
