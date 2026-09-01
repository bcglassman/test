/**
 * Stands in for a photograph.
 *
 * Most listings arrive without an image — clubs publish to Instagram, and we do
 * not lift their photos. A tinted plate carrying the category in display type
 * reads as a deliberate choice, where a grey placeholder reads as a broken
 * image, and it makes a wall of cards scannable by colour.
 */

const TINTS = {
  'running-endurance': ['#E6EFEA', '#1C6B52'],
  'racket-court':      ['#E3EEEF', '#0B5563'],
  'team-pickup':       ['#EDEAF3', '#4B3F72'],
  'strength-studio':   ['#F7EEDF', '#8A5A1B'],
  'water':             ['#E2EDF4', '#1F5580'],
  'climbing-movement': ['#F4E8EE', '#8E2B57'],
  'outdoor-walking':   ['#EAF0E4', '#4A6B29'],
  'mind-body':         ['#F0EDE8', '#5C5346'],
};
const DEFAULT_TINT = ['#EAEEEC', '#40575C'];

export default function CategoryPlate({ category }) {
  const [background, ink] = TINTS[category?.slug] ?? DEFAULT_TINT;
  return (
    <div className="plate" style={{ '--plate-bg': background, '--plate-ink': ink }}>
      <span>{category?.name ?? 'Active'}</span>
    </div>
  );
}
