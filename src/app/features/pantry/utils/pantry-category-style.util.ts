import { PantryCategory } from '../models/pantry-item.model';

/**
 * Visual identity for each pantry category in the "Citrus & Ink" screens
 * (pantry list, item cards, add/edit form).
 */

/** Decorative emoji per category. */
export const CATEGORY_EMOJI: Record<PantryCategory, string> = {
  vegetables: '🥦',
  produce: '🥦',
  fruits: '🍓',
  dairy: '🥛',
  meat: '🍗',
  frozen: '🧊',
  spices: '🌶️',
  masala: '🌶️',
  pulses: '🫘',
  grains: '🌾',
  nuts: '🥜',
  bakery: '🥐',
  biscuits: '🍪',
  snacks: '🍿',
  sauces: '🫙',
  beverages: '🧃',
  other: '🛒'
};

/** Pastel tile index (see `--h-tile-N` in src/theme/citrus.scss) per category. */
export const CATEGORY_TILE: Record<PantryCategory, number> = {
  vegetables: 2,
  produce: 2,
  fruits: 6,
  dairy: 4,
  beverages: 4,
  frozen: 4,
  meat: 1,
  spices: 1,
  masala: 1,
  bakery: 3,
  biscuits: 3,
  snacks: 3,
  pulses: 5,
  grains: 5,
  nuts: 5,
  sauces: 6,
  other: 2
};

/** CSS value for a category's tile colour, e.g. `var(--h-tile-4)`. */
export function categoryTileColor(category: PantryCategory | '' | null | undefined): string {
  return `var(--h-tile-${(category && CATEGORY_TILE[category]) || 5})`;
}
