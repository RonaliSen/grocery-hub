import { QuantityUnit } from './pantry-item.model';

/**
 * - `increment`: restocked
 * - `decrement` / `empty`: used
 * - `deleted`: the item was removed from the pantry (not consumption)
 */
export type PantryConsumptionActionType = 'increment' | 'decrement' | 'empty' | 'deleted';

export interface PantryConsumptionLog {
  readonly id: string;
  readonly itemId: string;
  readonly actionType: PantryConsumptionActionType;
  readonly amount: number;
  readonly previousQuantity: number;
  readonly nextQuantity: number;
  readonly createdAt: string;
  /**
   * Item name and unit at the time of the activity, so history keeps them after
   * the item is renamed, changed or deleted. Missing on entries recorded before
   * these fields existed.
   */
  readonly itemName?: string;
  readonly unit?: QuantityUnit;
}
