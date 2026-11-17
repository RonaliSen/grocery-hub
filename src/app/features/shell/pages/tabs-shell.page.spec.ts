import { vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../../testing/ionic-standalone.stubs')
);
// @ts-ignore Spec-only lightweight module mock for the Platform DI token.
vi.mock(import('@ionic/angular'), () => ({
  Platform: class Platform {}
}) as any);

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { Platform } from '@ionic/angular';
import { AlertController, provideIonicAngular } from '@ionic/angular/standalone';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { TabsShellPage } from './tabs-shell.page';

@Component({
  standalone: true,
  template: ''
})
class DummyPage {}

const TEST_ROUTES: Routes = [
  {
    path: 'tabs',
    children: [
      {
        path: 'home',
        component: DummyPage
      },
      {
        path: 'pantry',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: DummyPage
          },
          {
            path: 'new',
            component: DummyPage
          },
          {
            path: ':itemId/edit',
            component: DummyPage
          }
        ]
      },
      {
        path: 'shopping-list',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: DummyPage
          },
          {
            path: 'new',
            component: DummyPage
          },
          {
            path: ':itemId/edit',
            component: DummyPage
          }
        ]
      },
      {
        path: 'expenses',
        component: DummyPage
      },
      {
        path: 'settings',
        component: DummyPage
      },
      {
        path: 'profile',
        component: DummyPage
      },
      {
        path: 'meal-planner',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: DummyPage
          },
          {
            path: ':date',
            component: DummyPage
          },
          {
            path: ':date/meals/:mealId',
            component: DummyPage
          }
        ]
      }
    ]
  }
];

