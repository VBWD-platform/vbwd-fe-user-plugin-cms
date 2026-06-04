/**
 * S47.3 — relative "time ago" formatting for post metadata rows.
 * Single home (DRY) for the PostCard meta row + any future listing.
 * Uses `Intl.RelativeTimeFormat` so it is locale-aware without a dependency.
 */

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

export function timeAgo(
  isoTimestamp: string | null | undefined,
  locale = 'en',
  now: number = Date.now(),
): string {
  if (!isoTimestamp) return '';
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return '';

  const deltaSeconds = Math.round((then - now) / 1000);
  const absolute = Math.abs(deltaSeconds);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absolute < MINUTE) return format.format(Math.round(deltaSeconds), 'second');
  if (absolute < HOUR) return format.format(Math.round(deltaSeconds / MINUTE), 'minute');
  if (absolute < DAY) return format.format(Math.round(deltaSeconds / HOUR), 'hour');
  if (absolute < WEEK) return format.format(Math.round(deltaSeconds / DAY), 'day');
  if (absolute < MONTH) return format.format(Math.round(deltaSeconds / WEEK), 'week');
  if (absolute < YEAR) return format.format(Math.round(deltaSeconds / MONTH), 'month');
  return format.format(Math.round(deltaSeconds / YEAR), 'year');
}
