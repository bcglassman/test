/**
 * Turning stored values into the words a reader actually uses.
 *
 * The soft attributes are stored as enums; nobody says "pressure_level:
 * drop_in". These labels are the whole point of the platform, so they are
 * written as answers to the question a person is asking, not as field values.
 */

export const SOLO_FRIENDLY = {
  yes:      { label: 'Come alone', detail: 'People turn up on their own here', tone: 'good' },
  probably: { label: 'Probably fine alone', detail: 'Looks welcoming to solo arrivals', tone: 'ok' },
  unlikely: { label: 'Bring someone', detail: 'This one expects you to arrive with people', tone: 'warn' },
};

export const NEWCOMER_NORM = {
  common:     { label: 'New faces are normal', tone: 'good' },
  occasional: { label: 'Some new faces', tone: 'ok' },
  rare:       { label: 'Mostly regulars', tone: 'warn' },
};

export const PRESSURE = {
  drop_in: { label: 'Just turn up' },
  rsvp:    { label: 'Book a place' },
  commit:  { label: 'Ongoing commitment' },
};

export const CONVERSATION = {
  parallel:       { label: 'Quiet, side by side' },
  light:          { label: 'Easy chat' },
  conversational: { label: 'Talking is the point' },
};

export const GROUP_SIZE = {
  intimate: { label: 'Up to 8 people' },
  small:    { label: '9–20 people' },
  medium:   { label: '21–60 people' },
  large:    { label: '60+ people' },
};

export const INTENSITY = {
  gentle:      { label: 'Gentle' },
  moderate:    { label: 'Moderate' },
  vigorous:    { label: 'Hard work' },
  competitive: { label: 'Competitive' },
};

/**
 * Unknown is rendered as absence, never as a negative. A listing that does not
 * say whether you can come alone must not read as "no".
 */
export function lookup(map, value) {
  if (!value || value === 'unknown') return null;
  return map[value] ?? null;
}

export function priceLabel(activity) {
  const { price_min: min, price_max: max, currency = 'SGD', cost_band: band } = activity;
  if (min != null) {
    if (Number(min) === 0) return 'Free';
    if (max != null && Number(max) !== Number(min)) return `${currency} ${money(min)}–${money(max)}`;
    return `${currency} ${money(min)}`;
  }
  return { free: 'Free', under_20: 'Under $20', '20_to_50': '$20–50',
           '50_to_100': '$50–100', over_100: 'Over $100' }[band] ?? null;
}

const money = (v) => (Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2));

const SG = 'Asia/Singapore';

export function formatSession(value) {
  if (!value) return null;
  const date = new Date(value);
  const day = date.toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: SG });
  const time = date.toLocaleTimeString('en-SG', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: SG })
    .replace(':00', '').toLowerCase().replace(' ', '');
  return `${day}, ${time}`;
}

export function relativeDay(value) {
  if (!value) return null;
  const days = Math.round((new Date(value) - Date.now()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  return null;
}

export const REGION_LABEL = {
  central: 'Central', north: 'North', north_east: 'North East',
  east: 'East', west: 'West',
};
