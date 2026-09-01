import { PantryItem } from '../models/pantry-item.model';

export type PantryStockStatus = 'out-of-stock' | 'low-stock' | 'in-stock';

const UNIT_LOW_STOCK_FLOORS = {
  g: 200,
  l: 1
} as const;

function getUnitLowStockFloor(unit: PantryItem['unit']): number | null {
  return UNIT_LOW_STOCK_FLOORS[unit as keyof typeof UNIT_LOW_STOCK_FLOORS] ?? null;
}

export function getPantryLowStockThreshold(
  item: Pick<PantryItem, 'unit' | 'minQuantity'>,
  defaultThreshold = item.minQuantity
): number {
  const unitFloor = getUnitLowStockFloor(item.unit);
  const baselineThreshold = Math.max(item.minQuantity, defaultThreshold);

  if (unitFloor === null) {
    return baselineThreshold;
  }

  return Math.max(baselineThreshold, unitFloor);
}

export function isPantryItemBelowThreshold(
  item: Pick<PantryItem, 'quantity' | 'minQuantity' | 'unit' | 'expiryDate'>,
  defaultThreshold = item.minQuantity
): boolean {
  if (item.quantity > 1) {
    return false;
  }

  const baselineThreshold = Math.max(item.minQuantity, defaultThreshold);
  if (item.quantity <= baselineThreshold) {
    return true;
  }

  const unitFloor = getUnitLowStockFloor(item.unit);
  if (unitFloor === null) {
    return false;
  }

  return item.quantity < unitFloor;
}

export function shouldShowPantryLowStock(
  item: Pick<PantryItem, 'quantity' | 'minQuantity' | 'unit' | 'expiryDate'>,
  defaultThreshold = item.minQuantity
): boolean {
  return isPantryItemBelowThreshold(item, defaultThreshold);
}

export function getPantryStockStatus(
  item: Pick<PantryItem, 'quantity' | 'minQuantity' | 'unit' | 'expiryDate'>,
  defaultThreshold = item.minQuantity
): PantryStockStatus {
  if (item.quantity <= 0) {
    return 'out-of-stock';
  }

  if (shouldShowPantryLowStock(item, defaultThreshold)) {
    return 'low-stock';
  }

  return 'in-stock';
}
