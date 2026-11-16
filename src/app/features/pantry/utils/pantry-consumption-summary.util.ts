import { PantryConsumptionLog } from '../models/pantry-consumption.model';

export interface PantryConsumptionSummary {
  /** Number of different items that have been used at least once. */
  readonly itemsConsumed: number;
  /** Total quantity used across all items (sum of the logged amounts). */
  readonly unitsUsed: number;
  /** Number of different items that have been restocked at least once. */
  readonly itemsRestocked: number;
}

/**
 * Summarises the recorded consumption history.
 *
 * - "Use" (`decrement`) and "mark empty" (`empty`) entries count as consumption.
 * - "Restock" (`increment`) entries count as restocks.
 * - Entries for items that were later deleted still count: it's history.
 * - Deleting an item (`deleted`) is not consumption and counts towards nothing.
 */
export function summarizePantryConsumption(
  logs: readonly PantryConsumptionLog[]
): PantryConsumptionSummary {
  const consumedItemIds = new Set<string>();
  const restockedItemIds = new Set<string>();
  let unitsUsed = 0;

  for (const log of logs) {
    // Logs come from storage; skip anything that isn't a real, positive change.
    if (!Number.isFinite(log.amount) || log.amount <= 0) {
      continue;
    }

    if (log.actionType === 'increment') {
      restockedItemIds.add(log.itemId);
    } else if (log.actionType === 'decrement' || log.actionType === 'empty') {
      consumedItemIds.add(log.itemId);
      unitsUsed += log.amount;
    }
  }

  return {
    itemsConsumed: consumedItemIds.size,
    // Drop floating-point noise from adding decimals (0.1 + 0.2 → 0.3).
    unitsUsed: Math.round(unitsUsed * 1_000_000) / 1_000_000,
    itemsRestocked: restockedItemIds.size
  };
}
