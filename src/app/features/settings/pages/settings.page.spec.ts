// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NotificationsService } from '../../../core/services/notifications.service';
import { AppSettings } from '../models/app-settings.model';
import { SettingsService } from '../services/settings.service';
import { SettingsPage } from './settings.page';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized.
}

describe('SettingsPage', () => {
  const settingsState = signal<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
    notificationsEnabled: false,
    emailAlertsEnabled: false,
    defaultLowStockThreshold: 1,
    defaultAutoAddToShoppingList: true,
    reminderSettings: {
      ...DEFAULT_APP_SETTINGS.reminderSettings,
      reminderHour: 8
    }
  });
  const settingsService = {
    settings: settingsState,
    save: vi.fn(async (settings: AppSettings) => settingsState.set(settings))
  };
  const notificationsService = {
    ensurePermissions: vi.fn()
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      notificationsEnabled: false,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        reminderHour: 8
      }
    });
    settingsService.save.mockClear();
    notificationsService.ensurePermissions.mockReset();
    notificationsService.ensurePermissions.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        {
          provide: SettingsService,
          useValue: settingsService
        },
        {
          provide: NotificationsService,
          useValue: notificationsService
        }
      ]
    }).compileComponents();
  });

  it('renders account screen content', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Settings');
    expect(textContent).toContain('Notifications');
    expect(textContent).toContain('Personal Info');
    expect(textContent).toContain('Name');
    expect(textContent).toContain('Age');
    expect(textContent).toContain('Email Address');
    expect(textContent).toContain('Household Size');
    expect(textContent).toContain('Expiry Reminder');
    expect(component.settings()).toEqual({
      ...DEFAULT_APP_SETTINGS,
      notificationsEnabled: false,
      emailAlertsEnabled: false,
      defaultLowStockThreshold: 1,
      defaultAutoAddToShoppingList: true,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        reminderHour: 8
      }
    });
  });

  it('requests permission and saves settings when enabling notifications', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    await component.toggleNotifications();

    expect(notificationsService.ensurePermissions).toHaveBeenCalledTimes(1);
    expect(settingsService.save).toHaveBeenCalledWith({
      ...DEFAULT_APP_SETTINGS,
      notificationsEnabled: true,
      emailAlertsEnabled: false,
      defaultLowStockThreshold: 1,
      defaultAutoAddToShoppingList: true,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        reminderHour: 8
      }
    });
  });

  it('does not save notification settings when permission is denied', async () => {
    notificationsService.ensurePermissions.mockResolvedValue(false);

    const fixture = TestBed.createComponent(SettingsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    await component.toggleNotifications();

    expect(notificationsService.ensurePermissions).toHaveBeenCalledTimes(1);
    expect(settingsService.save).not.toHaveBeenCalled();
  });

  it('persists reminder setting changes immediately', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    await component.toggleExpiryReminder();
    expect(settingsService.save).toHaveBeenCalledWith({
      ...DEFAULT_APP_SETTINGS,
      notificationsEnabled: false,
      emailAlertsEnabled: false,
      defaultLowStockThreshold: 1,
      defaultAutoAddToShoppingList: true,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        expiryRemindersEnabled: false,
        reminderHour: 8
      }
    });
  });
});
