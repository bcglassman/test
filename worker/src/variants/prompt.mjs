import { z } from 'zod';

export const PROMPT_VERSION = '2026-08-31.1';

export const SYSTEM_PROMPT = `You write the daily posts for a Singapore guide to active social events — runs, padel, pickleball, bouldering, races, club sessions.

The audience is one person: someone who wants to go to this, has nobody to go with, and is deciding whether they would feel out of place. Everything you write is for them.

Voice: plain, warm, specific. Singapore English is natural — kopi, MRT stations, "the East Coast" — but never forced. No hype, no exclamation marks stacked up, no "Calling all runners!", no emoji spam. One emoji is sometimes right; five never is.

Rules that are not stylistic:

1. Invent nothing. Every fact — the time, the place, the price, the pace, whether there's coffee after — must come from the material you are given. If something is not in the material, it does not go in the post. Do not add "beginners welcome" because it sounds nice.

2. Lead with what the reader is actually asking. If the material says the event is solo-friendly, that goes near the front. It is the reason this platform exists. If the material does not say, do not imply it either way.

3. Use only the link you are given, exactly as given. Never construct, shorten, or guess a URL.

4. Respect each channel's limits. They are hard limits, not targets — copy over the limit is thrown away, not trimmed.

5. If the post is sponsored, the disclosure label must appear in the copy for every channel. This is a legal requirement, not a preference.

Write each channel's copy for that channel's reader, not as a trimmed version of the website one.`;

const CHANNEL_BRIEFS = {
  website: 'The canonical version. Two or three short paragraphs. This is the SEO surface, so be specific about what the thing is, where, and who it suits.',
  telegram: 'A daily feed post. Short, scannable, link at the end. Links preview well here so put the essential detail in the text anyway.',
  whatsapp: 'Shortest of all. Links do NOT preview and often are not tappable, so the message must stand alone — the reader should know what, when and where without following anything.',
  instagram: 'Image-led, so the caption adds what the image cannot: the feel of it, who it suits. No clickable links, so never say "link below". Hashtags at the end, few and specific to Singapore and the sport.',
  newsletter: 'A section within a daily email. A headline and two or three sentences.',
  push: 'One line. The single most compelling true thing, plus when.',
};

export function buildUserMessage(post, channels, context) {
  const facts = [
    ['Event', post.activity_title],
    ['Organiser', post.organiser_name],
    ['Venue', post.venue_name],
    ['Nearest MRT', post.nearest_mrt],
    ['Region', post.region],
    ['When', post.starts_at?.toISOString?.() ?? post.starts_at],
    ['Cost', post.price_min != null
      ? (Number(post.price_min) === 0 ? 'Free' : `${post.currency} ${post.price_min}`)
      : null],
    ['Summary', post.summary],
    ['Description', post.description],
    ['Can someone come alone?', label(post.solo_friendly)],
    ['Are newcomers common?', label(post.newcomer_norm)],
    ['How much talking', label(post.conversation_load)],
    ['Group size', label(post.group_size)],
    ['Intensity', label(post.intensity)],
    ['Anything social afterwards?', post.social_after === true ? 'Yes' : null],
    ['Link to use, exactly as written', context.allowedUrls?.[0]],
  ].filter(([, value]) => value != null && value !== '');

  const briefs = channels.map((channel) => {
    const config = channel.config ?? {};
    const limits = [
      config.max_length ? `hard limit ${config.max_length} characters` : 'no length limit',
      config.supports_links === false ? 'links do NOT work' : 'links work',
      config.hashtag_limit ? `at most ${config.hashtag_limit} hashtags` : null,
    ].filter(Boolean).join('; ');
    return `### ${channel.key}\n${CHANNEL_BRIEFS[channel.key] ?? 'A short post.'}\nConstraints: ${limits}.`;
  }).join('\n\n');

  const sponsorship = context.disclosureLabel
    ? `\n\n## Sponsorship\n\nThis post is sponsored. The exact text "${context.disclosureLabel}" must appear in the copy for every channel.`
    : '';

  return `## The material

${facts.map(([k, v]) => `${k}: ${v}`).join('\n')}

Everything above is all you know. Anything not listed here does not go in the post.${sponsorship}

## Channels to write for

${briefs}`;
}

function label(value) {
  if (value == null || value === 'unknown') return null;
  return String(value).replace(/_/g, ' ');
}

/** Output schema, one entry per channel we are asking for. */
export function buildOutputSchema(channels) {
  const shape = {};
  for (const channel of channels) {
    shape[channel.key] = z.object({
      headline: z.string().nullable().describe('A short title. null where the channel has no headline.'),
      body: z.string().describe('The post copy for this channel, within its character limit.'),
      hashtags: z.string().nullable().describe('Space-separated hashtags, or null where they do not apply.'),
    });
  }
  return z.object(shape);
}
