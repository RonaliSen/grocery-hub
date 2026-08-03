import '@angular/compiler';
import { vi } from 'vitest';
import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { NavigationHistoryService } from './navigation-history.service';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

@Component({
  standalone: true,
  template: ''
})
class DummyPage {}

const TEST_ROUTES: Routes = [
  {
    path: 'tabs',
    children: [
      { path: 'home', component: DummyPage },
      { path: 'pantry', component: DummyPage },
      { path: 'expenses', component: DummyPage }
    ]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tabs/home'
  }
];

describe('NavigationHistoryService', () => {
  const location = {
    back: vi.fn()
  };

  beforeEach(async () => {
    location.back.mockReset();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(TEST_ROUTES),
        NavigationHistoryService,
        {
          provide: Location,
          useValue: location
        }
      ]
    }).compileComponents();
  });

  it('tracks pushed routes in visit order', async () => {
    const router = TestBed.inject(Router);
    const service = TestBed.inject(NavigationHistoryService);

    await router.navigateByUrl('/tabs/home');
    await router.navigateByUrl('/tabs/pantry');
    await router.navigateByUrl('/tabs/expenses');

    expect(service.history()).toEqual(['/tabs/home', '/tabs/pantry', '/tabs/expenses']);
    expect(service.canGoBack()).toBe(true);
  });

  it('replaces the current entry when navigation uses replaceUrl', async () => {
    const router = TestBed.inject(Router);
    const service = TestBed.inject(NavigationHistoryService);

    await router.navigateByUrl('/tabs/home');
    await router.navigateByUrl('/tabs/pantry', { replaceUrl: true });

    expect(service.history()).toEqual(['/tabs/pantry']);
    expect(service.canGoBack()).toBe(false);
  });

  it('delegates back navigation to Location when there is in-app history', async () => {
    const router = TestBed.inject(Router);
    const service = TestBed.inject(NavigationHistoryService);

    await router.navigateByUrl('/tabs/home');
    await router.navigateByUrl('/tabs/pantry');

    await service.back('/tabs/home');

    expect(location.back).toHaveBeenCalledOnce();
  });
});
