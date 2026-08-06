import type { OutletType } from './types';

/** The company-wide conversion. Never duplicate this literal in components. */
export const BOTTLES_PER_PACK = 15 as const;

export const OUTLET_TYPE_LABEL: Record<OutletType, string> = {
  SUPERMARKET: 'Supermarkets',
  BAZAAR: 'Bazaars',
  EVENT: 'Activation Events',
  GIFT: 'Gifts',
  SAMPLE: 'Samples',
};

export const OUTLET_TYPE_DESCRIPTION: Record<OutletType, string> = {
  SUPERMARKET: 'Deliveries and stock held by retail partners',
  BAZAAR: 'Pack setup and live bottle-by-bottle selling',
  EVENT: 'Activation stock and rapid live sales',
  GIFT: 'Promotional gifts and issued stock',
  SAMPLE: 'Sampling stock and field consumption',
};

export function packsToBottles(packs: number): number {
  return Math.max(0, Math.trunc(packs)) * BOTTLES_PER_PACK;
}

export function roleHome(role: 'SUPER_ADMIN' | 'ADMIN' | 'BASIC'): string {
  return role === 'BASIC' ? '/outlets' : '/';
}
