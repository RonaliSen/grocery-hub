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
    set: vi.fn(),
  };

  beforeEach(() => {
    storage.get.mockReset();
    storage.set.mockReset();

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        {
          provide: StorageService,
          useValue: storage,
        },
      ],
    });
  });

  it('migrates legacy low-stock digest hour values into the shared reminder hour', async () => {
    storage.get.mockResolvedValue({
      notificationsEnabled: false,
      reminderSettings: {
        expiryRemindersEnabled: false,
        expiryLeadDays: 5,
        lowStockDigestEnabled: true,
        lowStockDigestHour: 14,
      },
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
        // Lead time is limited to 1, 3 or 7 days: a stored 5 maps to the nearest (7).
        expiryLeadDays: 7,
        lowStockDigestEnabled: true,
        reminderHour: 14,
      },
    });
  });

  it('keeps the chosen expiry reminder lead time across restarts', async () => {
    storage.get.mockResolvedValue(DEFAULT_APP_SETTINGS);
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(SettingsService);
    await service.load();
    await service.updateReminderSettings({ expiryLeadDays: 7 });

    expect(storage.set).toHaveBeenCalledWith(
      STORAGE_KEYS.appSettings,
      expect.objectContaining({
        reminderSettings: expect.objectContaining({ expiryLeadDays: 7 }),
      }),
    );

    // A fresh app start reads back what was saved.
    const saved = storage.set.mock.calls.at(-1)?.[1];
    storage.get.mockResolvedValue(saved);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: StorageService, useValue: storage }],
    });
    const restarted = TestBed.inject(SettingsService);
    await restarted.load();

    expect(restarted.settings().reminderSettings.expiryLeadDays).toBe(7);
  });

  it('defaults the expiry reminder lead time to 3 days', async () => {
    storage.get.mockResolvedValue({ reminderSettings: { reminderHour: 9 } });

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().reminderSettings.expiryLeadDays).toBe(3);
  });

  it.each([
    [1, 1],
    [3, 3],
    [7, 7],
    [2, 3],
    [5, 7],
    [14, 7],
    [0, 3],
    [-2, 3],
    ['7', 3],
    [null, 3],
  ])('maps a stored lead time of %s to %s days', async (stored, expected) => {
    storage.get.mockResolvedValue({ reminderSettings: { expiryLeadDays: stored } });

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().reminderSettings.expiryLeadDays).toBe(expected);
  });

  it('persists profile updates through the shared settings store', async () => {
    storage.get.mockResolvedValue(DEFAULT_APP_SETTINGS);
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(SettingsService);
    await service.load();

    await service.update({
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Test',
        email: 'test@example.com',
      },
    });

    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.appSettings, {
      ...DEFAULT_APP_SETTINGS,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Test',
        email: 'test@example.com',
      },
    });
    expect(service.settings().profile.fullName).toBe('Test');
  });

  it('keeps unsupported email alerts disabled when loading and saving settings', async () => {
    storage.get.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      emailAlertsEnabled: true,
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().emailAlertsEnabled).toBe(false);

    await service.update({
      emailAlertsEnabled: true,
    });

    expect(storage.set).toHaveBeenLastCalledWith(STORAGE_KEYS.appSettings, {
      ...DEFAULT_APP_SETTINGS,
      emailAlertsEnabled: false,
    });
  });

  it('normalizes the legacy default low-stock threshold to 1 when loading settings', async () => {
    storage.get.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      defaultLowStockThreshold: 2,
    });

    const service = TestBed.inject(SettingsService);
    await service.load();

    expect(service.settings().defaultLowStockThreshold).toBe(1);
  });
});
