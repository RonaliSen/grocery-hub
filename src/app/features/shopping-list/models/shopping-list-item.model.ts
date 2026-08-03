import { QuantityUnit } from '../../pantry/models/pantry-item.model';

export interface ShoppingListItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly quantityOverridden: boolean;
  readonly unit: QuantityUnit | null;
  readonly linkedPantryItemId: string | null;
  readonly source: 'manual' | 'low-stock' | 'expiry';
  readonly germanStore: boolean;
  readonly indianStore: boolean;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ShoppingListItemDraft {
  readonly name: string;
  readonly quantity: number;
  readonly unit: QuantityUnit | null;
  readonly linkedPantryItemId: string | null;
  readonly source: 'manual' | 'low-stock' | 'expiry';
  readonly germanStore: boolean;
  readonly indianStore: boolean;
}
