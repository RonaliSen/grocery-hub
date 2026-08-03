import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { DEFAULT_USER_PROFILE } from '../models/profile.model';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const storage = {
    get: vi.fn(),
    set: vi.fn()
  };

  beforeEach(() => {
    storage.get.mockReset();
    storage.set.mockReset();

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        {
          provide: StorageService,
          useValue: storage
        }
      ]
    });
  });

  it('migrates legacy low-stock digest hour values into the shared reminder hour', async () => {
    storage.get.mockResolvedValue({
      notificationsEnabled: false,
      reminderSettings: {
        expiryRemindersEnabled: false,
        expiryLeadDays: 5,
        lowStockDigestEnabled: true,
        lowStockDigestHour: 14
      }
    });

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.appSettings, DEFAULT_APP_SETTINGS);
    expect(service.settings()).toEqual({
      ...DEFAULT_APP_SETTINGS,
      notificationsEnabled: false,
      profile: DEFAULT_USER_PROFILE,
      reminderSettings: {
        expiryRemindersEnabled: false,
        expiryLeadDays: 5,
        lowStockDigestEnabled: true,
        reminderHour: 14
      }
    });
  });

  it('persists profile updates through the shared settings store', async () => {
    storage.get.mockResolvedValue(DEFAULT_APP_SETTINGS);
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(SettingsService);
    await service.load();

    await service.update({
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Samdarshi',
        email: 'samdarshi@example.com'
      }
    });

    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.appSettings, {
      ...DEFAULT_APP_SETTINGS,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Samdarshi',
        email: 'samdarshi@example.com'
      }
    });
    expect(service.settings().profile.fullName).toBe('Samdarshi');
  });

  it('keeps unsupported email alerts disabled when loading and saving settings', async () => {
    storage.get.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      emailAlertsEnabled: true
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().emailAlertsEnabled).toBe(false);

    await service.update({
      emailAlertsEnabled: true
    });

    expect(storage.set).toHaveBeenLastCalledWith(STORAGE_KEYS.appSettings, {
      ...DEFAULT_APP_SETTINGS,
      emailAlertsEnabled: false
    });
  });

  it('normalizes the legacy default low-stock threshold to 1 when loading settings', async () => {
    storage.get.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      defaultLowStockThreshold: 2
    });

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().defaultLowStockThreshold).toBe(1);
  });
});
