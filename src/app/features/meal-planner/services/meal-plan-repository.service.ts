import { inject, Injectable } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { PlannedMeal } from '../models/planned-meal.model';

@Injectable({
  providedIn: 'root'
})
export class MealPlanRepositoryService {
  private readonly storage = inject(StorageService);

  /** Raw stored value: validated by the state service, since storage may hold anything. */
  getAll(): Promise<unknown> {
    return this.storage.get<unknown>(STORAGE_KEYS.mealPlan, []);
  }

  saveAll(meals: readonly PlannedMeal[]): Promise<void> {
    return this.storage.set(STORAGE_KEYS.mealPlan, [...meals]);
  }
}
