import { notFound } from 'next/navigation';
import AttributeChips from '../../../components/AttributeChips';
import InterestForm from '../../../components/InterestForm';
import { getActivityBySlug, getSessions, getInterestStats, assetUrl } from '../../../lib/directus';
import {
  lookup, SOLO_FRIENDLY, NEWCOMER_NORM, PRESSURE, CONVERSATION, GROUP_SIZE, INTENSITY,
  priceLabel, formatSession, relativeDay, REGION_LABEL,
} from '../../../lib/format';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const activity = await getActivityBySlug(slug).catch(() => null);
  if (!activity) return { title: 'Not found' };
  return {
    title: activity.title,
    description: activity.summary ?? undefined,
  };
}

export default async function ActivityPage({ params }) {
  const { slug } = await params;

  let activity = null;
  try {
    activity = await getActivityBySlug(slug);
  } catch {
    activity = null;
  }
  if (!activity) notFound();

  const [sessions, stats] = await Promise.all([
    getSessions(activity.id).catch(() => []),
    getInterestStats(activity.id),
  ]);

  const image = assetUrl(activity.hero_image, 'width=1400&height=700&fit=cover&quality=80');
  const price = priceLabel(activity);

  /* Answers to what the reader is actually asking, in that order.
     An unknown attribute is omitted — never shown as "unknown". */
  const answers = [
    ['Can I come alone?', lookup(SOLO_FRIENDLY, activity.solo_friendly)],
    ['Will I be the only new face?', lookup(NEWCOMER_NORM, activity.newcomer_norm)],
    ['What am I signing up for?', lookup(PRESSURE, activity.pressure_level)],
    ['How much talking?', lookup(CONVERSATION, activity.conversation_load)],
    ['How many people?', lookup(GROUP_SIZE, activity.group_size)],
    ['How hard is it?', lookup(INTENSITY, activity.intensity)],
  ].filter(([, value]) => value);

  return (
    <>
      {image && (
        <div className="wrap" style={{ paddingTop: '1.5rem' }}>
          <div style={{ aspectRatio: '2 / 1', overflow: 'hidden', borderRadius: 'var(--radius)', background: 'var(--sunken)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      )}

      <div className="wrap detail-head">
        {activity.category?.name && <p className="label">{activity.category.name}</p>}
        <h1>{activity.title}</h1>
        <div className="row" style={{ gap: '.6rem', color: 'var(--ink-soft)', marginBottom: '1rem' }}>
          {activity.organiser?.name && <span>{activity.organiser.name}</span>}
          <span aria-hidden="true" style={{ color: 'var(--line-strong)' }}>/</span>
          {activity.venue?.name && (
            <span>
              {activity.venue.name}
              {activity.venue.nearest_mrt ? ` · ${activity.venue.nearest_mrt} MRT` : ''}
              {activity.venue.region ? ` · ${REGION_LABEL[activity.venue.region]}` : ''}
            </span>
          )}
          {price && <span>{price}</span>}
        </div>
        <AttributeChips activity={activity} limit={6} />
      </div>

      <div className="wrap detail-grid">
        <div className="stack" style={{ gap: '2rem' }}>
          {activity.summary && (
            <div className="prose"><p style={{ fontSize: '1.1rem' }}>{activity.summary}</p></div>
          )}

          {answers.length > 0 && (
            <section>
              <h2 style={{ marginBottom: '.8rem' }}>What it&rsquo;s like</h2>
              <dl className="answers">
                {answers.map(([question, value]) => (
                  <div className="answer" key={question}>
                    <dt>{question}</dt>
                    <dd>
                      {value.label}
                      {value.detail && <small>{value.detail}</small>}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="note" style={{ marginTop: '.7rem' }}>
                Checked by a person before publishing. Anything we couldn&rsquo;t
                establish from the organiser isn&rsquo;t listed above.
              </p>
            </section>
          )}

          {activity.description && (
            <section className="prose">
              <h2 style={{ marginBottom: '.6rem' }}>Details</h2>
              {activity.description.split(/\n{2,}/).map((para, index) => <p key={index}>{para}</p>)}
            </section>
          )}
        </div>

        <aside className="aside">
          {sessions.length > 0 && (
            <div className="panel">
              <h3>When</h3>
              <div className="stack" style={{ gap: '.4rem' }}>
                {sessions.map((session) => {
                  const soon = relativeDay(session.starts_at);
                  return (
                    <div key={session.id}>
                      {formatSession(session.starts_at)}
                      {soon && <span className="note"> · {soon}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats?.interested_count > 0 && (
            <div className="panel">
              <h3>Who&rsquo;s interested</h3>
              <div className="stat">
                <span className="n">{stats.interested_count}</span>
                <span>{stats.interested_count === 1 ? 'person' : 'people'}</span>
              </div>
              {stats.first_timer_count > 0 && (
                <p className="note" style={{ marginTop: '.5rem' }}>
                  <strong style={{ color: 'var(--accent)' }}>{stats.first_timer_count}</strong>{' '}
                  {stats.first_timer_count === 1 ? 'is coming' : 'are coming'} for the first time.
                </p>
              )}
            </div>
          )}

          <InterestForm activitySlug={activity.slug} activityTitle={activity.title} />

          {(activity.booking_url || activity.source_url) && (
            <a className="btn secondary" href={activity.booking_url ?? activity.source_url}
               rel="noopener noreferrer nofollow" target="_blank">
              Organiser&rsquo;s page
            </a>
          )}
        </aside>
      </div>
    </>
  );
}
