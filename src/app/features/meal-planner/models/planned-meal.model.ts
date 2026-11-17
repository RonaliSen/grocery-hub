import { QuantityUnit } from '../../pantry/models/pantry-item.model';
import { MealSlotId } from './meal-slot.model';

/** Longest meal name accepted, in characters. */
export const MEAL_NAME_MAX_LENGTH = 80;

/** Longest ingredient name accepted, in characters. */
export const INGREDIENT_NAME_MAX_LENGTH = 60;

/** Largest ingredient amount accepted (in its unit). */
export const INGREDIENT_MAX_QUANTITY = 100_000;

/** Something needed to make a meal, and how much. Units are the app's pantry units. */
export interface MealIngredient {
  readonly id: string;
  readonly name: string;
  /** Always above 0. */
  readonly quantity: number;
  readonly unit: QuantityUnit;
}

/** A meal the user has planned for one slot on one day. */
export interface PlannedMeal {
  readonly id: string;
  /** Local `YYYY-MM-DD` of the day it's planned for. */
  readonly date: string;
  readonly slot: MealSlotId;
  readonly name: string;
  /** ISO timestamp; meals in a slot are listed in the order they were added. */
  readonly createdAt: string;
  /** In the order they were added. Meals saved before ingredients existed load with none. */
  readonly ingredients: readonly MealIngredient[];
}

/** One day's meals, by slot. */
export type DayMealPlan = Readonly<Record<MealSlotId, readonly PlannedMeal[]>>;
