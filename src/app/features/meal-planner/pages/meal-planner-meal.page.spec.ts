import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { InMemoryMealPlanRepository, plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { MealPlanRepositoryService } from '../services/meal-plan-repository.service';
import { MealPlanStateService } from '../services/meal-plan-state.service';
import { formatPlannerDate } from '../utils/meal-planner-week.util';
import { MealPlannerMealPage } from './meal-planner-meal.page';

@Component({ standalone: true, template: '' })
class DummyPage {}

/**
 * A weekday's name in the machine's locale — as the app shows it — so these tests
 * pass on any system language, not just English.
 */
function weekday(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long' });
}

/** Wednesday 18 November 2026 (local time). */
const NOW = new Date(2026, 10, 18, 10, 30);
const FRIDAY = '2026-11-20';

const PANCAKES = plannedMeal({
  id: 'pancakes',
  date: FRIDAY,
  slot: 'breakfast',
  name: 'Pancakes',
  ingredients: [
    { id: 'flour', name: 'Flour', quantity: 200, unit: 'g' },
    { id: 'milk', name: 'Milk', quantity: 0.3, unit: 'l' }
  ]
});
const CURRY = plannedMeal({ id: 'curry', date: FRIDAY, slot: 'dinner', name: 'Vegetable curry' });

describe('MealPlannerMealPage', () => {
  const navigationHistory = { back: vi.fn().mockResolvedValue(true) };
  const paramMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  const route = {
    paramMap,
    get snapshot() {
      return { paramMap: paramMap.value };
    }
  };
  let repository: InMemoryMealPlanRepository;

  beforeEach(async () => {
    repository = new InMemoryMealPlanRepository([PANCAKES, CURRY]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    navigationHistory.back.mockClear();

    await TestBed.configureTestingModule({
      imports: [MealPlannerMealPage],
      providers: [
        provideRouter([
          { path: 'tabs/meal-planner/:date', component: DummyPage },
          { path: 'tabs/meal-planner/:date/meals/:mealId', component: DummyPage }
        ]),
        { provide: NavigationHistoryService, useValue: navigationHistory },
        { provide: ActivatedRoute, useValue: route },
        { provide: MealPlanRepositoryService, useValue: repository }
      ]
    }).compileComponents();

    await TestBed.inject(MealPlanStateService).load();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(mealId: string, date = FRIDAY) {
    paramMap.next(convertToParamMap({ date, mealId }));
    const fixture = TestBed.createComponent(MealPlannerMealPage);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof render>;

  const query = <T extends Element = HTMLElement>(fixture: Fixture, selector: string) =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const text = (fixture: Fixture, selector: string) => query(fixture, selector)?.textContent?.trim();
  /** The add form's fields (ids use the "ingredient" prefix). */
  const nameField = (fixture: Fixture) => query<HTMLInputElement>(fixture, '#ingredient-name')!;
  const amountField = (fixture: Fixture) => query<HTMLInputElement>(fixture, '#ingredient-amount')!;
  const addSave = (fixture: Fixture) => query<HTMLButtonElement>(fixture, '.add-card [data-testid="save-ingredient"]')!;
  const editor = (fixture: Fixture) => query(fixture, '.ingredient--editing');
  const editorField = (fixture: Fixture, field: 'name' | 'amount') =>
    query<HTMLInputElement>(fixture, `.ingredient--editing input[id$="-${field}"]`)!;

  /** "Name = amount" for each listed ingredient (not the one being edited). */
  function listed(fixture: Fixture): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('li.ingredient:not(.ingredient--editing)') as NodeListOf<HTMLElement>
    ).map(
      (row) =>
        `${row.querySelector('.ingredient__name')?.textContent?.trim()} = ${row
          .querySelector('.ingredient__amount strong')
          ?.textContent?.trim()} ${row.querySelector('.ingredient__amount small')?.textContent?.trim()}`
    );
  }

  function type(fixture: Fixture, field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pickUnit(fixture: Fixture, scope: string, unit: string): void {
    const radio = query<HTMLInputElement>(fixture, `${scope} input[type="radio"][value="${unit}"]`)!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /** Waits for saves to finish (a macrotask: storage writes are untracked promise chains). */
  async function settle(fixture: Fixture): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function openAdd(fixture: Fixture): void {
    query<HTMLButtonElement>(fixture, '[data-testid="open-add-ingredient"]')!.click();
    fixture.detectChanges();
  }

  async function addIngredient(fixture: Fixture, name: string, amount: string, unit?: string): Promise<void> {
    if (!query(fixture, '.add-card')) openAdd(fixture);
    type(fixture, nameField(fixture), name);
    type(fixture, amountField(fixture), amount);
    if (unit) pickUnit(fixture, '.add-card', unit);
    addSave(fixture).click();
    await settle(fixture);
  }

  function openEdit(fixture: Fixture, name: string): void {
    query<HTMLButtonElement>(fixture, `[data-testid="edit-ingredient"][aria-label^="Edit ${name},"]`)!.click();
    fixture.detectChanges();
  }

  async function saveEditor(fixture: Fixture): Promise<void> {
    query<HTMLButtonElement>(fixture, '.ingredient--editing [data-testid="save-ingredient"]')!.click();
    await settle(fixture);
  }

  function storedIngredients(mealId: string): string[] {
    const meal = (repository.stored as (typeof PANCAKES)[]).find((candidate) => candidate.id === mealId);
    return (meal?.ingredients ?? []).map((i) => `${i.name} ${i.quantity} ${i.unit}`);
  }

  describe('showing a meal', () => {
    it('titles the page with the meal, its slot and day', () => {
      const fixture = render('pancakes');

      expect(text(fixture, '.page-header__text h1')).toBe('Pancakes');
      expect(text(fixture, '.page-header__text p')).toBe(
        `Breakfast · ${weekday(2026, 11, 20)}, ${formatPlannerDate(new Date(2026, 10, 20))}`
      );
    });

    it('says "Today" for a meal planned today', async () => {
      const mealPlan = TestBed.inject(MealPlanStateService);
      const meal = await mealPlan.addMeal('2026-11-18', 'lunch', 'Soup');

      const fixture = render(meal.id, '2026-11-18');

      expect(text(fixture, '.page-header__text p')?.startsWith('Lunch · Today, ')).toBe(true);
    });

    it('lists the ingredients with how much of each is needed', () => {
      const fixture = render('pancakes');

      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l']);
      expect(text(fixture, '[data-testid="ingredient-count"]')).toBe('2 items');
      expect(query(fixture, '[data-testid="no-ingredients"]')).toBeNull();
    });

    it("labels each row with the ingredient and amount, and badges it with the name's initial", () => {
      const fixture = render('pancakes');
      const row = query(fixture, '[data-testid="edit-ingredient"]')!;

      expect(row.getAttribute('aria-label')).toBe('Edit Flour, 200 g');
      expect(row.querySelector('.ingredient__badge')?.textContent?.trim()).toBe('F');
    });

    it('says when a meal has no ingredients yet, with a way to add one', () => {
      const fixture = render('curry');

      expect(listed(fixture)).toEqual([]);
      expect(text(fixture, '[data-testid="no-ingredients"] .empty-ingredients__title')).toBe('No ingredients yet');
      expect(query(fixture, '[data-testid="no-ingredients"] [data-testid="open-add-ingredient"]')).not.toBeNull();
      expect(query(fixture, '[data-testid="ingredient-count"]')).toBeNull();
    });

    it('keeps the add form closed until asked for', () => {
      const fixture = render('pancakes');

      expect(query(fixture, 'form')).toBeNull();
      expect(text(fixture, '[data-testid="open-add-ingredient"]')).toBe('Add ingredient');
    });

    it('says "1 item" for a single ingredient', async () => {
      await TestBed.inject(MealPlanStateService).removeIngredient('pancakes', 'milk');
      const fixture = render('pancakes');

      expect(text(fixture, '[data-testid="ingredient-count"]')).toBe('1 item');
    });
  });

  describe('adding an ingredient', () => {
    it('opens an empty form, focused, when asked', () => {
      const fixture = render('pancakes');

      openAdd(fixture);

      expect(nameField(fixture).value).toBe('');
      expect(document.activeElement).toBe(nameField(fixture));
      expect(query(fixture, '[data-testid="open-add-ingredient"]')).toBeNull();
    });

    it('opens from the empty state too', () => {
      const fixture = render('curry');

      openAdd(fixture);

      expect(query(fixture, '.add-card')).not.toBeNull();
      expect(query(fixture, '[data-testid="no-ingredients"]')).toBeNull();
    });

    it('adds it to the end of the list and saves it', async () => {
      const fixture = render('pancakes');

      await addIngredient(fixture, 'Eggs', '2');

      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l', 'Eggs = 2 count']);
      expect(storedIngredients('pancakes')).toEqual(['Flour 200 g', 'Milk 0.3 l', 'Eggs 2 count']);
      expect(storedIngredients('curry')).toEqual([]);
    });

    it('uses the chosen unit and accepts a decimal comma', async () => {
      const fixture = render('curry');

      await addIngredient(fixture, 'Coconut milk', '0,4', 'l');

      expect(listed(fixture)).toEqual(['Coconut milk = 0.4 l']);
    });

    it('stays open, cleared and focused for the next one, keeping the unit', async () => {
      const fixture = render('curry');

      await addIngredient(fixture, 'Rice', '250', 'g');

      expect(query(fixture, '.add-card')).not.toBeNull();
      expect(nameField(fixture).value).toBe('');
      expect(amountField(fixture).value).toBe('');
      expect(query<HTMLInputElement>(fixture, '.add-card input[type="radio"]:checked')?.value).toBe('g');
      expect(document.activeElement).toBe(nameField(fixture));

      await addIngredient(fixture, 'Lentils', '200');
      expect(listed(fixture)).toEqual(['Rice = 250 g', 'Lentils = 200 g']);
    });

    it('starts new forms with the unit used last', async () => {
      const fixture = render('curry');
      await addIngredient(fixture, 'Rice', '250', 'ml');

      query<HTMLButtonElement>(fixture, '.add-card .ghost-btn')!.click();
      fixture.detectChanges();
      openAdd(fixture);

      expect(query<HTMLInputElement>(fixture, '.add-card input[type="radio"]:checked')?.value).toBe('ml');
    });

    it('announces what was added', async () => {
      const fixture = render('curry');

      await addIngredient(fixture, 'Rice', '250', 'g');

      expect(text(fixture, '[aria-live="polite"]')).toBe('Added 250 g Rice');
    });

    it('closes on Cancel and returns focus to the add button', () => {
      const fixture = render('pancakes');
      openAdd(fixture);
      type(fixture, nameField(fixture), 'Rice');

      query<HTMLButtonElement>(fixture, '.add-card .ghost-btn')!.click();
      fixture.detectChanges();

      expect(query(fixture, '.add-card')).toBeNull();
      expect(repository.saveCount).toBe(0);
      expect(document.activeElement).toBe(query(fixture, '[data-testid="open-add-ingredient"]'));
    });

    it('keeps what was typed and explains when saving fails', async () => {
      const fixture = render('curry');
      repository.failNextSave = true;

      await addIngredient(fixture, 'Rice', '250', 'g');

      expect(listed(fixture)).toEqual([]);
      expect(nameField(fixture).value).toBe('Rice');
      expect(amountField(fixture).value).toBe('250');
      expect(text(fixture, '.add-card [role="alert"]')).toBe("Couldn't add this ingredient. Please try again.");

      addSave(fixture).click();
      await settle(fixture);
      expect(listed(fixture)).toEqual(['Rice = 250 g']);
      expect(query(fixture, '.add-card [role="alert"]')).toBeNull();
    });

    it('adds once even if Add is tapped twice', async () => {
      const fixture = render('curry');
      openAdd(fixture);
      type(fixture, nameField(fixture), 'Rice');
      type(fixture, amountField(fixture), '250');

      addSave(fixture).click();
      addSave(fixture).click();
      await settle(fixture);

      expect(listed(fixture)).toEqual(['Rice = 250 count']);
    });
  });

  describe('editing an ingredient', () => {
    it('opens the tapped ingredient with its current name, amount and unit', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');

      expect(editorField(fixture, 'name').value).toBe('Milk');
      expect(editorField(fixture, 'amount').value).toBe('0.3');
      expect(query<HTMLInputElement>(fixture, '.ingredient--editing input[type="radio"]:checked')?.value).toBe('l');
      expect(editor(fixture)?.getAttribute('data-ingredient-id')).toBe('milk');
      // The other rows stay as they are.
      expect(listed(fixture)).toEqual(['Flour = 200 g']);
    });

    it('saves a new amount and unit, leaving the other ingredients alone', async () => {
      const fixture = render('pancakes');
      await addIngredient(fixture, 'Eggs', '2');
      query<HTMLButtonElement>(fixture, '.add-card .ghost-btn')!.click();
      fixture.detectChanges();

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '300');
      pickUnit(fixture, '.ingredient--editing', 'ml');
      await saveEditor(fixture);

      expect(editor(fixture)).toBeNull();
      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 300 ml', 'Eggs = 2 count']);
      expect(storedIngredients('pancakes')).toEqual(['Flour 200 g', 'Milk 300 ml', 'Eggs 2 count']);
    });

    it('saves a new name', async () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Flour');
      type(fixture, editorField(fixture, 'name'), 'Plain flour');
      await saveEditor(fixture);

      expect(listed(fixture)).toEqual(['Plain flour = 200 g', 'Milk = 0.3 l']);
    });

    it('returns focus to the edited row and announces the change', async () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '0.5');
      await saveEditor(fixture);

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Milk, 0.5 l');
      expect(text(fixture, '[aria-live="polite"]')).toBe('Updated Milk, 0.5 l');
    });

    it('keeps the old values on Cancel', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '5');
      query<HTMLButtonElement>(fixture, '.ingredient--editing .ghost-btn')!.click();
      fixture.detectChanges();

      expect(editor(fixture)).toBeNull();
      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l']);
      expect(repository.saveCount).toBe(0);
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Milk, 0.3 l');
    });

    it('keeps the old values on Escape', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '5');
      editorField(fixture, 'amount').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l']);
      expect(repository.saveCount).toBe(0);
    });

    it('will not save an invalid amount', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '0');

      expect(query<HTMLButtonElement>(fixture, '.ingredient--editing [data-testid="save-ingredient"]')!.disabled).toBe(
        true
      );
      expect(text(fixture, '.ingredient--editing .form-error')).toBe('Enter an amount above 0.');
    });

    it('edits one ingredient at a time', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '5');
      openEdit(fixture, 'Flour');

      expect(fixture.nativeElement.querySelectorAll('.ingredient--editing')).toHaveLength(1);
      expect(editorField(fixture, 'name').value).toBe('Flour');
      expect(listed(fixture)).toEqual(['Milk = 0.3 l']);
    });

    it('opening the add form closes the editor without saving', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '5');
      openAdd(fixture);

      expect(editor(fixture)).toBeNull();
      expect(query(fixture, '.add-card')).not.toBeNull();
      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l']);
    });

    it('keeps the changes and explains when saving fails', async () => {
      const fixture = render('pancakes');
      repository.failNextSave = true;

      openEdit(fixture, 'Milk');
      type(fixture, editorField(fixture, 'amount'), '300');
      pickUnit(fixture, '.ingredient--editing', 'ml');
      await saveEditor(fixture);

      expect(editorField(fixture, 'amount').value).toBe('300');
      expect(text(fixture, '.ingredient--editing [role="alert"]')).toBe("Couldn't save your changes. Please try again.");
      expect(storedIngredients('pancakes')).toEqual(['Flour 200 g', 'Milk 0.3 l']);

      await saveEditor(fixture);
      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 300 ml']);
    });

    it('closes the editor if the ingredient is removed meanwhile', async () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      await TestBed.inject(MealPlanStateService).removeIngredient('pancakes', 'milk');
      fixture.detectChanges();

      expect(editor(fixture)).toBeNull();
      expect(listed(fixture)).toEqual(['Flour = 200 g']);
    });
  });

  describe('removing an ingredient', () => {
    function removeFromEditor(fixture: Fixture, name: string): void {
      openEdit(fixture, name);
      query<HTMLButtonElement>(fixture, `.ingredient--editing [aria-label="Remove ${name}"]`)!.click();
    }

    it('removes it from its editor, leaving the others', async () => {
      const fixture = render('pancakes');

      removeFromEditor(fixture, 'Flour');
      await settle(fixture);

      expect(editor(fixture)).toBeNull();
      expect(listed(fixture)).toEqual(['Milk = 0.3 l']);
      expect(storedIngredients('pancakes')).toEqual(['Milk 0.3 l']);
      expect(text(fixture, '[aria-live="polite"]')).toBe('Removed Flour');
    });

    it('moves focus to the next row', async () => {
      const fixture = render('pancakes');

      removeFromEditor(fixture, 'Flour');
      await settle(fixture);

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Milk, 0.3 l');
    });

    it('shows the empty state once the last one is removed', async () => {
      const fixture = render('pancakes');

      removeFromEditor(fixture, 'Flour');
      await settle(fixture);
      removeFromEditor(fixture, 'Milk');
      await settle(fixture);

      expect(listed(fixture)).toEqual([]);
      expect(query(fixture, '[data-testid="no-ingredients"]')).not.toBeNull();
      expect(document.activeElement).toBe(query(fixture, '[data-testid="open-add-ingredient"]'));
    });

    it('keeps the ingredient and explains when removing fails', async () => {
      const fixture = render('pancakes');
      repository.failNextSave = true;

      removeFromEditor(fixture, 'Flour');
      await settle(fixture);

      expect(editor(fixture)).not.toBeNull();
      expect(text(fixture, '.ingredient--editing [role="alert"]')).toBe("Couldn't remove Flour. Please try again.");
      expect(storedIngredients('pancakes')).toEqual(['Flour 200 g', 'Milk 0.3 l']);
    });
  });

  describe('copying to another day', () => {
    function openCopy(fixture: Fixture): void {
      query<HTMLButtonElement>(fixture, '[data-testid="open-copy"]')!.click();
      fixture.detectChanges();
    }

    function choose(fixture: Fixture, name: 'copy-day' | 'copy-slot', value: string): void {
      const radio = query<HTMLInputElement>(fixture, `input[name="${name}"][value="${value}"]`)!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    async function copyTo(fixture: Fixture, date: string, slot?: string): Promise<void> {
      openCopy(fixture);
      choose(fixture, 'copy-day', date);
      if (slot) choose(fixture, 'copy-slot', slot);
      query<HTMLButtonElement>(fixture, '[data-testid="confirm-copy"]')!.click();
      await settle(fixture);
    }

    function mealsOn(date: string, slot: string): (typeof PANCAKES)[] {
      return (repository.stored as (typeof PANCAKES)[]).filter((meal) => meal.date === date && meal.slot === slot);
    }

    it('offers to copy, mentioning the ingredients', () => {
      const fixture = render('pancakes');

      expect(text(fixture, '[data-testid="open-copy"] .copy-row__title')).toBe('Copy to another day');
      expect(text(fixture, '[data-testid="open-copy"] .copy-row__hint')).toBe('With all 2 ingredients');
    });

    it('copies the meal with its ingredients, leaving this one unchanged', async () => {
      const fixture = render('pancakes');

      await copyTo(fixture, '2026-11-22');

      const [copy] = mealsOn('2026-11-22', 'breakfast');
      expect(copy.name).toBe('Pancakes');
      expect(copy.ingredients.map((i) => `${i.name} ${i.quantity} ${i.unit}`)).toEqual(['Flour 200 g', 'Milk 0.3 l']);
      expect(storedIngredients('pancakes')).toEqual(['Flour 200 g', 'Milk 0.3 l']);
      // Still on the original.
      expect(text(fixture, '.page-header__text h1')).toBe('Pancakes');
      expect(listed(fixture)).toEqual(['Flour = 200 g', 'Milk = 0.3 l']);
    });

    it('copies into the chosen slot', async () => {
      const fixture = render('pancakes');

      await copyTo(fixture, '2026-11-22', 'lunch');

      expect(mealsOn('2026-11-22', 'lunch').map((meal) => meal.name)).toEqual(['Pancakes']);
      expect(mealsOn('2026-11-22', 'breakfast')).toEqual([]);
    });

    it('confirms where it went, with a link to the copy', async () => {
      const fixture = render('pancakes');

      await copyTo(fixture, '2026-11-22', 'lunch');

      const [copy] = mealsOn('2026-11-22', 'lunch');
      const confirmation = query(fixture, '[data-testid="copied"]')!;
      expect(confirmation.getAttribute('role')).toBe('status');
      expect(confirmation.textContent).toContain('Copied to');
      expect(confirmation.textContent).toContain('Lunch');
      expect(query(fixture, '[data-testid="open-copied-meal"]')?.getAttribute('href')).toBe(
        `/tabs/meal-planner/2026-11-22/meals/${copy.id}`
      );
      expect(query(fixture, '.copy-card')).toBeNull();
      expect(document.activeElement).toBe(query(fixture, '[data-testid="open-copied-meal"]'));
      expect(text(fixture, '[aria-live="polite"]')?.startsWith('Copied Pancakes to ')).toBe(true);
    });

    it('opens the copy from the confirmation', async () => {
      const fixture = render('pancakes');
      await copyTo(fixture, '2026-11-22');
      const [copy] = mealsOn('2026-11-22', 'breakfast');

      query<HTMLAnchorElement>(fixture, '[data-testid="open-copied-meal"]')!.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`/tabs/meal-planner/2026-11-22/meals/${copy.id}`);
    });

    it('can make several copies', async () => {
      const fixture = render('pancakes');

      await copyTo(fixture, '2026-11-21');
      await copyTo(fixture, '2026-11-22');

      expect(mealsOn('2026-11-21', 'breakfast')).toHaveLength(1);
      expect(mealsOn('2026-11-22', 'breakfast')).toHaveLength(1);
    });

    it('closes on Cancel without copying, returning focus to the copy button', () => {
      const fixture = render('pancakes');

      openCopy(fixture);
      choose(fixture, 'copy-day', '2026-11-22');
      query<HTMLButtonElement>(fixture, '.copy-card .ghost-btn')!.click();
      fixture.detectChanges();

      expect(query(fixture, '.copy-card')).toBeNull();
      expect(repository.saveCount).toBe(0);
      expect(document.activeElement).toBe(query(fixture, '[data-testid="open-copy"]'));
    });

    it('keeps one panel open at a time', () => {
      const fixture = render('pancakes');

      openEdit(fixture, 'Milk');
      openCopy(fixture);
      expect(editor(fixture)).toBeNull();
      expect(query(fixture, '.copy-card')).not.toBeNull();

      openEdit(fixture, 'Milk');
      expect(query(fixture, '.copy-card')).toBeNull();
      expect(editor(fixture)).not.toBeNull();
    });

    it('keeps the panel open and explains when copying fails', async () => {
      const fixture = render('pancakes');
      repository.failNextSave = true;

      await copyTo(fixture, '2026-11-22');

      expect(query(fixture, '.copy-card')).not.toBeNull();
      expect(text(fixture, '.copy-card [role="alert"]')).toBe("Couldn't copy this meal. Please try again.");
      expect(query(fixture, '[data-testid="copied"]')).toBeNull();
      expect(mealsOn('2026-11-22', 'breakfast')).toEqual([]);

      query<HTMLButtonElement>(fixture, '[data-testid="confirm-copy"]')!.click();
      await settle(fixture);
      expect(mealsOn('2026-11-22', 'breakfast')).toHaveLength(1);
    });
  });

  describe('a meal that is not in the plan', () => {
    it('explains and links back to the day', async () => {
      const fixture = render('missing');

      expect(query(fixture, '[data-testid="meal-not-found"]')).not.toBeNull();
      expect(query(fixture, 'form')).toBeNull();
      expect(text(fixture, '.page-header__text p')).toBe('Meal not found');
      expect(text(fixture, '.empty-action')).toBe(`Back to ${weekday(2026, 11, 20)}`);

      query<HTMLAnchorElement>(fixture, '.empty-action')!.click();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(`/tabs/meal-planner/${FRIDAY}`);
    });

    it('switches to the not-found message if the meal is removed while open', async () => {
      const fixture = render('curry');

      await TestBed.inject(MealPlanStateService).removeMeal('curry');
      fixture.detectChanges();

      expect(query(fixture, '[data-testid="meal-not-found"]')).not.toBeNull();
    });

    it('links to the week when the date is invalid too', () => {
      const fixture = render('missing', 'not-a-date');

      expect(text(fixture, '.empty-action')).toBe('Back to Meal Planner');
      expect(query(fixture, '.empty-action')?.getAttribute('href')).toBe('/tabs/meal-planner');
    });
  });

  it("goes back to the meal's day by default", () => {
    const fixture = render('pancakes');

    query<HTMLButtonElement>(fixture, 'button[aria-label="Go back"]')!.click();

    expect(navigationHistory.back).toHaveBeenCalledWith(`/tabs/meal-planner/${FRIDAY}`);
  });
});
