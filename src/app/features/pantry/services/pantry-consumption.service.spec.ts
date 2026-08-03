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
});
