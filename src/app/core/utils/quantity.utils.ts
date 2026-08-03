import { QuantityUnit } from '../../features/pantry/models/pantry-item.model';

export function formatQuantity(
  quantity: number | null | undefined,
  unit: QuantityUnit | null | undefined
): string {
  if (quantity === null || quantity === undefined || !unit) {
    return 'Not set';
  }

  return `${quantity} ${unit}`;
}
