import { getPublishedCoaches } from '../../lib/directus';

export const revalidate = 3600;
export const metadata = { title: 'Coaches' };

const VERIFICATION = {
  documents_checked: { label: 'Credentials checked', tone: 'good' },
  self_declared: { label: 'Profile reviewed', tone: 'ok' },
};

export default async function Coaches() {
  let coaches = [];
  let error = null;
  try {
    coaches = await getPublishedCoaches();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <div className="wrap" style={{ paddingTop: '2.5rem', paddingBottom: '3rem' }}>
      <h1>Coaches</h1>
      <p className="lede" style={{ marginBottom: '2rem' }}>
        Professional coaches and experienced peers. We say which is which, always.
      </p>

      {error ? (
        <div className="empty"><p><strong>The directory is unavailable right now.</strong></p></div>
      ) : coaches.length === 0 ? (
        <div className="empty">
          <p><strong>No coaches listed yet.</strong></p>
          <p className="note">Every profile is read by a person before it appears.</p>
        </div>
      ) : (
        <div className="grid">
          {coaches.map((coach) => {
            const verification = VERIFICATION[coach.verification_status];
            const rate = coach.rate_min != null
              ? `${coach.currency ?? 'SGD'} ${coach.rate_min}${coach.rate_unit ? ` / ${coach.rate_unit}` : ''}`
              : null;
            return (
              <article className="card" key={coach.id}>
                <div className="card-body">
                  <div className="chips">
                    <span className={`chip ${coach.coach_type === 'professional' ? 'ok' : ''}`}>
                      {coach.coach_type === 'professional' ? 'Professional coach' : 'Peer coach'}
                    </span>
                    {verification && <span className={`chip ${verification.tone}`}>{verification.label}</span>}
                    {coach.offers_free_intro && <span className="chip">Free first session</span>}
                  </div>
                  <h3>{coach.display_name}</h3>
                  {coach.headline && <p className="card-meta">{coach.headline}</p>}
                  {rate && <div className="card-foot label">{rate}</div>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="note" style={{ marginTop: '2rem', maxWidth: '52ch' }}>
        We pass on introductions; we don&rsquo;t take payment or arrange sessions. A peer
        coach is an experienced participant, not a certified professional — both are
        useful, and the difference is always shown.
      </p>
    </div>
  );
}
