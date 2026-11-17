// @vitest-environment jsdom
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { getTestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { ExpenseService } from './expense.service';

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Test environment already initialized.
}

/**
 * Noon on 3 June in the machine's own timezone, so it's 3 June everywhere. (Noon UTC is
 * already 4 June in timezones from UTC+12, e.g. New Zealand, which moves the budget day.)
 */
const JUNE_3_LOCAL_NOON = new Date(2026, 5, 3, 12).toISOString();

describe('ExpenseService', () => {
  const storage = {
    get: vi.fn(),
    set: vi.fn()
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));

    storage.get.mockReset();
    storage.set.mockReset();

    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        {
          provide: StorageService,
          useValue: storage
        }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('normalizes legacy monthly budget maps into cycle history', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          '2026-06': {
            monthlyLimit: 123.456,
            currency: 'gbp'
          }
        };
      }
      if (key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      return [];
    });

    const service = TestBed.inject(ExpenseService);
    await service.load();

    const cycle = service.getBudgetCycles()[0];
    expect(cycle).toMatchObject({
      budgetType: 'monthly',
      budgetAmount: 123.46,
      currency: 'GBP',
      startDate: '2026-06-01',
      endDate: '2026-06-30'
    });
  });

  it('creates active weekly cycles and expected spend from saved settings', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses || key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'weekly',
            budgetAmount: 70,
            startDate: '2026-06-01',
            currency: 'EUR',
            updatedAt: '2026-06-01T08:00:00.000Z'
          },
          cycles: []
        };
      }
      return [];
    });

    const service = TestBed.inject(ExpenseService);
    await service.load();

    const activeCycle = service.getActiveBudgetCycle(JUNE_3_LOCAL_NOON);
    expect(activeCycle).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-06-07'
    });

    const expected = service.getExpectedSpendSummary(activeCycle!.id, JUNE_3_LOCAL_NOON);
    expect(expected).toEqual({
      expectedSpend: 30,
      dailyBudget: 10,
      difference: -30,
      status: 'under_expected'
    });
  });

  it('assigns purchase records to the active cycle and persists cycle ids', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses || key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-05-28',
            currency: 'EUR',
            updatedAt: '2026-05-28T08:00:00.000Z'
          },
          cycles: []
        };
      }
      return [];
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(ExpenseService);
    await service.load();

    const purchase = await service.addPurchaseRecord({
      createdAt: '2026-06-03T10:00:00.000Z',
      store: 'Lidl',
      items: [
        {
          id: 'item-1',
          itemName: 'Milk',
          quantity: 2,
          unitPrice: 3,
          totalPrice: 6,
          category: 'dairy',
          purchaseDate: '2026-06-03T10:00:00.000Z'
        }
      ]
    });

    expect(purchase.budgetCycleId).toBe('cycle-monthly-2026-05-28');
    expect(service.getCycleSpent('cycle-monthly-2026-05-28')).toBe(6);
  });

  it('preserves previous monthly cycles when budget settings are saved again', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses || key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-04-28',
            currency: 'EUR',
            updatedAt: '2026-04-28T08:00:00.000Z'
          },
          cycles: [
            {
              id: 'cycle-monthly-2026-04-28',
              budgetType: 'monthly',
              budgetAmount: 500,
              currency: 'EUR',
              startDate: '2026-04-28',
              endDate: '2026-05-27',
              createdAt: '2026-04-28T08:00:00.000Z'
            },
            {
              id: 'cycle-monthly-2026-05-28',
              budgetType: 'monthly',
              budgetAmount: 500,
              currency: 'EUR',
              startDate: '2026-05-28',
              endDate: '2026-06-27',
              createdAt: '2026-04-28T08:00:00.000Z'
            }
          ]
        };
      }
      return [];
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(ExpenseService);
    await service.load();

    await service.saveBudgetSettings({
      budgetType: 'monthly',
      budgetAmount: 550,
      startDate: '2026-05-28',
      currency: 'EUR'
    });

    expect(service.getBudgetCycles().map((cycle) => cycle.id)).toEqual([
      'cycle-monthly-2026-05-28',
      'cycle-monthly-2026-04-28'
    ]);
  });

  it('persists an updated budget currency into settings and generated cycles', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses || key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-05-28',
            currency: 'EUR',
            updatedAt: '2026-05-28T08:00:00.000Z'
          },
          cycles: []
        };
      }
      return [];
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(ExpenseService);
    await service.load();

    await service.saveBudgetSettings({
      budgetType: 'monthly',
      budgetAmount: 500,
      startDate: '2026-05-28',
      currency: 'usd'
    });

    expect(service.getBudgetSettings()).toMatchObject({
      currency: 'USD'
    });
    expect(service.getActiveBudgetCycle(JUNE_3_LOCAL_NOON)).toMatchObject({
      currency: 'USD'
    });
    expect(service.getDisplayCurrency(JUNE_3_LOCAL_NOON)).toBe('USD');
  });

  it('reassigns an edited expense to the matching past cycle when the date changes', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses) {
        return [
          {
            id: 'expense-1',
            title: 'Milk',
            amount: 20,
            category: 'dairy',
            quantity: 1,
            discount: 0,
            totalAmount: 20,
            date: '2026-06-03T10:00:00.000Z',
            budgetCycleId: 'cycle-monthly-2026-05-28'
          }
        ];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-04-28',
            currency: 'EUR',
            updatedAt: '2026-04-28T08:00:00.000Z'
          },
          cycles: [
            {
              id: 'cycle-monthly-2026-04-28',
              budgetType: 'monthly',
              budgetAmount: 500,
              currency: 'EUR',
              startDate: '2026-04-28',
              endDate: '2026-05-27',
              createdAt: '2026-04-28T08:00:00.000Z'
            },
            {
              id: 'cycle-monthly-2026-05-28',
              budgetType: 'monthly',
              budgetAmount: 500,
              currency: 'EUR',
              startDate: '2026-05-28',
              endDate: '2026-06-27',
              createdAt: '2026-04-28T08:00:00.000Z'
            }
          ]
        };
      }
      if (key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      return [];
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(ExpenseService);
    await service.load();

    await service.updateExpense('expense-1', {
      title: 'Milk',
      amount: 20,
      quantity: 1,
      discount: 0,
      category: 'dairy',
      date: '2026-05-01T10:00:00.000Z'
    });

    expect(service.getById('expense-1')).toMatchObject({
      date: '2026-05-01T10:00:00.000Z',
      budgetCycleId: 'cycle-monthly-2026-04-28'
    });
  });

  it('backfills older monthly cycles when earlier expenses exist', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses) {
        return [
          {
            id: 'expense-may',
            title: 'Rice',
            amount: 42,
            category: 'pulses',
            quantity: 1,
            discount: 0,
            totalAmount: 42,
            date: '2026-05-10T09:00:00.000Z'
          }
        ];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-05-28',
            currency: 'EUR',
            updatedAt: '2026-05-28T08:00:00.000Z'
          },
          cycles: []
        };
      }
      if (key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      return [];
    });
    storage.set.mockResolvedValue(undefined);

    const service = TestBed.inject(ExpenseService);
    await service.load();

    expect(service.getBudgetCycles().map((cycle) => cycle.id)).toContain('cycle-monthly-2026-04-28');
    expect(service.getById('expense-may')?.budgetCycleId).toBe('cycle-monthly-2026-04-28');
  });

  it('shows and resolves only cycles for the currently selected budget type', async () => {
    storage.get.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.expenses || key === STORAGE_KEYS.expensePurchases) {
        return [];
      }
      if (key === STORAGE_KEYS.expenseBudget) {
        return {
          settings: {
            budgetType: 'monthly',
            budgetAmount: 500,
            startDate: '2026-05-28',
            currency: 'EUR',
            updatedAt: '2026-05-28T08:00:00.000Z'
          },
          cycles: [
            {
              id: 'cycle-weekly-2026-06-01',
              budgetType: 'weekly',
              budgetAmount: 125,
              currency: 'EUR',
              startDate: '2026-06-01',
              endDate: '2026-06-07',
              createdAt: '2026-06-01T08:00:00.000Z'
            },
            {
              id: 'cycle-monthly-2026-05-28',
              budgetType: 'monthly',
              budgetAmount: 500,
              currency: 'EUR',
              startDate: '2026-05-28',
              endDate: '2026-06-27',
              createdAt: '2026-05-28T08:00:00.000Z'
            }
          ]
        };
      }
      return [];
    });

    const service = TestBed.inject(ExpenseService);
    await service.load();

    expect(service.getBudgetCycles().map((cycle) => cycle.id)).toEqual(['cycle-monthly-2026-05-28']);
    expect(service.getActiveBudgetCycle(JUNE_3_LOCAL_NOON)?.id).toBe('cycle-monthly-2026-05-28');
  });
});
