import { addDays, differenceInCalendarDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryItem } from '../../pantry/models/pantry-item.model';

/**
 * Timeline buckets used by the Expiry Tracker, in display order.
 *
 * "Expiring soon" (today, tomorrow and "soon") is the user's expiry reminder
 * lead time from Account settings (`reminderSettings.expiryLeadDays`: 1, 3 or
 * 7 days), so the tracker flags items exactly when reminders do.
 *
 * Items with nothing left (quantity 0) are "used up": there is nothing left to
 * expire, so they sit in their own group instead of counting as expired or
 * expiring. That way "Mark as used" can actually clear an item from the
 * attention list, and "Restock" brings it back onto the timeline.
 */
export const EXPIRY_BUCKETS = ['expired', 'today', 'tomorrow', 'soon', 'later', 'no-date', 'used-up'] as const;
export type ExpiryBucket = (typeof EXPIRY_BUCKETS)[number];

export const EXPIRY_TRACKER_FILTERS = ['all', 'expired', 'expiring', 'fresh', 'no-date', 'used-up'] as const;
export type ExpiryTrackerFilter = (typeof EXPIRY_TRACKER_FILTERS)[number];

export type ExpiryTone = 'danger' | 'warn' | 'ok' | 'muted';

export interface ExpiryTrackerEntry {
  readonly item: PantryItem;
  /** Calendar days until expiry (negative = already expired); null when no date is set. */
  readonly daysUntil: number | null;
  readonly bucket: ExpiryBucket;
}

export interface ExpiryTrackerGroup {
  readonly bucket: ExpiryBucket;
  readonly label: string;
  readonly entries: readonly ExpiryTrackerEntry[];
}

export interface ExpiryTrackerSummary {
  /** Every pantry item, including used-up ones. */
  readonly total: number;
  /** Items with something left (quantity above 0). */
  readonly inStock: number;
  /** In-stock items that have an expiry date. */
  readonly tracked: number;
  readonly expired: number;
  readonly expiring: number;
  readonly fresh: number;
  readonly noDate: number;
  readonly usedUp: number;
}

const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: 'Expired',
  today: 'Today',
  tomorrow: 'Tomorrow',
  soon: 'Soon',
  later: 'Later',
  'no-date': 'No expiry date',
  'used-up': 'Used up'
};

const FILTER_BUCKETS: Record<ExpiryTrackerFilter, readonly ExpiryBucket[]> = {
  all: EXPIRY_BUCKETS,
  expired: ['expired'],
  expiring: ['today', 'tomorrow', 'soon'],
  fresh: ['later'],
  'no-date': ['no-date'],
  'used-up': ['used-up']
};

/** Quick picks offered when restocking, relative to today. */
export const RESTOCK_DATE_PRESETS: ReadonlyArray<{ readonly label: string; readonly days: number }> = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 }
];

/** Group heading; the "soon" group (2+ days out, inside the window) names the window. */
export function expiryBucketLabel(bucket: ExpiryBucket, leadDays: number): string {
  if (bucket !== 'soon') return EXPIRY_BUCKET_LABELS[bucket];
  return leadDays === 7 ? 'Within a week' : `Within ${leadDays} days`;
}

/** Short description of the window, e.g. "3 days" or "1 day". */
export function describeLeadDays(leadDays: number): string {
  return `${leadDays} ${leadDays === 1 ? 'day' : 'days'}`;
}

export function getExpiryBucket(daysUntil: number | null, soonWindowDays: number): ExpiryBucket {
  if (daysUntil === null) return 'no-date';
  if (daysUntil < 0) return 'expired';
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  if (daysUntil <= soonWindowDays) return 'soon';
  return 'later';
}

export function getExpiryTone(bucket: ExpiryBucket): ExpiryTone {
  switch (bucket) {
    case 'expired':
    case 'today':
      return 'danger';
    case 'tomorrow':
    case 'soon':
      return 'warn';
    case 'later':
      return 'ok';
    default:
      return 'muted';
  }
}

