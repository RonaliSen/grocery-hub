import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryRepositoryService } from './pantry-repository.service';
import { PantryDuplicateItemNameError, PantryStateService } from './pantry-state.service';

/**
 * Local `YYYY-MM-DD` `days` from today — the calendar day the app compares expiry dates
 * against. (Not `toISOString()`: that's the UTC date, a day off near midnight in most timezones.)
 */
function dateOnlyFromOffset(days: number): string {
  return toLocalDateOnly(addDays(new Date(), days));
}

function createItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    ...baseItem(),
    ...overrides
  };
}

function baseItem(): PantryItem {
  return {
    id: 'item-1',
    name: 'Milk',
    category: 'dairy' as const,
    unit: 'count' as const,
    quantity: 2,
    minQuantity: 1,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: null,
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

describe('PantryStateService', () => {
  const settingsState = signal(DEFAULT_APP_SETTINGS);
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };

  beforeEach(() => {
    settingsState.set(DEFAULT_APP_SETTINGS);
    repository.getAll.mockReset();
    repository.saveAll.mockReset();
    repository.saveAll.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        PantryStateService,
        {
          provide: PantryRepositoryService,
          useValue: repository
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

  it('loads items once from the repository', async () => {
    repository.getAll.mockResolvedValue([createItem()]);

    const service = TestBed.inject(PantryStateService);
    await Promise.all([service.load(), service.load()]);

    expect(repository.getAll).toHaveBeenCalledTimes(1);
    expect(service.loaded()).toBe(true);
    expect(service.items()).toHaveLength(1);
  });

  it('creates, updates, and removes pantry items', async () => {
    repository.getAll.mockResolvedValue([createItem()]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    const created = await service.save({
      name: 'Apples',
      category: 'produce',
      unit: 'count',
      quantity: 6,
      minQuantity: 2,
      avgDailyUsage: null,
      autoAddToShoppingList: true,
      expiryDate: null,
      germanStore: false,
      indianStore: false,
      notes: null
    });

    expect(created.id).toContain('pantry');
    expect(service.items()).toHaveLength(2);

    await service.save(
      {
        name: 'Whole Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        germanStore: false,
        indianStore: false,
        notes: 'Fridge door'
      },
      'item-1'
    );

    expect(service.getById('item-1')?.name).toBe('Whole Milk');

    await service.remove('item-1');

    expect(service.getById('item-1')).toBeUndefined();
    expect(repository.saveAll).toHaveBeenCalled();
  });

  it('never lets quantity updates go below zero', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        quantity: 1,
        minQuantity: 1
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();
    await service.updateQuantity('item-1', -5);

    expect(service.getById('item-1')?.quantity).toBe(0);
  });

  it('clamps direct quantity writes at zero', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        quantity: 4,
        minQuantity: 1
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();
    await service.setQuantity('item-1', -2);

    expect(service.getById('item-1')?.quantity).toBe(0);
  });

  it('computes low-stock, expiring, and expired lists', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'low-stock',
        quantity: 1,
        minQuantity: 2,
        expiryDate: null
      }),
      createItem({
        id: 'expiring-soon',
        name: 'Spinach',
        quantity: 5,
        minQuantity: 1,
        expiryDate: dateOnlyFromOffset(1)
      }),
      createItem({
        id: 'outside-expiring-window',
        name: 'Yogurt',
        quantity: 1,
        minQuantity: 1,
        expiryDate: dateOnlyFromOffset(4)
      }),
      createItem({
        id: 'expired',
        name: 'Broth',
        quantity: 3,
        minQuantity: 1,
        expiryDate: dateOnlyFromOffset(-1)
      }),
      createItem({
        id: 'stable',
        name: 'Rice',
        category: 'grains',
        unit: 'box',
        quantity: 5,
        minQuantity: 1,
        expiryDate: null
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.lowStockItems().map((item) => item.id)).toEqual(['low-stock', 'outside-expiring-window']);
    expect(service.lowStockSignalItems().map((item) => item.id)).toEqual(['low-stock', 'outside-expiring-window']);
    expect(service.expiringSoonItems().map((item) => item.id)).toEqual(['expiring-soon']);
    expect(service.expiredItems().map((item) => item.id)).toEqual(['expired']);
  });

  it('excludes out-of-stock items from low-stock signal alerts', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'out-of-stock',
        name: 'Tomatoes',
        quantity: 0,
        minQuantity: 2
      }),
      createItem({
        id: 'low-stock',
        name: 'Milk',
        quantity: 1,
        minQuantity: 2
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.lowStockItems().map((item) => item.id)).toEqual(['out-of-stock', 'low-stock']);
    expect(service.lowStockSignalItems().map((item) => item.id)).toEqual(['low-stock']);
  });

  it('updates expiring-soon items when expiry lead days changes in settings', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'expiring-3-days',
        name: 'Spinach',
        quantity: 5,
        minQuantity: 1,
        expiryDate: dateOnlyFromOffset(3)
      }),
      createItem({
        id: 'expiring-4-days',
        name: 'Yogurt',
        quantity: 2,
        minQuantity: 1,
        expiryDate: dateOnlyFromOffset(4)
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.expiringSoonItems().map((item) => item.id)).toEqual(['expiring-3-days']);

    settingsState.set({
      ...settingsState(),
      reminderSettings: {
        ...settingsState().reminderSettings,
        expiryLeadDays: 4
      }
    });

    expect(service.expiringSoonItems().map((item) => item.id)).toEqual([
      'expiring-3-days',
      'expiring-4-days'
    ]);
  });

  it('treats gram and liter items below their unit thresholds as low stock', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'spice',
        name: 'Chili Powder',
        unit: 'g',
        quantity: 150,
        minQuantity: 25,
        expiryDate: dateOnlyFromOffset(1)
      }),
      createItem({
        id: 'juice',
        name: 'Orange Juice',
        unit: 'l',
        quantity: 0.75,
        minQuantity: 0.25,
        expiryDate: dateOnlyFromOffset(1)
      }),
      createItem({
        id: 'rice',
        name: 'Rice',
        category: 'grains',
        unit: 'box',
        quantity: 5,
        minQuantity: 1,
        expiryDate: null
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.lowStockItems().map((item) => item.id)).toEqual(['juice', 'spice']);
    expect(service.lowStockSignalItems().map((item) => item.id)).toEqual(['juice', 'spice']);
  });

  it('filters items by search query and stock status', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'milk',
        quantity: 2,
        minQuantity: 2,
        expiryDate: dateOnlyFromOffset(1)
      }),
      createItem({
        id: 'beans',
        name: 'Beans',
        category: 'other',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        expiryDate: null
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    service.setSearchQuery('bean');
    expect(service.filteredItems().map((item) => item.id)).toEqual(['beans']);

    service.setSearchQuery('');
    service.setStockFilter('low-stock');
    expect(service.filteredItems().map((item) => item.id)).toEqual(['milk']);
  });

  it('sorts filtered pantry items with expired items first and no-expiry items last', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'no-expiry',
        name: 'Rice',
        category: 'grains',
        unit: 'box',
        quantity: 3,
        minQuantity: 1,
        expiryDate: null
      }),
      createItem({
        id: 'expired',
        name: 'Broth',
        expiryDate: dateOnlyFromOffset(-2)
      }),
      createItem({
        id: 'later-expiry',
        name: 'Yogurt',
        expiryDate: dateOnlyFromOffset(5)
      }),
      createItem({
        id: 'soon-expiry',
        name: 'Milk',
        expiryDate: dateOnlyFromOffset(1)
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.filteredItems().map((item) => item.id)).toEqual([
      'expired',
      'soon-expiry',
      'later-expiry',
      'no-expiry'
    ]);
  });

  it('applies the settings threshold as a global baseline for low-stock reminders', async () => {
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      defaultLowStockThreshold: 5
    });
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'global-low-stock',
        quantity: 4,
        minQuantity: 2
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.lowStockItems().map((item) => item.id)).toEqual(['global-low-stock']);
  });

  it('normalizes names while checking duplicate existence', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'milk',
        name: 'Milk'
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    expect(service.existsByName('  milk  ')).toBe(true);
    expect(service.existsByName('MILK')).toBe(true);
    expect(service.existsByName('milk', 'milk')).toBe(false);
  });

  it('blocks creating a duplicate item name using normalized matching', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'milk',
        name: 'Milk'
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    await expect(
      service.save({
        name: '  milk  ',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        germanStore: false,
        indianStore: false,
        notes: null
      })
    ).rejects.toBeInstanceOf(PantryDuplicateItemNameError);
  });

  it('blocks renaming an item to another item name while allowing same-name edits', async () => {
    repository.getAll.mockResolvedValue([
      createItem({
        id: 'item-1',
        name: 'Milk',
        quantity: 3
      }),
      createItem({
        id: 'item-2',
        name: 'Bread',
        quantity: 1
      })
    ]);

    const service = TestBed.inject(PantryStateService);
    await service.load();

    await expect(
      service.save(
        {
          name: ' MILK ',
          category: 'other',
          unit: 'count',
          quantity: 2,
          minQuantity: 1,
          avgDailyUsage: null,
          autoAddToShoppingList: true,
          expiryDate: null,
          germanStore: false,
          indianStore: false,
          notes: null
        },
        'item-2'
      )
    ).rejects.toBeInstanceOf(PantryDuplicateItemNameError);

    await expect(
      service.save(
        {
          name: ' milk ',
          category: 'dairy',
          unit: 'count',
          quantity: 9,
          minQuantity: 1,
          avgDailyUsage: null,
          autoAddToShoppingList: true,
          expiryDate: null,
          germanStore: false,
          indianStore: false,
          notes: null
        },
        'item-1'
      )
    ).resolves.toMatchObject({
      id: 'item-1',
      quantity: 9
    });
  });

  describe('setQuantities', () => {
    it('updates only the requested items in a single write and reports how many changed', async () => {
      repository.getAll.mockResolvedValue([
        createItem({ id: 'milk', name: 'Milk', quantity: 2 }),
        createItem({ id: 'rice', name: 'Rice', quantity: 5 }),
        createItem({ id: 'oats', name: 'Oats', quantity: 1 })
      ]);
      const service = TestBed.inject(PantryStateService);
      await service.load();

      const changed = await service.setQuantities(new Map([['milk', 0], ['rice', 7.5]]));

      expect(changed).toBe(2);
      expect(repository.saveAll).toHaveBeenCalledTimes(1);
      const saved = repository.saveAll.mock.calls[0][0] as PantryItem[];
      expect(saved.map((item) => [item.id, item.quantity])).toEqual([
        ['milk', 0],
        ['rice', 7.5],
        ['oats', 1]
      ]);
      expect(saved[0].updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect(saved[2]).toEqual(createItem({ id: 'oats', name: 'Oats', quantity: 1 }));
      expect(service.getById('milk')?.quantity).toBe(0);
    });

    it('skips items already at the requested quantity and unknown ids, without writing if nothing changed', async () => {
      repository.getAll.mockResolvedValue([createItem({ id: 'milk', quantity: 2 })]);
      const service = TestBed.inject(PantryStateService);
      await service.load();

      const changed = await service.setQuantities(new Map([['milk', 2], ['ghost', 4]]));

      expect(changed).toBe(0);
      expect(repository.saveAll).not.toHaveBeenCalled();
    });

    it('leaves the in-memory pantry unchanged when the write fails', async () => {
      repository.getAll.mockResolvedValue([createItem({ id: 'milk', quantity: 2 })]);
      repository.saveAll.mockRejectedValue(new Error('disk full'));
      const service = TestBed.inject(PantryStateService);
      await service.load();

      await expect(service.setQuantities(new Map([['milk', 9]]))).rejects.toThrow('disk full');

      expect(service.getById('milk')?.quantity).toBe(2);
    });
  });
});
