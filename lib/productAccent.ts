export interface ProductAccent {
  ring: string;
  glow: string;
  chip: string;
  gradient: string;
}

const RED: ProductAccent = {
  ring: 'ring-konjo-red/25',
  glow: 'shadow-konjo-red/20',
  chip: 'bg-konjo-red/15 text-konjo-red',
  gradient: 'from-konjo-red/20 via-transparent to-transparent',
};

const GREEN: ProductAccent = {
  ring: 'ring-konjo-green/25',
  glow: 'shadow-konjo-green/20',
  chip: 'bg-konjo-green/15 text-konjo-green',
  gradient: 'from-konjo-green/20 via-transparent to-transparent',
};

const AMBER: ProductAccent = {
  ring: 'ring-konjo-amber/25',
  glow: 'shadow-konjo-amber/20',
  chip: 'bg-konjo-amber/15 text-konjo-amber',
  gradient: 'from-konjo-amber/20 via-transparent to-transparent',
};

const NEUTRAL: ProductAccent = {
  ring: 'ring-white/10',
  glow: 'shadow-black/20',
  chip: 'bg-white/10 text-konjo-cream/70',
  gradient: 'from-white/10 via-transparent to-transparent',
};

/**
 * KONJO's real catalog is small and name-driven (Datta Red, Datta Green,
 * Hot & Sweet Ketchup), so the card accent reads product name keywords
 * rather than depending on a separate color field nobody would keep in
 * sync. New products fall back to a quiet neutral accent automatically.
 */
export function getProductAccent(name: string): ProductAccent {
  const n = name.toLowerCase();
  if (n.includes('green')) return GREEN;
  if (n.includes('red')) return RED;
  if (n.includes('ketchup') || n.includes('sweet') || n.includes('hot')) return AMBER;
  return NEUTRAL;
}
