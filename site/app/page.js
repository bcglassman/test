import ActivityCard from '../components/ActivityCard';
import { getPublishedActivities } from '../lib/directus';

export const revalidate = 300;

export default async function Home() {
  let activities = [];
  let error = null;
  try {
    activities = await getPublishedActivities({ limit: 12 });
  } catch (cause) {
    error = cause.message;
  }

  // Lead with what someone arriving alone can use, then show the rest. The
  // two sections must not repeat the same cards down the page.
  const soloFriendly = activities.filter((a) => ['yes', 'probably'].includes(a.solo_friendly));
  const featured = soloFriendly.slice(0, 3);
  const featuredIds = new Set(featured.map((a) => a.id));
  const rest = activities.filter((a) => !featuredIds.has(a.id));

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="label" style={{ marginBottom: '1rem' }}>Active social events · Singapore</p>
          <h1>Something to do this week,<br />and you don&rsquo;t need a plus one.</h1>
          <p className="lede">
            Runs, padel, pickleball, bouldering, club sessions. Every listing tells you the
            thing the others leave out: <span className="em">whether you can turn up on your own.</span>
          </p>
        </div>
      </section>

      <div className="wrap">
        {error ? (
          <div className="empty">
            <p><strong>Listings are unavailable right now.</strong></p>
            <p className="note">Nothing is wrong with your connection — we can&rsquo;t reach the listings service.</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="empty">
            <p><strong>Nothing published yet.</strong></p>
            <p className="note">Listings appear here once they&rsquo;ve been checked by a person.</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section style={{ marginBottom: '3rem' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2>Good to arrive alone</h2>
                  <a href="/browse?solo=1" className="pill">See all</a>
                </div>
                <div className="grid">
                  {featured.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section style={{ paddingBottom: '2rem' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2>Also on</h2>
                  <a href="/browse" className="pill">Browse everything</a>
                </div>
                <div className="grid">
                  {rest.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
