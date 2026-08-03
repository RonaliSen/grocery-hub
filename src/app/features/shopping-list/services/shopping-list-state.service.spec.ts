import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { ShoppingListRepositoryService } from './shopping-list-repository.service';
import { ShoppingListStateService } from './shopping-list-state.service';

function createShoppingItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id: 'shop-1',
    name: 'Milk',
    quantity: 1,
    quantityOverridden: false,
    unit: 'count',
    linkedPantryItemId: null,
    source: 'manual',
    germanStore: false,
    indianStore: false,
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function createPantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'pantry-1',
    name: 'Eggs',
    category: 'dairy',
    unit: 'count',
    quantity: 0,
    minQuantity: 2,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: null,
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('ShoppingListStateService', () => {
  const settingsState = signal(DEFAULT_APP_SETTINGS);
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn(),
    getDismissedAutoAddPantryItemIds: vi.fn(),
    saveDismissedAutoAddPantryItemIds: vi.fn()
  };
  const pantryState = {
    getById: vi.fn(),
    setQuantity: vi.fn()
  };

  beforeEach(() => {
    settingsState.set(DEFAULT_APP_SETTINGS);
    repository.getAll.mockReset();
    repository.saveAll.mockReset();
    repository.getDismissedAutoAddPantryItemIds.mockReset();
    repository.saveDismissedAutoAddPantryItemIds.mockReset();
    repository.saveAll.mockResolvedValue(undefined);
    repository.getDismissedAutoAddPantryItemIds.mockResolvedValue([]);
    repository.saveDismissedAutoAddPantryItemIds.mockResolvedValue(undefined);
    pantryState.getById.mockReset();
    pantryState.setQuantity.mockReset();
    pantryState.setQuantity.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        ShoppingListStateService,
        {
          provide: ShoppingListRepositoryService,
          useValue: repository
        },
        {
          provide: PantryStateService,
          useValue: pantryState
        },
        {
          provide: SettingsService,
          useValue: {
            settings: settingsState
          }
        }
      ]
    });
  });

  it('loads items from the repository', async () => {
    repository.getAll.mockResolvedValue([createShoppingItem()]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    expect(service.items()).toHaveLength(1);
  });

  it('normalizes legacy items with missing quantity on load and persists the repaired value', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({ quantity: null as unknown as number })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    expect(service.items()[0].quantity).toBe(1);
    expect(repository.saveAll).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 1 })
    ]);
  });

  it('preserves zero quantities on load without rewriting stored items', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({ quantity: 0 })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    expect(service.items()[0].quantity).toBe(0);
    expect(repository.saveAll).not.toHaveBeenCalled();
  });

  it('creates, toggles, and removes shopping items', async () => {
    repository.getAll.mockResolvedValue([createShoppingItem()]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    const created = await service.save({
      name: 'Apples',
      quantity: 6,
      unit: 'count',
      linkedPantryItemId: null,
      source: 'manual',
      germanStore: false,
      indianStore: false
    });

    expect(created.id).toContain('shop');
    expect(service.items()).toHaveLength(2);

    await service.toggleCompleted('shop-1');
    expect(service.getById('shop-1')?.completed).toBe(true);
    expect(service.activeItems()).toHaveLength(1);
    expect(service.completedItems()).toHaveLength(1);

    await service.remove('shop-1');
    expect(service.getById('shop-1')).toBeUndefined();
    expect(repository.saveAll).toHaveBeenCalled();
  });

  it('syncs linked pantry quantity when a shopping item is bought and undone', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-linked',
        name: 'Milk',
        quantity: 2,
        linkedPantryItemId: 'pantry-1',
        source: 'low-stock',
        germanStore: false,
        indianStore: false
      })
    ]);
    pantryState.getById
      .mockReturnValueOnce(createPantryItem({ id: 'pantry-1', name: 'Milk', quantity: 1, minQuantity: 1 }))
      .mockReturnValueOnce(createPantryItem({ id: 'pantry-1', name: 'Milk', quantity: 3, minQuantity: 1 }));

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.toggleCompleted('shop-linked');
    await service.toggleCompleted('shop-linked');

    expect(pantryState.setQuantity).toHaveBeenNthCalledWith(1, 'pantry-1', 3);
    expect(pantryState.setQuantity).toHaveBeenNthCalledWith(2, 'pantry-1', 1);
    expect(service.getById('shop-linked')?.completed).toBe(false);
  });

  it('bulk imports low-stock pantry items without duplicating linked active entries', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-linked',
        name: 'Eggs',
        quantity: 1,
        unit: 'count',
        linkedPantryItemId: 'pantry-1',
        source: 'low-stock',
        germanStore: false,
        indianStore: false
      })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.addLowStockItems([
      createPantryItem({
        id: 'pantry-1',
        name: 'Eggs',
        quantity: 0,
        minQuantity: 3
      }),
      createPantryItem({
        id: 'pantry-2',
        name: 'Rice',
        category: 'grains',
        unit: 'box',
        quantity: 1,
        minQuantity: 2
      })
    ]);

    expect(service.items()).toHaveLength(2);
    expect(service.getById('shop-linked')?.quantity).toBe(3);
    expect(service.items().some((item) => item.linkedPantryItemId === 'pantry-2')).toBe(true);
  });

  it('auto-adds only eligible low-stock pantry items when automation is enabled', async () => {
    repository.getAll.mockResolvedValue([]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.syncAutoAddLowStockItems(
      [
        createPantryItem({
          id: 'pantry-low',
          name: 'Eggs',
          quantity: 0,
          minQuantity: 2,
          autoAddToShoppingList: true
        }),
        createPantryItem({
          id: 'pantry-opt-out',
          name: 'Yogurt',
          quantity: 0,
          minQuantity: 2,
          autoAddToShoppingList: false
        }),
        createPantryItem({
          id: 'pantry-stable',
          name: 'Rice',
          quantity: 4,
          minQuantity: 2,
          autoAddToShoppingList: true
        })
      ],
      true
    );

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]).toMatchObject({
      name: 'Eggs',
      linkedPantryItemId: 'pantry-low',
      source: 'low-stock',
      germanStore: false,
      indianStore: false
    });
  });

  it('does not rewrite matching auto-added entries when they are already current', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-linked',
        name: 'Eggs',
        quantity: 2,
        unit: 'count',
        linkedPantryItemId: 'pantry-1',
        source: 'low-stock',
        germanStore: false,
        indianStore: false
      })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();
    repository.saveAll.mockClear();

    await service.syncAutoAddLowStockItems(
      [
        createPantryItem({
          id: 'pantry-1',
          name: 'Eggs',
          quantity: 1,
          minQuantity: 3
        })
      ],
      true
    );

    expect(repository.saveAll).not.toHaveBeenCalled();
    expect(service.items()).toHaveLength(1);
  });

  it('preserves a user-adjusted quantity for linked low-stock items during auto-sync', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-linked',
        name: 'Eggs',
        quantity: 2,
        unit: 'count',
        linkedPantryItemId: 'pantry-1',
        source: 'low-stock',
        germanStore: false,
        indianStore: false
      })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.incrementQuantity('shop-linked');
    repository.saveAll.mockClear();

    await service.syncAutoAddLowStockItems(
      [
        createPantryItem({
          id: 'pantry-1',
          name: 'Eggs',
          quantity: 0,
          minQuantity: 2
        })
      ],
      true
    );

    expect(service.getById('shop-linked')).toMatchObject({
      quantity: 3,
      quantityOverridden: true,
      linkedPantryItemId: 'pantry-1'
    });
    expect(repository.saveAll).not.toHaveBeenCalled();
  });

  it('keeps a deleted auto-added low-stock item dismissed during reactive auto-sync', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-linked',
        name: 'Eggs',
        quantity: 2,
        unit: 'count',
        linkedPantryItemId: 'pantry-1',
        source: 'low-stock'
      })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.remove('shop-linked');
    expect(service.items()).toHaveLength(0);

    await service.syncAutoAddLowStockItems(
      [
        createPantryItem({
          id: 'pantry-1',
          name: 'Eggs',
          quantity: 0,
          minQuantity: 2,
          autoAddToShoppingList: true
        })
      ],
      true
    );

    expect(service.items()).toHaveLength(0);
    expect(repository.saveDismissedAutoAddPantryItemIds).toHaveBeenCalledWith(['pantry-1']);
  });

  it('lets a manually re-added pantry item clear its dismissal state', async () => {
    repository.getAll.mockResolvedValue([]);
    repository.getDismissedAutoAddPantryItemIds.mockResolvedValue(['pantry-1']);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.addFromPantryItem(
      createPantryItem({
        id: 'pantry-1',
        name: 'Eggs',
        quantity: 0,
        minQuantity: 2
      })
    );

    expect(service.items()).toHaveLength(1);
    expect(repository.saveDismissedAutoAddPantryItemIds).toHaveBeenCalledWith([]);
  });

  it('uses the settings threshold when determining the auto-add quantity', async () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      defaultLowStockThreshold: 5
    });
    repository.getAll.mockResolvedValue([]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.syncAutoAddLowStockItems(
      [
        createPantryItem({
          id: 'pantry-threshold',
          name: 'Eggs',
          quantity: 4,
          minQuantity: 2
        })
      ],
      true
    );

    expect(service.items()[0].quantity).toBe(1);
  });

  it('uses the unit low-stock floor when building shopping suggestions', async () => {
    repository.getAll.mockResolvedValue([]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.addFromPantryItem(
      createPantryItem({
        id: 'pantry-spice',
        name: 'Chili Powder',
        unit: 'g',
        quantity: 150,
        minQuantity: 50
      })
    );

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0].quantity).toBe(50);
    expect(service.items()[0].unit).toBe('g');
  });

  it('increments quantity and removes the item once quantity reaches zero', async () => {
    repository.getAll.mockResolvedValue([
      createShoppingItem({
        id: 'shop-adjust',
        quantity: 2
      })
    ]);

    const service = TestBed.inject(ShoppingListStateService);
    await service.load();

    await service.incrementQuantity('shop-adjust');
    expect(service.getById('shop-adjust')?.quantity).toBe(3);

    await service.decrementQuantity('shop-adjust');
    await service.decrementQuantity('shop-adjust');
    await service.decrementQuantity('shop-adjust');

    expect(service.getById('shop-adjust')).toBeUndefined();
  });
});
