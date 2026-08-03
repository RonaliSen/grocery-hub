import { vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { Router } from '@angular/router';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { AppSettings } from '../../settings/models/app-settings.model';
import { SettingsService } from '../../settings/services/settings.service';
import { ProfileDetailsPage } from './profile-details.page';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

describe('ProfileDetailsPage', () => {
  const settingsState = signal<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
    profile: {
      ...DEFAULT_APP_SETTINGS.profile,
      fullName: 'Ronali',
      email: 'ronali@example.com',
      householdSize: 2
    }
  });
  const settingsService = {
    settings: settingsState,
    update: vi.fn(async (partial: Partial<AppSettings>) => {
      settingsState.set({
        ...settingsState(),
        ...partial
      });
    })
  };
  const router = {
    navigateByUrl: vi.fn()
  };
  const navigationHistory = {
    back: vi.fn()
  };

  beforeEach(async () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Ronali',
        email: 'ronali@example.com',
        householdSize: 2
      }
    });
    settingsService.update.mockClear();
    router.navigateByUrl.mockReset();
    router.navigateByUrl.mockResolvedValue(true);
    navigationHistory.back.mockReset();
    navigationHistory.back.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ProfileDetailsPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        {
          provide: SettingsService,
          useValue: settingsService
        },
        {
          provide: Router,
          useValue: router
        },
        {
          provide: NavigationHistoryService,
          useValue: navigationHistory
        }
      ]
    }).compileComponents();
  });

  it('prefills the profile form with saved values', () => {
    const fixture = TestBed.createComponent(ProfileDetailsPage);
    fixture.detectChanges();

    const component = fixture.componentInstance as any;

    expect(component.form.getRawValue()).toEqual({
      fullName: 'Ronali',
      age: null,
      email: 'ronali@example.com',
      householdSize: 2,
      preferredShoppingFrequency: 'weekly',
      defaultUnitPreference: 'mixed'
    });
  });

  it('saves the profile and returns through navigation history', async () => {
    const fixture = TestBed.createComponent(ProfileDetailsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.setValue({
      fullName: 'Samdarshi',
      age: 30,
      email: 'samdarshi@example.com',
      householdSize: 3,
      preferredShoppingFrequency: 'biweekly',
      defaultUnitPreference: 'metric'
    });

    await component.save();

    expect(settingsService.update).toHaveBeenCalledWith({
      profile: {
        fullName: 'Samdarshi',
        age: 30,
        email: 'samdarshi@example.com',
        householdSize: 3,
        photoDataUrl: null,
        preferredShoppingFrequency: 'biweekly',
        defaultUnitPreference: 'metric'
      }
    });
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/home');
  });

  it('shows validation errors for invalid required fields', async () => {
    const fixture = TestBed.createComponent(ProfileDetailsPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.controls.fullName.setValue('   ');
    component.form.controls.email.setValue('invalid-email');

    await component.save();

    expect(component.form.invalid).toBe(true);
    expect(component.errorMessage('fullName')).toBe('Name is required.');
    expect(component.errorMessage('email')).toBe('Enter a valid email address.');
    expect(settingsService.update).not.toHaveBeenCalled();
  });
});
