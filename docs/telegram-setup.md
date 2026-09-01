# Telegram setup

Two things to create on your phone, and three values to save. About ten minutes.

## 1. Create the bot

In Telegram, message **@BotFather**:

```
/newbot
```

Give it a name (`Meet in Motion`) and a username ending in `bot`
(`meetinmotion_bot`). BotFather replies with a token like
`8123456789:AAH...`. That is `TELEGRAM_BOT_TOKEN` — treat it as a password;
anyone holding it can post as you.

## 2. Create the channel

New Message → **New Channel**. Name it, make it **public**, and claim a username
(`@meetinmotion_sg`). Public matters: it gives every post a shareable
`t.me/…` link, which is what the site and the WhatsApp copy point at.

Then **add your bot as an administrator** with permission to post. A bot cannot post to
a channel it does not administer, and the error when it isn't ("chat not found") does not
say so.

Save the username in the channel's config:

```sql
UPDATE channels
SET config = config || '{"chat_id":"@meetinmotion_sg","username":"meetinmotion_sg"}'::jsonb
WHERE key = 'telegram';
```

## 3. Get your own chat ID

The assisted-publish link is sent to you as a direct message, which needs your personal
chat ID. Message your new bot anything (`hello`), then open:

```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

Find `"chat":{"id":123456789`. That number is `TELEGRAM_ADMIN_CHAT_ID`.

A bot cannot message you first — if `getUpdates` is empty, you have not messaged it yet.

## The three values

| Variable | What |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From BotFather. Secret |
| `TELEGRAM_ADMIN_CHAT_ID` | Your personal chat, for publish links and nudges |
| `channels.config.chat_id` | The channel, e.g. `@meetinmotion_sg`. Not secret |

## Check it works

```sh
cd worker
DATABASE_URL=... TELEGRAM_BOT_TOKEN=... node src/index.mjs publish --dry-run
```

Dry run lists what would go where and sends nothing. When something is genuinely ready,
drop `--dry-run`.

## What happens each morning

At 07:00 SGT the publish job runs. Telegram posts go out immediately. The WhatsApp post
is prepared and a link arrives as a DM: open it, tap **Copy text**, paste into your
WhatsApp Channel, then tap **Mark sent**.

Opening WhatsApp does not mark it sent, deliberately — opening is not sending, and a
ledger claiming "published" when nothing went out is what causes a double-post later.

Anything still unsent gets a nudge at noon, up to three times, then it stops. If you see
that nudge often, the assisted channel has become a chore in practice — that is the
signal to reconsider WhatsApp rather than to try harder.