describe('TabsShellPage', () => {
  let backButtonHandler: ((processNextHandler: () => void) => Promise<void> | void) | undefined;
  let mockPlatform: Pick<Platform, 'backButton' | 'is'>;
  const navigationHistory = {
    back: vi.fn(),
    canGoBack: vi.fn(() => false),
    isCurrentRouteRootScreen: vi.fn(() => false)
  };
  const alert = {
    present: vi.fn()
  };
  const alertController = {
    create: vi.fn(async (_options: Record<string, unknown>) => alert)
  };

  beforeEach(async () => {
    backButtonHandler = undefined;
    navigationHistory.canGoBack.mockReset();
    navigationHistory.canGoBack.mockReturnValue(false);
    navigationHistory.isCurrentRouteRootScreen.mockReset();
    navigationHistory.isCurrentRouteRootScreen.mockReturnValue(false);
    navigationHistory.back.mockReset();
    navigationHistory.back.mockResolvedValue(true);
    alert.present.mockReset();
    alertController.create.mockReset();
    alertController.create.mockResolvedValue(alert);
    mockPlatform = {
      backButton: {
        subscribeWithPriority: vi.fn(
          (_priority: number, callback: (processNextHandler: () => void) => Promise<void> | void) => {
            backButtonHandler = callback;
            return { unsubscribe: vi.fn() };
          }
        )
      } as unknown as Platform['backButton'],
      is: vi.fn((platformName: string) => platformName === 'android')
    };

    await TestBed.configureTestingModule({
      imports: [TabsShellPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter(TEST_ROUTES),
        { provide: Platform, useValue: mockPlatform },
        { provide: NavigationHistoryService, useValue: navigationHistory },
        { provide: AlertController, useValue: alertController }
      ]
    }).compileComponents();
  });

  it('renders the five-tab navigation', () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    fixture.detectChanges();

    const tabButtons = Array.from(
      fixture.nativeElement.querySelectorAll('ion-tab-button')
    ) as HTMLElement[];

    expect(tabButtons.length).toBe(5);
    expect(tabButtons.map((tab) => tab.getAttribute('href'))).toEqual([
      '/tabs/home',
      '/tabs/pantry',
      '/tabs/shopping-list',
      '/tabs/expenses',
      '/tabs/settings'
    ]);
    expect(tabButtons.map((tab) => tab.getAttribute('tab'))).toEqual([
      'home',
      'pantry',
      'shopping-list',
      'expenses',
      'settings'
    ]);
    expect(tabButtons.map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Home',
      'Pantry',
      'Cart',
      'Expenses',
      'Account'
    ]);
  });

  it('keeps the selected tab aligned with the visible tab route', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/home');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('home');
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBe(
      'home'
    );
    expect(selectedTabs(fixture)).toEqual(['home']);

    await router.navigateByUrl('/tabs/pantry/new');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('pantry');
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBe(
      'pantry'
    );
    expect(selectedTabs(fixture)).toEqual(['pantry']);

    await router.navigateByUrl('/tabs/shopping-list/new');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('shopping-list');
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBe(
      'shopping-list'
    );
    expect(selectedTabs(fixture)).toEqual(['shopping-list']);

    await router.navigateByUrl('/tabs/settings');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('settings');
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBe(
      'settings'
    );
    expect(selectedTabs(fixture)).toEqual(['settings']);
  });

  it('resets the selected tab back to Home when navigation returns to Home', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/pantry');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('pantry');

    await router.navigateByUrl('/tabs/home');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('home');
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBe(
      'home'
    );
    expect(selectedTabs(fixture)).toEqual(['home']);
  });

  it('clears all tab highlights for non-tab child screens', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/profile');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBeNull();
    expect(fixture.nativeElement.querySelector('ion-tab-bar')?.getAttribute('selected-tab')).toBeNull();
    expect(selectedTabs(fixture)).toEqual([]);
  });

  it.each(['/tabs/home', '/tabs/pantry', '/tabs/shopping-list', '/tabs/expenses', '/tabs/settings'])(
    'shows the exit confirmation on Android root screen %s when there is no previous history',
    async (url) => {
      const fixture = TestBed.createComponent(TabsShellPage);
      const router = TestBed.inject(Router);

      fixture.detectChanges();

      await router.navigateByUrl(url);
      await fixture.whenStable();
      fixture.detectChanges();

      navigationHistory.isCurrentRouteRootScreen.mockReturnValue(true);
      navigationHistory.canGoBack.mockReturnValue(false);
      expect(backButtonHandler).toBeTypeOf('function');

      const processNextHandler = vi.fn();
      await backButtonHandler?.(processNextHandler);
      await fixture.whenStable();

      expect(alertController.create).toHaveBeenCalledOnce();
      expect(alert.present).toHaveBeenCalledOnce();
      expect(processNextHandler).not.toHaveBeenCalled();
    }
  );

  it('falls through to the default back handler when there is stack history to unwind', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/pantry/new');
    await fixture.whenStable();
    fixture.detectChanges();

    navigationHistory.isCurrentRouteRootScreen.mockReturnValue(true);
    navigationHistory.canGoBack.mockReturnValue(true);
    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(processNextHandler).toHaveBeenCalledOnce();
    expect(router.url).toBe('/tabs/pantry/new');
    expect(selectedTabs(fixture)).toEqual(['pantry']);
  });

  it('navigates to the section fallback when a non-root route has no prior history', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/pantry/new');
    await fixture.whenStable();

    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(processNextHandler).not.toHaveBeenCalled();
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/pantry');
    expect(alertController.create).not.toHaveBeenCalled();
  });

  it('falls back to Account for profile routes without in-app history', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/profile');
    await fixture.whenStable();

    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(processNextHandler).not.toHaveBeenCalled();
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/settings');
    expect(alertController.create).not.toHaveBeenCalled();
  });

  it('falls back to the weekly plan for a Meal Planner day without in-app history', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/meal-planner/2026-11-20');
    await fixture.whenStable();

    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(processNextHandler).not.toHaveBeenCalled();
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/meal-planner');
    expect(selectedTabs(fixture)).toEqual([]);
  });

  it("falls back to the meal's day for a Meal Planner meal without in-app history", async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/meal-planner/2026-11-20/meals/meal-1');
    await fixture.whenStable();

    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(processNextHandler).not.toHaveBeenCalled();
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/meal-planner/2026-11-20');
  });

  it('falls back to Home for the Meal Planner week without in-app history', async () => {
    const fixture = TestBed.createComponent(TabsShellPage);
    const router = TestBed.inject(Router);

    fixture.detectChanges();

    await router.navigateByUrl('/tabs/meal-planner');
    await fixture.whenStable();

    const processNextHandler = vi.fn();
    await backButtonHandler?.(processNextHandler);

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/home');
  });
});

function selectedTabs(fixture: { nativeElement: HTMLElement }): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('ion-tab-button[selected]')).map(
    (tab) => tab.getAttribute('tab') ?? ''
  );
}
