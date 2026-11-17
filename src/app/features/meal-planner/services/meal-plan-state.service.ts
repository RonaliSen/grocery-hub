import { computed, inject, Injectable, signal } from '@angular/core';

import { createId } from '../../../core/utils/id.utils';
import { MealSlotId, isMealSlotId } from '../models/meal-slot.model';
import { DayMealPlan, MealIngredient, PlannedMeal } from '../models/planned-meal.model';
import { QuantityUnit } from '../../pantry/models/pantry-item.model';
import {
  EMPTY_DAY_PLAN,
  groupMealsByDate,
  isQuantityUnit,
  isValidIngredientQuantity,
  normalizeIngredientName,
  normalizeMealName,
  toPlannedMeal
} from '../utils/meal-plan.util';
import { parseDateOnly } from '../utils/meal-planner-week.util';
import { MealPlanRepositoryService } from './meal-plan-repository.service';

/** What the user enters for an ingredient. */
export interface IngredientDraft {
  readonly name: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
}

/** The tidied ingredient, or the reason it isn't valid. */
function validateIngredient(ingredient: IngredientDraft): IngredientDraft | Error {
  const name = normalizeIngredientName(ingredient.name);

  if (!name) {
    return new Error('An ingredient needs a name.');
  }
  if (!isValidIngredientQuantity(ingredient.quantity)) {
    return new Error(`Invalid ingredient amount: ${ingredient.quantity}`);
  }
  if (!isQuantityUnit(ingredient.unit)) {
    return new Error(`Invalid ingredient unit: ${ingredient.unit}`);
  }

  return { name, quantity: ingredient.quantity, unit: ingredient.unit };
}

/** Planned meals for every day, saved on-device. Loaded at app start by AppInitService. */
@Injectable({
  providedIn: 'root'
})
export class MealPlanStateService {
  private readonly repository = inject(MealPlanRepositoryService);
  private readonly mealsState = signal<readonly PlannedMeal[]>([]);

  /**
   * Writes run one at a time, each starting from the previous one's result, so
   * two quick saves can't overwrite each other.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  readonly meals = this.mealsState.asReadonly();
  private readonly mealsByDate = computed(() => groupMealsByDate(this.mealsState()));
  private readonly mealsById = computed(() => new Map(this.mealsState().map((meal) => [meal.id, meal])));

  async load(): Promise<void> {
    const stored = await this.repository.getAll();
    const meals = Array.isArray(stored) ? stored.map(toPlannedMeal) : [];
    this.mealsState.set(meals.filter((meal): meal is PlannedMeal => meal !== null));
  }

  /** A day's meals by slot (empty slots are empty arrays). `date` is `YYYY-MM-DD`. */
  mealsFor(date: string): DayMealPlan {
    return this.mealsByDate().get(date) ?? EMPTY_DAY_PLAN;
  }

  /** A planned meal by id, or null if there's no such meal (e.g. it was removed). */
  getMeal(mealId: string | null | undefined): PlannedMeal | null {
    return (mealId && this.mealsById().get(mealId)) || null;
  }

  /**
   * Plans a meal. The name is tidied (trimmed, spaces collapsed); throws if
   * it ends up empty, or if the date or slot isn't valid. Rejects if saving fails,
   * in which case nothing changes.
   */
  addMeal(date: string, slot: MealSlotId, name: string): Promise<PlannedMeal> {
    const mealName = normalizeMealName(name);

    if (!mealName) {
      return Promise.reject(new Error('A meal needs a name.'));
    }
    if (parseDateOnly(date) === null) {
      return Promise.reject(new Error(`Invalid meal date: ${date}`));
    }
    if (!isMealSlotId(slot)) {
      return Promise.reject(new Error(`Invalid meal slot: ${slot}`));
    }

    return this.enqueueWrite(async () => {
      const meal: PlannedMeal = {
        id: createId('meal'),
        date,
        slot,
        name: mealName,
        createdAt: new Date().toISOString(),
        ingredients: []
      };
      await this.persist([...this.mealsState(), meal]);
      return meal;
    });
  }

  /**
   * Renames a planned meal, keeping its day, slot and position. The name is
   * tidied like in `addMeal`; throws if it ends up empty. Resolves null if the
   * meal no longer exists. Rejects if saving fails, in which case nothing changes.
   */
  renameMeal(mealId: string, name: string): Promise<PlannedMeal | null> {
    const mealName = normalizeMealName(name);

    if (!mealName) {
      return Promise.reject(new Error('A meal needs a name.'));
    }

    return this.updateMeal(mealId, (meal) => (meal.name === mealName ? meal : { ...meal, name: mealName }));
  }

