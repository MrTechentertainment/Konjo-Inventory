/**
 * All display timestamps are formatted in Africa/Addis_Ababa (EAT, UTC+3,
 * no DST) regardless of the viewing device's own timezone — a staff phone
 * set to a different locale should never show a stock-in logged at a
 * different local time than it actually happened in Addis Ababa.
 *
 * The database stores `timestamptz` (UTC internally, which is the correct
 * and portable way to store instants in Postgres). This file is the single
 * place that converts those instants to EAT for humans to read.
 */

const EAT_ZONE = 'Africa/Addis_Ababa';

export function formatEAT(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EAT_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...opts,
  }).format(new Date(iso));
}

export function formatEATDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EAT_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso));
}

export function formatEATTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EAT_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Relative "just now" / "12m ago" for the live activity feed. */
export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatEATDate(iso);
}

/** ISO cutoff N days ago, for the audit drawer's date-range filter. */
export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
