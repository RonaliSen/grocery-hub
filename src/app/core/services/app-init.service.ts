import { effect, inject, Injectable, signal } from '@angular/core';

import { AppSettings } from '../../features/settings/models/app-settings.model';
import { PantryItem } from '../../features/pantry/models/pantry-item.model';
import { PantryStateService } from '../../features/pantry/services/pantry-state.service';
import { ExpenseService } from '../../features/expenses/services/expense.service';
import { ReminderService } from '../../features/reminders/services/reminder.service';
import { SettingsService } from '../../features/settings/services/settings.service';
import { ShoppingListStateService } from '../../features/shopping-list/services/shopping-list-state.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class AppInitService {
  private readonly storage = inject(StorageService);
  private readonly pantryState = inject(PantryStateService);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly settingsService = inject(SettingsService);
  private readonly expenseService = inject(ExpenseService);
  private readonly reminderService = inject(ReminderService);
  private readonly initializedState = signal(false);
  private initialized = false;
  private pendingRuntimeSync:
    | {
        readonly items: readonly PantryItem[];
        readonly settings: AppSettings;
      }
    | null = null;
  private runtimeSyncInFlight = false;
  private skipNextReactiveSync = false;

  constructor() {
    effect(() => {
      if (!this.initializedState()) {
        return;
      }

      const items = this.pantryState.items();
      const settings = this.settingsService.settings();
      this.shoppingState.items();
      this.expenseService.expenses();
      this.expenseService.purchases();
      this.reminderService.loaded();

      if (this.skipNextReactiveSync) {
        this.skipNextReactiveSync = false;
        return;
      }

      this.queueRuntimeSync(items, settings);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storage.initialize();
    await Promise.all([
      this.settingsService.load(),
      this.pantryState.load(),
      this.shoppingState.load(),
      this.expenseService.load(),
      this.reminderService.load()
    ]);
    await this.runRuntimeSync(this.pantryState.items(), this.settingsService.settings());
    this.initialized = true;
    this.skipNextReactiveSync = true;
    this.initializedState.set(true);
  }

  async syncReminders(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.reminderService.sync();
  }

  private queueRuntimeSync(items: readonly PantryItem[], settings: AppSettings): void {
    this.pendingRuntimeSync = { items, settings };

    if (this.runtimeSyncInFlight) {
      return;
    }

    this.runtimeSyncInFlight = true;
    queueMicrotask(() => void this.flushRuntimeSync());
  }

  private async flushRuntimeSync(): Promise<void> {
    while (this.pendingRuntimeSync) {
      const nextSync = this.pendingRuntimeSync;
      this.pendingRuntimeSync = null;
      await this.runRuntimeSync(nextSync.items, nextSync.settings);
    }

    this.runtimeSyncInFlight = false;

    if (this.pendingRuntimeSync) {
      this.runtimeSyncInFlight = true;
      queueMicrotask(() => void this.flushRuntimeSync());
    }
  }

  private async runRuntimeSync(items: readonly PantryItem[], settings: AppSettings): Promise<void> {
    await this.shoppingState.syncAutoAddLowStockItems(items, settings.defaultAutoAddToShoppingList);
    await this.reminderService.sync();
  }
}
