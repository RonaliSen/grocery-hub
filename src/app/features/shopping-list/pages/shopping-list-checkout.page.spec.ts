// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  '@ionic/angular/standalone',
  async () => import('../../../../testing/ionic-standalone.stubs'),
);
// @ts-ignore Spec-only lightweight module mock for the Platform DI token.
vi.mock(import('@ionic/angular'), () => ({
  Platform: class Platform {}
}) as any);
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { TestBed, getTestBed } from '@angular/core/testing';

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { PantryRepositoryService } from '../../pantry/services/pantry-repository.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ExpenseService } from '../../expenses/services/expense.service';
import { ShoppingListRepositoryService } from '../services/shopping-list-repository.service';
import { ShoppingListStateService } from '../services/shopping-list-state.service';
import { ShoppingListCheckoutPage } from './shopping-list-checkout.page';

function createPantryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pantry-1',
    name: 'Rice',
    imageUrl: null,
    category: 'pulses',
    unit: 'kg',
    quantity: 0,
    minQuantity: 1,
    avgDailyUsage: null,
    autoAddToShoppingList: false,
    expiryDate: null,
    germanStore: true,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setCheckoutState(lines: readonly Record<string, unknown>[]): void {
  window.history.replaceState({ checkoutLines: lines }, '');
}

describe('ShoppingListCheckoutPage', () => {
  const pantryRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn(),
  };
  const shoppingRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn(),
    getDismissedAutoAddPantryItemIds: vi.fn(),
    saveDismissedAutoAddPantryItemIds: vi.fn(),
  };
  const expenseService = {
    load: vi.fn().mockResolvedValue(undefined),
    addPurchaseRecord: vi.fn().mockResolvedValue({ id: 'purchase-1' }),
    getDisplayCurrency: vi.fn().mockReturnValue('EUR'),
  };
  const navigationHistory = {
    back: vi.fn().mockResolvedValue(undefined),
  };
  const router = {
    getCurrentNavigation: vi.fn().mockReturnValue(null),
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };
  const toastController = {
    create: vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    }),
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    window.history.replaceState(null, '');
  });

  beforeEach(async () => {
    pantryRepository.getAll.mockReset();
    pantryRepository.saveAll.mockReset().mockResolvedValue(undefined);
    shoppingRepository.getAll.mockReset().mockResolvedValue([]);
    shoppingRepository.saveAll.mockReset().mockResolvedValue(undefined);
    shoppingRepository.getDismissedAutoAddPantryItemIds.mockReset().mockResolvedValue([]);
    shoppingRepository.saveDismissedAutoAddPantryItemIds.mockReset().mockResolvedValue(undefined);
    expenseService.addPurchaseRecord.mockReset().mockResolvedValue({ id: 'purchase-1' });
    navigationHistory.back.mockReset().mockResolvedValue(undefined);
    router.getCurrentNavigation.mockReset().mockReturnValue(null);
    router.navigateByUrl.mockReset().mockResolvedValue(true);
    toastController.create.mockReset().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    });

    await TestBed.configureTestingModule({
      imports: [ShoppingListCheckoutPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        PantryStateService,
        ShoppingListStateService,
        { provide: PantryRepositoryService, useValue: pantryRepository },
        { provide: ShoppingListRepositoryService, useValue: shoppingRepository },
        { provide: ExpenseService, useValue: expenseService },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } },
        { provide: NavigationHistoryService, useValue: navigationHistory },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastController },
      ],
    }).compileComponents();
  });

  async function createComponent() {
    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();
    const fixture = TestBed.createComponent(ShoppingListCheckoutPage);
    fixture.detectChanges();
    return fixture;
  }

  it('restocks linked pantry items to quantity 2 on confirmed purchase', async () => {
    pantryRepository.getAll.mockResolvedValue([createPantryItem({ id: 'pantry-1', quantity: 0 })]);
    setCheckoutState([
      {
        itemId: 'shop-1',
        name: 'Rice',
        quantity: 5,
        category: 'pulses',
        imageUrl: null,
        unitPriceInput: '',
        isCustom: false,
        linkedPantryItemId: 'pantry-1',
      },
    ]);

    const fixture = await createComponent();
    const component = fixture.componentInstance as any;

    component.onUnitPriceChange('shop-1', '1.50');
    await component.confirmPurchase();

    expect(TestBed.inject(PantryStateService).getById('pantry-1')?.quantity).toBe(2);
  });

  it('leaves custom and unlinked lines alone', async () => {
    pantryRepository.getAll.mockResolvedValue([createPantryItem({ id: 'pantry-1', quantity: 7 })]);
    setCheckoutState([
      {
        itemId: 'custom-1',
        name: 'Napkins',
        quantity: 1,
        category: 'other',
        imageUrl: null,
        unitPriceInput: '',
        isCustom: true,
        linkedPantryItemId: null,
      },
      {
        itemId: 'shop-2',
        name: 'Loose apples',
        quantity: 3,
        category: 'fruits',
        imageUrl: null,
        unitPriceInput: '',
        isCustom: false,
        linkedPantryItemId: null,
      },
    ]);

    const fixture = await createComponent();
    const component = fixture.componentInstance as any;

    component.onUnitPriceChange('custom-1', '2.00');
    await component.confirmPurchase();

    expect(TestBed.inject(PantryStateService).getById('pantry-1')?.quantity).toBe(7);
  });
});
