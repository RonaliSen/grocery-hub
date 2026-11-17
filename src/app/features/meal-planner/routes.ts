import { Routes } from '@angular/router';

export const MEAL_PLANNER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/meal-planner.page').then((m) => m.MealPlannerPage)
  },
  {
    path: ':date',
    loadComponent: () => import('./pages/meal-planner-day.page').then((m) => m.MealPlannerDayPage)
  },
  {
    path: ':date/meals/:mealId',
    loadComponent: () => import('./pages/meal-planner-meal.page').then((m) => m.MealPlannerMealPage)
  }
];
