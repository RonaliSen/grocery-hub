import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryConsumptionRepositoryService } from './pantry-consumption-repository.service';
import { PantryConsumptionService } from './pantry-consumption.service';
import { PantryRepositoryService } from './pantry-repository.service';
import { PantryStateService } from './pantry-state.service';

function createItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'item-1',
    name: 'Milk',
    category: 'dairy',
    unit: 'count',
    quantity: 3,
    minQuantity: 1,
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

describe('PantryConsumptionService', () => {
  const pantryRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };
  const consumptionRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };

  beforeEach(() => {
    pantryRepository.getAll.mockReset();
    pantryRepository.saveAll.mockReset();
    pantryRepository.saveAll.mockResolvedValue(undefined);

    consumptionRepository.getAll.mockReset();
    consumptionRepository.saveAll.mockReset();
    consumptionRepository.saveAll.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        PantryStateService,
        PantryConsumptionService,
        {
          provide: PantryRepositoryService,
          useValue: pantryRepository
        },
        {
          provide: PantryConsumptionRepositoryService,
          useValue: consumptionRepository
        },
        {
          provide: SettingsService,
          useValue: {
            settings: () => DEFAULT_APP_SETTINGS
          }
        }
      ]
    });
  });

  it('records a decrement within the available quantity', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem()]);
    consumptionRepository.getAll.mockResolvedValue([]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    const changed = await service.consume('item-1', 1);

    expect(changed).toBe(true);
    expect(pantryState.getById('item-1')?.quantity).toBe(2);
    expect(consumptionRepository.saveAll).toHaveBeenCalledWith([
      expect.objectContaining({
        itemId: 'item-1',
        actionType: 'decrement',
        amount: 1,
        previousQuantity: 3,
        nextQuantity: 2
      })
    ]);
  });

  it('clamps decrements that would go below zero', async () => {
    pantryRepository.getAll.mockResolvedValue([
      createItem({
        quantity: 1
      })
    ]);
    consumptionRepository.getAll.mockResolvedValue([]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    await service.consume('item-1', 5);

    expect(pantryState.getById('item-1')?.quantity).toBe(0);
    expect(consumptionRepository.saveAll).toHaveBeenCalledWith([
      expect.objectContaining({
        amount: 1,
        previousQuantity: 1,
        nextQuantity: 0
      })
    ]);
  });

  it('marks an item empty using the exact remaining quantity', async () => {
    pantryRepository.getAll.mockResolvedValue([
      createItem({
        quantity: 2.5,
        unit: 'l'
      })
    ]);
    consumptionRepository.getAll.mockResolvedValue([]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    await service.markEmpty('item-1');

    expect(pantryState.getById('item-1')?.quantity).toBe(0);
    expect(consumptionRepository.saveAll).toHaveBeenCalledWith([
      expect.objectContaining({
        actionType: 'empty',
        amount: 2.5,
        previousQuantity: 2.5,
        nextQuantity: 0
      })
    ]);
  });

  it('does not write a log for no-op actions at zero quantity', async () => {
    pantryRepository.getAll.mockResolvedValue([
      createItem({
        quantity: 0
      })
    ]);
    consumptionRepository.getAll.mockResolvedValue([]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    const changed = await service.markEmpty('item-1');

    expect(changed).toBe(false);
    expect(pantryState.getById('item-1')?.quantity).toBe(0);
    expect(consumptionRepository.saveAll).not.toHaveBeenCalled();
  });

  it('returns item logs newest first', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem()]);
    consumptionRepository.getAll.mockResolvedValue([
      {
        id: 'older',
        itemId: 'item-1',
        actionType: 'decrement',
        amount: 0.5,
        previousQuantity: 2,
        nextQuantity: 1.5,
        createdAt: '2026-03-10T08:00:00.000Z'
      },
      {
        id: 'other-item',
        itemId: 'item-2',
        actionType: 'decrement',
        amount: 1,
        previousQuantity: 1,
        nextQuantity: 0,
        createdAt: '2026-03-12T08:00:00.000Z'
      },
      {
        id: 'newer',
        itemId: 'item-1',
        actionType: 'empty',
        amount: 1.5,
        previousQuantity: 1.5,
        nextQuantity: 0,
        createdAt: '2026-03-11T08:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();
    await service.load();

    expect(service.getLogsForItem('item-1').map((log) => log.id)).toEqual(['newer', 'older']);
  });

  it('never consumes more than is available when actions overlap', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem({ quantity: 1 })]);
    consumptionRepository.getAll.mockResolvedValue([]);
    // Storage writes take a moment, as they do with IndexedDB.
    pantryRepository.saveAll.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    const results = await Promise.all([service.consume('item-1', 1), service.consume('item-1', 1)]);

    expect(results).toEqual([true, false]);
    expect(pantryState.getById('item-1')?.quantity).toBe(0);
    expect(service.logs().reduce((total, log) => total + log.amount, 0)).toBe(1);
  });

  it('applies overlapping restock and use actions in order with consistent logs', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem({ quantity: 1 })]);
    consumptionRepository.getAll.mockResolvedValue([]);
    pantryRepository.saveAll.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    await Promise.all([service.adjust('item-1', 1), service.consume('item-1', 1), service.adjust('item-1', 1)]);

    expect(pantryState.getById('item-1')?.quantity).toBe(2);
    const steps = [...service.logs()]
      .reverse()
      .map((log) => [log.actionType, log.previousQuantity, log.nextQuantity]);
    expect(steps).toEqual([
      ['increment', 1, 2],
      ['decrement', 2, 1],
      ['increment', 1, 2]
    ]);
  });

  it('keeps processing actions after a failed save', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem({ quantity: 2 })]);
    consumptionRepository.getAll.mockResolvedValue([]);
    pantryRepository.saveAll.mockRejectedValueOnce(new Error('disk full'));

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    await expect(service.consume('item-1', 1)).rejects.toThrow('disk full');
    await expect(service.consume('item-1', 1)).resolves.toBe(true);
    expect(pantryState.getById('item-1')?.quantity).toBe(1);
  });

  it('saves the item name and unit with each use and restock', async () => {
    pantryRepository.getAll.mockResolvedValue([createItem({ name: 'Basmati Rice', unit: 'kg' })]);
    consumptionRepository.getAll.mockResolvedValue([]);

    const pantryState = TestBed.inject(PantryStateService);
    const service = TestBed.inject(PantryConsumptionService);
    await pantryState.load();

    await service.consume('item-1', 1);
    await service.adjust('item-1', 1);

    expect(service.logs()).toEqual([
      expect.objectContaining({ actionType: 'increment', itemName: 'Basmati Rice', unit: 'kg' }),
      expect.objectContaining({ actionType: 'decrement', itemName: 'Basmati Rice', unit: 'kg' })
    ]);
  });

  describe('removeItem', () => {
    it('deletes the item and records a deleted entry with its name, unit and quantity', async () => {
      pantryRepository.getAll.mockResolvedValue([
        createItem({ name: 'Basmati Rice', unit: 'kg', quantity: 2.5 }),
        createItem({ id: 'item-2', name: 'Oat Milk' })
      ]);
      consumptionRepository.getAll.mockResolvedValue([]);

      const pantryState = TestBed.inject(PantryStateService);
      const service = TestBed.inject(PantryConsumptionService);
      await pantryState.load();

      const removed = await service.removeItem('item-1');

      expect(removed).toBe(true);
      expect(pantryState.getById('item-1')).toBeUndefined();
      expect(pantryState.getById('item-2')).toBeDefined();
      expect(consumptionRepository.saveAll).toHaveBeenLastCalledWith([
        expect.objectContaining({
          itemId: 'item-1',
          actionType: 'deleted',
          itemName: 'Basmati Rice',
          unit: 'kg',
          amount: 2.5,
          previousQuantity: 2.5,
          nextQuantity: 0
        })
      ]);
    });

    it('keeps the existing history and puts the deletion first', async () => {
      pantryRepository.getAll.mockResolvedValue([createItem()]);
      consumptionRepository.getAll.mockResolvedValue([
        {
          id: 'older',
          itemId: 'item-1',
          actionType: 'decrement',
          amount: 1,
          previousQuantity: 4,
          nextQuantity: 3,
          createdAt: '2026-03-10T08:00:00.000Z'
        }
      ]);

      const pantryState = TestBed.inject(PantryStateService);
      const service = TestBed.inject(PantryConsumptionService);
      await pantryState.load();

      await service.removeItem('item-1');

      expect(service.logs().map((log) => log.actionType)).toEqual(['deleted', 'decrement']);
    });

    it('does nothing for an item that does not exist', async () => {
      pantryRepository.getAll.mockResolvedValue([createItem()]);
      consumptionRepository.getAll.mockResolvedValue([]);

      const pantryState = TestBed.inject(PantryStateService);
      const service = TestBed.inject(PantryConsumptionService);
      await pantryState.load();

      expect(await service.removeItem('missing')).toBe(false);
      expect(pantryRepository.saveAll).not.toHaveBeenCalled();
      expect(consumptionRepository.saveAll).not.toHaveBeenCalled();
    });

    it('applies a use tapped just before deleting, then ignores uses after it', async () => {
      pantryRepository.getAll.mockResolvedValue([createItem({ quantity: 3 })]);
      consumptionRepository.getAll.mockResolvedValue([]);
      pantryRepository.saveAll.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));

      const pantryState = TestBed.inject(PantryStateService);
      const service = TestBed.inject(PantryConsumptionService);
      await pantryState.load();

      const results = await Promise.all([
        service.consume('item-1', 1),
        service.removeItem('item-1'),
        service.consume('item-1', 1)
      ]);

      expect(results).toEqual([true, true, false]);
      expect(service.logs().map((log) => [log.actionType, log.previousQuantity])).toEqual([
        ['deleted', 2],
        ['decrement', 3]
      ]);
    });
  });
});
