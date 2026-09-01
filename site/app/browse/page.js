import ActivityCard from '../../components/ActivityCard';
import { getPublishedActivities, getCategories } from '../../lib/directus';
import { REGION_LABEL } from '../../lib/format';

export const revalidate = 300;
export const metadata = { title: 'Browse' };

/** Builds a href with one filter toggled, preserving the others. */
function toggle(params, key, value) {
  const next = new URLSearchParams(params);
  if (next.get(key) === String(value)) next.delete(key);
  else next.set(key, String(value));
  const query = next.toString();
  return query ? `/browse?${query}` : '/browse';
}

export default async function Browse({ searchParams }) {
  const params = await searchParams;
  const current = {
    category: params?.category ?? null,
    region: params?.region ?? null,
    solo: params?.solo === '1',
    dropin: params?.dropin === '1',
    free: params?.free === '1',
  };
  const asStrings = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => typeof v === 'string'));

  let activities = [];
  let categories = [];
  let error = null;
  try {
    [activities, categories] = await Promise.all([
      getPublishedActivities({
        limit: 48,
        category: current.category,
        region: current.region,
        soloOnly: current.solo,
        dropInOnly: current.dropin,
        freeOnly: current.free,
      }),
      getCategories(),
    ]);
  } catch (cause) {
    error = cause.message;
  }

  return (
    <div className="wrap" style={{ paddingTop: '2.5rem' }}>
      <h1>Browse</h1>
      <p className="lede" style={{ marginBottom: '1.5rem' }}>
        Filter by how it feels, not just what it is.
      </p>

      <div className="filters">
        <span className="label">How it feels</span>
        <a className="pill" aria-current={current.solo} href={toggle(asStrings, 'solo', 1)}>Fine alone</a>
        <a className="pill" aria-current={current.dropin} href={toggle(asStrings, 'dropin', 1)}>Just turn up</a>
        <a className="pill" aria-current={current.free} href={toggle(asStrings, 'free', 1)}>Free</a>
      </div>

      {categories.length > 0 && (
        <div className="filters">
          <span className="label">Activity</span>
          {categories.map((category) => (
            <a key={category.slug} className="pill"
               aria-current={current.category === category.slug}
               href={toggle(asStrings, 'category', category.slug)}>{category.name}</a>
          ))}
        </div>
      )}

      <div className="filters">
        <span className="label">Where</span>
        {Object.entries(REGION_LABEL).map(([slug, label]) => (
          <a key={slug} className="pill" aria-current={current.region === slug}
             href={toggle(asStrings, 'region', slug)}>{label}</a>
        ))}
      </div>

      {error ? (
        <div className="empty"><p><strong>Listings are unavailable right now.</strong></p></div>
      ) : activities.length === 0 ? (
        <div className="empty">
          <p><strong>Nothing matches all of those.</strong></p>
          <p className="note">Try removing a filter — <a href="/browse">start over</a>.</p>
        </div>
      ) : (
        <>
          <p className="note" style={{ marginBottom: '1rem' }}>
            {activities.length} {activities.length === 1 ? 'listing' : 'listings'}
          </p>
          <div className="grid" style={{ paddingBottom: '3rem' }}>
            {activities.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
          </div>
        </>
      )}
    </div>
  );
}
