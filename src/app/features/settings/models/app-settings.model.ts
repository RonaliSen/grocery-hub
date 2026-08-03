import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { ReminderSettings } from '../../reminders/models/reminder-settings.model';
import { UserProfile } from './profile.model';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  readonly notificationsEnabled: boolean;
  readonly emailAlertsEnabled: boolean;
  readonly themePreference: ThemePreference;
  readonly defaultCategory: PantryCategory | null;
  readonly defaultLowStockThreshold: number;
  readonly defaultAutoAddToShoppingList: boolean;
  readonly reminderSettings: ReminderSettings;
  readonly profile: UserProfile;
}
