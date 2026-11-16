import { computed, inject, Injectable, signal } from '@angular/core';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { normalizeExpiryLeadDays, ReminderSettings } from '../../reminders/models/reminder-settings.model';
import { AppSettings, ThemePreference } from '../models/app-settings.model';
import { UserProfile } from '../models/profile.model';

type StoredReminderSettings = Partial<ReminderSettings> & {
  readonly lowStockDigestHour?: number;
};

type StoredAppSettings = Partial<AppSettings> & {
  readonly profile?: Partial<UserProfile>;
  readonly reminderSettings?: StoredReminderSettings;
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly storage = inject(StorageService);
  private readonly settingsState = signal<AppSettings>(DEFAULT_APP_SETTINGS);

  readonly settings = computed(() => this.settingsState());

  async load(): Promise<void> {
    const storedValue = await this.storage.get<StoredAppSettings>(STORAGE_KEYS.appSettings, DEFAULT_APP_SETTINGS);
    const storedReminderSettings: StoredReminderSettings = storedValue.reminderSettings ?? {};
    const { lowStockDigestHour: _legacyLowStockDigestHour, ...nextReminderSettings } =
      storedReminderSettings;
    const normalizedLowStockThreshold = this.normalizeDefaultLowStockThreshold(
      storedValue.defaultLowStockThreshold
    );

    this.settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      ...storedValue,
      themePreference: this.normalizeThemePreference(storedValue.themePreference),
      defaultLowStockThreshold: normalizedLowStockThreshold,
      emailAlertsEnabled: false,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        ...storedValue.profile
      },
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        ...nextReminderSettings,
        expiryLeadDays: normalizeExpiryLeadDays(nextReminderSettings.expiryLeadDays),
        reminderHour:
          storedReminderSettings.reminderHour ??
          storedReminderSettings.lowStockDigestHour ??
          DEFAULT_APP_SETTINGS.reminderSettings.reminderHour
      }
    });
  }

  async save(settings: AppSettings): Promise<void> {
    const nextSettings: AppSettings = {
      ...settings,
      themePreference: this.normalizeThemePreference(settings.themePreference),
      emailAlertsEnabled: false
    };

    await this.storage.set(STORAGE_KEYS.appSettings, nextSettings);
    this.settingsState.set(nextSettings);
  }

  async update(partial: Partial<AppSettings>): Promise<void> {
    await this.save({
      ...this.settingsState(),
      ...partial
    });
  }

  async updateReminderSettings(partial: Partial<ReminderSettings>): Promise<void> {
    await this.save({
      ...this.settingsState(),
      reminderSettings: {
        ...this.settingsState().reminderSettings,
        ...partial
      }
    });
  }

  async reset(): Promise<void> {
    await this.save(DEFAULT_APP_SETTINGS);
  }

  private normalizeDefaultLowStockThreshold(threshold: number | undefined): number {
    if (threshold === undefined) {
      return DEFAULT_APP_SETTINGS.defaultLowStockThreshold;
    }

    // Older builds seeded persisted settings with 2. Treat that as the legacy default.
    if (threshold === 2) {
      return DEFAULT_APP_SETTINGS.defaultLowStockThreshold;
    }

    return threshold;
  }

  private normalizeThemePreference(value: ThemePreference | undefined): ThemePreference {
    return value === 'dark' || value === 'light' || value === 'system' ? value : 'system';
  }
}
