import type { OutletType } from './types';

export type LocalOutletType = Exclude<OutletType, 'EVENT'>;

export const OUTLET_TYPE_SLUG: Record<LocalOutletType, string> = {
  SUPERMARKET: 'supermarkets',
  BAZAAR: 'bazaars',
  GIFT: 'gifts',
  SAMPLE: 'samples',
};

export function outletTypeFromSlug(slug: string): LocalOutletType | null {
  const entry = (Object.entries(OUTLET_TYPE_SLUG) as [LocalOutletType, string][]).find(([, value]) => value === slug.toLowerCase());
  return entry?.[0] ?? null;
}

export function portalCategoryHref(type: LocalOutletType): string {
  return `/outlets/category/${OUTLET_TYPE_SLUG[type]}`;
}

export function managementCategoryHref(type: LocalOutletType): string {
  return `/admin/outlets/${OUTLET_TYPE_SLUG[type]}`;
}
