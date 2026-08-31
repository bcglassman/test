/**
 * Eventbrite adapter.
 *
 * Eventbrite shut down public event search in December 2019 - there is no
 * endpoint that searches events across the platform. What remains is retrieval
 * by id, by venue, and by organisation. So this adapter does not discover
 * events; it turns events we already know about into complete structured
 * listings.
 *
 *   mode: 'organization'  list events for organisers who have authorised us
 *   mode: 'event_url'     resolve submitted Eventbrite links to full events
 *
 * Broader coverage needs Eventbrite's distribution partner programme, which is
 * an application rather than an API key.
 */

import { normaliseText, slugify } from '../../lib/hash.mjs';

export const key = 'eventbrite';

const API = 'https://www.eventbriteapi.com/v3';
const EXPAND = 'venue,organizer,ticket_availability,category';

// Eventbrite's own category ids: 108 Sports & Fitness, 107 Health & Wellness.
// Deliberately narrow - an event with no category set is let through for a
// human to judge, but a wine tasting is not an active social event.
const RELEVANT_CATEGORIES = new Set(['108', '107']);

export function validateConfig(config = {}) {
  const mode = config.mode ?? 'organization';
  if (!['organization', 'event_url'].includes(mode)) {
    throw new Error(`eventbrite: unknown mode "${mode}"`);
  }
  if (mode === 'organization' && !config.organization_id) {
    throw new Error('eventbrite: mode "organization" needs config.organization_id');
  }
  if (mode === 'event_url' && !Array.isArray(config.urls)) {
    throw new Error('eventbrite: mode "event_url" needs config.urls (an array)');
  }
  return { ...config, mode };
}

/** Extracts the numeric event id from any Eventbrite event URL shape. */
export function eventIdFromUrl(url) {
  const match = String(url).match(/(?:tickets-|\/e\/[^/]*-)(\d{6,})/) ?? String(url).match(/\/(\d{9,})\/?$/);
  return match ? match[1] : null;
}

async function call(path, { token, fetchImpl }) {
  const response = await fetchImpl(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (response.status === 429) {
    throw Object.assign(new Error('eventbrite: rate limited'), { retryable: true });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`eventbrite: ${response.status} on ${path} ${body.slice(0, 200)}`);
  }
  return response.json();
}

/**
 * Yields `{ externalId, url, payload }` for each event this source covers.
 * Pagination follows Eventbrite's continuation tokens.
 */
export async function* fetchItems(source, { token, fetchImpl = fetch, maxPages = 10 } = {}) {
  const config = validateConfig(source.config);
  if (!token) throw new Error('eventbrite: EVENTBRITE_TOKEN is not set');

  if (config.mode === 'event_url') {
    for (const url of config.urls) {
      const id = eventIdFromUrl(url);
      if (!id) continue;
      const payload = await call(`/events/${id}/?expand=${EXPAND}`, { token, fetchImpl });
      yield { externalId: String(payload.id), url: payload.url ?? url, payload };
    }
    return;
  }

  let continuation = null;
  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ expand: EXPAND, status: 'live', order_by: 'start_asc' });
    if (continuation) query.set('continuation', continuation);

    const data = await call(
      `/organizations/${config.organization_id}/events/?${query}`,
      { token, fetchImpl },
    );

    for (const payload of data.events ?? []) {
      yield { externalId: String(payload.id), url: payload.url, payload };
    }

    if (!data.pagination?.has_more_items) return;
    continuation = data.pagination.continuation;
  }
}

/** True when an event looks like something this platform should carry. */
export function isRelevant(payload) {
  if (payload.status && payload.status !== 'live') return false;
  if (payload.online_event) return false;                 // not a place you turn up to
  if (payload.category_id && !RELEVANT_CATEGORIES.has(String(payload.category_id))) return false;
  return true;
}

function priceRange(payload) {
  const availability = payload.ticket_availability ?? {};
  const toMajor = (money) => (money?.major_value != null ? Number(money.major_value) : null);
  const free = availability.is_free || payload.is_free;

  let min = free ? 0 : toMajor(availability.minimum_ticket_price);
  let max = free ? 0 : toMajor(availability.maximum_ticket_price);

  // A source can report a maximum below its minimum - stale tier data, a tier
  // withdrawn mid-sale. The database rejects an inverted range, which would
  // lose the whole event, so normalise here rather than fail the item.
  if (min != null && max != null && max < min) [min, max] = [max, min];

  return { min, max, currency: availability.minimum_ticket_price?.currency ?? payload.currency ?? 'SGD' };
}

