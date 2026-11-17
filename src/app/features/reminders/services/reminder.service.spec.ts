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
import { AppSettings } from '../../settings/models/app-settings.model';
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
  const settingsState = signal<AppSettings>(DEFAULT_APP_SETTINGS);
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
    settingsState.set(DEFAULT_APP_SETTINGS);
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
            settings: computed(() => settingsState())
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
    // Relative to "now" (local 08:00, set in beforeEach): a fixed UTC time such as 12:00Z is
    // already due in timezones where local 08:00 is 12:00Z or later (e.g. New York in March).
    const snoozeUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await service.snooze(reminder.id, snoozeUntil.toISOString());

    expect(service.getVisibleReminders('expiry')).toHaveLength(0);
    expect(service.getSnoozedReminders('expiry')).toHaveLength(1);
    expect(service.getReminderCountForState('SNOOZED', 'all')).toBe(1);

    vi.setSystemTime(new Date(snoozeUntil.getTime() + 60 * 1000));
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

  describe('expiry reminder lead time', () => {
    // System time: Sun 15 Mar 2026, 08:00 — before the default 09:00 reminder hour.
    function setLeadDays(expiryLeadDays: number): void {
      settingsState.set({
        ...DEFAULT_APP_SETTINGS,
        reminderSettings: { ...DEFAULT_APP_SETTINGS.reminderSettings, expiryLeadDays }
      });
    }

    function expiryTitles(service: ReminderService): string[] {
      return service.getVisibleReminders('expiry').map((reminder) => reminder.title);
    }

    function scheduledExpiryNotifications(): { title: string; at: Date }[] {
      const notifications = notifications_.replaceScheduledReminders.mock.calls.at(-1)?.[0] ?? [];
      return notifications
        .filter((notification: any) => notification.extra?.type === 'expiry')
        .map((notification: any) => ({ title: notification.title, at: notification.schedule.at }));
    }

    const notifications_ = notifications;

    beforeEach(() => {
      pantryItems.set([
        createPantryItem({ id: 'milk', name: 'Milk', minQuantity: 0, expiryDate: '2026-03-16' }),
        createPantryItem({ id: 'eggs', name: 'Eggs', minQuantity: 0, expiryDate: '2026-03-18' }),
        createPantryItem({ id: 'cheese', name: 'Cheese', minQuantity: 0, expiryDate: '2026-03-22' })
      ]);
    });

    it('keeps the previous 3-day window by default', async () => {
      const service = TestBed.inject(ReminderService);
      await service.load();
      await service.sync();

      expect(expiryTitles(service)).toEqual(expect.arrayContaining(['Milk', 'Eggs']));
      expect(expiryTitles(service)).not.toContain('Cheese');
    });

    it.each([
      [1, ['Milk']],
      [3, ['Milk', 'Eggs']],
      [7, ['Milk', 'Eggs', 'Cheese']]
    ])('with %i day(s) it reminds about items expiring within that window', async (leadDays, expected) => {
      setLeadDays(leadDays);
      const service = TestBed.inject(ReminderService);
      await service.load();
      await service.sync();

      expect([...expiryTitles(service)].sort()).toEqual([...expected].sort());
    });

    it('schedules the notification that many days before expiry, at the reminder hour', async () => {
      setLeadDays(7);
      const service = TestBed.inject(ReminderService);
      await service.load();
      await service.sync();

      // Cheese expires on the 22nd: 7 days ahead is today, at 09:00.
      expect(scheduledExpiryNotifications()).toContainEqual({
        title: 'Cheese expires soon',
        at: new Date('2026-03-15T09:00:00')
      });
    });

    it('schedules expiry notifications at a valid date (regression: the date was parsed as just the day)', async () => {
      const service = TestBed.inject(ReminderService);
      await service.load();
      await service.sync();

      const expiryNotifications = scheduledExpiryNotifications();
      expect(expiryNotifications.length).toBeGreaterThan(0);
      for (const { at } of expiryNotifications) {
        expect(Number.isNaN(at.getTime())).toBe(false);
      }
    });

    it('reschedules when the lead time changes', async () => {
      const service = TestBed.inject(ReminderService);
      await service.load();
      await service.sync();
      // 3 days: Eggs (18th) is due today at 09:00; Cheese isn't reminded yet.
      expect(scheduledExpiryNotifications().map((entry) => entry.title)).toEqual(['Eggs expires soon']);

      setLeadDays(1);
      await service.sync();
      // 1 day: only Milk (16th) is due today.
      expect(scheduledExpiryNotifications().map((entry) => entry.title)).toEqual(['Milk expires soon']);
    });
  });
});
