import { PlannedMeal } from '../app/features/meal-planner/models/planned-meal.model';

/**
 * Stand-in for MealPlanRepositoryService in specs: keeps the "stored" plan in
 * memory so specs can run the real MealPlanStateService. Set `failNextSave` to
 * simulate a storage error on the next write.
 */
export class InMemoryMealPlanRepository {
  stored: unknown;
  saveCount = 0;
  failNextSave = false;

  constructor(initial: unknown = []) {
    this.stored = initial;
  }

  async getAll(): Promise<unknown> {
    return this.stored;
  }

  async saveAll(meals: readonly PlannedMeal[]): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('Simulated storage failure');
    }

    this.saveCount++;
    this.stored = [...meals];
  }

  /** Names stored for one day and slot, in order. */
  namesFor(date: string, slot: PlannedMeal['slot']): string[] {
    return (this.stored as PlannedMeal[])
      .filter((meal) => meal.date === date && meal.slot === slot)
      .map((meal) => meal.name);
  }
}

export function plannedMeal(overrides: Partial<PlannedMeal> & Pick<PlannedMeal, 'date' | 'slot' | 'name'>): PlannedMeal {
  return {
    id: `meal-${overrides.date}-${overrides.slot}-${overrides.name}`,
    createdAt: '2026-11-01T08:00:00.000Z',
    ingredients: [],
    ...overrides
  };
}
