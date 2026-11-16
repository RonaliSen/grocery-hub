import { formatQuantity } from '../../../core/utils/quantity.utils';
import { PantryConsumptionLog } from '../models/pantry-consumption.model';
import { PantryItem, QuantityUnit } from '../models/pantry-item.model';
import { indexPantryItemHistory } from './pantry-activity.util';

export const TOP_CONSUMED_LIMIT = 5;

export interface TopConsumedItem {
  readonly itemId: string;
  /** Null only when the name can't be recovered from history. */
  readonly itemName: string | null;
  readonly unit: QuantityUnit | null;
  /** Total quantity used, in `unit`. */
  readonly totalUsed: number;
  /** e.g. "3.5 kg" */
  readonly quantityLabel: string;
  /** The item is no longer in the pantry. */
  readonly isDeleted: boolean;
  /** When it was last used (ISO); breaks ties. */
  readonly lastUsedAt: string;
}

/**
 * Ranks items by total quantity used ("Use" and "mark empty" entries), most
 * first. Ties go to the item used most recently, then by name.
 *
 * - Items are grouped by pantry item ID, matching "Items Consumed".
 * - If an item's unit changed over time (e.g. kg → g), each unit is totalled
 *   separately rather than adding different units together.
 * - Deleted items still count: it's history.
 */
export function rankTopConsumedItems(
  logs: readonly PantryConsumptionLog[],
  items: readonly PantryItem[],
  limit = TOP_CONSUMED_LIMIT
): TopConsumedItem[] {
  const { itemsById, deletedById, detailsFor } = indexPantryItemHistory(logs, items);

  interface Group {
    itemId: string;
    unit: QuantityUnit | null;
    total: number;
    lastUsedAt: string;
    /** Name from the newest use, used if the item is gone and wasn't recorded as deleted. */
    newestName: string | null;
  }
  const groups = new Map<string, Group>();

  for (const log of logs) {
    if (log.actionType !== 'decrement' && log.actionType !== 'empty') {
      continue;
    }
    // Logs come from storage; skip anything that isn't a real, positive change.
    if (!Number.isFinite(log.amount) || log.amount <= 0) {
      continue;
    }

    const { name, unit } = detailsFor(log);
    const key = `${log.itemId}\u0000${unit ?? ''}`;
    const group = groups.get(key);

    if (group) {
      group.total += log.amount;
      if (log.createdAt > group.lastUsedAt) {
        group.lastUsedAt = log.createdAt;
        group.newestName = name;
      }
    } else {
      groups.set(key, {
        itemId: log.itemId,
        unit,
        total: log.amount,
        lastUsedAt: log.createdAt,
        newestName: name
      });
    }
  }

  return [...groups.values()]
    .map((group): TopConsumedItem => {
      // Show the item's latest name: as it is now, or as it was when deleted.
      const itemName =
        itemsById.get(group.itemId)?.name ??
        deletedById.get(group.itemId)?.itemName ??
        group.newestName;
      // Drop floating-point noise from adding decimals (0.1 + 0.2 → 0.3).
      const totalUsed = Math.round(group.total * 1_000_000) / 1_000_000;

      return {
        itemId: group.itemId,
        itemName,
        unit: group.unit,
        totalUsed,
        quantityLabel: group.unit ? formatQuantity(totalUsed, group.unit) : String(totalUsed),
        isDeleted: !itemsById.has(group.itemId),
        lastUsedAt: group.lastUsedAt
      };
    })
    .sort(
      (left, right) =>
        right.totalUsed - left.totalUsed ||
        right.lastUsedAt.localeCompare(left.lastUsedAt) ||
        (left.itemName ?? '').localeCompare(right.itemName ?? '')
    )
    .slice(0, limit);
}
