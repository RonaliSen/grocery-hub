import { vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { signal } from '@angular/core';

import { App } from './app';
import { SettingsService } from './features/settings/services/settings.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        {
          provide: SettingsService,
          useValue: {
            settings: signal({
              themePreference: 'system'
            })
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(fixture.nativeElement.querySelector('ion-router-outlet')).toBeTruthy();
  });
});