  /**
   * Adds an ingredient to a meal (at the end of its list). The name is tidied
   * like meal names; throws if it ends up empty, or if the amount (above 0) or
   * unit isn't valid. Resolves null if the meal no longer exists. Rejects if
   * saving fails, in which case nothing changes.
   */
  addIngredient(mealId: string, ingredient: IngredientDraft): Promise<MealIngredient | null> {
    const draft = validateIngredient(ingredient);
    if (draft instanceof Error) {
      return Promise.reject(draft);
    }

    const added: MealIngredient = { id: createId('ingredient'), ...draft };

    return this.updateMeal(mealId, (meal) => ({ ...meal, ingredients: [...meal.ingredients, added] })).then(
      (meal) => (meal ? added : null)
    );
  }

  /**
   * Changes an ingredient's name, amount and unit, keeping its id and its
   * place in the list; the meal's other ingredients are untouched. Validated
   * like `addIngredient`. Resolves null if the meal or the ingredient no longer
   * exists. Rejects if saving fails, in which case nothing changes.
   */
  updateIngredient(mealId: string, ingredientId: string, ingredient: IngredientDraft): Promise<MealIngredient | null> {
    const draft = validateIngredient(ingredient);
    if (draft instanceof Error) {
      return Promise.reject(draft);
    }

    let updated: MealIngredient | null = null;

    return this.updateMeal(mealId, (meal) => {
      const current = meal.ingredients.find((candidate) => candidate.id === ingredientId);
      if (!current) {
        return meal;
      }

      const unchanged =
        current.name === draft.name && current.quantity === draft.quantity && current.unit === draft.unit;
      updated = unchanged ? current : { ...current, ...draft };

      return unchanged
        ? meal
        : {
            ...meal,
            ingredients: meal.ingredients.map((candidate) => (candidate.id === ingredientId ? updated! : candidate))
          };
    }).then(() => updated);
  }

  /**
   * Removes an ingredient from a meal. Resolves false if the meal or the
   * ingredient was already gone.
   */
  removeIngredient(mealId: string, ingredientId: string): Promise<boolean> {
    let removed = false;

    return this.updateMeal(mealId, (meal) => {
      const ingredients = meal.ingredients.filter((ingredient) => ingredient.id !== ingredientId);
      removed = ingredients.length !== meal.ingredients.length;
      return removed ? { ...meal, ingredients } : meal;
    }).then(() => removed);
  }

  /**
   * Copies a meal — its name and every ingredient with its amount and unit —
   * to another day and slot (the same day in another slot works too). The copy
   * is a new, independent meal: new ids for it and its ingredients, added at the
   * end of the target slot. The original is not changed. Throws if the date or
   * slot isn't valid; resolves null if the original no longer exists.
   */
  copyMeal(mealId: string, date: string, slot: MealSlotId): Promise<PlannedMeal | null> {
    if (parseDateOnly(date) === null) {
      return Promise.reject(new Error(`Invalid meal date: ${date}`));
    }
    if (!isMealSlotId(slot)) {
      return Promise.reject(new Error(`Invalid meal slot: ${slot}`));
    }

    return this.enqueueWrite(async () => {
      const current = this.mealsState();
      const original = current.find((meal) => meal.id === mealId);

      if (!original) {
        return null;
      }

      const copy: PlannedMeal = {
        id: createId('meal'),
        date,
        slot,
        name: original.name,
        createdAt: new Date().toISOString(),
        ingredients: original.ingredients.map((ingredient) => ({ ...ingredient, id: createId('ingredient') }))
      };
      await this.persist([...current, copy]);
      return copy;
    });
  }

  /** Removes a planned meal. Resolves false if it was already gone. */
  removeMeal(mealId: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      const current = this.mealsState();
      const next = current.filter((meal) => meal.id !== mealId);

      if (next.length === current.length) {
        return false;
      }

      await this.persist(next);
      return true;
    });
  }

  /**
   * Replaces one meal with `change(meal)`, saving only if it actually changed.
   * Resolves to the (possibly unchanged) meal, or null if it doesn't exist.
   */
  private updateMeal(mealId: string, change: (meal: PlannedMeal) => PlannedMeal): Promise<PlannedMeal | null> {
    return this.enqueueWrite(async () => {
      const current = this.mealsState();
      const meal = current.find((candidate) => candidate.id === mealId);

      if (!meal) {
        return null;
      }

      const next = change(meal);
      if (next !== meal) {
        await this.persist(current.map((candidate) => (candidate.id === mealId ? next : candidate)));
      }
      return next;
    });
  }

  private enqueueWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(write);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  /** Saves first; the in-memory plan only changes once storage has it. */
  private async persist(meals: readonly PlannedMeal[]): Promise<void> {
    await this.repository.saveAll(meals);
    this.mealsState.set(meals);
  }
}
