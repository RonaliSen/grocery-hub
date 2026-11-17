import { QUANTITY_UNITS, QuantityUnit } from '../../pantry/models/pantry-item.model';
import { parseAuditQuantity } from '../../pantry/utils/pantry-audit.util';
import { isMealSlotId, MEAL_SLOTS, MealSlotId } from '../models/meal-slot.model';
import {
  DayMealPlan,
  INGREDIENT_MAX_QUANTITY,
  INGREDIENT_NAME_MAX_LENGTH,
  MEAL_NAME_MAX_LENGTH,
  MealIngredient,
  PlannedMeal
} from '../models/planned-meal.model';
import { parseDateOnly } from './meal-planner-week.util';

export const EMPTY_DAY_PLAN: DayMealPlan = { breakfast: [], lunch: [], dinner: [] };

/** What the week view shows for a day without opening it. */
export interface DayPlanSummary {
  readonly mealCount: number;
  /** Slots with at least one meal, in display order. */
  readonly plannedSlots: readonly MealSlotId[];
  /** Every meal name, breakfast first, then lunch, then dinner. */
  readonly mealNames: readonly string[];
  readonly mealNamesBySlot: Readonly<Record<MealSlotId, readonly string[]>>;
}

/** Trims, collapses inner whitespace and caps the length. Empty means "no name". */
export function normalizeMealName(value: string): string {
  return normalizeName(value, MEAL_NAME_MAX_LENGTH);
}

/** Same tidying as meal names, with the ingredient length cap. */
export function normalizeIngredientName(value: string): string {
  return normalizeName(value, INGREDIENT_NAME_MAX_LENGTH);
}

function normalizeName(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
}

export function isQuantityUnit(value: unknown): value is QuantityUnit {
  return typeof value === 'string' && (QUANTITY_UNITS as readonly string[]).includes(value);
}

/** Rounds away floating-point noise, to 3 decimals (e.g. 0.1 + 0.2). */
function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isValidIngredientQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= INGREDIENT_MAX_QUANTITY;
}

export type IngredientAmountInput =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'valid'; readonly value: number };

/**
 * Parses an ingredient amount as typed. Accepts "." or "," as the decimal
 * separator ("1.5", "1,5", ".5"); it must be above 0.
 */
export function parseIngredientAmount(raw: string | null | undefined): IngredientAmountInput {
  const parsed = parseAuditQuantity(raw);

  if (parsed.status === 'empty') return parsed;
  if (parsed.status === 'invalid') return { status: 'invalid', message: 'Enter a number, like 2 or 1.5.' };

  const value = roundQuantity(parsed.value);
  if (value <= 0) return { status: 'invalid', message: 'Enter an amount above 0.' };
  if (value > INGREDIENT_MAX_QUANTITY) return { status: 'invalid', message: 'That amount is too large.' };

  return { status: 'valid', value };
}

/** Guards an ingredient read back from storage. */
export function isMealIngredient(value: unknown): value is MealIngredient {
  if (typeof value !== 'object' || value === null) return false;

  const ingredient = value as Record<string, unknown>;
  return (
    typeof ingredient['id'] === 'string' &&
    ingredient['id'].length > 0 &&
    typeof ingredient['name'] === 'string' &&
    normalizeIngredientName(ingredient['name']).length > 0 &&
    isValidIngredientQuantity(ingredient['quantity']) &&
    isQuantityUnit(ingredient['unit'])
  );
}

/**
 * Turns a value read back from storage into a meal, or null if it isn't one —
 * so one bad entry can't break the planner. Meals saved before ingredients
 * existed get an empty list; malformed ingredients are dropped.
 */
export function toPlannedMeal(value: unknown): PlannedMeal | null {
  if (typeof value !== 'object' || value === null) return null;

  const meal = value as Record<string, unknown>;
  const valid =
    typeof meal['id'] === 'string' &&
    meal['id'].length > 0 &&
    typeof meal['date'] === 'string' &&
    parseDateOnly(meal['date']) !== null &&
    isMealSlotId(meal['slot']) &&
    typeof meal['name'] === 'string' &&
    normalizeMealName(meal['name']).length > 0 &&
    typeof meal['createdAt'] === 'string';

  if (!valid) return null;

  const ingredients = Array.isArray(meal['ingredients']) ? meal['ingredients'].filter(isMealIngredient) : [];
  return { ...(meal as unknown as PlannedMeal), ingredients };
}

/** Groups meals by day, then slot. Order within a slot is kept as given. */
export function groupMealsByDate(meals: readonly PlannedMeal[]): ReadonlyMap<string, DayMealPlan> {
  const byDate = new Map<string, Record<MealSlotId, PlannedMeal[]>>();

  for (const meal of meals) {
    let day = byDate.get(meal.date);
    if (!day) {
      day = { breakfast: [], lunch: [], dinner: [] };
      byDate.set(meal.date, day);
    }
    day[meal.slot].push(meal);
  }

  return byDate;
}

export function summarizeDayPlan(plan: DayMealPlan): DayPlanSummary {
  const names = (slot: MealSlotId) => plan[slot].map((meal) => meal.name);
  const mealNamesBySlot = { breakfast: names('breakfast'), lunch: names('lunch'), dinner: names('dinner') };
  const plannedSlots = MEAL_SLOTS.filter((slot) => mealNamesBySlot[slot.id].length > 0).map((slot) => slot.id);
  const mealNames = MEAL_SLOTS.flatMap((slot) => mealNamesBySlot[slot.id]);

  return { mealCount: mealNames.length, plannedSlots, mealNames, mealNamesBySlot };
}
