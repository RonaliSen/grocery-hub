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
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TestBed, getTestBed } from '@angular/core/testing';

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { PantryRepositoryService } from '../../pantry/services/pantry-repository.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ExpenseService } from '../../expenses/services/expense.service';
import { ShoppingListRepositoryService } from '../services/shopping-list-repository.service';
import { ShoppingListStateService } from '../services/shopping-list-state.service';
import { ShoppingItemRowComponent } from '../components/shopping-item-row.component';
import { ShoppingListPage } from './shopping-list.page';

@Component({
  selector: 'app-shopping-item-row',
  standalone: true,
  template: `
    <article class="shopping-item-row-stub">
      <span>{{ item?.name }}</span>
    </article>
  `,
})
class ShoppingItemRowStubComponent {
  @Input() item: { name?: string } | null = null;
  @Output() toggle = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();
  @Output() increment = new EventEmitter<string>();
  @Output() decrement = new EventEmitter<string>();
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
    germanStore: true,
    indianStore: false,
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ShoppingListPage', () => {
  let backButtonHandler: ((processNextHandler: () => void) => Promise<void> | void) | undefined;
  let mockPlatform: Pick<Platform, 'backButton'>;
  const settingsState = signal(DEFAULT_APP_SETTINGS);
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
  const router = {
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };
  const toastController = {
    create: vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    }),
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    backButtonHandler = undefined;
    settingsState.set(DEFAULT_APP_SETTINGS);
    pantryRepository.getAll.mockReset();
    pantryRepository.saveAll.mockReset();
    pantryRepository.saveAll.mockResolvedValue(undefined);

    shoppingRepository.getAll.mockReset();
    shoppingRepository.saveAll.mockReset();
    shoppingRepository.getDismissedAutoAddPantryItemIds.mockReset();
    shoppingRepository.saveDismissedAutoAddPantryItemIds.mockReset();
    shoppingRepository.saveAll.mockResolvedValue(undefined);
    shoppingRepository.getDismissedAutoAddPantryItemIds.mockResolvedValue([]);
    shoppingRepository.saveDismissedAutoAddPantryItemIds.mockResolvedValue(undefined);
    expenseService.load.mockReset();
    expenseService.addPurchaseRecord.mockReset();
    expenseService.getDisplayCurrency.mockReset();
    expenseService.load.mockResolvedValue(undefined);
    expenseService.addPurchaseRecord.mockResolvedValue({ id: 'purchase-1' });
    expenseService.getDisplayCurrency.mockReturnValue('EUR');
    router.navigateByUrl.mockReset();
    router.navigateByUrl.mockResolvedValue(true);
    toastController.create.mockReset();
    toastController.create.mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    });
    mockPlatform = {
      backButton: {
        subscribeWithPriority: vi.fn(
          (_priority: number, callback: (processNextHandler: () => void) => Promise<void> | void) => {
            backButtonHandler = callback;
            return { unsubscribe: vi.fn() };
          }
        ),
      } as unknown as Platform['backButton'],
    };

    TestBed.overrideComponent(ShoppingListPage, {
      remove: {
        imports: [ShoppingItemRowComponent],
      },
      add: {
        imports: [ShoppingItemRowStubComponent],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ShoppingListPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        PantryStateService,
        ShoppingListStateService,
        {
          provide: PantryRepositoryService,
          useValue: pantryRepository,
        },
        {
          provide: ShoppingListRepositoryService,
          useValue: shoppingRepository,
        },
        {
          provide: ExpenseService,
          useValue: expenseService,
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState,
          },
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: Platform,
          useValue: mockPlatform,
        },
        {
          provide: ToastController,
          useValue: toastController,
        },
      ],
    }).compileComponents();
  });

  it('renders the redesigned header and search controls', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement | null;

    expect(textContent).toContain('My Cart');
    expect(fixture.nativeElement.querySelector('.add-button')).toBeNull();
    expect(input?.placeholder).toBe('Filter items...');
  });

  it('renders active and completed items', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([
      createShoppingItem({ name: 'Bread', quantity: 2 }),
      createShoppingItem({
        id: 'shop-2',
        name: 'Apples',
        completed: true,
      }),
    ]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    const component = fixture.componentInstance as any;

    expect(textContent).toContain('Current List (3)');
    expect(component.filteredActiveItems().map((item: { name: string }) => item.name)).toEqual(['Bread']);
    expect(component.filteredCompletedItems().map((item: { name: string }) => item.name)).toEqual(['Apples']);
  });

  it('does not render bill details', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([createShoppingItem({ quantity: 2 })]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).not.toContain('Bill Details');
    expect(textContent).not.toContain('Bill Total');
  });

  it('renders a share action alongside checkout when cart items exist', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([createShoppingItem({ quantity: 2 })]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Checkout');
    expect(textContent).toContain('Share');
  });

  it('navigates to the share screen with the active store', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([
      createShoppingItem({ id: 'shop-1', name: 'Potato', quantity: 1 }),
      createShoppingItem({ id: 'shop-2', name: 'Chole', quantity: 3 }),
    ]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    const component = fixture.componentInstance as ShoppingListPage & {
      openShareOptions: () => Promise<void>;
    };

    await component.openShareOptions();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/shopping-list/share?store=german');
  });

  it('navigates to the checkout screen with draft lines from visible cart items', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([
      createShoppingItem({ id: 'shop-1', name: 'Potato', quantity: 1 }),
      createShoppingItem({ id: 'shop-2', name: 'Chole', quantity: 3, indianStore: true, germanStore: false }),
    ]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    const component = fixture.componentInstance as ShoppingListPage & {
      checkout: () => Promise<void>;
    };

    await component.checkout();

    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/tabs/shopping-list/checkout',
      expect.objectContaining({
        state: expect.objectContaining({
          activeStore: 'german',
          checkoutLines: [
            expect.objectContaining({
              itemId: 'shop-1',
              name: 'Potato',
              quantity: 1,
            }),
          ],
        }),
      })
    );
  });

  it('allows direct navigation to share and checkout without relying on dialog state', async () => {
    pantryRepository.getAll.mockResolvedValue([]);
    shoppingRepository.getAll.mockResolvedValue([
      createShoppingItem({ id: 'shop-1', name: 'Potato', quantity: 1 }),
    ]);

    await TestBed.inject(PantryStateService).load();
    await TestBed.inject(ShoppingListStateService).load();

    const fixture = TestBed.createComponent(ShoppingListPage);
    const component = fixture.componentInstance as ShoppingListPage & {
      openShareOptions: () => Promise<void>;
      checkout: () => Promise<void>;
    };

    await component.openShareOptions();
    await component.checkout();

    expect(router.navigateByUrl).toHaveBeenNthCalledWith(1, '/tabs/shopping-list/share?store=german');
    expect(router.navigateByUrl).toHaveBeenNthCalledWith(
      2,
      '/tabs/shopping-list/checkout',
      expect.objectContaining({ state: expect.any(Object) })
    );
  });

});
