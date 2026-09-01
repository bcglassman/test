/**
 * Telegram Bot API — broadcast to a channel.
 *
 * A channel is one-way: the bot posts, readers read. That is the right shape
 * for a daily feed, and it means no moderation surface to run.
 */

const API = 'https://api.telegram.org';

export const key = 'telegram';

export function validateConfig(config = {}) {
  const chatId = config.chat_id ?? process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error('telegram: no chat_id — set it in channels.config or TELEGRAM_CHAT_ID');
  }
  return { chatId, username: config.username ?? null };
}

/**
 * Sends one message. Returns { externalId, url } on success.
 *
 * Telegram's own rate limiting comes back as 429 with retry_after; that is
 * marked retryable so the publication row stays failed-and-retriable rather
 * than being treated as a rejection.
 */
export async function send(variant, channel, { token = process.env.TELEGRAM_BOT_TOKEN,
                                               fetchImpl = fetch } = {}) {
  if (!token) throw new Error('telegram: TELEGRAM_BOT_TOKEN is not set');
  const { chatId, username } = validateConfig(channel.config);

  const response = await fetchImpl(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: variant.body,
      // The copy is written as plain text and validated as plain text. Asking
      // Telegram to parse it as Markdown would let a stray underscore in a club
      // name break the whole message.
      parse_mode: undefined,
      disable_web_page_preview: false,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 429) {
    const wait = body?.parameters?.retry_after ?? 30;
    throw Object.assign(new Error(`telegram: rate limited, retry after ${wait}s`),
                        { retryable: true, retryAfter: wait });
  }
  if (!response.ok || body.ok !== true) {
    const description = body?.description ?? `HTTP ${response.status}`;
    throw Object.assign(new Error(`telegram: ${description}`),
                        { retryable: response.status >= 500 });
  }

  const messageId = body.result?.message_id;
  return {
    externalId: messageId != null ? String(messageId) : null,
    url: username && messageId ? `https://t.me/${username.replace(/^@/, '')}/${messageId}` : null,
  };
}

/** A direct message to the admin — used for the assisted-publish nudge. */
export async function sendDirect(text, { token = process.env.TELEGRAM_BOT_TOKEN,
                                         chatId = process.env.TELEGRAM_ADMIN_CHAT_ID,
                                         fetchImpl = fetch } = {}) {
  if (!token || !chatId) {
    throw new Error('telegram: TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID are needed to notify');
  }
  const response = await fetchImpl(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    throw new Error(`telegram: notify failed — ${body?.description ?? response.status}`);
  }
  return { externalId: String(body.result?.message_id ?? '') };
}
