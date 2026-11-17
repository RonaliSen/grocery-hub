import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryMealPlanRepository, plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { MealSlotId } from '../models/meal-slot.model';
import { PlannedMeal } from '../models/planned-meal.model';
import { MealPlanRepositoryService } from './meal-plan-repository.service';
import { MealPlanStateService } from './meal-plan-state.service';

describe('MealPlanStateService', () => {
  let repository: InMemoryMealPlanRepository;

  function createService(stored: unknown = []): MealPlanStateService {
    repository = new InMemoryMealPlanRepository(stored);
    TestBed.configureTestingModule({
      providers: [{ provide: MealPlanRepositoryService, useValue: repository }]
    });
    return TestBed.inject(MealPlanStateService);
  }

  function names(service: MealPlanStateService, date: string, slot: MealSlotId): string[] {
    return service.mealsFor(date)[slot].map((meal) => meal.name);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('load', () => {
    it('loads stored meals', async () => {
      const service = createService([
        plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Porridge' }),
        plannedMeal({ date: '2026-11-16', slot: 'dinner', name: 'Curry' })
      ]);

      await service.load();

      expect(names(service, '2026-11-16', 'breakfast')).toEqual(['Porridge']);
      expect(names(service, '2026-11-16', 'dinner')).toEqual(['Curry']);
    });

    it('skips malformed entries instead of failing', async () => {
      const service = createService([
        plannedMeal({ date: '2026-11-16', slot: 'lunch', name: 'Soup' }),
        { id: 'bad', date: 'nope', slot: 'lunch', name: 'Broken', createdAt: '' },
        null,
        'junk'
      ]);

      await service.load();

      expect(service.meals().map((meal) => meal.name)).toEqual(['Soup']);
    });

    it.each([
      ['nothing stored', []],
      ['a non-array value', { meals: [] }],
      ['null', null]
    ])('starts empty with %s', async (_label, stored) => {
      const service = createService(stored);

      await service.load();

      expect(service.meals()).toEqual([]);
    });
  });

  describe('mealsFor', () => {
    it('returns empty slots for a day with nothing planned', async () => {
      const service = createService();
      await service.load();

      expect(service.mealsFor('2026-11-16')).toEqual({ breakfast: [], lunch: [], dinner: [] });
    });
  });

  describe('addMeal', () => {
    it('saves the meal to the given day and slot', async () => {
      const service = createService();
      await service.load();

      const meal = await service.addMeal('2026-11-16', 'lunch', 'Chicken wrap');

      expect(meal).toMatchObject({ date: '2026-11-16', slot: 'lunch', name: 'Chicken wrap' });
      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Chicken wrap']);
      expect(names(service, '2026-11-16', 'breakfast')).toEqual([]);
      expect(names(service, '2026-11-17', 'lunch')).toEqual([]);
      expect(repository.namesFor('2026-11-16', 'lunch')).toEqual(['Chicken wrap']);
    });

    it('keeps meals in the order they were added', async () => {
      const service = createService();
      await service.load();

      await service.addMeal('2026-11-16', 'breakfast', 'Porridge');
      await service.addMeal('2026-11-16', 'breakfast', 'Coffee');

      expect(names(service, '2026-11-16', 'breakfast')).toEqual(['Porridge', 'Coffee']);
    });

    it('tidies the name before saving', async () => {
      const service = createService();
      await service.load();

      await service.addMeal('2026-11-16', 'dinner', '   Vegetable    curry  ');

      expect(repository.namesFor('2026-11-16', 'dinner')).toEqual(['Vegetable curry']);
    });

    it('gives each meal its own id', async () => {
      const service = createService();
      await service.load();

      const first = await service.addMeal('2026-11-16', 'dinner', 'Curry');
      const second = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      expect(first.id).not.toBe(second.id);
    });

    it.each([
      ['a blank name', '2026-11-16', 'lunch', '   '],
      ['an invalid date', '2026-02-30', 'lunch', 'Soup'],
      ['an unknown slot', '2026-11-16', 'brunch', 'Soup']
    ])('rejects %s without saving', async (_label, date, slot, name) => {
      const service = createService();
      await service.load();

      await expect(service.addMeal(date, slot as MealSlotId, name)).rejects.toThrow();
      expect(service.meals()).toEqual([]);
      expect(repository.saveCount).toBe(0);
    });

    it('leaves the plan unchanged when saving fails', async () => {
      const service = createService();
      await service.load();
      await service.addMeal('2026-11-16', 'lunch', 'Soup');

      repository.failNextSave = true;
      await expect(service.addMeal('2026-11-16', 'lunch', 'Salad')).rejects.toThrow();

      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Soup']);
      expect(repository.namesFor('2026-11-16', 'lunch')).toEqual(['Soup']);
    });

    it('keeps working after a failed save', async () => {
      const service = createService();
      await service.load();

      repository.failNextSave = true;
      await expect(service.addMeal('2026-11-16', 'lunch', 'Soup')).rejects.toThrow();
      await service.addMeal('2026-11-16', 'lunch', 'Salad');

      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Salad']);
    });

    it('does not lose meals saved at the same time', async () => {
      const service = createService();
      await service.load();

      await Promise.all([
        service.addMeal('2026-11-16', 'breakfast', 'Porridge'),
        service.addMeal('2026-11-16', 'lunch', 'Soup'),
        service.addMeal('2026-11-17', 'dinner', 'Curry')
      ]);

      expect(service.meals().map((meal) => meal.name)).toEqual(['Porridge', 'Soup', 'Curry']);
      expect((repository.stored as unknown[]).length).toBe(3);
    });
  });

  describe('renameMeal', () => {
    it('changes the name, keeping the day, slot, id and position', async () => {
      const service = createService();
      await service.load();
      await service.addMeal('2026-11-16', 'dinner', 'Curry');
      const pasta = await service.addMeal('2026-11-16', 'dinner', 'Pasta');
      await service.addMeal('2026-11-16', 'dinner', 'Salad');

      const renamed = await service.renameMeal(pasta.id, 'Pizza');

      expect(renamed).toEqual({ ...pasta, name: 'Pizza' });
      expect(names(service, '2026-11-16', 'dinner')).toEqual(['Curry', 'Pizza', 'Salad']);
      expect(repository.namesFor('2026-11-16', 'dinner')).toEqual(['Curry', 'Pizza', 'Salad']);
    });

    it('tidies the new name', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'lunch', 'Soup');

      await service.renameMeal(meal.id, '   Tomato    soup ');

      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Tomato soup']);
    });

    it('does not save when the name is unchanged', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'lunch', 'Soup');
      const saves = repository.saveCount;

      await expect(service.renameMeal(meal.id, ' Soup ')).resolves.toEqual(meal);
      expect(repository.saveCount).toBe(saves);
    });

    it('rejects a blank name without saving', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'lunch', 'Soup');
      const saves = repository.saveCount;

      await expect(service.renameMeal(meal.id, '   ')).rejects.toThrow();
      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Soup']);
      expect(repository.saveCount).toBe(saves);
    });

    it('resolves null when the meal no longer exists', async () => {
      const service = createService();
      await service.load();

      await expect(service.renameMeal('missing', 'Pizza')).resolves.toBeNull();
      expect(service.meals()).toEqual([]);
    });

    it('keeps the old name when saving fails', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'lunch', 'Soup');

      repository.failNextSave = true;
      await expect(service.renameMeal(meal.id, 'Salad')).rejects.toThrow();

      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Soup']);
      expect(repository.namesFor('2026-11-16', 'lunch')).toEqual(['Soup']);
    });

    it('does not lose changes made at the same time', async () => {
      const service = createService();
      await service.load();
      const soup = await service.addMeal('2026-11-16', 'lunch', 'Soup');
      const curry = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      await Promise.all([
        service.renameMeal(soup.id, 'Salad'),
        service.removeMeal(curry.id),
        service.addMeal('2026-11-16', 'breakfast', 'Toast')
      ]);

      expect(service.meals().map((meal) => meal.name)).toEqual(['Salad', 'Toast']);
      expect((repository.stored as { name: string }[]).map((meal) => meal.name)).toEqual(['Salad', 'Toast']);
    });
  });

  describe('ingredients', () => {
    function ingredientsOf(service: MealPlanStateService, mealId: string): string[] {
      return (service.getMeal(mealId)?.ingredients ?? []).map((i) => `${i.name} ${i.quantity} ${i.unit}`);
    }

    function storedIngredientsOf(mealId: string): string[] {
      const meal = (repository.stored as { id: string; ingredients: { name: string; quantity: number; unit: string }[] }[])
        .find((candidate) => candidate.id === mealId);
      return (meal?.ingredients ?? []).map((i) => `${i.name} ${i.quantity} ${i.unit}`);
    }

    it('starts new meals with no ingredients', async () => {
      const service = createService();
      await service.load();

      const meal = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      expect(meal.ingredients).toEqual([]);
    });

    it('loads meals saved before ingredients existed', async () => {
      const { ingredients: _ingredients, ...legacy } = plannedMeal({ date: '2026-11-16', slot: 'lunch', name: 'Soup' });
      const service = createService([legacy]);

      await service.load();

      expect(service.getMeal(legacy.id)?.ingredients).toEqual([]);
    });

    it('looks meals up by id', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      expect(service.getMeal(meal.id)).toEqual(meal);
      expect(service.getMeal('missing')).toBeNull();
      expect(service.getMeal(null)).toBeNull();
    });

    it('adds ingredients in order and saves them', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');

      const flour = await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' });
      await service.addIngredient(meal.id, { name: 'Milk', quantity: 0.3, unit: 'l' });

      expect(flour).toMatchObject({ name: 'Flour', quantity: 200, unit: 'g' });
      expect(flour?.id).toBeTruthy();
      expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l']);
      expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l']);
    });

    it('tidies the ingredient name', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      await service.addIngredient(meal.id, { name: '  Red    onion ', quantity: 2, unit: 'count' });

      expect(ingredientsOf(service, meal.id)).toEqual(['Red onion 2 count']);
    });

    it('only changes the meal it was added to', async () => {
      const service = createService();
      await service.load();
      const pancakes = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      const curry = await service.addMeal('2026-11-16', 'dinner', 'Curry');

      await service.addIngredient(pancakes.id, { name: 'Flour', quantity: 200, unit: 'g' });

      expect(ingredientsOf(service, curry.id)).toEqual([]);
    });

    it.each([
      ['a blank name', { name: '  ', quantity: 1, unit: 'g' }],
      ['a zero amount', { name: 'Flour', quantity: 0, unit: 'g' }],
      ['a negative amount', { name: 'Flour', quantity: -1, unit: 'g' }],
      ['a non-finite amount', { name: 'Flour', quantity: NaN, unit: 'g' }],
      ['an unknown unit', { name: 'Flour', quantity: 1, unit: 'cup' }]
    ])('rejects %s without saving', async (_label, ingredient) => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'dinner', 'Curry');
      const saves = repository.saveCount;

      await expect(service.addIngredient(meal.id, ingredient as never)).rejects.toThrow();
      expect(ingredientsOf(service, meal.id)).toEqual([]);
      expect(repository.saveCount).toBe(saves);
    });

    it('resolves null when adding to a meal that no longer exists', async () => {
      const service = createService();
      await service.load();

      await expect(service.addIngredient('missing', { name: 'Flour', quantity: 1, unit: 'g' })).resolves.toBeNull();
      expect(repository.saveCount).toBe(0);
    });

    it('removes only the chosen ingredient', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' });
      const milk = (await service.addIngredient(meal.id, { name: 'Milk', quantity: 0.3, unit: 'l' }))!;
      await service.addIngredient(meal.id, { name: 'Eggs', quantity: 2, unit: 'count' });

      await expect(service.removeIngredient(meal.id, milk.id)).resolves.toBe(true);

      expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g', 'Eggs 2 count']);
      expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g', 'Eggs 2 count']);
    });

    it('resolves false without saving when the ingredient or meal is already gone', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      const saves = repository.saveCount;

      await expect(service.removeIngredient(meal.id, 'missing')).resolves.toBe(false);
      await expect(service.removeIngredient('missing', 'missing')).resolves.toBe(false);
      expect(repository.saveCount).toBe(saves);
    });

    it('leaves ingredients unchanged when saving fails', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      const flour = (await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' }))!;

      repository.failNextSave = true;
      await expect(service.addIngredient(meal.id, { name: 'Milk', quantity: 1, unit: 'l' })).rejects.toThrow();
      repository.failNextSave = true;
      await expect(service.removeIngredient(meal.id, flour.id)).rejects.toThrow();

      expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g']);
      expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g']);
    });

    describe('updateIngredient', () => {
      async function pancakesWithThree(service: MealPlanStateService) {
        const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
        const flour = (await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' }))!;
        const milk = (await service.addIngredient(meal.id, { name: 'Milk', quantity: 0.3, unit: 'l' }))!;
        const eggs = (await service.addIngredient(meal.id, { name: 'Eggs', quantity: 2, unit: 'count' }))!;
        return { meal, flour, milk, eggs };
      }

      it('changes name, amount and unit, keeping its id and place', async () => {
        const service = createService();
        await service.load();
        const { meal, milk } = await pancakesWithThree(service);

        const updated = await service.updateIngredient(meal.id, milk.id, { name: 'Oat milk', quantity: 300, unit: 'ml' });

        expect(updated).toEqual({ id: milk.id, name: 'Oat milk', quantity: 300, unit: 'ml' });
        expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g', 'Oat milk 300 ml', 'Eggs 2 count']);
        expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g', 'Oat milk 300 ml', 'Eggs 2 count']);
      });

      it('leaves the other ingredients exactly as they were', async () => {
        const service = createService();
        await service.load();
        const { meal, flour, milk, eggs } = await pancakesWithThree(service);

        await service.updateIngredient(meal.id, milk.id, { name: 'Milk', quantity: 0.5, unit: 'l' });

        const [first, , third] = service.getMeal(meal.id)!.ingredients;
        expect(first).toEqual(flour);
        expect(third).toEqual(eggs);
      });

      it('changes only the amount or only the unit', async () => {
        const service = createService();
        await service.load();
        const { meal, flour, eggs } = await pancakesWithThree(service);

        await service.updateIngredient(meal.id, flour.id, { name: 'Flour', quantity: 250, unit: 'g' });
        await service.updateIngredient(meal.id, eggs.id, { name: 'Eggs', quantity: 2, unit: 'pack' });

        expect(ingredientsOf(service, meal.id)).toEqual(['Flour 250 g', 'Milk 0.3 l', 'Eggs 2 pack']);
      });

      it('tidies the name', async () => {
        const service = createService();
        await service.load();
        const { meal, flour } = await pancakesWithThree(service);

        await service.updateIngredient(meal.id, flour.id, { name: '  Plain   flour ', quantity: 200, unit: 'g' });

        expect(ingredientsOf(service, meal.id)[0]).toBe('Plain flour 200 g');
      });

      it('does not save when nothing changed', async () => {
        const service = createService();
        await service.load();
        const { meal, flour } = await pancakesWithThree(service);
        const saves = repository.saveCount;

        await expect(
          service.updateIngredient(meal.id, flour.id, { name: ' Flour ', quantity: 200, unit: 'g' })
        ).resolves.toEqual(flour);
        expect(repository.saveCount).toBe(saves);
      });

      it.each([
        ['a blank name', { name: ' ', quantity: 1, unit: 'g' }],
        ['a zero amount', { name: 'Flour', quantity: 0, unit: 'g' }],
        ['an unknown unit', { name: 'Flour', quantity: 1, unit: 'cup' }]
      ])('rejects %s without saving', async (_label, draft) => {
        const service = createService();
        await service.load();
        const { meal, flour } = await pancakesWithThree(service);
        const saves = repository.saveCount;

        await expect(service.updateIngredient(meal.id, flour.id, draft as never)).rejects.toThrow();
        expect(ingredientsOf(service, meal.id)[0]).toBe('Flour 200 g');
        expect(repository.saveCount).toBe(saves);
      });

      it('resolves null when the ingredient or meal is gone', async () => {
        const service = createService();
        await service.load();
        const { meal } = await pancakesWithThree(service);
        const saves = repository.saveCount;

        const draft = { name: 'Rice', quantity: 1, unit: 'kg' } as const;
        await expect(service.updateIngredient(meal.id, 'missing', draft)).resolves.toBeNull();
        await expect(service.updateIngredient('missing', 'missing', draft)).resolves.toBeNull();
        expect(repository.saveCount).toBe(saves);
        expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l', 'Eggs 2 count']);
      });

      it('keeps the old values when saving fails', async () => {
        const service = createService();
        await service.load();
        const { meal, milk } = await pancakesWithThree(service);

        repository.failNextSave = true;
        await expect(
          service.updateIngredient(meal.id, milk.id, { name: 'Milk', quantity: 300, unit: 'ml' })
        ).rejects.toThrow();

        expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l', 'Eggs 2 count']);
        expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l', 'Eggs 2 count']);
      });

      it('does not lose edits made at the same time', async () => {
        const service = createService();
        await service.load();
        const { meal, flour, milk, eggs } = await pancakesWithThree(service);

        await Promise.all([
          service.updateIngredient(meal.id, flour.id, { name: 'Flour', quantity: 250, unit: 'g' }),
          service.updateIngredient(meal.id, milk.id, { name: 'Milk', quantity: 300, unit: 'ml' }),
          service.removeIngredient(meal.id, eggs.id),
          service.addIngredient(meal.id, { name: 'Butter', quantity: 1, unit: 'pack' })
        ]);

        expect(storedIngredientsOf(meal.id)).toEqual(['Flour 250 g', 'Milk 300 ml', 'Butter 1 pack']);
      });
    });

    it('keeps ingredients when the meal is renamed', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' });

      await service.renameMeal(meal.id, 'Crêpes');

      expect(service.getMeal(meal.id)?.name).toBe('Crêpes');
      expect(ingredientsOf(service, meal.id)).toEqual(['Flour 200 g']);
    });

    it('removes the ingredients along with the meal', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');
      await service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' });

      await service.removeMeal(meal.id);

      expect(service.getMeal(meal.id)).toBeNull();
      expect(repository.stored).toEqual([]);
    });

    it('does not lose ingredients added at the same time', async () => {
      const service = createService();
      await service.load();
      const meal = await service.addMeal('2026-11-16', 'breakfast', 'Pancakes');

      await Promise.all([
        service.addIngredient(meal.id, { name: 'Flour', quantity: 200, unit: 'g' }),
        service.addIngredient(meal.id, { name: 'Milk', quantity: 0.3, unit: 'l' }),
        service.renameMeal(meal.id, 'Crêpes'),
        service.addIngredient(meal.id, { name: 'Eggs', quantity: 2, unit: 'count' })
      ]);

      expect(service.getMeal(meal.id)?.name).toBe('Crêpes');
      expect(storedIngredientsOf(meal.id)).toEqual(['Flour 200 g', 'Milk 0.3 l', 'Eggs 2 count']);
    });
  });

  describe('copyMeal', () => {
    async function mondayPasta(service: MealPlanStateService) {
      const pasta = await service.addMeal('2026-11-16', 'dinner', 'Pasta');
      await service.addIngredient(pasta.id, { name: 'Spaghetti', quantity: 500, unit: 'g' });
      await service.addIngredient(pasta.id, { name: 'Tomato sauce', quantity: 1, unit: 'box' });
      await service.addIngredient(pasta.id, { name: 'Parmesan', quantity: 0.05, unit: 'kg' });
      return service.getMeal(pasta.id)!;
    }

    const describeIngredients = (meal: PlannedMeal | null) =>
      (meal?.ingredients ?? []).map((i) => `${i.name} ${i.quantity} ${i.unit}`);

    it('copies the name and every ingredient with its amount and unit to the chosen day and slot', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      const copy = (await service.copyMeal(pasta.id, '2026-11-18', 'dinner'))!;

      expect(copy).toMatchObject({ date: '2026-11-18', slot: 'dinner', name: 'Pasta' });
      expect(describeIngredients(copy)).toEqual(['Spaghetti 500 g', 'Tomato sauce 1 box', 'Parmesan 0.05 kg']);
      expect(names(service, '2026-11-18', 'dinner')).toEqual(['Pasta']);
    });

    it('leaves the original exactly as it was', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      await service.copyMeal(pasta.id, '2026-11-18', 'dinner');

      expect(service.getMeal(pasta.id)).toEqual(pasta);
      expect(names(service, '2026-11-16', 'dinner')).toEqual(['Pasta']);
    });

    it('gives the copy and its ingredients their own ids', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      const copy = (await service.copyMeal(pasta.id, '2026-11-18', 'dinner'))!;

      expect(copy.id).not.toBe(pasta.id);
      const originalIds = new Set(pasta.ingredients.map((i) => i.id));
      expect(copy.ingredients.every((i) => !originalIds.has(i.id))).toBe(true);
      expect(new Set(copy.ingredients.map((i) => i.id)).size).toBe(3);
    });

    it('can copy into another slot, or another slot on the same day', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      await service.copyMeal(pasta.id, '2026-11-17', 'lunch');
      await service.copyMeal(pasta.id, '2026-11-16', 'lunch');

      expect(names(service, '2026-11-17', 'lunch')).toEqual(['Pasta']);
      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Pasta']);
      expect(names(service, '2026-11-16', 'dinner')).toEqual(['Pasta']);
    });

    it('adds the copy after any meals already in that slot', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);
      await service.addMeal('2026-11-18', 'dinner', 'Salad');

      await service.copyMeal(pasta.id, '2026-11-18', 'dinner');

      expect(names(service, '2026-11-18', 'dinner')).toEqual(['Salad', 'Pasta']);
    });

    it('copies a meal with no ingredients', async () => {
      const service = createService();
      await service.load();
      const soup = await service.addMeal('2026-11-16', 'lunch', 'Soup');

      const copy = (await service.copyMeal(soup.id, '2026-11-18', 'lunch'))!;

      expect(copy.name).toBe('Soup');
      expect(copy.ingredients).toEqual([]);
    });

    it('saves the copy, so it is there after a restart', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);
      const copy = (await service.copyMeal(pasta.id, '2026-11-18', 'dinner'))!;
      const stored = repository.stored;

      TestBed.resetTestingModule();
      const restarted = createService(stored);
      await restarted.load();

      expect(restarted.getMeal(copy.id)).toEqual(copy);
      expect(restarted.getMeal(pasta.id)).toEqual(pasta);
    });

    describe('afterwards, the two meals are edited separately', () => {
      async function pastaAndCopy(service: MealPlanStateService) {
        const pasta = await mondayPasta(service);
        const copy = (await service.copyMeal(pasta.id, '2026-11-18', 'dinner'))!;
        return { pasta, copy };
      }

      it('renaming one leaves the other', async () => {
        const service = createService();
        await service.load();
        const { pasta, copy } = await pastaAndCopy(service);

        await service.renameMeal(copy.id, 'Pasta bake');
        expect(service.getMeal(pasta.id)?.name).toBe('Pasta');

        await service.renameMeal(pasta.id, 'Pasta al pomodoro');
        expect(service.getMeal(copy.id)?.name).toBe('Pasta bake');
      });

      it("editing one's ingredient leaves the other's", async () => {
        const service = createService();
        await service.load();
        const { pasta, copy } = await pastaAndCopy(service);

        await service.updateIngredient(copy.id, copy.ingredients[0].id, { name: 'Spaghetti', quantity: 750, unit: 'g' });
        expect(describeIngredients(service.getMeal(pasta.id))[0]).toBe('Spaghetti 500 g');

        await service.updateIngredient(pasta.id, pasta.ingredients[1].id, { name: 'Passata', quantity: 500, unit: 'ml' });
        expect(describeIngredients(service.getMeal(copy.id))[1]).toBe('Tomato sauce 1 box');
      });

      it('adding or removing ingredients on one leaves the other', async () => {
        const service = createService();
        await service.load();
        const { pasta, copy } = await pastaAndCopy(service);

        await service.addIngredient(copy.id, { name: 'Basil', quantity: 1, unit: 'pack' });
        await service.removeIngredient(pasta.id, pasta.ingredients[2].id);

        expect(describeIngredients(service.getMeal(pasta.id))).toEqual(['Spaghetti 500 g', 'Tomato sauce 1 box']);
        expect(describeIngredients(service.getMeal(copy.id))).toEqual([
          'Spaghetti 500 g',
          'Tomato sauce 1 box',
          'Parmesan 0.05 kg',
          'Basil 1 pack'
        ]);
      });

      it('removing one leaves the other', async () => {
        const service = createService();
        await service.load();
        const { pasta, copy } = await pastaAndCopy(service);

        await service.removeMeal(pasta.id);

        expect(service.getMeal(pasta.id)).toBeNull();
        expect(service.getMeal(copy.id)).toEqual(copy);
      });
    });

    it.each([
      ['an invalid date', '2026-02-30', 'dinner'],
      ['an unknown slot', '2026-11-18', 'brunch']
    ])('rejects %s without saving', async (_label, date, slot) => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);
      const saves = repository.saveCount;

      await expect(service.copyMeal(pasta.id, date, slot as MealSlotId)).rejects.toThrow();
      expect(repository.saveCount).toBe(saves);
      expect(service.meals()).toHaveLength(1);
    });

    it('resolves null when the original no longer exists', async () => {
      const service = createService();
      await service.load();

      await expect(service.copyMeal('missing', '2026-11-18', 'dinner')).resolves.toBeNull();
      expect(service.meals()).toEqual([]);
    });

    it('changes nothing when saving fails', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      repository.failNextSave = true;
      await expect(service.copyMeal(pasta.id, '2026-11-18', 'dinner')).rejects.toThrow();

      expect(service.meals()).toEqual([pasta]);
      expect(repository.stored).toHaveLength(1);
    });

    it('does not lose copies made at the same time as other changes', async () => {
      const service = createService();
      await service.load();
      const pasta = await mondayPasta(service);

      await Promise.all([
        service.copyMeal(pasta.id, '2026-11-18', 'dinner'),
        service.renameMeal(pasta.id, 'Pasta al pomodoro'),
        service.copyMeal(pasta.id, '2026-11-20', 'lunch')
      ]);

      expect(names(service, '2026-11-16', 'dinner')).toEqual(['Pasta al pomodoro']);
      // Writes run in order: the first copy was made before the rename, the second after.
      expect(names(service, '2026-11-18', 'dinner')).toEqual(['Pasta']);
      expect(names(service, '2026-11-20', 'lunch')).toEqual(['Pasta al pomodoro']);
      expect(repository.stored).toHaveLength(3);
    });
  });

  describe('removeMeal', () => {
    it('removes only that meal', async () => {
      const service = createService();
      await service.load();
      const porridge = await service.addMeal('2026-11-16', 'breakfast', 'Porridge');
      await service.addMeal('2026-11-16', 'breakfast', 'Coffee');

      await expect(service.removeMeal(porridge.id)).resolves.toBe(true);

      expect(names(service, '2026-11-16', 'breakfast')).toEqual(['Coffee']);
      expect(repository.namesFor('2026-11-16', 'breakfast')).toEqual(['Coffee']);
    });

    it('resolves false without saving when the meal is already gone', async () => {
      const service = createService();
      await service.load();
      const saves = repository.saveCount;

      await expect(service.removeMeal('missing')).resolves.toBe(false);
      expect(repository.saveCount).toBe(saves);
    });

    it('keeps the meal when saving fails', async () => {
      const service = createService();
      await service.load();
      const soup = await service.addMeal('2026-11-16', 'lunch', 'Soup');

      repository.failNextSave = true;
      await expect(service.removeMeal(soup.id)).rejects.toThrow();

      expect(names(service, '2026-11-16', 'lunch')).toEqual(['Soup']);
    });
  });

  it('restores saved meals in a fresh session', async () => {
    const first = createService();
    await first.load();
    await first.addMeal('2026-11-16', 'dinner', 'Curry');
    const stored = repository.stored;

    TestBed.resetTestingModule();
    const second = createService(stored);
    await second.load();

    expect(names(second, '2026-11-16', 'dinner')).toEqual(['Curry']);
  });
});
