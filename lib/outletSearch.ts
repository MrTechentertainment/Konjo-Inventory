import type { Outlet } from './types';

export interface OutletSearchResult {
  matches: Outlet[];
  suggestion: Outlet | null;
  hasDirectMatch: boolean;
}

export function normalizeOutletSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u1200-\u137f]+/g, ' ')
    .trim();
}

/** Damerau-Levenshtein distance catches both misspellings and swapped letters. */
export function outletEditDistance(left: string, right: string): number {
  const a = normalizeOutletSearch(left);
  const b = normalizeOutletSearch(right);
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

function searchableText(outlet: Outlet): string {
  return normalizeOutletSearch([outlet.name, outlet.address, outlet.subcity].filter(Boolean).join(' '));
}

function outletNameDistance(query: string, outletName: string): number {
  const normalizedName = normalizeOutletSearch(outletName);
  const withoutType = normalizedName.replace(/\b(supermarkets?|markets?|bazaars?|shops?|stores?|gift|sample)\b/g, '').replace(/\s+/g, ' ').trim();
  const queryVariants = [query, query.replace(/\s+/g, '')];
  const nameVariants = [normalizedName, withoutType, normalizedName.replace(/\s+/g, '')].filter(Boolean);
  return Math.min(...queryVariants.flatMap((queryValue) => nameVariants.map((nameValue) => outletEditDistance(queryValue, nameValue))));
}

export function searchOutlets(outlets: Outlet[], rawQuery: string): OutletSearchResult {
  const candidates = outlets.filter((outlet) => outlet.type !== 'EVENT');
  const query = normalizeOutletSearch(rawQuery);
  if (!query) return { matches: [], suggestion: null, hasDirectMatch: false };

  const direct = candidates.filter((outlet) => searchableText(outlet).includes(query));
  if (direct.length) {
    return {
      matches: direct.sort((a, b) => a.name.localeCompare(b.name)),
      suggestion: null,
      hasDirectMatch: true,
    };
  }

  if (query.length < 3) return { matches: [], suggestion: null, hasDirectMatch: false };

  const ranked = candidates
    .map((outlet) => ({ outlet, distance: outletNameDistance(query, outlet.name) }))
    .sort((a, b) => a.distance - b.distance || a.outlet.name.localeCompare(b.outlet.name));
  const closest = ranked[0];
  const threshold = Math.max(1, Math.min(4, Math.ceil(query.length * 0.34)));
  const fuzzy = ranked.filter((item) => item.distance <= threshold).slice(0, 8).map((item) => item.outlet);
  return {
    matches: fuzzy,
    suggestion: closest && closest.distance <= threshold ? closest.outlet : null,
    hasDirectMatch: false,
  };
}
