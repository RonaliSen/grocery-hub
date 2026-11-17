import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { Component } from '@angular/core';

import { InMemoryMealPlanRepository, plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { MealPlanRepositoryService } from '../services/meal-plan-repository.service';
import { MealPlanStateService } from '../services/meal-plan-state.service';
import { formatWeekRange } from '../utils/meal-planner-week.util';
import { MealPlannerPage } from './meal-planner.page';

@Component({ standalone: true, template: '' })
class DummyDayPage {}

/**
 * A weekday's name in the machine's locale — as the app shows it — so these tests
 * pass on any system language, not just English.
 */
function weekday(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long' });
}

/** Wednesday 18 November 2026, mid-morning (local time). */
const NOW = new Date(2026, 10, 18, 10, 30);

describe('MealPlannerPage', () => {
  const navigationHistory = { back: vi.fn().mockResolvedValue(true) };

  let repository: InMemoryMealPlanRepository;

  beforeEach(async () => {
    repository = new InMemoryMealPlanRepository([
      // Monday: breakfast (two meals) and dinner.
      plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Porridge' }),
      plannedMeal({ date: '2026-11-16', slot: 'dinner', name: 'Curry' }),
      plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Coffee' }),
      // Friday: lunch only.
      plannedMeal({ date: '2026-11-20', slot: 'lunch', name: 'Leftovers' }),
      // Next Monday.
      plannedMeal({ date: '2026-11-23', slot: 'dinner', name: 'Pizza' })
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    navigationHistory.back.mockClear();

    await TestBed.configureTestingModule({
      imports: [MealPlannerPage],
      providers: [
        provideRouter([{ path: 'tabs/meal-planner/:date', component: DummyDayPage }]),
        { provide: NavigationHistoryService, useValue: navigationHistory },
        { provide: MealPlanRepositoryService, useValue: repository }
      ]
    }).compileComponents();

    await TestBed.inject(MealPlanStateService).load();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(MealPlannerPage);
    fixture.detectChanges();
    return fixture;
  }

  function query(fixture: ReturnType<typeof render>, selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function dayLinks(fixture: ReturnType<typeof render>): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('a.day-card'));
  }

  function dayHrefs(fixture: ReturnType<typeof render>): string[] {
    return dayLinks(fixture).map((link) => link.getAttribute('href') ?? '');
  }

  function click(fixture: ReturnType<typeof render>, testId: string): void {
    (query(fixture, `[data-testid="${testId}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('opens on the current week, Monday to Sunday', () => {
    const fixture = render();

    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('This week');
    expect(query(fixture, '[data-testid="week-range"]')?.textContent?.trim()).toBe(
      formatWeekRange(new Date(2026, 10, 16))
    );
    expect(dayHrefs(fixture)).toEqual([
      '/tabs/meal-planner/2026-11-16',
      '/tabs/meal-planner/2026-11-17',
      '/tabs/meal-planner/2026-11-18',
      '/tabs/meal-planner/2026-11-19',
      '/tabs/meal-planner/2026-11-20',
      '/tabs/meal-planner/2026-11-21',
      '/tabs/meal-planner/2026-11-22'
    ]);
    expect(dayLinks(fixture).map((link) => link.querySelector('.day-card__name')?.textContent?.trim())).toEqual([
      weekday(2026, 11, 16),
      weekday(2026, 11, 17),
      `${weekday(2026, 11, 18)} Today`,
      weekday(2026, 11, 19),
      weekday(2026, 11, 20),
      weekday(2026, 11, 21),
      weekday(2026, 11, 22)
    ]);
  });

  it('highlights today and marks it as the current date', () => {
    const fixture = render();
    const today = dayLinks(fixture).filter((link) => link.classList.contains('is-today'));

    expect(today).toHaveLength(1);
    expect(today[0].getAttribute('href')).toBe('/tabs/meal-planner/2026-11-18');
    expect(today[0].getAttribute('aria-current')).toBe('date');
    expect(today[0].getAttribute('aria-label')).toContain('today');
    expect(fixture.nativeElement.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  describe('planned meals', () => {
    function card(fixture: ReturnType<typeof render>, date: string): HTMLAnchorElement {
      return query(fixture, `a.day-card[href="/tabs/meal-planner/${date}"]`) as HTMLAnchorElement;
    }

    function status(fixture: ReturnType<typeof render>, date: string): string | undefined {
      return card(fixture, date).querySelector('.day-card__status')?.textContent?.trim();
    }

    function plannedSlots(fixture: ReturnType<typeof render>, date: string): string[] {
      return Array.from(card(fixture, date).querySelectorAll<HTMLElement>('.slot-dot.is-planned')).map(
        (dot) => dot.dataset['slot'] ?? ''
      );
    }

    it("lists each day's meals, breakfast to dinner", () => {
      const fixture = render();

      expect(status(fixture, '2026-11-16')).toBe('Porridge · Coffee · Curry');
      expect(status(fixture, '2026-11-20')).toBe('Leftovers');
    });

    it('marks which slots are planned', () => {
      const fixture = render();

      expect(plannedSlots(fixture, '2026-11-16')).toEqual(['breakfast', 'dinner']);
      expect(plannedSlots(fixture, '2026-11-20')).toEqual(['lunch']);
      expect(plannedSlots(fixture, '2026-11-17')).toEqual([]);
    });

    it('highlights only days with meals', () => {
      const fixture = render();
      const planned = dayLinks(fixture)
        .filter((link) => link.classList.contains('has-meals'))
        .map((link) => link.getAttribute('href'));

      expect(planned).toEqual(['/tabs/meal-planner/2026-11-16', '/tabs/meal-planner/2026-11-20']);
    });

    it('shows days without meals as not planned yet', () => {
      const fixture = render();

      for (const date of ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-21', '2026-11-22']) {
        expect(status(fixture, date)).toBe('Nothing planned yet');
      }
    });

    it('describes the plan to screen readers', () => {
      const fixture = render();

      const monday = card(fixture, '2026-11-16').getAttribute('aria-label')!;
      expect(monday.startsWith(`${weekday(2026, 11, 16)}, `)).toBe(true);
      expect(monday.endsWith('. Breakfast: Porridge, Coffee. Dinner: Curry')).toBe(true);

      const wednesday = card(fixture, '2026-11-18').getAttribute('aria-label')!;
      expect(wednesday.startsWith(`${weekday(2026, 11, 18)}, `)).toBe(true);
      expect(wednesday.endsWith(', today. Nothing planned yet')).toBe(true);
    });

    it("shows another week's meals after switching weeks", () => {
      const fixture = render();

      click(fixture, 'next-week');

      expect(status(fixture, '2026-11-23')).toBe('Pizza');
      expect(status(fixture, '2026-11-24')).toBe('Nothing planned yet');
    });

    it('updates as soon as meals are added, renamed or removed', async () => {
      const fixture = render();
      const mealPlan = TestBed.inject(MealPlanStateService);

      const added = await mealPlan.addMeal('2026-11-18', 'lunch', 'Soup');
      fixture.detectChanges();
      expect(status(fixture, '2026-11-18')).toBe('Soup');
      expect(plannedSlots(fixture, '2026-11-18')).toEqual(['lunch']);

      const soup = (await mealPlan.renameMeal(added.id, 'Tomato soup'))!;
      fixture.detectChanges();
      expect(status(fixture, '2026-11-18')).toBe('Tomato soup');
      expect(card(fixture, '2026-11-18').getAttribute('aria-label')).toContain('Lunch: Tomato soup');

      await mealPlan.removeMeal(soup.id);
      fixture.detectChanges();
      expect(status(fixture, '2026-11-18')).toBe('Nothing planned yet');
    });
  });

  it('moves to the next and previous weeks with the arrows', () => {
    const fixture = render();

    click(fixture, 'next-week');
    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('Next week');
    expect(dayHrefs(fixture)[0]).toBe('/tabs/meal-planner/2026-11-23');
    expect(dayHrefs(fixture)[6]).toBe('/tabs/meal-planner/2026-11-29');
    expect(query(fixture, '.day-card.is-today')).toBeNull();

    click(fixture, 'previous-week');
    click(fixture, 'previous-week');
    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('Last week');
    expect(dayHrefs(fixture)[0]).toBe('/tabs/meal-planner/2026-11-09');
    expect(query(fixture, '[data-testid="week-range"]')?.textContent?.trim()).toBe(
      formatWeekRange(new Date(2026, 10, 9))
    );
  });

  it('crosses into the next year', () => {
    const fixture = render();

    for (let i = 0; i < 6; i++) click(fixture, 'next-week');

    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('In 6 weeks');
    expect(dayHrefs(fixture)).toEqual([
      '/tabs/meal-planner/2026-12-28',
      '/tabs/meal-planner/2026-12-29',
      '/tabs/meal-planner/2026-12-30',
      '/tabs/meal-planner/2026-12-31',
      '/tabs/meal-planner/2027-01-01',
      '/tabs/meal-planner/2027-01-02',
      '/tabs/meal-planner/2027-01-03'
    ]);
  });

  it('offers a way back to the current week only when away from it', () => {
    const fixture = render();
    expect(query(fixture, '[data-testid="current-week"]')).toBeNull();

    click(fixture, 'previous-week');
    click(fixture, 'previous-week');
    expect(query(fixture, '[data-testid="current-week"]')).not.toBeNull();

    click(fixture, 'current-week');
    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('This week');
    expect(dayHrefs(fixture)[0]).toBe('/tabs/meal-planner/2026-11-16');
    expect(query(fixture, '[data-testid="current-week"]')).toBeNull();
  });

  it('labels the week arrows for screen readers', () => {
    const fixture = render();

    expect(query(fixture, '[data-testid="previous-week"]')?.getAttribute('aria-label')).toBe('Previous week');
    expect(query(fixture, '[data-testid="next-week"]')?.getAttribute('aria-label')).toBe('Next week');
  });

  it('opens a day when it is tapped', async () => {
    const fixture = render();

    dayLinks(fixture)[4].click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tabs/meal-planner/2026-11-20');
  });

  it('moves "today" on when the page is revisited on a later day', () => {
    const fixture = render();

    // Next Monday: the week the page opened on is now last week.
    vi.setSystemTime(new Date(2026, 10, 23, 9));
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();

    expect(query(fixture, '[data-testid="week-label"]')?.textContent?.trim()).toBe('Last week');
    expect(query(fixture, '.day-card.is-today')).toBeNull();

    click(fixture, 'current-week');
    expect(query(fixture, '.day-card.is-today')?.getAttribute('href')).toBe('/tabs/meal-planner/2026-11-23');
  });

  it('goes back to Home by default', () => {
    const fixture = render();

    (query(fixture, 'button[aria-label="Go back"]') as HTMLButtonElement).click();

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/home');
  });
});
