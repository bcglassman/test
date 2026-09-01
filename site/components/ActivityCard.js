import AttributeChips from './AttributeChips';
import { assetUrl } from '../lib/directus';
import { priceLabel, formatSession, relativeDay, REGION_LABEL } from '../lib/format';

export default function ActivityCard({ activity }) {
  const image = assetUrl(activity.hero_image, 'width=640&height=360&fit=cover&quality=75');
  const when = formatSession(activity.next_session);
  const soon = relativeDay(activity.next_session);
  const price = priceLabel(activity);
  const place = activity.venue?.nearest_mrt
    ? `${activity.venue.nearest_mrt} MRT`
    : activity.venue?.name ?? REGION_LABEL[activity.venue?.region] ?? null;

  return (
    <article className="card">
      {image && (
        <div className="card-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" loading="lazy" />
        </div>
      )}
      <div className="card-body">
        <AttributeChips activity={activity} limit={3} />
        <h3><a href={`/e/${activity.slug}`}>{activity.title}</a></h3>
        <div className="card-meta">
          {when && <span>{when}{soon ? ` · ${soon}` : ''}</span>}
          {place && <span>{place}</span>}
          {activity.organiser?.name && <span>{activity.organiser.name}</span>}
        </div>
        {price && <div className="card-foot label">{price}</div>}
      </div>
    </article>
  );
}
