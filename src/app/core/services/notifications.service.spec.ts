// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn()
  }
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    cancel: vi.fn(),
    schedule: vi.fn()
  }
}));

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { STORAGE_KEYS } from '../constants/storage-keys';
import { StorageService } from './storage.service';
import { NotificationsService } from './notifications.service';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized.
}

describe('NotificationsService', () => {
  const browserNotifications = vi.fn();
  const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
  const storage = {
    get: vi.fn(),
    set: vi.fn()
  };

  class MockNotification {
    static permission: NotificationPermission = 'default';
    static requestPermission = requestPermission;

    constructor(title: string, options?: NotificationOptions) {
      browserNotifications(title, options);
    }
  }

  beforeEach(() => {
    vi.stubGlobal('Notification', MockNotification);
    vi.mocked(Capacitor.isNativePlatform).mockReset();
    vi.mocked(LocalNotifications.checkPermissions).mockReset();
    vi.mocked(LocalNotifications.requestPermissions).mockReset();
    vi.mocked(LocalNotifications.cancel).mockReset();
    vi.mocked(LocalNotifications.schedule).mockReset();
    browserNotifications.mockReset();
    requestPermission.mockReset();
    storage.get.mockReset();
    storage.set.mockReset();
    storage.get.mockResolvedValue([]);
    storage.set.mockResolvedValue(undefined);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' });
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' });
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined as never);
    vi.mocked(LocalNotifications.schedule).mockResolvedValue(undefined as never);
    MockNotification.permission = 'default';
    requestPermission.mockResolvedValue('granted');

    TestBed.configureTestingModule({
      providers: [
        NotificationsService,
        {
          provide: StorageService,
          useValue: storage
        }
      ]
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('cancels only previously owned reminder ids and stores the replacement ids', async () => {
    storage.get.mockResolvedValue([11, 22]);

    const service = TestBed.inject(NotificationsService);
    await service.replaceScheduledReminders([
      {
        id: 33,
        title: 'Milk expires soon',
        body: 'Use it',
        schedule: {
          at: new Date('2026-03-16T09:00:00')
        }
      }
    ]);

    expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.reminderNotificationIds, []);
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 11 }, { id: 22 }]
    });
    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 33,
          title: 'Milk expires soon',
          body: 'Use it',
          schedule: {
            at: new Date('2026-03-16T09:00:00')
          }
        }
      ]
    });
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.reminderNotificationIds, [33]);
  });

  it('uses browser notifications when local notifications are unsupported', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    MockNotification.permission = 'granted';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T08:59:59'));

    const service = TestBed.inject(NotificationsService);
    await service.replaceScheduledReminders([
      {
        id: 44,
        title: 'Digest',
        body: 'Apples',
        schedule: {
          at: new Date('2026-03-16T09:00:00')
        }
      }
    ]);

    expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.reminderNotificationIds, [44]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(browserNotifications).toHaveBeenCalledWith('Digest', {
      body: 'Apples'
    });
    vi.useRealTimers();
  });

  it('returns false when browser permissions are denied', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    MockNotification.permission = 'denied';

    const service = TestBed.inject(NotificationsService);

    await expect(service.ensurePermissions()).resolves.toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
