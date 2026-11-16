import { differenceInCalendarDays } from '../../../core/utils/date.utils';
import { PantryItem } from '../models/pantry-item.model';

/**
 * Shared "expiring soon" rule for every screen that counts or filters by
 * expiry (My Pantry, the Expiry Tracker, the Home shortcut), so they always
 * agree:
 *
 * - `leadDays` is the user's expiry reminder lead time from Account settings
 *   (`reminderSettings.expiryLeadDays`: 1, 3 or 7 days);
 * - days are local calendar days (an item expiring today has 0 days left);
 * - an item with nothing left (quantity 0) is `used-up`: there's nothing left
 *   to expire, so it counts as neither expired nor expiring.
 */
export type PantryExpiryStatus = 'expired' | 'expiring' | 'fresh' | 'no-date' | 'used-up';

export function getPantryExpiryStatus(
  item: Pick<PantryItem, 'quantity' | 'expiryDate'>,
  leadDays: number,
  today: Date = new Date()
): PantryExpiryStatus {
  if (item.quantity <= 0) return 'used-up';
  if (!item.expiryDate) return 'no-date';

  const daysLeft = differenceInCalendarDays(item.expiryDate, today);
  if (daysLeft < 0) return 'expired';
  return daysLeft <= leadDays ? 'expiring' : 'fresh';
}

/**
 * Colour for an item's expiry date text. Describes the date itself, so unlike
 * `getPantryExpiryStatus` it ignores the quantity.
 */
export function getExpiryDateTone(
  expiryDate: string | null,
  leadDays: number,
  today: Date = new Date()
): 'danger' | 'warning' | 'muted' {
  if (!expiryDate) return 'muted';

  const daysLeft = differenceInCalendarDays(expiryDate, today);
  if (daysLeft < 0) return 'danger';
  return daysLeft <= leadDays ? 'warning' : 'muted';
}
