import { formatQuantity } from '../../../core/utils/quantity.utils';
import { PantryConsumptionLog } from '../models/pantry-consumption.model';
import { PantryItem, QuantityUnit } from '../models/pantry-item.model';

export type PantryActivityKind = 'used' | 'restocked' | 'deleted';

export interface PantryActivityEntry {
  readonly id: string;
  readonly itemId: string;
  /** Null only when the name can't be recovered (see `buildPantryActivity`). */
  readonly itemName: string | null;
  readonly kind: PantryActivityKind;
  /** Signed change, e.g. "−1 kg" or "+2 count". Null for deletions. */
  readonly quantityLabel: string | null;
  /** ISO timestamp of the activity. */
  readonly createdAt: string;
  /** Local date and time, e.g. "Mar 01, 2026, 08:00 AM". */
  readonly dateTimeLabel: string;
}

export interface PantryItemDetails {
  readonly name: string | null;
  readonly unit: QuantityUnit | null;
}

export interface PantryItemHistoryIndex {
  /** Current pantry items by ID. */
  readonly itemsById: ReadonlyMap<string, PantryItem>;
  /** Each deleted item's `deleted` entry (it holds the name and unit at deletion). */
  readonly deletedById: ReadonlyMap<string, PantryConsumptionLog>;
  /**
   * Name and unit for a history entry, from (in order):
   * 1. the entry itself (saved at the time of the activity), so history keeps
   *    the original name and unit;
   * 2. the current pantry item, for older entries recorded without them;
   * 3. the item's `deleted` entry, for older entries of items deleted since.
   */
  readonly detailsFor: (log: PantryConsumptionLog) => PantryItemDetails;
}

export function indexPantryItemHistory(
  logs: readonly PantryConsumptionLog[],
  items: readonly PantryItem[]
): PantryItemHistoryIndex {
  const itemsById = new Map(items.map((item) => [item.id, item] as const));
  const deletedById = new Map<string, PantryConsumptionLog>();
  for (const log of logs) {
    if (log.actionType === 'deleted' && !deletedById.has(log.itemId)) {
      deletedById.set(log.itemId, log);
    }
  }

  return {
    itemsById,
    deletedById,
    detailsFor: (log) => {
      const item = itemsById.get(log.itemId);
      const deleted = deletedById.get(log.itemId);
      return {
        name: log.itemName ?? item?.name ?? deleted?.itemName ?? null,
        unit: log.unit ?? item?.unit ?? deleted?.unit ?? null
      };
    }
  };
}

/**
 * Turns the recorded consumption history into activity rows, keeping the
 * history's order (the consumption service stores it newest first).
 * Names and units are resolved by `indexPantryItemHistory`.
 */
export function buildPantryActivity(
  logs: readonly PantryConsumptionLog[],
  items: readonly PantryItem[]
): PantryActivityEntry[] {
  const { detailsFor } = indexPantryItemHistory(logs, items);
  const entries: PantryActivityEntry[] = [];

  for (const log of logs) {
    let kind: PantryActivityKind;
    if (log.actionType === 'increment') {
      kind = 'restocked';
    } else if (log.actionType === 'decrement' || log.actionType === 'empty') {
      kind = 'used';
    } else if (log.actionType === 'deleted') {
      kind = 'deleted';
    } else {
      continue;
    }

    // Logs come from storage; skip use/restock entries that aren't a real,
    // positive change. Deletions are kept even for items with 0 left.
    if (kind !== 'deleted' && (!Number.isFinite(log.amount) || log.amount <= 0)) {
      continue;
    }

    const { name, unit } = detailsFor(log);
    let quantityLabel: string | null = null;
    if (kind !== 'deleted') {
      const sign = kind === 'used' ? '−' : '+';
      quantityLabel = `${sign}${unit ? formatQuantity(log.amount, unit) : String(log.amount)}`;
    }

    entries.push({
      id: log.id,
      itemId: log.itemId,
      itemName: name,
      kind,
      quantityLabel,
      createdAt: log.createdAt,
      dateTimeLabel: formatActivityDateTime(log.createdAt)
    });
  }

  return entries;
}

/** Same date and time format as the Reminders screen. */
export function formatActivityDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
