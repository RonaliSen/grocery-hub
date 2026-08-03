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

  private async applyConsumption(
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

    const nextLogs = this.sortLogs([
      {
        id: createId('consumption'),
        itemId,
        actionType,
        amount,
        previousQuantity,
        nextQuantity,
        createdAt: new Date().toISOString()
      },
      ...this.logsState()
    ]);

    await this.repository.saveAll(nextLogs);
    this.logsState.set(nextLogs);
    this.loadedState.set(true);

    return true;
  }

  private sortLogs(logs: readonly PantryConsumptionLog[]): readonly PantryConsumptionLog[] {
    return [...logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
