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
    return this.enqueue(() => this.applyConsumptionNow(itemId, requestedAmount, actionType));
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
  ): Promise<boolean> {
    await this.load();

    const item = this.pantryState.getById(itemId);
    if (!item) {
      return false;
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
        return false;
      }
    }

    if (nextQuantity === previousQuantity && actionType !== 'empty') {
      return false;
    }

    await this.pantryState.setQuantity(itemId, nextQuantity);
    await this.appendLog({
      id: createId('consumption'),
      itemId,
      actionType,
      amount,
      previousQuantity,
      nextQuantity,
      createdAt: new Date().toISOString(),
      itemName: item.name,
      unit: item.unit
    });

    return true;
  }

  private async appendLog(log: PantryConsumptionLog): Promise<void> {
    const nextLogs = this.sortLogs([log, ...this.logsState()]);

    await this.repository.saveAll(nextLogs);
    this.logsState.set(nextLogs);
    this.loadedState.set(true);
  }

  private sortLogs(logs: readonly PantryConsumptionLog[]): readonly PantryConsumptionLog[] {
    return [...logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
