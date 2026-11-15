import '@angular/compiler';
import { vi } from 'vitest';
import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
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
  let locationBackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(TEST_ROUTES), provideLocationMocks(), NavigationHistoryService]
    }).compileComponents();

    locationBackSpy = vi
      .spyOn(TestBed.inject(Location) as SpyLocation, 'back')
      .mockImplementation(() => {});
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

    expect(locationBackSpy).toHaveBeenCalledOnce();
  });

  describe('backTo', () => {
    it('jumps back to the most recent entry for the path, ignoring its query string', async () => {
      const router = TestBed.inject(Router);
      const service = TestBed.inject(NavigationHistoryService);
      const historyGoSpy = vi.spyOn(TestBed.inject(Location), 'historyGo').mockImplementation(() => {});

      await router.navigateByUrl('/tabs/pantry');
      await router.navigateByUrl('/tabs/home');
      await router.navigateByUrl('/tabs/pantry?filter=expiring');
      await router.navigateByUrl('/tabs/expenses');
      await router.navigateByUrl('/tabs/home');

      await service.backTo('/tabs/pantry');

      expect(historyGoSpy).toHaveBeenCalledWith(-2);
    });

    it('navigates and replaces the current entry when the path is not in history', async () => {
      const router = TestBed.inject(Router);
      const service = TestBed.inject(NavigationHistoryService);
      const historyGoSpy = vi.spyOn(TestBed.inject(Location), 'historyGo');

      await router.navigateByUrl('/tabs/home');
      await router.navigateByUrl('/tabs/expenses');

      await service.backTo('/tabs/pantry');

      expect(historyGoSpy).not.toHaveBeenCalled();
      expect(router.url).toBe('/tabs/pantry');
      expect(service.history()).toEqual(['/tabs/home', '/tabs/pantry']);
    });

    it('does not treat the current entry as a previous one', async () => {
      const router = TestBed.inject(Router);
      const service = TestBed.inject(NavigationHistoryService);
      const historyGoSpy = vi.spyOn(TestBed.inject(Location), 'historyGo');

      await router.navigateByUrl('/tabs/pantry');

      await service.backTo('/tabs/pantry');

      expect(historyGoSpy).not.toHaveBeenCalled();
      expect(service.history()).toEqual(['/tabs/pantry']);
    });
  });
});
