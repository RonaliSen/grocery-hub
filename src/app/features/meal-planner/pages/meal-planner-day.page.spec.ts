import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { Component } from '@angular/core';

import { InMemoryMealPlanRepository, plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { MealSlotId } from '../models/meal-slot.model';
import { MealPlanRepositoryService } from '../services/meal-plan-repository.service';
import { MealPlanStateService } from '../services/meal-plan-state.service';
import { formatPlannerDate } from '../utils/meal-planner-week.util';
import { MealPlannerDayPage } from './meal-planner-day.page';

@Component({ standalone: true, template: '' })
class DummyWeekPage {}

/**
 * A weekday's name in the machine's locale — as the app shows it — so these tests
 * pass on any system language, not just English.
 */
function weekday(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long' });
}

/** Wednesday 18 November 2026 (local time). */
const NOW = new Date(2026, 10, 18, 10, 30);

describe('MealPlannerDayPage', () => {
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
    repository = new InMemoryMealPlanRepository([
      plannedMeal({
        id: 'curry',
        date: '2026-11-20',
        slot: 'dinner',
        name: 'Vegetable curry',
        ingredients: [
          { id: 'rice', name: 'Rice', quantity: 250, unit: 'g' },
          { id: 'onion', name: 'Onion', quantity: 2, unit: 'count' }
        ]
      }),
      plannedMeal({ date: '2026-11-21', slot: 'lunch', name: 'Saturday soup' })
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    navigationHistory.back.mockClear();

    await TestBed.configureTestingModule({
      imports: [MealPlannerDayPage],
      providers: [
        provideRouter([
          { path: 'tabs/meal-planner', component: DummyWeekPage },
          { path: 'tabs/meal-planner/:date/meals/:mealId', component: DummyWeekPage }
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

  function render(date: string) {
    paramMap.next(convertToParamMap({ date }));
    const fixture = TestBed.createComponent(MealPlannerDayPage);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ReturnType<typeof render>, selector: string): string | undefined {
    return fixture.nativeElement.querySelector(selector)?.textContent?.trim();
  }

  type Fixture = ReturnType<typeof render>;

  function slotEl(fixture: Fixture, slot: MealSlotId): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-slot="${slot}"]`);
  }

  function mealNames(fixture: Fixture, slot: MealSlotId): string[] {
    return Array.from(slotEl(fixture, slot).querySelectorAll('.meal-item__name')).map(
      (el) => el.textContent?.trim() ?? ''
    );
  }

  function addButtons(fixture: Fixture): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="add-meal"]'));
  }

  function addButton(fixture: Fixture, slot: MealSlotId): HTMLButtonElement {
    return slotEl(fixture, slot).querySelector('[data-testid="add-meal"]') as HTMLButtonElement;
  }

  function input(fixture: Fixture, slot: MealSlotId): HTMLInputElement | null {
    return slotEl(fixture, slot).querySelector('input.meal-form__input');
  }

  function form(fixture: Fixture, slot: MealSlotId): HTMLFormElement {
    return slotEl(fixture, slot).querySelector('form') as HTMLFormElement;
  }

  function saveButton(fixture: Fixture, slot: MealSlotId): HTMLButtonElement {
    return slotEl(fixture, slot).querySelector('[data-testid="save-meal"]') as HTMLButtonElement;
  }

  function removeButton(fixture: Fixture, label: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
  }

  function type(fixture: Fixture, slot: MealSlotId, value: string): void {
    const field = input(fixture, slot)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Waits for saves to finish (a macrotask: storage writes are untracked promise chains). */
  async function settle(fixture: Fixture): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function addMeal(fixture: Fixture, slot: MealSlotId, name: string): Promise<void> {
    addButton(fixture, slot).click();
    fixture.detectChanges();
    type(fixture, slot, name);
    saveButton(fixture, slot).click();
    await settle(fixture);
  }

  it('shows breakfast, lunch and dinner slots, in that order', () => {
    const fixture = render('2026-11-19');
    const slots = Array.from(fixture.nativeElement.querySelectorAll('.slot-card')) as HTMLElement[];

    expect(slots.map((slot) => slot.dataset['slot'])).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(slots.map((slot) => slot.querySelector('.slot-card__label')?.textContent?.trim())).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner'
    ]);
  });

  it('offers to add a meal to each empty slot', () => {
    const fixture = render('2026-11-19');

    expect(addButtons(fixture).map((button) => button.textContent?.trim())).toEqual([
      'Add breakfast',
      'Add lunch',
      'Add dinner'
    ]);
    expect(fixture.nativeElement.querySelector('.meal-item')).toBeNull();
  });

  it("shows the day's saved meals in their slots, and only that day's", () => {
    const fixture = render('2026-11-20');

    expect(mealNames(fixture, 'breakfast')).toEqual([]);
    expect(mealNames(fixture, 'lunch')).toEqual([]);
    expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry']);
    expect(addButton(fixture, 'dinner').textContent?.trim()).toBe('Add another');
  });

  describe('adding a meal', () => {
    it('opens a name field for the chosen slot only', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'lunch').click();
      fixture.detectChanges();

      expect(input(fixture, 'lunch')).not.toBeNull();
      expect(input(fixture, 'breakfast')).toBeNull();
      expect(input(fixture, 'dinner')).toBeNull();
      expect(fixture.nativeElement.querySelector('label[for="meal-name-lunch"]')?.textContent?.trim()).toBe(
        'Lunch meal name'
      );
    });

    it('focuses the name field when it opens', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'breakfast').click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(input(fixture, 'breakfast'));
    });

    it('saves the meal into that slot and closes the form', async () => {
      const fixture = render('2026-11-19');

      await addMeal(fixture, 'lunch', 'Chicken wrap');

      expect(mealNames(fixture, 'lunch')).toEqual(['Chicken wrap']);
      expect(mealNames(fixture, 'breakfast')).toEqual([]);
      expect(mealNames(fixture, 'dinner')).toEqual([]);
      expect(input(fixture, 'lunch')).toBeNull();
      expect(repository.namesFor('2026-11-19', 'lunch')).toEqual(['Chicken wrap']);
      expect(repository.namesFor('2026-11-20', 'lunch')).toEqual([]);
    });

    it('adds more meals to the same slot', async () => {
      const fixture = render('2026-11-20');

      await addMeal(fixture, 'dinner', 'Rice');

      expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry', 'Rice']);
      expect(fixture.nativeElement.querySelector('[data-slot="dinner"] .slot-card__count')?.textContent?.trim()).toBe(
        '2'
      );
    });

    it('tidies extra spaces in the name', async () => {
      const fixture = render('2026-11-19');

      await addMeal(fixture, 'breakfast', '   Black    coffee ');

      expect(mealNames(fixture, 'breakfast')).toEqual(['Black coffee']);
    });

    it.each([
      ['empty', ''],
      ['only spaces', '    ']
    ])('keeps Save disabled while the name is %s', (_label, value) => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'dinner').click();
      fixture.detectChanges();
      type(fixture, 'dinner', value);

      expect(saveButton(fixture, 'dinner').disabled).toBe(true);
    });

    it('does nothing when an empty form is submitted (e.g. with Enter)', async () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'dinner').click();
      fixture.detectChanges();
      form(fixture, 'dinner').dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();

      expect(repository.saveCount).toBe(0);
      expect(input(fixture, 'dinner')).not.toBeNull();
    });

    it('limits the name length', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'dinner').click();
      fixture.detectChanges();

      expect(input(fixture, 'dinner')!.maxLength).toBe(80);
    });

    it('closes without saving on Cancel', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'lunch').click();
      fixture.detectChanges();
      type(fixture, 'lunch', 'Not this');
      (fixture.nativeElement.querySelector('[data-slot="lunch"] .ghost-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(input(fixture, 'lunch')).toBeNull();
      expect(mealNames(fixture, 'lunch')).toEqual([]);
      expect(repository.saveCount).toBe(0);
    });

    it('closes without saving on Escape', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'lunch').click();
      fixture.detectChanges();
      type(fixture, 'lunch', 'Not this');
      input(fixture, 'lunch')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(input(fixture, 'lunch')).toBeNull();
      expect(repository.saveCount).toBe(0);
    });

    it('starts with an empty field each time it opens', () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'lunch').click();
      fixture.detectChanges();
      type(fixture, 'lunch', 'Draft');
      addButton(fixture, 'dinner').click();
      fixture.detectChanges();

      expect(input(fixture, 'lunch')).toBeNull();
      expect(input(fixture, 'dinner')!.value).toBe('');
    });

    it('keeps the text and explains when saving fails', async () => {
      const fixture = render('2026-11-19');
      repository.failNextSave = true;

      await addMeal(fixture, 'lunch', 'Chicken wrap');

      expect(mealNames(fixture, 'lunch')).toEqual([]);
      expect(input(fixture, 'lunch')!.value).toBe('Chicken wrap');
      const error = fixture.nativeElement.querySelector('[data-slot="lunch"] [role="alert"]') as HTMLElement;
      expect(error.textContent?.trim()).toBe("Couldn't save this meal. Please try again.");
      expect(input(fixture, 'lunch')!.getAttribute('aria-describedby')).toBe(error.id);

      // Retrying works.
      saveButton(fixture, 'lunch').click();
      await settle(fixture);
      expect(mealNames(fixture, 'lunch')).toEqual(['Chicken wrap']);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });

    it('saves once even if Save is tapped twice', async () => {
      const fixture = render('2026-11-19');

      addButton(fixture, 'lunch').click();
      fixture.detectChanges();
      type(fixture, 'lunch', 'Soup');
      saveButton(fixture, 'lunch').click();
      saveButton(fixture, 'lunch').click();
      await settle(fixture);

      expect(mealNames(fixture, 'lunch')).toEqual(['Soup']);
    });
  });

  describe('opening a meal', () => {
    function openLink(fixture: Fixture, slot: MealSlotId): HTMLAnchorElement {
      return slotEl(fixture, slot).querySelector('[data-testid="open-meal"]') as HTMLAnchorElement;
    }

    it("links each meal to its own page", () => {
      const fixture = render('2026-11-20');

      expect(openLink(fixture, 'dinner').getAttribute('href')).toBe('/tabs/meal-planner/2026-11-20/meals/curry');
    });

    it('shows how many ingredients a meal has', () => {
      const fixture = render('2026-11-20');

      expect(openLink(fixture, 'dinner').querySelector('.meal-item__meta')?.textContent?.trim()).toBe('2 ingredients');
      expect(openLink(fixture, 'dinner').getAttribute('aria-label')).toBe('Vegetable curry, 2 ingredients');
    });

    it('nudges to add ingredients when a meal has none', async () => {
      const fixture = render('2026-11-19');
      await addMeal(fixture, 'lunch', 'Soup');

      const meta = openLink(fixture, 'lunch').querySelector('.meal-item__meta');
      expect(meta?.textContent?.trim()).toBe('Add ingredients');
      expect(meta?.classList).toContain('is-empty');
    });

    it('says "1 ingredient" for a single one', async () => {
      const fixture = render('2026-11-20');
      await TestBed.inject(MealPlanStateService).removeIngredient('curry', 'onion');
      fixture.detectChanges();

      expect(openLink(fixture, 'dinner').querySelector('.meal-item__meta')?.textContent?.trim()).toBe('1 ingredient');
    });

    it('opens the meal when tapped', async () => {
      const fixture = render('2026-11-20');

      openLink(fixture, 'dinner').click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/tabs/meal-planner/2026-11-20/meals/curry');
    });
  });

  describe('renaming a meal', () => {
    function editButton(fixture: Fixture, label: string): HTMLButtonElement {
      return fixture.nativeElement.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
    }

    function editField(fixture: Fixture): HTMLInputElement | null {
      return fixture.nativeElement.querySelector('.meal-item--editing input');
    }

    function typeInEdit(fixture: Fixture, value: string): void {
      const field = editField(fixture)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function saveEdit(fixture: Fixture): void {
      (fixture.nativeElement.querySelector('.meal-item--editing [data-testid="save-meal"]') as HTMLButtonElement).click();
    }

    async function rename(fixture: Fixture, label: string, name: string): Promise<void> {
      editButton(fixture, label).click();
      fixture.detectChanges();
      typeInEdit(fixture, name);
      saveEdit(fixture);
      await settle(fixture);
    }

    it('offers to edit each meal', () => {
      const fixture = render('2026-11-20');

      expect(editButton(fixture, 'Edit Vegetable curry for dinner')).not.toBeNull();
    });

    it('turns the meal into a field holding its current name', () => {
      const fixture = render('2026-11-20');

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();

      const field = editField(fixture)!;
      expect(field.value).toBe('Vegetable curry');
      expect(document.activeElement).toBe(field);
      expect(fixture.nativeElement.querySelector('label[for="' + field.id + '"]')?.textContent?.trim()).toBe(
        'New name for Vegetable curry'
      );
      // The slot's add button steps aside while a form is open there.
      expect(addButton(fixture, 'dinner')).toBeNull();
    });

    it('saves the new name in the same slot, day and position', async () => {
      const fixture = render('2026-11-20');
      await addMeal(fixture, 'dinner', 'Rice');

      await rename(fixture, 'Edit Vegetable curry for dinner', 'Margherita pizza');

      expect(mealNames(fixture, 'dinner')).toEqual(['Margherita pizza', 'Rice']);
      expect(editField(fixture)).toBeNull();
      expect(repository.namesFor('2026-11-20', 'dinner')).toEqual(['Margherita pizza', 'Rice']);
      expect(repository.namesFor('2026-11-21', 'lunch')).toEqual(['Saturday soup']);
    });

    it('puts focus back on the renamed meal', async () => {
      const fixture = render('2026-11-20');

      await rename(fixture, 'Edit Vegetable curry for dinner', 'Pizza');

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Pizza for dinner');
    });

    it('keeps the old name on Cancel', () => {
      const fixture = render('2026-11-20');

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      typeInEdit(fixture, 'Pizza');
      (fixture.nativeElement.querySelector('.meal-item--editing .ghost-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry']);
      expect(editField(fixture)).toBeNull();
      expect(repository.saveCount).toBe(0);
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Vegetable curry for dinner');
    });

    it('keeps the old name on Escape', () => {
      const fixture = render('2026-11-20');

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      typeInEdit(fixture, 'Pizza');
      editField(fixture)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry']);
      expect(repository.saveCount).toBe(0);
    });

    it('will not save an empty name', () => {
      const fixture = render('2026-11-20');

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      typeInEdit(fixture, '   ');

      expect(
        (fixture.nativeElement.querySelector('.meal-item--editing [data-testid="save-meal"]') as HTMLButtonElement)
          .disabled
      ).toBe(true);
    });

    it('keeps the new text and explains when saving fails', async () => {
      const fixture = render('2026-11-20');
      repository.failNextSave = true;

      await rename(fixture, 'Edit Vegetable curry for dinner', 'Pizza');

      expect(editField(fixture)!.value).toBe('Pizza');
      expect(fixture.nativeElement.querySelector('.meal-item--editing [role="alert"]')?.textContent?.trim()).toBe(
        "Couldn't save the new name. Please try again."
      );
      expect(repository.namesFor('2026-11-20', 'dinner')).toEqual(['Vegetable curry']);

      saveEdit(fixture);
      await settle(fixture);
      expect(mealNames(fixture, 'dinner')).toEqual(['Pizza']);
    });

    it('opening another form closes the one being edited without saving', () => {
      const fixture = render('2026-11-20');

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      typeInEdit(fixture, 'Pizza');
      addButton(fixture, 'lunch').click();
      fixture.detectChanges();

      expect(editField(fixture)).toBeNull();
      expect(input(fixture, 'lunch')).not.toBeNull();
      expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry']);
    });

    it('closes the form if the meal is removed meanwhile', async () => {
      const fixture = render('2026-11-20');
      const mealPlan = TestBed.inject(MealPlanStateService);

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      await mealPlan.removeMeal(mealPlan.mealsFor('2026-11-20').dinner[0].id);
      fixture.detectChanges();

      expect(editField(fixture)).toBeNull();
      expect(addButton(fixture, 'dinner').textContent?.trim()).toBe('Add dinner');
    });

    it('explains if the meal was removed while saving', async () => {
      const fixture = render('2026-11-20');
      const mealPlan = TestBed.inject(MealPlanStateService);
      const meal = mealPlan.mealsFor('2026-11-20').dinner[0];

      editButton(fixture, 'Edit Vegetable curry for dinner').click();
      fixture.detectChanges();
      typeInEdit(fixture, 'Pizza');
      // The remove is queued first, so the rename finds the meal gone.
      const removal = mealPlan.removeMeal(meal.id);
      saveEdit(fixture);
      await removal;
      await settle(fixture);

      expect(mealNames(fixture, 'dinner')).toEqual([]);
      expect(fixture.nativeElement.querySelector('[data-slot="dinner"] [role="alert"]')?.textContent?.trim()).toBe(
        'That meal was already removed.'
      );
    });
  });

  describe('removing a meal', () => {
    it('removes it from the slot and from storage', async () => {
      const fixture = render('2026-11-20');

      removeButton(fixture, 'Remove Vegetable curry from dinner').click();
      await settle(fixture);

      expect(mealNames(fixture, 'dinner')).toEqual([]);
      expect(repository.namesFor('2026-11-20', 'dinner')).toEqual([]);
      expect(addButton(fixture, 'dinner').textContent?.trim()).toBe('Add dinner');
    });

    it('keeps the meal and explains when removing fails', async () => {
      const fixture = render('2026-11-20');
      repository.failNextSave = true;

      removeButton(fixture, 'Remove Vegetable curry from dinner').click();
      await settle(fixture);

      expect(mealNames(fixture, 'dinner')).toEqual(['Vegetable curry']);
      expect(fixture.nativeElement.querySelector('[data-slot="dinner"] [role="alert"]')?.textContent?.trim()).toBe(
        "Couldn't remove Vegetable curry. Please try again."
      );
    });
  });

  it('shows meals added on an earlier visit when the day is opened again', async () => {
    const first = render('2026-11-19');
    await addMeal(first, 'breakfast', 'Pancakes');
    first.destroy();

    const second = render('2026-11-19');

    expect(mealNames(second, 'breakfast')).toEqual(['Pancakes']);
  });

  it('titles the page with the weekday and full date', () => {
    const fixture = render('2026-11-20');

    expect(text(fixture, '.page-header__text h1')).toBe(weekday(2026, 11, 20));
    expect(text(fixture, '.page-header__text p')).toBe(formatPlannerDate(new Date(2026, 10, 20)));
  });

  it.each([
    ['2026-11-18', 'Today'],
    ['2026-11-19', 'Tomorrow'],
    ['2026-11-17', 'Yesterday']
  ])('calls %s "%s"', (date, relative) => {
    const fixture = render(date);

    expect(text(fixture, '.page-header__text p')?.startsWith(`${relative} · `)).toBe(true);
  });

  it.each(['2026-02-30', 'not-a-date', '2026-11'])('shows a friendly message for an invalid day (%s)', (date) => {
    const fixture = render(date);

    expect(fixture.nativeElement.querySelector('[data-testid="invalid-day"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.slot-card')).toBeNull();
    expect(text(fixture, '.page-header__text h1')).toBe('Meal Planner');
    expect(text(fixture, '.page-header__text p')).toBe('Day not found');
  });

  it('links an invalid day back to the weekly plan', async () => {
    const fixture = render('2026-02-30');

    (fixture.nativeElement.querySelector('.empty-action') as HTMLAnchorElement).click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tabs/meal-planner');
  });

  it('follows the route when it moves to another day', () => {
    const fixture = render('2026-11-20');

    paramMap.next(convertToParamMap({ date: '2026-11-22' }));
    fixture.detectChanges();

    expect(text(fixture, '.page-header__text h1')).toBe(weekday(2026, 11, 22));
  });

  it('goes back to the weekly plan by default', () => {
    const fixture = render('2026-11-20');

    (fixture.nativeElement.querySelector('button[aria-label="Go back"]') as HTMLButtonElement).click();

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/meal-planner');
  });
});
