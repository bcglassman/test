import { lookup, SOLO_FRIENDLY, NEWCOMER_NORM, PRESSURE, GROUP_SIZE } from '../lib/format';

/**
 * The chips that make this platform different from a listings page.
 *
 * Order is deliberate: whether you can come alone goes first, because it is the
 * question the reader is actually asking. An unknown attribute renders nothing
 * at all — never a negative, never a greyed-out "unknown".
 */
export default function AttributeChips({ activity, limit = 4 }) {
  const solo = lookup(SOLO_FRIENDLY, activity.solo_friendly);
  const newcomer = lookup(NEWCOMER_NORM, activity.newcomer_norm);
  const pressure = lookup(PRESSURE, activity.pressure_level);
  const size = lookup(GROUP_SIZE, activity.group_size);

  const chips = [
    solo && { key: 'solo', label: solo.label, tone: solo.tone },
    newcomer && { key: 'new', label: newcomer.label, tone: newcomer.tone },
    pressure && { key: 'pressure', label: pressure.label },
    activity.social_after === true && { key: 'after', label: 'Kopi after' },
    size && { key: 'size', label: size.label },
  ].filter(Boolean).slice(0, limit);

  if (chips.length === 0) return null;

  return (
    <div className="chips">
      {chips.map((chip) => (
        <span key={chip.key} className={`chip${chip.tone ? ` ${chip.tone}` : ''}`}>{chip.label}</span>
      ))}
    </div>
  );
}
