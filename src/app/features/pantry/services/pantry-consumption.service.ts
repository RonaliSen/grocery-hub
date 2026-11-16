import { computed, inject, Injectable, signal } from '@angular/core';

import { createId } from '../../../core/utils/id.utils';
import { PantryConsumptionActionType, PantryConsumptionLog } from '../models/pantry-consumption.model';
import { PantryConsumptionRepositoryService } from './pantry-consumption-repository.service';
import { PantryStateService } from './pantry-state.service';

@Injectable({
  providedIn: 'root'
})
export class PantryConsumptionService {
  private readonly repository = inject(PantryConsumptionRepositoryService);
  private readonly pantryState = inject(PantryStateService);
  private readonly logsState = signal<readonly PantryConsumptionLog[]>([]);
  private readonly loadedState = signal(false);
  private loadPromise: Promise<void> | null = null;
  /**
   * Quantity changes run one at a time. Each change reads the current quantity
   * and then waits for storage, so letting them overlap (e.g. a quick double tap
   * on "Use") would base both on the same stale quantity and could record more
   * consumption than was available.
   */
  private pendingChange: Promise<unknown> = Promise.resolve();

  readonly logs = computed(() => this.logsState());
  readonly loaded = computed(() => this.loadedState());

  async load(): Promise<void> {
    if (this.loadedState()) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.repository
      .getAll()
      .then((logs) => {
        this.logsState.set(this.sortLogs(logs));
        this.loadedState.set(true);
      })
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  getLogsForItem(itemId: string | null): readonly PantryConsumptionLog[] {
    if (!itemId) {
      return [];
    }

    return this.logsState().filter((log) => log.itemId === itemId);
  }

  async consume(itemId: string, requestedAmount: number): Promise<boolean> {
    return this.applyConsumption(itemId, requestedAmount, 'decrement');
  }

  /**
   * Same as `consume`, but returns the recorded entry (or null when nothing was
   * used) so the use can be reverted with `undoConsumption`.
   */
  consumeUndoable(itemId: string, requestedAmount: number): Promise<PantryConsumptionLog | null> {
    return this.enqueue(() => this.applyConsumptionNow(itemId, requestedAmount, 'decrement'));
  }

  /**
   * Reverts a use (`decrement` / `empty` entry): gives the used amount back to
   * the item and removes the entry, so totals, trends and Recent Activity read
   * as if it never happened — rather than recording a separate restock.
   *
   * Returns false when there is nothing to revert: the entry is gone (already
   * undone), isn't a use, or its item has been deleted since.
   */
  undoConsumption(logId: string): Promise<boolean> {
    return this.enqueue(async () => {
      await this.load();

      const log = this.logsState().find((entry) => entry.id === logId);
      if (!log || (log.actionType !== 'decrement' && log.actionType !== 'empty')) {
        return false;
      }

      const item = this.pantryState.getById(log.itemId);
      if (!item) {
        return false;
      }

      // Add the amount back (rather than resetting to previousQuantity) so any
      // later change to the item is kept.
      const restoredQuantity = Math.round((item.quantity + log.amount) * 1_000_000) / 1_000_000;
      await this.pantryState.setQuantity(item.id, restoredQuantity);

      try {
        await this.saveLogs(this.logsState().filter((entry) => entry.id !== logId));
      } catch (error) {
        // Keep quantity and history consistent: put the quantity back as well.
        await this.pantryState.setQuantity(item.id, item.quantity);
        throw error;
      }

      return true;
    });
  }

  async markEmpty(itemId: string): Promise<boolean> {
    const item = this.pantryState.getById(itemId);
    return this.applyConsumption(itemId, item?.quantity ?? 0, 'empty');
  }

  async adjust(itemId: string, amount: number): Promise<boolean> {
    if (amount === 0) {
      return false;
    }

    const actionType = amount > 0 ? 'increment' : 'decrement';
    return this.applyConsumption(itemId, Math.abs(amount), actionType);
  }

  /**
   * Deletes a pantry item and records a `deleted` entry with its name and unit,
   * so the item's history stays readable. Deleting is not consumption: it
   * doesn't count towards any consumption totals.
   */
  removeItem(itemId: string): Promise<boolean> {
    return this.enqueue(async () => {
      await this.load();

      const item = this.pantryState.getById(itemId);
      if (!item) {
        return false;
      }

      await this.pantryState.remove(itemId);
      await this.appendLog({
        id: createId('consumption'),
        itemId,
        actionType: 'deleted',
        amount: item.quantity,
        previousQuantity: item.quantity,
        nextQuantity: 0,
        createdAt: new Date().toISOString(),
        itemName: item.name,
        unit: item.unit
      });

      return true;
    });
  }

  private applyConsumption(
    itemId: string,
    requestedAmount: number,
    actionType: PantryConsumptionActionType
  ): Promise<boolean> {
    return this.enqueue(async () => (await this.applyConsumptionNow(itemId, requestedAmount, actionType)) !== null);
  }

  private enqueue<T>(change: () => Promise<T>): Promise<T> {
    const result = this.pendingChange.then(change);
    // A failed change must not block the ones queued after it.
    this.pendingChange = result.catch(() => undefined);
    return result;
  }

  private async applyConsumptionNow(
    itemId: string,
    requestedAmount: number,
    actionType: PantryConsumptionActionType
  ): Promise<PantryConsumptionLog | null> {
    await this.load();

    const item = this.pantryState.getById(itemId);
    if (!item) {
      return null;
    }

    const previousQuantity = item.quantity;
    let nextQuantity: number;
    let amount: number;

    if (actionType === 'increment') {
      amount = requestedAmount;
      nextQuantity = previousQuantity + amount;
    } else {
      amount = Math.min(previousQuantity, requestedAmount);
      nextQuantity = Math.max(0, previousQuantity - amount);

      if (amount <= 0) {
        return null;
      }
    }

    if (nextQuantity === previousQuantity && actionType !== 'empty') {
      return null;
    }

    const log: PantryConsumptionLog = {
      id: createId('consumption'),
      itemId,
      actionType,
      amount,
      previousQuantity,
      nextQuantity,
      createdAt: new Date().toISOString(),
      itemName: item.name,
      unit: item.unit
    };

    await this.pantryState.setQuantity(itemId, nextQuantity);
    await this.appendLog(log);

    return log;
  }

  private async appendLog(log: PantryConsumptionLog): Promise<void> {
    await this.saveLogs([log, ...this.logsState()]);
  }

  private async saveLogs(logs: readonly PantryConsumptionLog[]): Promise<void> {
    const nextLogs = this.sortLogs(logs);

    await this.repository.saveAll(nextLogs);
    this.logsState.set(nextLogs);
    this.loadedState.set(true);
  }

  private sortLogs(logs: readonly PantryConsumptionLog[]): readonly PantryConsumptionLog[] {
    return [...logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
