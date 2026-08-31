/**
 * Validation for generated channel copy.
 *
 * Generation is a suggestion; these are the rules. Anything that fails here
 * does not become a variant an editor has to notice is wrong — it is rejected
 * with a reason, and the missing variant is visible.
 *
 * Two of these rules are not stylistic and must never be softened into
 * warnings: a sponsored post must carry its disclosure label, and a variant
 * must not contain a URL that is not the canonical one. The first is a legal
 * requirement, the second is how a generated post becomes a phishing link.
 */

const URL_PATTERN = /https?:\/\/[^\s<>()[\]{}"']+/gi;
const PLACEHOLDER_PATTERN = /\[(insert|your|add|tbd|todo)\b|lorem ipsum|\bTODO\b|\{\{/i;

export function extractUrls(text) {
  return String(text ?? '').match(URL_PATTERN) ?? [];
}

function sameUrl(a, b) {
  const strip = (u) => String(u).replace(/[).,;]+$/, '').replace(/\/$/, '').toLowerCase();
  return strip(a) === strip(b);
}

export function countHashtags(text) {
  return (String(text ?? '').match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/**
 * Checks one channel's copy. Returns { ok, problems: [...] }.
 *
 * `context` carries what the copy is allowed to reference:
 *   allowedUrls      - the canonical link(s) for this post
 *   disclosureLabel  - set when the post is sponsored; then it is mandatory
 */
export function validateVariant(variant, channel, context = {}) {
  const problems = [];
  const config = channel.config ?? {};
  const body = String(variant.body ?? '').trim();

  if (body === '') {
    return { ok: false, problems: ['body is empty'] };
  }

  const maxLength = config.max_length ?? null;
  if (maxLength && body.length > maxLength) {
    problems.push(`body is ${body.length} characters, over the ${maxLength} limit for ${channel.key}`);
  }

  const urls = extractUrls(body);
  const allowed = context.allowedUrls ?? [];

  if (config.supports_links === false && urls.length > 0) {
    problems.push(`${channel.key} does not render links, but the copy contains ${urls.length}`);
  }

  for (const url of urls) {
    if (!allowed.some((candidate) => sameUrl(url, candidate))) {
      problems.push(`contains a link that is not the canonical one: ${url}`);
    }
  }

  const hashtagLimit = config.hashtag_limit ?? null;
  const hashtags = countHashtags([body, variant.hashtags].filter(Boolean).join(' '));
  if (hashtagLimit !== null && hashtags > hashtagLimit) {
    problems.push(`${hashtags} hashtags, over the ${hashtagLimit} allowed on ${channel.key}`);
  }
  if (hashtagLimit === null && hashtags > 0 && config.supports_links === true && channel.key !== 'instagram') {
    // Not an error - hashtags simply do nothing on most channels.
  }

  if (PLACEHOLDER_PATTERN.test(body)) {
    problems.push('contains placeholder text that was never filled in');
  }

  if (context.disclosureLabel) {
    const label = context.disclosureLabel.toLowerCase();
    if (!body.toLowerCase().includes(label)) {
      problems.push(`sponsored post is missing its required disclosure label ("${context.disclosureLabel}")`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Runs every channel's copy and splits it into what can be saved and what cannot. */
export function validateAll(variants, channels, context) {
  const valid = [];
  const rejected = [];

  for (const channel of channels) {
    const variant = variants[channel.key];
    if (!variant) {
      rejected.push({ channel, variant: null, problems: ['no copy was generated for this channel'] });
      continue;
    }
    const { ok, problems } = validateVariant(variant, channel, context);
    (ok ? valid : rejected).push({ channel, variant, problems });
  }

  return { valid, rejected };
}
