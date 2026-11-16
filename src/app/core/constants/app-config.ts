import { PantryCategory } from '../../features/pantry/models/pantry-item.model';
import { DEFAULT_EXPIRY_LEAD_DAYS } from '../../features/reminders/models/reminder-settings.model';
import { AppSettings } from '../../features/settings/models/app-settings.model';
import { DEFAULT_USER_PROFILE } from '../../features/settings/models/profile.model';

export const APP_NAME = 'My Grocery';
export const EXPIRING_SOON_SECTION_WINDOW_DAYS = 3;
export const LOW_STOCK_EXPIRY_WINDOW_DAYS = 1;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  emailAlertsEnabled: false,
  themePreference: 'system',
  defaultCategory: 'vegetables',
  defaultLowStockThreshold: 1,
  defaultAutoAddToShoppingList: true,
  profile: DEFAULT_USER_PROFILE,
  reminderSettings: {
    expiryRemindersEnabled: true,
    expiryLeadDays: DEFAULT_EXPIRY_LEAD_DAYS,
    lowStockDigestEnabled: true,
    reminderHour: 9
  }
};

export const CATEGORY_LABELS: Record<PantryCategory, string> = {
  produce: 'Produce',
  grains: 'Grains',
  masala: 'Masala',
  snacks: 'Snacks',
  other: 'Others',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  dairy: 'Dairy & Eggs',
  meat: 'Meat & Fish',
  frozen: 'Frozen',
  spices: 'Spices',
  pulses: 'Pulses',
  nuts: 'Nuts',
  bakery: 'Bakery',
  biscuits: 'Biscuits',
  sauces: 'Sauces',
  beverages: 'Beverages'
};

export const CATEGORY_FILTER_ORDER: readonly PantryCategory[] = [
  'vegetables',
  'fruits',
  'dairy',
  'meat',
  'frozen',
  'spices',
  'pulses',
  'nuts',
  'bakery',
  'biscuits',
  'snacks',
  'sauces',
  'beverages',
  'other'
];

export const CATEGORY_FILTER_OPTIONS: ReadonlyArray<{
  readonly value: PantryCategory;
  readonly label: string;
}> = CATEGORY_FILTER_ORDER.map((value) => ({
  value,
  label: CATEGORY_LABELS[value]
}));
