export interface ReminderSettings {
  readonly expiryRemindersEnabled: boolean;
  readonly expiryLeadDays: number;
  readonly lowStockDigestEnabled: boolean;
  readonly reminderHour: number;
}

/** How many days before expiry the user can choose to be reminded. */
export const EXPIRY_LEAD_DAY_OPTIONS = [1, 3, 7] as const;
export type ExpiryLeadDays = (typeof EXPIRY_LEAD_DAY_OPTIONS)[number];
export const DEFAULT_EXPIRY_LEAD_DAYS: ExpiryLeadDays = 3;

/**
 * Maps a stored value onto one of the offered options: the nearest one (ties
 * go to the longer lead time — an earlier warning is the safer mistake).
 * Missing or invalid values fall back to the default.
 */
export function normalizeExpiryLeadDays(value: unknown): ExpiryLeadDays {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_EXPIRY_LEAD_DAYS;
  }

  let nearest: ExpiryLeadDays = EXPIRY_LEAD_DAY_OPTIONS[0];
  for (const option of EXPIRY_LEAD_DAY_OPTIONS) {
    if (Math.abs(option - value) <= Math.abs(nearest - value)) {
      nearest = option;
    }
  }
  return nearest;
}
