import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideIonicAngular } from '@ionic/angular/standalone';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../../testing/ionic-standalone.stubs'),
);

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { AppSettings } from '../../settings/models/app-settings.model';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { HomePage } from './home.page';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

@Component({ standalone: true, template: '' })
class DummyProfilePage {}

@Component({ standalone: true, template: '' })
class DummyExpiryTrackerPage {}

@Component({ standalone: true, template: '' })
class DummyMealPlannerPage {}

const TEST_ROUTES: Routes = [
  { path: 'tabs/profile', component: DummyProfilePage },
  { path: 'tabs/expiry-tracker', component: DummyExpiryTrackerPage },
  { path: 'tabs/meal-planner', component: DummyMealPlannerPage },
];

function expiringInDays(days: number): string {
  return toLocalDateOnly(addDays(new Date(), days));
}

function createShoppingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop-1',
    name: 'Bread',
    quantity: 1,
    quantityOverridden: false,
    unit: 'count',
    linkedPantryItemId: null,
    source: 'manual',
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function findProductCard(
  fixture: ReturnType<typeof TestBed.createComponent>,
  name: string,
): HTMLElement {
  const card = Array.from(fixture.nativeElement.querySelectorAll('.product-card')).find((el) =>
    (el as HTMLElement).textContent?.includes(name),
  ) as HTMLElement | undefined;

  expect(card).toBeDefined();
  return card as HTMLElement;
}

