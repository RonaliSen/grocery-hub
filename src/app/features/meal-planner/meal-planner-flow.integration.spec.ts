import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../testing/ionic-standalone.stubs'));

import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { StorageService } from '../../core/services/storage.service';
import { MEAL_PLANNER_ROUTES } from './routes';
import { MealPlanStateService } from './services/meal-plan-state.service';

/**
 * End-to-end check of planning, renaming and removing meals through the real
 * routes, pages, state service and repository. Only the low-level key/value
 * store is replaced, by an in-memory map that survives an "app restart"
 * (tearing down and rebuilding the Angular injector).
 */

class InMemoryStorage {
  constructor(private readonly data: Map<string, unknown>) {}

  async initialize(): Promise<void> {}

  async get<T>(key: string, fallback: T): Promise<T> {
    // Round-trip through JSON like a real store, so no object references are shared.
    return this.data.has(key) ? (JSON.parse(JSON.stringify(this.data.get(key))) as T) : fallback;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

/** Wednesday 18 November 2026 (local time). */
const NOW = new Date(2026, 10, 18, 10, 30);
const WEEK = '/tabs/meal-planner';
const FRIDAY = '2026-11-20';

describe('Meal Planner flow', () => {
  let data: Map<string, unknown>;
  let harness: RouterTestingHarness;

  /** Builds a fresh app (injector) over the same stored data, like relaunching. */
  async function startApp(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'tabs/meal-planner', loadChildren: () => MEAL_PLANNER_ROUTES }]),
        { provide: StorageService, useValue: new InMemoryStorage(data) }
      ]
    });
    // What AppInitService does at startup.
    await TestBed.inject(MealPlanStateService).load();
    harness = await RouterTestingHarness.create();
  }

  async function open(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  function page(): HTMLElement {
    return harness.routeNativeElement!;
  }

  /**
   * Waits for saves to finish. whenStable() alone isn't enough: storage writes
   * are plain promise chains the zoneless app doesn't track, so also wait for a
   * macrotask, by which point every pending promise step has run.
   */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function click(selector: string): void {
    const element = page().querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Nothing matches ${selector}`);
    element.click();
    harness.detectChanges();
  }

  function typeInto(selector: string, value: string): void {
    const field = page().querySelector<HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  /** Meal names in one slot of the open day page. */
  function dayMeals(slot: string): string[] {
    return Array.from(page().querySelectorAll(`[data-slot="${slot}"] .meal-item__name`)).map(
      (el) => el.textContent?.trim() ?? ''
    );
  }

  /** What the open week page shows for a day. */
  function weekStatus(date: string): string | undefined {
    return page()
      .querySelector(`a.day-card[href="${WEEK}/${date}"] .day-card__status`)
      ?.textContent?.trim();
  }

  function weekPlannedSlots(date: string): string[] {
    return Array.from(
      page().querySelectorAll<HTMLElement>(`a.day-card[href="${WEEK}/${date}"] .slot-dot.is-planned`)
    ).map((dot) => dot.dataset['slot'] ?? '');
  }

  async function addMeal(slot: string, name: string): Promise<void> {
    click(`[data-slot="${slot}"] [data-testid="add-meal"]`);
    typeInto(`#meal-name-${slot}`, name);
    click(`[data-slot="${slot}"] [data-testid="save-meal"]`);
    await settle();
  }

  async function renameMeal(label: string, name: string): Promise<void> {
    click(`[aria-label="${label}"]`);
    typeInto('.meal-item--editing input', name);
    click('.meal-item--editing [data-testid="save-meal"]');
    await settle();
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    data = new Map();
    await startApp();

    // Plan Friday: porridge and coffee for breakfast, curry for dinner.
    await open(`${WEEK}/${FRIDAY}`);
    await addMeal('breakfast', 'Porridge');
    await addMeal('breakfast', 'Coffee');
    await addMeal('dinner', 'Vegetable curry');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows planned meals on the day and on the week', async () => {
    expect(dayMeals('breakfast')).toEqual(['Porridge', 'Coffee']);
    expect(dayMeals('dinner')).toEqual(['Vegetable curry']);

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Porridge · Coffee · Vegetable curry');
    expect(weekPlannedSlots(FRIDAY)).toEqual(['breakfast', 'dinner']);
  });

  it('shows a renamed meal on the day, the week, and when the day is reopened', async () => {
    await renameMeal('Edit Vegetable curry for dinner', 'Margherita pizza');
    expect(dayMeals('dinner')).toEqual(['Margherita pizza']);

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Porridge · Coffee · Margherita pizza');
    expect(weekPlannedSlots(FRIDAY)).toEqual(['breakfast', 'dinner']);

    await open(`${WEEK}/${FRIDAY}`);
    expect(dayMeals('breakfast')).toEqual(['Porridge', 'Coffee']);
    expect(dayMeals('dinner')).toEqual(['Margherita pizza']);
  });

  it('shows a removed meal gone from the day, the week, and when the day is reopened', async () => {
    click('[aria-label="Remove Porridge from breakfast"]');
    await settle();
    expect(dayMeals('breakfast')).toEqual(['Coffee']);

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Coffee · Vegetable curry');

    await open(`${WEEK}/${FRIDAY}`);
    expect(dayMeals('breakfast')).toEqual(['Coffee']);
  });

  it('clears the day on the week once its last meals are removed', async () => {
    click('[aria-label="Remove Porridge from breakfast"]');
    await settle();
    click('[aria-label="Remove Coffee from breakfast"]');
    await settle();
    click('[aria-label="Remove Vegetable curry from dinner"]');
    await settle();

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Nothing planned yet');
    expect(weekPlannedSlots(FRIDAY)).toEqual([]);
    expect(page().querySelector(`a.day-card[href="${WEEK}/${FRIDAY}"]`)?.classList).not.toContain('has-meals');
  });

  it('keeps renames and removals after the app restarts', async () => {
    await renameMeal('Edit Coffee for breakfast', 'Green tea');
    click('[aria-label="Remove Vegetable curry from dinner"]');
    await settle();

    await startApp();

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Porridge · Green tea');
    await open(`${WEEK}/${FRIDAY}`);
    expect(dayMeals('breakfast')).toEqual(['Porridge', 'Green tea']);
    expect(dayMeals('dinner')).toEqual([]);
    expect(data.get(STORAGE_KEYS.mealPlan)).toHaveLength(2);
  });

  describe('ingredients', () => {
    function mealIngredients(): string[] {
      return Array.from(page().querySelectorAll('li.ingredient:not(.ingredient--editing)')).map(
        (row) =>
          `${row.querySelector('.ingredient__name')?.textContent?.trim()} = ${row
            .querySelector('.ingredient__amount strong')
            ?.textContent?.trim()} ${row.querySelector('.ingredient__amount small')?.textContent?.trim()}`
      );
    }

    function mealMeta(slot: string): string | undefined {
      return page().querySelector(`[data-slot="${slot}"] .meal-item__meta`)?.textContent?.trim();
    }

    /** Opens a meal from the day page, like tapping it. */
    async function openMeal(slot: string): Promise<void> {
      const href = page().querySelector(`[data-slot="${slot}"] [data-testid="open-meal"]`)!.getAttribute('href')!;
      await open(href);
    }

    function pickUnit(scope: string, unit: string): void {
      const radio = page().querySelector<HTMLInputElement>(`${scope} input[type="radio"][value="${unit}"]`)!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
      harness.detectChanges();
    }

    async function addIngredient(name: string, amount: string, unit: string): Promise<void> {
      if (!page().querySelector('.add-card')) click('[data-testid="open-add-ingredient"]');
      typeInto('#ingredient-name', name);
      typeInto('#ingredient-amount', amount);
      pickUnit('.add-card', unit);
      click('.add-card [data-testid="save-ingredient"]');
      await settle();
    }

    async function editIngredient(name: string, changes: { name?: string; amount?: string; unit?: string }) {
      click(`[data-testid="edit-ingredient"][aria-label^="Edit ${name},"]`);
      if (changes.name !== undefined) typeInto('.ingredient--editing input[id$="-name"]', changes.name);
      if (changes.amount !== undefined) typeInto('.ingredient--editing input[id$="-amount"]', changes.amount);
      if (changes.unit !== undefined) pickUnit('.ingredient--editing', changes.unit);
      click('.ingredient--editing [data-testid="save-ingredient"]');
      await settle();
    }

    async function removeIngredient(name: string): Promise<void> {
      click(`[data-testid="edit-ingredient"][aria-label^="Edit ${name},"]`);
      click(`.ingredient--editing [aria-label="Remove ${name}"]`);
      await settle();
    }

    it('adds ingredients to a meal, shows them when it is reopened, and counts them on the day', async () => {
      expect(mealMeta('dinner')).toBe('Add ingredients');
      await openMeal('dinner');
      expect(page().querySelector('h1')?.textContent?.trim()).toBe('Vegetable curry');

      await addIngredient('Rice', '250', 'g');
      await addIngredient('Coconut milk', '0,4', 'l');
      await addIngredient('Onion', '2', 'count');
      expect(mealIngredients()).toEqual(['Rice = 250 g', 'Coconut milk = 0.4 l', 'Onion = 2 count']);

      await open(`${WEEK}/${FRIDAY}`);
      expect(mealMeta('dinner')).toBe('3 ingredients');
      expect(mealMeta('breakfast')).toBe('Add ingredients');

      await openMeal('dinner');
      expect(mealIngredients()).toEqual(['Rice = 250 g', 'Coconut milk = 0.4 l', 'Onion = 2 count']);
    });

    it('removes ingredients that are no longer needed', async () => {
      await openMeal('dinner');
      await addIngredient('Rice', '250', 'g');
      await addIngredient('Coconut milk', '0,4', 'l');

      await removeIngredient('Rice');
      expect(mealIngredients()).toEqual(['Coconut milk = 0.4 l']);

      await open(`${WEEK}/${FRIDAY}`);
      expect(mealMeta('dinner')).toBe('1 ingredient');
      await openMeal('dinner');
      expect(mealIngredients()).toEqual(['Coconut milk = 0.4 l']);
    });

    it('keeps ingredients after the app restarts', async () => {
      await openMeal('dinner');
      await addIngredient('Rice', '250', 'g');
      await addIngredient('Onion', '2', 'count');
      await removeIngredient('Onion');

      await startApp();

      await open(`${WEEK}/${FRIDAY}`);
      expect(mealMeta('dinner')).toBe('1 ingredient');
      await openMeal('dinner');
      expect(mealIngredients()).toEqual(['Rice = 250 g']);
    });

    it('edits one ingredient without touching the others, and keeps the change', async () => {
      await openMeal('dinner');
      await addIngredient('Rice', '250', 'g');
      await addIngredient('Coconut milk', '0,4', 'l');
      await addIngredient('Onion', '2', 'count');

      // Wrong amount and unit for the coconut milk, and a more specific name.
      await editIngredient('Coconut milk', { name: 'Light coconut milk', amount: '400', unit: 'ml' });
      expect(mealIngredients()).toEqual(['Rice = 250 g', 'Light coconut milk = 400 ml', 'Onion = 2 count']);

      await open(`${WEEK}/${FRIDAY}`);
      expect(mealMeta('dinner')).toBe('3 ingredients');
      await openMeal('dinner');
      expect(mealIngredients()).toEqual(['Rice = 250 g', 'Light coconut milk = 400 ml', 'Onion = 2 count']);

      await startApp();
      await open(`${WEEK}/${FRIDAY}`);
      await openMeal('dinner');
      expect(mealIngredients()).toEqual(['Rice = 250 g', 'Light coconut milk = 400 ml', 'Onion = 2 count']);
    });

    it('keeps ingredients when the meal is renamed', async () => {
      await openMeal('dinner');
      await addIngredient('Rice', '250', 'g');

      await open(`${WEEK}/${FRIDAY}`);
      await renameMeal('Edit Vegetable curry for dinner', 'Chickpea curry');
      await openMeal('dinner');

      expect(page().querySelector('h1')?.textContent?.trim()).toBe('Chickpea curry');
      expect(mealIngredients()).toEqual(['Rice = 250 g']);
    });

    it('shows the meal as gone once it is removed from the day', async () => {
      await openMeal('dinner');
      const mealUrl = TestBed.inject(Router).url;
      await addIngredient('Rice', '250', 'g');

      await open(`${WEEK}/${FRIDAY}`);
      click('[aria-label="Remove Vegetable curry from dinner"]');
      await settle();
      await open(mealUrl);

      expect(page().querySelector('[data-testid="meal-not-found"]')).not.toBeNull();
    });
  });

  describe('copying a meal to another day', () => {
    const MONDAY = '2026-11-16';
    const WEDNESDAY = '2026-11-18';

    function ingredientsShown(): string[] {
      return Array.from(page().querySelectorAll('li.ingredient:not(.ingredient--editing)')).map(
        (row) =>
          `${row.querySelector('.ingredient__name')?.textContent?.trim()} = ${row
            .querySelector('.ingredient__amount strong')
            ?.textContent?.trim()} ${row.querySelector('.ingredient__amount small')?.textContent?.trim()}`
      );
    }

    function choose(selector: string): void {
      const radio = page().querySelector<HTMLInputElement>(selector)!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
      harness.detectChanges();
    }

    async function openMealOn(date: string, slot: string): Promise<string> {
      await open(`${WEEK}/${date}`);
      const href = page().querySelector(`[data-slot="${slot}"] [data-testid="open-meal"]`)!.getAttribute('href')!;
      await open(href);
      return href;
    }

    /** Pasta for Monday dinner: spaghetti, tomato sauce and parmesan. */
    async function planMondayPasta(): Promise<string> {
      await open(`${WEEK}/${MONDAY}`);
      await addMeal('dinner', 'Pasta');
      const url = await openMealOn(MONDAY, 'dinner');
      click('[data-testid="open-add-ingredient"]');
      for (const [name, amount, unit] of [
        ['Spaghetti', '500', 'g'],
        ['Tomato sauce', '1', 'box'],
        ['Parmesan', '50', 'g']
      ]) {
        typeInto('#ingredient-name', name);
        typeInto('#ingredient-amount', amount);
        choose(`.add-card input[type="radio"][value="${unit}"]`);
        click('.add-card [data-testid="save-ingredient"]');
        await settle();
      }
      click('.add-card .ghost-btn');
      return url;
    }

    async function copyTo(date: string): Promise<void> {
      click('[data-testid="open-copy"]');
      choose(`input[name="copy-day"][value="${date}"]`);
      click('[data-testid="confirm-copy"]');
      await settle();
    }

    async function editIngredient(name: string, amount: string, unit: string): Promise<void> {
      click(`[data-testid="edit-ingredient"][aria-label^="Edit ${name},"]`);
      typeInto('.ingredient--editing input[id$="-amount"]', amount);
      choose(`.ingredient--editing input[type="radio"][value="${unit}"]`);
      click('.ingredient--editing [data-testid="save-ingredient"]');
      await settle();
    }

    const PASTA = ['Spaghetti = 500 g', 'Tomato sauce = 1 box', 'Parmesan = 50 g'];

    it('copies Monday\'s pasta, with all its ingredients, to Wednesday', async () => {
      const mondayUrl = await planMondayPasta();
      expect(ingredientsShown()).toEqual(PASTA);

      await copyTo(WEDNESDAY);

      // Monday is unchanged.
      expect(page().querySelector('h1')?.textContent?.trim()).toBe('Pasta');
      expect(ingredientsShown()).toEqual(PASTA);

      // Wednesday has its own Pasta, with the same ingredients.
      await open(`${WEEK}/${WEDNESDAY}`);
      expect(dayMeals('dinner')).toEqual(['Pasta']);
      expect(page().querySelector('[data-slot="dinner"] .meal-item__meta')?.textContent?.trim()).toBe('3 ingredients');
      const wednesdayUrl = await openMealOn(WEDNESDAY, 'dinner');
      expect(wednesdayUrl).not.toBe(mondayUrl);
      expect(ingredientsShown()).toEqual(PASTA);

      // And the week shows pasta on both days.
      await open(WEEK);
      expect(weekStatus(MONDAY)).toBe('Pasta');
      expect(weekStatus(WEDNESDAY)).toBe('Pasta');
    });

    it('lets the copy and the original be edited separately', async () => {
      const mondayUrl = await planMondayPasta();
      await copyTo(WEDNESDAY);
      const wednesdayUrl = await openMealOn(WEDNESDAY, 'dinner');

      // Change the copy: more spaghetti, no parmesan, a new name.
      await editIngredient('Spaghetti', '750', 'g');
      click('[data-testid="edit-ingredient"][aria-label^="Edit Parmesan,"]');
      click('.ingredient--editing [data-testid="remove-ingredient"]');
      await settle();
      await open(`${WEEK}/${WEDNESDAY}`);
      await renameMeal('Edit Pasta for dinner', 'Pasta bake');

      // Monday is untouched.
      await open(mondayUrl);
      expect(page().querySelector('h1')?.textContent?.trim()).toBe('Pasta');
      expect(ingredientsShown()).toEqual(PASTA);

      // Change the original; the copy is untouched.
      await editIngredient('Tomato sauce', '500', 'ml');
      await open(wednesdayUrl);
      expect(page().querySelector('h1')?.textContent?.trim()).toBe('Pasta bake');
      expect(ingredientsShown()).toEqual(['Spaghetti = 750 g', 'Tomato sauce = 1 box']);

      // Both survive a restart, still separate.
      await startApp();
      await open(mondayUrl);
      expect(ingredientsShown()).toEqual(['Spaghetti = 500 g', 'Tomato sauce = 500 ml', 'Parmesan = 50 g']);
      await open(wednesdayUrl);
      expect(ingredientsShown()).toEqual(['Spaghetti = 750 g', 'Tomato sauce = 1 box']);
      await open(WEEK);
      expect(weekStatus(MONDAY)).toBe('Pasta');
      expect(weekStatus(WEDNESDAY)).toBe('Pasta bake');
    });

    it('keeps the copy when the original is removed', async () => {
      await planMondayPasta();
      await copyTo(WEDNESDAY);

      await open(`${WEEK}/${MONDAY}`);
      click('[aria-label="Remove Pasta from dinner"]');
      await settle();

      await openMealOn(WEDNESDAY, 'dinner');
      expect(ingredientsShown()).toEqual(PASTA);
    });
  });

  it('leaves other days alone', async () => {
    await open(`${WEEK}/2026-11-21`);
    await addMeal('dinner', 'Vegetable curry');

    await open(`${WEEK}/${FRIDAY}`);
    await renameMeal('Edit Vegetable curry for dinner', 'Pizza');

    await open(WEEK);
    expect(weekStatus(FRIDAY)).toBe('Porridge · Coffee · Pizza');
    expect(weekStatus('2026-11-21')).toBe('Vegetable curry');
  });
});
