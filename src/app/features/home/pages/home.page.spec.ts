import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideIonicAngular } from '@ionic/angular/standalone';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../../testing/ionic-standalone.stubs')
);

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
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

const TEST_ROUTES: Routes = [{ path: 'tabs/profile', component: DummyProfilePage }];

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
    ...overrides
  };
}

function findProductCard(fixture: ReturnType<typeof TestBed.createComponent>, name: string): HTMLElement {
  const card = Array.from(fixture.nativeElement.querySelectorAll('.product-card')).find((el) =>
    (el as HTMLElement).textContent?.includes(name)
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
    getById: vi.fn()
  };

  const shoppingState = {
    totalCount: vi.fn<() => number>(),
    activeItems: vi.fn(),
    save: vi.fn(),
    incrementQuantity: vi.fn(),
    decrementQuantity: vi.fn()
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
    pantryState.getById.mockImplementation((id: string) => pantryItemsState().find((item) => item.id === id) ?? null);

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
          useValue: pantryState
        },
        {
          provide: ShoppingListStateService,
          useValue: shoppingState
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState
          }
        }
      ]
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

  it('renders the saved profile name in the greeting', () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      profile: {
        ...DEFAULT_APP_SETTINGS.profile,
        fullName: 'Samdarshi'
      }
    });

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome back, Samdarshi');
  });

  it('links the profile icon button directly to the profile details screen', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const profileButton = fixture.nativeElement.querySelector(
      'button[aria-label="Open profile"]'
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
        quantity: 3
      })
    });
  });

  it('filters the popular picks grid by category', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const bakeryPill = Array.from(fixture.nativeElement.querySelectorAll('.category-pill')).find((el) =>
      (el as HTMLElement).textContent?.trim() === 'Bakery'
    ) as HTMLButtonElement;
    bakeryPill.click();
    fixture.detectChanges();

    const cardNames = Array.from(fixture.nativeElement.querySelectorAll('.product-card h4')).map(
      (el) => (el as HTMLElement).textContent
    );

    expect(cardNames).toEqual(['Bread']);
  });

  it('filters the popular picks grid by search text', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'toma';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const cardNames = Array.from(fixture.nativeElement.querySelectorAll('.product-card h4')).map(
      (el) => (el as HTMLElement).textContent
    );

    expect(cardNames).toEqual(['Tomato']);
  });

  it('adds a new shopping list entry when a product with no existing entry is added', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const addButton = findProductCard(fixture, 'Onion').querySelector('.add-btn') as HTMLButtonElement;
    addButton.click();
    await fixture.whenStable();

    expect(shoppingState.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Onion', quantity: 1, source: 'manual' })
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
});
