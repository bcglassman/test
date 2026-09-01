/**
 * Reads from Directus.
 *
 * Everything here runs on the server: the token never reaches the browser, and
 * pages are rendered and revalidated rather than fetched per visitor. A
 * listings page that changes a few times a day should not hit the API once per
 * reader.
 */

const URL_BASE = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN ?? '';

/** How long a page may serve stale data before Next re-renders it. */
export const REVALIDATE = { feed: 300, activity: 300, static: 3600 };

async function request(path, { revalidate = REVALIDATE.feed } = {}) {
  const headers = { Accept: 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const response = await fetch(`${URL_BASE}${path}`, { headers, next: { revalidate } });

  if (!response.ok) {
    throw new Error(`Directus ${response.status} on ${path}`);
  }
  const payload = await response.json();
  return payload.data;
}

const ACTIVITY_FIELDS = [
  'id', 'title', 'slug', 'summary', 'description', 'hero_image',
  'solo_friendly', 'newcomer_norm', 'pressure_level', 'conversation_load',
  'group_size', 'intensity', 'social_after', 'cost_band',
  'price_min', 'price_max', 'currency', 'capacity', 'format',
  'booking_url', 'discussion_group_url', 'source_url',
  'organiser.name', 'organiser.slug', 'organiser.website',
  'venue.name', 'venue.nearest_mrt', 'venue.region', 'venue.address',
  'category.name', 'category.slug',
].join(',');

export async function getPublishedActivities({ limit = 24, category, region, soloOnly, dropInOnly, freeOnly } = {}) {
  const query = new URLSearchParams({
    fields: ACTIVITY_FIELDS,
    'filter[status][_eq]': 'published',
    sort: '-quality_score',
    limit: String(limit),
  });
  if (category)   query.set('filter[category][slug][_eq]', category);
  if (region)     query.set('filter[venue][region][_eq]', region);
  if (soloOnly)   query.set('filter[solo_friendly][_in]', 'yes,probably');
  if (dropInOnly) query.set('filter[pressure_level][_eq]', 'drop_in');
  if (freeOnly)   query.set('filter[cost_band][_eq]', 'free');

  return request(`/items/activities?${query}`);
}

export async function getActivityBySlug(slug) {
  const query = new URLSearchParams({
    fields: ACTIVITY_FIELDS,
    'filter[slug][_eq]': slug,
    'filter[status][_eq]': 'published',
    limit: '1',
  });
  const [activity] = await request(`/items/activities?${query}`, { revalidate: REVALIDATE.activity });
  return activity ?? null;
}

export async function getSessions(activityId, { limit = 6 } = {}) {
  const query = new URLSearchParams({
    fields: 'id,starts_at,ends_at,status,spots_remaining',
    'filter[activity][_eq]': activityId,
    'filter[status][_eq]': 'scheduled',
    sort: 'starts_at',
    limit: String(limit),
  });
  return request(`/items/sessions?${query}`);
}

/** Public interest counts. Counts only — never names. */
export async function getInterestStats(activityId) {
  try {
    const query = new URLSearchParams({
      fields: 'interested_count,first_timer_count',
      'filter[activity][_eq]': activityId,
      limit: '1',
    });
    const [stats] = await request(`/items/activity_interest_stats?${query}`);
    return stats ?? null;
  } catch {
    return null;   // the counts are a nicety; their absence must not break a page
  }
}

export async function getCategories() {
  const query = new URLSearchParams({
    fields: 'name,slug', 'filter[status][_eq]': 'active', sort: 'sort',
  });
  return request(`/items/categories?${query}`, { revalidate: REVALIDATE.static });
}

export async function getPublishedCoaches({ category, limit = 24 } = {}) {
  const query = new URLSearchParams({
    fields: ['id', 'slug', 'display_name', 'headline', 'bio', 'coach_type',
             'verification_status', 'rate_min', 'rate_max', 'rate_unit', 'currency',
             'offers_free_intro', 'regions'].join(','),
    'filter[status][_eq]': 'published',
    limit: String(limit),
  });
  if (category) query.set('filter[coach_categories][category][slug][_eq]', category);
  return request(`/items/coaches?${query}`);
}

export function assetUrl(id, params = 'width=1200&quality=80') {
  if (!id) return null;
  return `${URL_BASE}/assets/${id}?${params}`;
}
