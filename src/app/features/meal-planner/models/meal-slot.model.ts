export const MEAL_SLOT_IDS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealSlotId = (typeof MEAL_SLOT_IDS)[number];

export interface MealSlotDefinition {
  readonly id: MealSlotId;
  readonly label: string;
  readonly emoji: string;
  /** Example shown in the empty "add meal" field. */
  readonly placeholder: string;
}

/** The meal slots every day has, in the order they're shown. */
export const MEAL_SLOTS: readonly MealSlotDefinition[] = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳', placeholder: 'e.g. Porridge with berries' },
  { id: 'lunch', label: 'Lunch', emoji: '🥗', placeholder: 'e.g. Chicken wrap' },
  { id: 'dinner', label: 'Dinner', emoji: '🍝', placeholder: 'e.g. Vegetable curry' }
];

export function isMealSlotId(value: unknown): value is MealSlotId {
  return typeof value === 'string' && (MEAL_SLOT_IDS as readonly string[]).includes(value);
}
