import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideIonicAngular } from '@ionic/angular/standalone';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../../testing/ionic-standalone.stubs')
);

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { AppSettings } from '../../settings/models/app-settings.model';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { HomePage } from './home.page';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

function createPantryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pantry-1',
    name: 'Milk',
    category: 'dairy',
    unit: 'count',
    quantity: 1,
    minQuantity: 2,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
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
    ...overrides
  };
}

function dateOffsetFromToday(days: number): string {
  return toLocalDateOnly(addDays(new Date(), days));
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
    addFromPantryItem: vi.fn(),
    toggleCompleted: vi.fn(),
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
    shoppingState.addFromPantryItem.mockReset();
    shoppingState.toggleCompleted.mockReset();
    shoppingState.incrementQuantity.mockReset();
    shoppingState.decrementQuantity.mockReset();

    pantryState.totalCount.mockImplementation(() => pantryItemsState().length);
    pantryState.items.mockImplementation(() => pantryItemsState());
    pantryState.getById.mockImplementation((id: string) => pantryItemsState().find((item) => item.id === id) ?? null);

    shoppingState.totalCount.mockImplementation(() => shoppingItemsState().length);
    shoppingState.activeItems.mockImplementation(() => shoppingItemsState());
    shoppingState.addFromPantryItem.mockResolvedValue(undefined);
    shoppingState.toggleCompleted.mockResolvedValue(undefined);
    shoppingState.incrementQuantity.mockResolvedValue(undefined);
    shoppingState.decrementQuantity.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
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

  it('renders the home placeholder content and call to action when there is no inventory', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('My Grocery');
    expect(textContent).toContain('Add pantry item');
    expect(textContent).toContain('Your grocery tracker is ready for its first item');
    expect(textContent).toContain('Welcome back');
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

  it('routes the header profile action directly to the profile details screen', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const headerComponent = fixture.debugElement.query(By.directive(PageHeaderComponent)).componentInstance as
      | PageHeaderComponent
      | undefined;

    expect(headerComponent?.actionLink()).toEqual(['/tabs/profile']);
  });

  it('opens popular pick detail with the current added quantity from home state', async () => {
    shoppingItemsState.set([createShoppingItem({ id: 'shop-milk', name: 'Milk', quantity: 3 })]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const milkCard = Array.from(fixture.nativeElement.querySelectorAll('.product-card')).find((card) =>
      (card as HTMLElement).textContent?.includes('Milk')
    ) as HTMLElement | undefined;

    expect(milkCard).toBeDefined();
    milkCard?.click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/tabs/pantry/new'], {
      queryParams: expect.objectContaining({
        name: 'Milk',
        quantity: 3,
      }),
    });
  });

  it('renders sections in order and prevents overlap between Expiring Soon and Low Stock', () => {
    pantryItemsState.set([
      createPantryItem({ id: 'pantry-expiring', name: 'Yogurt', quantity: 1, minQuantity: 3, expiryDate: dateOffsetFromToday(2) }),
      createPantryItem({ id: 'pantry-low', name: 'Rice', quantity: 1, minQuantity: 2, expiryDate: dateOffsetFromToday(8) }),
      createPantryItem({ id: 'pantry-ok', name: 'Pasta', quantity: 5, minQuantity: 2, expiryDate: dateOffsetFromToday(9) })
    ]);

    shoppingItemsState.set([
      createShoppingItem({ id: 'shop-manual', name: 'Soap', linkedPantryItemId: null }),
      createShoppingItem({ id: 'shop-expiring', name: 'Yogurt', linkedPantryItemId: 'pantry-expiring' })
    ]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const rootText = fixture.nativeElement.textContent as string;
    expect(rootText.indexOf('Expiring Soon')).toBeLessThan(rootText.indexOf('Low Stock'));
    expect(rootText.indexOf('Low Stock')).toBeLessThan(rootText.indexOf('To Buy'));

    const expiringSection = fixture.nativeElement.querySelector('#expiring-soon') as HTMLElement;
    const lowStockSection = fixture.nativeElement.querySelector('#low-stock') as HTMLElement;

    expect(expiringSection.textContent).toContain('Yogurt');
    expect(lowStockSection.textContent).toContain('Rice');
    expect(lowStockSection.textContent).not.toContain('Yogurt');
  });

  it('uses settings expiry lead time dynamically for expiring soon and label text', () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        expiryRemindersEnabled: true,
        expiryLeadDays: 4
      }
    });

    pantryItemsState.set([
      createPantryItem({ id: 'in-window', name: 'Yogurt', expiryDate: dateOffsetFromToday(4) }),
      createPantryItem({ id: 'out-window', name: 'Spinach', expiryDate: dateOffsetFromToday(5) })
    ]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const expiringSection = fixture.nativeElement.querySelector('#expiring-soon') as HTMLElement;
    expect(expiringSection.textContent).toContain('In next 4 days');
    expect(expiringSection.textContent).toContain('Yogurt');
    expect(expiringSection.textContent).not.toContain('Spinach');
  });

  it('requires confirmation before adding a low-stock item to To Buy', async () => {
    const lowStockItem = createPantryItem({ id: 'pantry-low', name: 'Flour', quantity: 1, minQuantity: 3 });
    pantryItemsState.set([lowStockItem]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('#low-stock .stock-btn') as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    expect(shoppingState.addFromPantryItem).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Confirm Add');

    const confirmButton = fixture.nativeElement.querySelector('#low-stock .stock-btn--confirm') as HTMLButtonElement;
    confirmButton.click();

    await fixture.whenStable();

    expect(shoppingState.addFromPantryItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'pantry-low' }));
  });

  it('hides low-stock content when low-stock reminders are disabled', () => {
    pantryItemsState.set([createPantryItem({ id: 'pantry-low', quantity: 1, minQuantity: 3 })]);
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      reminderSettings: {
        ...DEFAULT_APP_SETTINGS.reminderSettings,
        lowStockDigestEnabled: false
      }
    });

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const lowStockSection = fixture.nativeElement.querySelector('#low-stock') as HTMLElement;
    expect(lowStockSection.textContent).toContain('No low-stock alerts right now.');
    expect(lowStockSection.querySelector('.stock-btn')).toBeNull();
  });

  it('filters To Buy suggestions linked to expiring-soon items while keeping manual entries', () => {
    pantryItemsState.set([createPantryItem({ id: 'pantry-expiring', expiryDate: dateOffsetFromToday(1) })]);
    shoppingItemsState.set([
      createShoppingItem({ id: 'shop-expiring', name: 'Milk', linkedPantryItemId: 'pantry-expiring' }),
      createShoppingItem({ id: 'shop-manual', name: 'Toilet Paper', linkedPantryItemId: null })
    ]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const toBuySection = fixture.nativeElement.querySelector('#shopping-list') as HTMLElement;
    expect(toBuySection.textContent).toContain('Toilet Paper');
    expect(toBuySection.textContent).not.toContain('Milk');
  });

  it('includes expired pantry items in To Buy as replacement candidates', async () => {
    pantryItemsState.set([createPantryItem({ id: 'pantry-expired', name: 'Spinach', expiryDate: dateOffsetFromToday(-1) })]);
    shoppingItemsState.set([]);

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const toBuySection = fixture.nativeElement.querySelector('#shopping-list') as HTMLElement;
    expect(toBuySection.textContent).toContain('Expired Items To Replace');
    expect(toBuySection.textContent).toContain('Spinach');

    const addButton = toBuySection.querySelector('.stock-btn') as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    const confirmButton = toBuySection.querySelector('.stock-btn--confirm') as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();

    expect(shoppingState.addFromPantryItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'pantry-expired' }));
  });

  it('updates shopping item quantity from the To Buy section and keeps decrement disabled at zero', async () => {
    let shoppingItem = createShoppingItem({ id: 'shop-1', quantity: 1, linkedPantryItemId: null });
    shoppingItemsState.set([shoppingItem]);

    shoppingState.decrementQuantity.mockImplementation(async (itemId: string) => {
      if (itemId === shoppingItem.id) {
        shoppingItem = { ...shoppingItem, quantity: 0 };
        shoppingItemsState.set([shoppingItem]);
      }
    });

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const decrementButton = fixture.nativeElement.querySelector('.quantity-control') as HTMLButtonElement;
    decrementButton.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(shoppingState.decrementQuantity).toHaveBeenCalledWith('shop-1');
    expect((fixture.nativeElement.querySelector('.quantity-pill strong') as HTMLElement).textContent?.trim()).toBe('0');
    expect((fixture.nativeElement.querySelector('.quantity-control') as HTMLButtonElement).disabled).toBe(true);
  });
});