export function costBand(min) {
  if (min == null) return null;
  if (min === 0) return 'free';
  if (min < 20) return 'under_20';
  if (min < 50) return '20_to_50';
  if (min <= 100) return '50_to_100';
  return 'over_100';
}

const SG_REGION_BY_PREFIX = [
  [/^(01|02|03|04|05|06|07|08|09|1[0-9]|20|21)/, 'central'],
  [/^(22|23|24|25|26|27)/, 'west'],
  [/^(28|29|30|31|32|33)/, 'north'],
  [/^(34|35|36|37|38|39|4[0-9]|5[0-2])/, 'east'],
  [/^(53|54|55|56|57|58|59|6[0-9]|7[0-9]|8[0-2])/, 'north_east'],
];

export function regionFromPostalCode(postal) {
  const code = String(postal ?? '').padStart(6, '0');
  for (const [pattern, region] of SG_REGION_BY_PREFIX) {
    if (pattern.test(code)) return region;
  }
  return null;
}

/**
 * Maps an Eventbrite payload onto our canonical shape.
 *
 * Deliberately does NOT infer the soft-socializing attributes. Ingestion states
 * facts; solo_friendly and newcomer_norm are judgements, and they belong to the
 * enrichment pass with evidence attached and a human confirming.
 */
export function toActivity(payload) {
  const venue = payload.venue ?? null;
  const organizer = payload.organizer ?? null;
  const { min, max, currency } = priceRange(payload);

  const title = payload.name?.text?.trim() || 'Untitled event';
  const startsAt = payload.start?.utc ?? null;

  return {
    title,
    slug: slugify(`${title}-${String(payload.id).slice(-6)}`),
    summary: payload.summary?.trim() || truncate(payload.description?.text, 400) || null,
    description: payload.description?.text?.trim() || null,
    source_url: payload.url ?? null,
    external_id: String(payload.id),

    format: 'one_off',      // an Eventbrite listing is a dated event; series are separate listings
    origin: 'ingested',
    status: 'draft',

    capacity: Number.isInteger(payload.capacity) ? payload.capacity : null,
    price_min: min,
    price_max: max ?? min,
    currency,
    cost_band: costBand(min),
    booking_url: payload.url ?? null,
    booking_platform: 'eventbrite',
    hero_image_url: payload.logo?.original?.url ?? payload.logo?.url ?? null,

    organiser: organizer
      ? {
          name: organizer.name?.trim() || 'Unknown organiser',
          slug: slugify(organizer.name ?? `eventbrite-${organizer.id}`),
          website: organizer.website ?? null,
          description: truncate(organizer.description?.text, 1000),
          external_id: organizer.id ? String(organizer.id) : null,
        }
      : null,

    venue: venue
      ? {
          name: venue.name?.trim() || 'Unnamed venue',
          slug: slugify(venue.name ?? `eventbrite-venue-${venue.id}`),
          address: venue.address?.localized_address_display ?? null,
          postal_code: venue.address?.postal_code ?? null,
          region: regionFromPostalCode(venue.address?.postal_code),
          latitude: toNumber(venue.address?.latitude ?? venue.latitude),
          longitude: toNumber(venue.address?.longitude ?? venue.longitude),
        }
      : null,

    sessions: startsAt
      ? [{
          starts_at: startsAt,
          ends_at: payload.end?.utc ?? null,
          timezone: payload.start?.timezone ?? 'Asia/Singapore',
          capacity: Number.isInteger(payload.capacity) ? payload.capacity : null,
        }]
      : [],
  };
}

function truncate(text, length) {
  if (!text) return null;
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Stable identity for deduplication: organiser + title + first session date.
 * Two sources describing the same run produce the same key.
 */
export function dedupeKey(activity) {
  const organiser = activity.organiser?.slug ?? 'unknown';
  const day = activity.sessions[0]?.starts_at
    ? new Date(activity.sessions[0].starts_at).toISOString().slice(0, 10)
    : 'undated';
  return `${organiser}|${normaliseText(activity.title).replace(/\s/g, '-')}|${day}`.slice(0, 255);
}
