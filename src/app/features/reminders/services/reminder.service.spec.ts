// @vitest-environment jsdom
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NotificationsService } from '../../../core/services/notifications.service';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryConsumptionService } from '../../pantry/services/pantry-consumption.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { ExpenseService } from '../../expenses/services/expense.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { DEFAULT_REMINDER_STORE } from '../models/reminder.model';
import { ReminderRepositoryService } from './reminder-repository.service';
import { ReminderService } from './reminder.service';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized.
}

function createPantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'milk',
    name: 'Milk',
    category: 'dairy',
    unit: 'count',
    quantity: 1,
    minQuantity: 2,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: '2026-03-18',
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    ...overrides
  };
}

describe('ReminderService', () => {
  const pantryItems = signal<readonly PantryItem[]>([]);
  const shoppingItems = signal<any[]>([]);
  const expensePurchases = signal<any[]>([]);
  const repository = {
    getStore: vi.fn(),
    saveStore: vi.fn()
  };
  const expenseService = {
    purchases: computed(() => expensePurchases()),
    getActiveBudgetCycle: vi.fn(),
    getCycleOverview: vi.fn(),
    getDisplayCurrency: vi.fn()
  };
  const notifications = {
    hasPermission: vi.fn(),
    replaceScheduledReminders: vi.fn()
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T08:00:00'));
    pantryItems.set([]);
    shoppingItems.set([]);
    expensePurchases.set([]);
    repository.getStore.mockReset();
    repository.saveStore.mockReset();
    expenseService.getActiveBudgetCycle.mockReset();
    expenseService.getCycleOverview.mockReset();
    expenseService.getDisplayCurrency.mockReset();
    notifications.hasPermission.mockReset();
    notifications.replaceScheduledReminders.mockReset();
    repository.getStore.mockResolvedValue(DEFAULT_REMINDER_STORE);
    repository.saveStore.mockResolvedValue(undefined);
    expenseService.getActiveBudgetCycle.mockReturnValue(null);
    expenseService.getCycleOverview.mockReturnValue(null);
    expenseService.getDisplayCurrency.mockReturnValue('EUR');
    notifications.hasPermission.mockResolvedValue(true);
    notifications.replaceScheduledReminders.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        ReminderService,
        {
          provide: ReminderRepositoryService,
          useValue: repository
        },
        {
          provide: NotificationsService,
          useValue: notifications
        },
        {
          provide: PantryStateService,
          useValue: {
            items: computed(() => pantryItems()),
            getById: (itemId: string | null) => pantryItems().find((item) => item.id === itemId)
          }
        },
        {
          provide: PantryConsumptionService,
          useValue: {
            consume: vi.fn().mockResolvedValue(true)
          }
        },
        {
          provide: ShoppingListStateService,
          useValue: {
            items: computed(() => shoppingItems()),
            activeItems: computed(() => shoppingItems().filter((item) => !item.completed)),
            getActiveLinkedPantryItem: (itemId: string) =>
              shoppingItems().find((item) => item.linkedPantryItemId === itemId && !item.completed),
            addFromPantryItem: vi.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: SettingsService,
          useValue: {
            settings: computed(() => DEFAULT_APP_SETTINGS)
          }
        },
        {
          provide: ExpenseService,
          useValue: expenseService
        }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('derives expiry and low-stock reminders from pantry data', async () => {
    pantryItems.set([createPantryItem()]);
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.sync();

    const reminders = service.reminders();
    expect(reminders.map((reminder) => reminder.type)).toEqual(
      expect.arrayContaining(['expiry', 'low-stock'])
    );
    expect(reminders.find((reminder) => reminder.type === 'expiry')?.description).toContain(
      'Expires in 3 days'
    );
    expect(reminders.find((reminder) => reminder.type === 'low-stock')?.description).toContain(
      'Current Qty: 1'
    );
  });

  it('creates and exposes custom reminders from stored local data', async () => {
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.createCustomReminder({
      name: 'Plan weekly groceries',
      recurrence: 'weekly',
      date: '2026-03-20',
      time: '10:00',
      notes: 'Review pantry before ordering'
    });

    const customReminders = service.getVisibleReminders('custom');
    expect(customReminders).toHaveLength(1);
    expect(customReminders[0]).toMatchObject({
      title: 'Plan weekly groceries',
      type: 'custom',
      description: 'Review pantry before ordering'
    });
    expect(repository.saveStore).toHaveBeenCalled();
  });

  it('moves manually completed reminders into the completed collection', async () => {
    pantryItems.set([createPantryItem()]);
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.sync();

    const lowStockReminder = service.getVisibleReminders('low-stock')[0];
    await service.markDone(lowStockReminder.id);

    const completed = service.getCompletedReminders('all');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      type: 'low-stock',
      completedByAction: 'MARK_DONE',
      isAutoResolved: false
    });
    expect(service.getVisibleReminders('low-stock')).toHaveLength(0);
  });

  it('auto-completes low stock reminders when stock is replenished above threshold', async () => {
    pantryItems.set([createPantryItem()]);
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.sync();
    expect(service.getVisibleReminders('low-stock')).toHaveLength(1);

    pantryItems.set([createPantryItem({ quantity: 4, updatedAt: '2026-03-15T10:00:00.000Z' })]);
    await service.sync();

    expect(service.getVisibleReminders('low-stock')).toHaveLength(0);
    expect(service.getCompletedReminders('all')[0]).toMatchObject({
      type: 'low-stock',
      completedByAction: 'RESTOCKED',
      isAutoResolved: true
    });
  });

  it('moves reminders into the snoozed collection and restores them automatically after the snooze window', async () => {
    pantryItems.set([createPantryItem()]);
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.sync();

    const reminder = service.getVisibleReminders('expiry')[0];
    await service.snooze(reminder.id, '2026-03-15T12:00:00.000Z');

    expect(service.getVisibleReminders('expiry')).toHaveLength(0);
    expect(service.getSnoozedReminders('expiry')).toHaveLength(1);
    expect(service.getReminderCountForState('SNOOZED', 'all')).toBe(1);

    vi.setSystemTime(new Date('2026-03-15T12:01:00.000Z'));
    await service.sync();

    expect(service.getVisibleReminders('expiry')).toHaveLength(1);
    expect(service.getSnoozedReminders('expiry')).toHaveLength(0);
    expect(service.getReminderCountForState('ACTIVE', 'all')).toBeGreaterThan(0);
  });

  it('reactivates a snoozed reminder immediately when activated manually', async () => {
    pantryItems.set([createPantryItem()]);
    const service = TestBed.inject(ReminderService);

    await service.load();
    await service.sync();

    const reminder = service.getVisibleReminders('low-stock')[0];
    await service.snooze(reminder.id, '2026-03-16T09:00:00.000Z');
    expect(service.getSnoozedReminders('low-stock')).toHaveLength(1);

    const snoozedReminder = service.getSnoozedReminders('low-stock')[0];
    await service.activateReminder(snoozedReminder.id);

    expect(service.getVisibleReminders('low-stock')).toHaveLength(1);
    expect(service.getSnoozedReminders('low-stock')).toHaveLength(0);
  });
});
