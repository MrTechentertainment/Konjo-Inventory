import type { OutletType } from './types';

export const ACTIVATION_PORTAL_URL = 'https://ktally.netlify.app/' as const;

/** Activation events are managed by KTally, not the local outlet database. */
export const LOCAL_OUTLET_TYPES: Exclude<OutletType, 'EVENT'>[] = ['SUPERMARKET', 'BAZAAR', 'GIFT', 'SAMPLE'];

/** The company-wide conversion. Never duplicate this literal in components. */
export const BOTTLES_PER_PACK = 15 as const;

export function productPackSize(product: { bottles_per_pack?: number | null }): number {
  const value = Number(product.bottles_per_pack);
  return Number.isInteger(value) && value > 0 ? value : BOTTLES_PER_PACK;
}

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

export function packsToBottles(packs: number, bottlesPerPack: number = BOTTLES_PER_PACK): number {
  return Math.max(0, Math.trunc(packs)) * Math.max(1, Math.trunc(bottlesPerPack));
}

export function roleHome(role: 'SUPER_ADMIN' | 'ADMIN' | 'BASIC'): string {
  return role === 'BASIC' ? '/outlets' : '/';
}