/** `leadDays`: the user's expiry reminder lead time — see `reminderSettings.expiryLeadDays`. */
export function toExpiryEntry(item: PantryItem, leadDays: number, today: Date = new Date()): ExpiryTrackerEntry {
  const daysUntil = item.expiryDate ? differenceInCalendarDays(item.expiryDate, today) : null;
  const bucket = item.quantity <= 0 ? 'used-up' : getExpiryBucket(daysUntil, leadDays);
  return { item, daysUntil, bucket };
}

export function summarizeExpiry(entries: readonly ExpiryTrackerEntry[]): ExpiryTrackerSummary {
  let expired = 0;
  let expiring = 0;
  let fresh = 0;
  let noDate = 0;
  let usedUp = 0;

  for (const { bucket } of entries) {
    if (bucket === 'expired') expired++;
    else if (bucket === 'later') fresh++;
    else if (bucket === 'no-date') noDate++;
    else if (bucket === 'used-up') usedUp++;
    else expiring++;
  }

  const inStock = entries.length - usedUp;
  return { total: entries.length, inStock, tracked: inStock - noDate, expired, expiring, fresh, noDate, usedUp };
}

export function countForFilter(summary: ExpiryTrackerSummary, filter: ExpiryTrackerFilter): number {
  switch (filter) {
    case 'expired':
      return summary.expired;
    case 'expiring':
      return summary.expiring;
    case 'fresh':
      return summary.fresh;
    case 'no-date':
      return summary.noDate;
    case 'used-up':
      return summary.usedUp;
    default:
      return summary.total;
  }
}

/**
 * Groups entries into timeline sections (soonest first), dropping empty ones.
 * Dated items are ordered by days left; undated and used-up ones alphabetically.
 */
export function groupExpiryEntries(
  entries: readonly ExpiryTrackerEntry[],
  leadDays: number,
  filter: ExpiryTrackerFilter = 'all'
): ExpiryTrackerGroup[] {
  const visibleBuckets = FILTER_BUCKETS[filter];

  return visibleBuckets
    .map((bucket) => ({
      bucket,
      label: expiryBucketLabel(bucket, leadDays),
      entries: entries
        .filter((entry) => entry.bucket === bucket)
        .sort(
          (left, right) =>
            (bucket === 'used-up' ? 0 : (left.daysUntil ?? 0) - (right.daysUntil ?? 0)) ||
            left.item.name.localeCompare(right.item.name)
        )
    }))
    .filter((group) => group.entries.length > 0);
}

/** Short badge copy, e.g. `{ value: '3', caption: 'days left' }`. */
export function describeDaysLeft(daysUntil: number | null): { value: string; caption: string } {
  if (daysUntil === null) return { value: '—', caption: 'no date' };
  if (daysUntil === 0) return { value: 'Today', caption: 'use now' };

  const days = Math.abs(daysUntil);
  const unit = days === 1 ? 'day' : 'days';
  return daysUntil < 0
    ? { value: `${days}`, caption: `${unit} ago` }
    : { value: `${days}`, caption: `${unit} left` };
}

/** Formats a `YYYY-MM-DD` date in local time, e.g. "Tue, 18 Nov" (year added when not this year). */
export function formatExpiryDate(dateOnly: string, today: Date = new Date()): string {
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {})
  });
}

/** `YYYY-MM-DD` for `days` after `today` (local time). */
export function dateInDays(days: number, today: Date = new Date()): string {
  return toLocalDateOnly(addDays(today, days));
}

/**
 * Expiry date suggested when restocking: keep the current date while it is
 * still ahead, otherwise start blank so an old date isn't carried onto a new
 * batch by accident.
 */
export function suggestedRestockDate(item: Pick<PantryItem, 'expiryDate'>, today: Date = new Date()): string {
  return item.expiryDate && differenceInCalendarDays(item.expiryDate, today) >= 0 ? item.expiryDate : '';
}

/** A restocked batch can't already be expired; a blank date is allowed (no date). */
export function isValidRestockDate(dateOnly: string, today: Date = new Date()): boolean {
  if (!dateOnly) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) || Number.isNaN(new Date(`${dateOnly}T00:00:00`).getTime())) {
    return false;
  }
  return differenceInCalendarDays(dateOnly, today) >= 0;
}
