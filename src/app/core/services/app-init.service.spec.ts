// @vitest-environment jsdom
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized.
}

import { DEFAULT_APP_SETTINGS } from '../constants/app-config';
import { PantryStateService } from '../../features/pantry/services/pantry-state.service';
import { ExpenseService } from '../../features/expenses/services/expense.service';
import { ReminderService } from '../../features/reminders/services/reminder.service';
import { SettingsService } from '../../features/settings/services/settings.service';
import { ShoppingListStateService } from '../../features/shopping-list/services/shopping-list-state.service';
import { StorageService } from './storage.service';
import { AppInitService } from './app-init.service';

describe('AppInitService', () => {
  const calls: string[] = [];
  const pantryItems = signal<readonly string[]>(['pantry-items']);
  const shoppingItems = signal<readonly string[]>([]);
  const settingsState = signal({
    ...DEFAULT_APP_SETTINGS,
    defaultAutoAddToShoppingList: true
  });
  const storage = {
    initialize: vi.fn(async () => {
      calls.push('storage');
    })
  };
  const pantryState = {
    load: vi.fn(async () => {
      calls.push('pantry');
    }),
    items: pantryItems
  };
  const shoppingState = {
    load: vi.fn(async () => {
      calls.push('shopping');
    }),
    items: shoppingItems,
    syncAutoAddLowStockItems: vi.fn(async () => {
      calls.push('auto-add');
    })
  };
  const expenseService = {
    load: vi.fn(async () => {
      calls.push('expense');
    })
  };
  const settingsService = {
    load: vi.fn(async () => {
      calls.push('settings');
    }),
    settings: settingsState
  };
  const reminderService = {
    sync: vi.fn(async () => {
      calls.push('reminder');
    })
  };

  beforeEach(() => {
    calls.length = 0;
    storage.initialize.mockClear();
    pantryState.load.mockClear();
    pantryItems.set(['pantry-items']);
    shoppingState.load.mockClear();
    shoppingItems.set([]);
    shoppingState.syncAutoAddLowStockItems.mockClear();
    settingsService.load.mockClear();
    settingsState.set({
      ...DEFAULT_APP_SETTINGS,
      defaultAutoAddToShoppingList: true
    });
    reminderService.sync.mockClear();

    TestBed.configureTestingModule({
      providers: [
        AppInitService,
        {
          provide: StorageService,
          useValue: storage
        },
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
          useValue: settingsService
        },
        {
          provide: ReminderService,
          useValue: reminderService
        },
        {
          provide: ExpenseService,
          useValue: expenseService
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads settings before syncing reminders during startup', async () => {
    const service = TestBed.inject(AppInitService);

    await service.initialize();

    expect(calls).toEqual([
      'storage',
      'settings',
      'pantry',
      'shopping',
      'expense',
      'auto-add',
      'reminder'
    ]);
    expect(shoppingState.syncAutoAddLowStockItems).toHaveBeenCalledWith(['pantry-items'], true);
    expect(reminderService.sync).toHaveBeenCalledWith(['pantry-items'], settingsState());
  });

  it('does not rerun auto-add when only the shopping list changes after initialization', async () => {
    const service = TestBed.inject(AppInitService);

    await service.initialize();
    shoppingState.syncAutoAddLowStockItems.mockClear();
    reminderService.sync.mockClear();
    calls.length = 0;

    pantryItems.set(['skip-consumer']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    shoppingState.syncAutoAddLowStockItems.mockClear();
    reminderService.sync.mockClear();

    shoppingItems.set(['changed-shopping-items']);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shoppingState.syncAutoAddLowStockItems).not.toHaveBeenCalled();
    expect(reminderService.sync).not.toHaveBeenCalled();

    // Changing pantry data should still trigger the runtime sync.
    pantryItems.set(['changed-pantry-items']);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shoppingState.syncAutoAddLowStockItems).toHaveBeenCalledWith(
      ['changed-pantry-items'],
      true
    );
  });
});
