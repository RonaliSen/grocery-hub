export const PANTRY_CATEGORIES = [
  'vegetables',
  'fruits',
  'dairy',
  'meat',
  'frozen',
  'spices',
  'pulses',
  'nuts',
  'bakery',
  'biscuits',
  'snacks',
  'sauces',
  'beverages'
] as const;

export const LEGACY_PANTRY_CATEGORIES = ['produce', 'grains', 'masala', 'other'] as const;
export const ALL_PANTRY_CATEGORIES = [...LEGACY_PANTRY_CATEGORIES, ...PANTRY_CATEGORIES] as const;

export const QUANTITY_UNITS = ['count', 'kg', 'g', 'l', 'ml', 'pack', 'box'] as const;

export type PantryCategory =
  | (typeof PANTRY_CATEGORIES)[number]
  | (typeof LEGACY_PANTRY_CATEGORIES)[number];
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface PantryItem {
  readonly id: string;
  readonly name: string;
  readonly imageUrl?: string | null;
  readonly category: PantryCategory;
  readonly unit: QuantityUnit;
  readonly quantity: number;
  readonly minQuantity: number;
  readonly avgDailyUsage: number | null;
  readonly autoAddToShoppingList: boolean;
  readonly expiryDate: string | null;
  readonly germanStore: boolean;
  readonly indianStore: boolean;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PantryItemDraft {
  readonly name: string;
  readonly imageUrl?: string | null;
  readonly category: PantryCategory;
  readonly unit: QuantityUnit;
  readonly quantity: number;
  readonly minQuantity: number;
  readonly avgDailyUsage: number | null;
  readonly autoAddToShoppingList: boolean;
  readonly expiryDate: string | null;
  readonly germanStore: boolean;
  readonly indianStore: boolean;
  readonly notes: string | null;
}