describe('HomePage', () => {
  const settingsState = signal<AppSettings>(DEFAULT_APP_SETTINGS);
  const pantryItemsState = signal<any[]>([]);
  const shoppingItemsState = signal<any[]>([]);

  const pantryState = {
    totalCount: vi.fn<() => number>(),
    items: vi.fn(),
    getById: vi.fn(),
  };

  const shoppingState = {
    totalCount: vi.fn<() => number>(),
    activeItems: vi.fn(),
    save: vi.fn(),
    incrementQuantity: vi.fn(),
    decrementQuantity: vi.fn(),
  };

  beforeEach(async () => {
    settingsState.set(DEFAULT_APP_SETTINGS);
    pantryItemsState.set([]);
    shoppingItemsState.set([]);

    pantryState.totalCount.mockReset();
    pantryState.items.mockReset();
    pantryState.getById.mockReset();

    shoppingState.totalCount.mockReset();
    shoppingState.activeItems.mockReset();
    shoppingState.save.mockReset();
    shoppingState.incrementQuantity.mockReset();
    shoppingState.decrementQuantity.mockReset();

    pantryState.totalCount.mockImplementation(() => pantryItemsState().length);
    pantryState.items.mockImplementation(() => pantryItemsState());
    pantryState.getById.mockImplementation(
      (id: string) => pantryItemsState().find((item) => item.id === id) ?? null,
    );

    shoppingState.totalCount.mockImplementation(() => shoppingItemsState().length);
    shoppingState.activeItems.mockImplementation(() => shoppingItemsState());
    shoppingState.save.mockResolvedValue(undefined);
    shoppingState.incrementQuantity.mockResolvedValue(undefined);
    shoppingState.decrementQuantity.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter(TEST_ROUTES),
        {
          provide: PantryStateService,
          useValue: pantryState,
        },
        {
          provide: ShoppingListStateService,
          useValue: shoppingState,
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the brand header and the popular picks grid', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Grocery Hub');
    expect(textContent).toContain('Welcome back');
    expect(textContent).toContain('Popular Picks');
    expect(textContent).toContain('Milk');
    expect(textContent).toContain('Onion');
  });

  it('shows the Expiry Tracker shortcut with a default hint when nothing is dated', () => {
    pantryItemsState.set([{ id: 'rice', name: 'Rice', expiryDate: null }]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const shortcut = fixture.nativeElement.querySelector('a.expiry-shortcut') as HTMLAnchorElement;
    expect(shortcut.textContent).toContain('Expiry Tracker');
    expect(shortcut.textContent).toContain('Keep an eye on use-by dates');
    expect(shortcut.querySelector('.expiry-shortcut__count')).toBeNull();
  });

  it('summarises expiring and expired pantry items on the Expiry Tracker shortcut', () => {
    pantryItemsState.set([
      { id: 'milk', name: 'Milk', expiryDate: expiringInDays(-1) },
      { id: 'eggs', name: 'Eggs', expiryDate: expiringInDays(2) },
      { id: 'cheese', name: 'Cheese', expiryDate: expiringInDays(5) },
      { id: 'jam', name: 'Jam', expiryDate: expiringInDays(60) },
    ]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    // Default reminder lead time is 3 days: Cheese (5 days) is still fresh.
    const shortcut = fixture.nativeElement.querySelector('a.expiry-shortcut') as HTMLAnchorElement;
    expect(shortcut.querySelector('.expiry-shortcut__subtitle')?.textContent?.trim()).toBe(
      '1 expiring soon · 1 expired',
    );
    expect(shortcut.querySelector('.expiry-shortcut__count')?.textContent?.trim()).toBe('2');
  });

  it('uses the reminder lead time chosen in Account settings for the shortcut counts', () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      reminderSettings: { ...DEFAULT_APP_SETTINGS.reminderSettings, expiryLeadDays: 7 },
    });
    pantryItemsState.set([
      { id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) },
      { id: 'eggs', name: 'Eggs', quantity: 1, expiryDate: expiringInDays(2) },
      { id: 'cheese', name: 'Cheese', quantity: 1, expiryDate: expiringInDays(5) },
    ]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.expiry-shortcut__subtitle')?.textContent?.trim(),
    ).toBe('2 expiring soon · 1 expired');
  });

  it('opens the Expiry Tracker from the home shortcut', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('a.expiry-shortcut') as HTMLAnchorElement).click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tabs/expiry-tracker');
  });

  it('opens the Meal Planner from the home shortcut', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const shortcut = fixture.nativeElement.querySelector('a.planner-shortcut') as HTMLAnchorElement;
    expect(shortcut.querySelector('.planner-shortcut__title')?.textContent?.trim()).toBe('Meal Planner');

    shortcut.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tabs/meal-planner');
  });

  it('renders the saved profile name in the greeting', () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Test',
      },
    });

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome back, Test');
  });

  it('links the profile icon button directly to the profile details screen', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const profileButton = fixture.nativeElement.querySelector(
      'button[aria-label="Open profile"]',
    ) as HTMLButtonElement;
    profileButton.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tabs/profile');
  });

  it('opens popular pick detail with the current added quantity from home state', async () => {
    shoppingItemsState.set([createShoppingItem({ id: 'shop-milk', name: 'Milk', quantity: 3 })]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    findProductCard(fixture, 'Milk').click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/tabs/pantry/new'], {
      queryParams: expect.objectContaining({
        name: 'Milk',
        quantity: 3,
      }),
    });
  });

  it('filters the popular picks grid by category', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const bakeryPill = Array.from(fixture.nativeElement.querySelectorAll('.category-pill')).find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Bakery',
    ) as HTMLButtonElement;
    bakeryPill.click();
    fixture.detectChanges();

    const cardNames = Array.from(fixture.nativeElement.querySelectorAll('.product-card h4')).map(
      (el) => (el as HTMLElement).textContent,
    );

    expect(cardNames).toEqual(['Bread']);
  });

  it('filters the popular picks grid by search text', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    searchInput.value = 'toma';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const cardNames = Array.from(fixture.nativeElement.querySelectorAll('.product-card h4')).map(
      (el) => (el as HTMLElement).textContent,
    );

    expect(cardNames).toEqual(['Tomato']);
  });

  it('adds a new shopping list entry when a product with no existing entry is added', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const addButton = findProductCard(fixture, 'Onion').querySelector(
      '.add-btn',
    ) as HTMLButtonElement;
    addButton.click();
    await fixture.whenStable();

    expect(shoppingState.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Onion', quantity: 1, source: 'manual' }),
    );
    expect(shoppingState.incrementQuantity).not.toHaveBeenCalled();
  });

  it('increments the existing shopping list entry instead of adding a duplicate', async () => {
    shoppingItemsState.set([createShoppingItem({ id: 'shop-onion', name: 'Onion', quantity: 2 })]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const onionCard = findProductCard(fixture, 'Onion');
    expect(onionCard.textContent).toContain('Added: 2');

    const addButton = onionCard.querySelector('.add-btn') as HTMLButtonElement;
    addButton.click();
    await fixture.whenStable();

    expect(shoppingState.incrementQuantity).toHaveBeenCalledWith('shop-onion');
    expect(shoppingState.save).not.toHaveBeenCalled();
  });

  it('shows a remove button only once a product has been added and decrements on click', async () => {
    shoppingItemsState.set([createShoppingItem({ id: 'shop-onion', name: 'Onion', quantity: 1 })]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const onionCard = findProductCard(fixture, 'Onion');
    const removeButton = onionCard.querySelector('.remove-btn') as HTMLButtonElement;
    expect(removeButton).not.toBeNull();

    removeButton.click();
    await fixture.whenStable();

    expect(shoppingState.decrementQuantity).toHaveBeenCalledWith('shop-onion');
  });

  it('hides the remove button when a product has not been added yet', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const onionCard = findProductCard(fixture, 'Onion');
    expect(onionCard.querySelector('.remove-btn')).toBeNull();
  });

  describe('expiry warning', () => {
    function withLeadDays(expiryLeadDays: number): void {
      settingsState.set({
        ...DEFAULT_APP_SETTINGS,
        reminderSettings: { ...DEFAULT_APP_SETTINGS.reminderSettings, expiryLeadDays },
      });
    }

    function render() {
      const fixture = TestBed.createComponent(HomePage);
      fixture.detectChanges();
      return fixture;
    }

    function alertOf(fixture: ReturnType<typeof render>): HTMLAnchorElement | null {
      return fixture.nativeElement.querySelector('[data-testid="home-expiry-alert"]');
    }

    const text = (element: Element | null | undefined, selector: string) =>
      element?.querySelector(selector)?.textContent?.trim();

    it.each([
      ['the pantry is empty', []],
      ['everything is fresh', [{ id: 'jam', name: 'Jam', quantity: 1, expiryDate: expiringInDays(30) }]],
      ['nothing has a date', [{ id: 'rice', name: 'Rice', quantity: 1, expiryDate: null }]],
      ['the only expired item is used up', [{ id: 'milk', name: 'Milk', quantity: 0, expiryDate: expiringInDays(-2) }]],
    ])('is hidden when %s', (_case, items) => {
      pantryItemsState.set(items);

      expect(alertOf(render())).toBeNull();
    });

    it('shows how many items need attention, with a breakdown', () => {
      pantryItemsState.set([
        { id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) },
        { id: 'eggs', name: 'Eggs', quantity: 1, expiryDate: expiringInDays(0) },
        { id: 'cheese', name: 'Cheese', quantity: 1, expiryDate: expiringInDays(2) },
        { id: 'jam', name: 'Jam', quantity: 1, expiryDate: expiringInDays(30) },
      ]);

      const alert = alertOf(render());

      expect(text(alert, '.expiry-alert__title')).toBe('3 items need attention');
      expect(text(alert, '.expiry-alert__detail')).toBe('1 expired · 2 expiring within 3 days');
      expect(text(alert, '.expiry-alert__cta')).toBe('Review');
      expect(alert?.getAttribute('aria-label')).toBe(
        '3 items need attention: 1 expired · 2 expiring within 3 days. Open the Expiry Tracker',
      );
    });

    it('is red when something has expired and amber when items are only expiring', () => {
      pantryItemsState.set([{ id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) }]);
      expect(alertOf(render())?.classList).toContain('expiry-alert--danger');

      pantryItemsState.set([{ id: 'eggs', name: 'Eggs', quantity: 1, expiryDate: expiringInDays(1) }]);
      const amber = alertOf(render());
      expect(amber?.classList).not.toContain('expiry-alert--danger');
      expect(text(amber, '.expiry-alert__title')).toBe('1 item needs attention');
      expect(text(amber, '.expiry-alert__detail')).toBe('1 expiring within 3 days');
    });

    it('uses the reminder lead time and updates as soon as it changes', () => {
      pantryItemsState.set([
        { id: 'eggs', name: 'Eggs', quantity: 1, expiryDate: expiringInDays(1) },
        { id: 'cheese', name: 'Cheese', quantity: 1, expiryDate: expiringInDays(5) },
      ]);
      withLeadDays(1);
      const fixture = render();
      expect(text(alertOf(fixture), '.expiry-alert__detail')).toBe('1 expiring within 1 day');

      withLeadDays(7);
      fixture.detectChanges();

      expect(text(alertOf(fixture), '.expiry-alert__title')).toBe('2 items need attention');
      expect(text(alertOf(fixture), '.expiry-alert__detail')).toBe('2 expiring within 7 days');
    });

    it('disappears once nothing needs attention any more', () => {
      pantryItemsState.set([{ id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) }]);
      const fixture = render();
      expect(alertOf(fixture)).not.toBeNull();

      pantryItemsState.set([{ id: 'milk', name: 'Milk', quantity: 0, expiryDate: expiringInDays(-1) }]);
      fixture.detectChanges();

      expect(alertOf(fixture)).toBeNull();
    });

    it('opens the Expiry Tracker', async () => {
      pantryItemsState.set([{ id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) }]);
      const fixture = render();

      alertOf(fixture)!.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/tabs/expiry-tracker');
    });

    it('sits near the top, before the search box', () => {
      pantryItemsState.set([{ id: 'milk', name: 'Milk', quantity: 1, expiryDate: expiringInDays(-1) }]);
      const fixture = render();
      const alert = alertOf(fixture)!;
      const search = fixture.nativeElement.querySelector('.search-wrap') as HTMLElement;

      expect(alert.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('re-checks the date when Home is shown again', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const now = new Date();
        vi.setSystemTime(now);
        // Fresh today (4 days out with a 3-day lead time)...
        pantryItemsState.set([{ id: 'cheese', name: 'Cheese', quantity: 1, expiryDate: expiringInDays(4) }]);
        const fixture = render();
        expect(alertOf(fixture)).toBeNull();

        // ...but two days later, with the app left open, it's expiring.
        vi.setSystemTime(new Date(now.getTime() + 2 * 86_400_000));
        fixture.componentInstance.ionViewWillEnter();
        fixture.detectChanges();

        expect(text(alertOf(fixture), '.expiry-alert__detail')).toBe('1 expiring within 3 days');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

