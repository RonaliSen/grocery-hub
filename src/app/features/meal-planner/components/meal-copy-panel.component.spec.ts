import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { PlannedMeal } from '../models/planned-meal.model';
import { formatWeekRange } from '../utils/meal-planner-week.util';
import { MealCopyPanelComponent, MealCopyTarget } from './meal-copy-panel.component';

/** Wednesday 18 November 2026 (local time). */
const NOW = new Date(2026, 10, 18, 10, 30);

@Component({
  standalone: true,
  imports: [MealCopyPanelComponent],
  template: `
    <app-meal-copy-panel
      [meal]="meal()"
      [busy]="busy()"
      [error]="error()"
      (copy)="copies.push($event)"
      (cancelled)="cancelCount = cancelCount + 1"
    />
  `
})
class HostComponent {
  readonly meal = signal<PlannedMeal>(plannedMeal({ id: 'pasta', date: '2026-11-16', slot: 'dinner', name: 'Pasta' }));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  copies: MealCopyTarget[] = [];
  cancelCount = 0;
}

describe('MealCopyPanelComponent', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(meal?: PlannedMeal) {
    const fixture = TestBed.createComponent(HostComponent);
    if (meal) fixture.componentInstance.meal.set(meal);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof render>;
  const el = <T extends Element = HTMLElement>(fixture: Fixture, selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;
  const days = (fixture: Fixture) =>
    Array.from(fixture.nativeElement.querySelectorAll('input[name="copy-day"]') as NodeListOf<HTMLInputElement>);
  const copyButton = (fixture: Fixture) => el<HTMLButtonElement>(fixture, '[data-testid="confirm-copy"]');

  function choose(fixture: Fixture, name: 'copy-day' | 'copy-slot', value: string): void {
    const radio = el<HTMLInputElement>(fixture, `input[name="${name}"][value="${value}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it("shows the meal's own week, Monday to Sunday, and marks its day", () => {
    const fixture = render(plannedMeal({ id: 'p', date: '2026-11-25', slot: 'dinner', name: 'Pasta' }));

    expect(days(fixture).map((day) => day.value)).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29'
    ]);
    expect(el(fixture, '.week__relative').textContent?.trim()).toBe('Next week');
    expect(el(fixture, '.week__range').textContent?.trim()).toBe(formatWeekRange(new Date(2026, 10, 23)));
    expect(fixture.nativeElement.querySelector('.day.is-original input')?.value).toBe('2026-11-25');
    expect(el(fixture, '.day.is-original input').getAttribute('aria-label')).toContain("this meal's day");
  });

  it('moves between weeks with the arrows', () => {
    const fixture = render();

    el<HTMLButtonElement>(fixture, '[data-testid="copy-next-week"]').click();
    fixture.detectChanges();
    expect(days(fixture)[0].value).toBe('2026-11-23');

    el<HTMLButtonElement>(fixture, '[data-testid="copy-previous-week"]').click();
    el<HTMLButtonElement>(fixture, '[data-testid="copy-previous-week"]').click();
    fixture.detectChanges();
    expect(days(fixture)[0].value).toBe('2026-11-09');
    expect(el(fixture, '.week__relative').textContent?.trim()).toBe('Last week');
  });

  it('starts with no day picked and the Copy button disabled', () => {
    const fixture = render();

    expect(days(fixture).some((day) => day.checked)).toBe(false);
    expect(copyButton(fixture).disabled).toBe(true);
  });

  it("starts on the original meal's slot", () => {
    const fixture = render();

    expect(el<HTMLInputElement>(fixture, 'input[name="copy-slot"]:checked').value).toBe('dinner');
  });

  it('emits the picked day with the same slot', () => {
    const fixture = render();

    choose(fixture, 'copy-day', '2026-11-18');
    copyButton(fixture).click();

    expect(fixture.componentInstance.copies).toEqual([{ date: '2026-11-18', slot: 'dinner' }]);
  });

  it('emits another slot when one is chosen', () => {
    const fixture = render();

    choose(fixture, 'copy-day', '2026-11-20');
    choose(fixture, 'copy-slot', 'lunch');
    copyButton(fixture).click();

    expect(fixture.componentInstance.copies).toEqual([{ date: '2026-11-20', slot: 'lunch' }]);
  });

  it('can pick a day in another week', () => {
    const fixture = render();

    el<HTMLButtonElement>(fixture, '[data-testid="copy-next-week"]').click();
    fixture.detectChanges();
    choose(fixture, 'copy-day', '2026-11-25');
    copyButton(fixture).click();

    expect(fixture.componentInstance.copies).toEqual([{ date: '2026-11-25', slot: 'dinner' }]);
  });

  it('does not emit when submitted without a day', () => {
    const fixture = render();

    el(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));

    expect(fixture.componentInstance.copies).toEqual([]);
  });

  it('cancels with the Cancel button and with Escape', () => {
    const fixture = render();

    el<HTMLButtonElement>(fixture, '.ghost-btn').click();
    el(fixture, 'form').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.cancelCount).toBe(2);
  });

  it('focuses its title when it opens', () => {
    const fixture = render();

    expect(document.activeElement).toBe(el(fixture, '#copy-title'));
  });

  it('locks while copying', () => {
    const fixture = render();
    choose(fixture, 'copy-day', '2026-11-18');

    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();

    expect(copyButton(fixture).disabled).toBe(true);
    expect(copyButton(fixture).textContent?.trim()).toBe('Copying…');
    expect(el<HTMLButtonElement>(fixture, '.ghost-btn').disabled).toBe(true);
    for (const fieldset of Array.from(fixture.nativeElement.querySelectorAll('fieldset')) as HTMLFieldSetElement[]) {
      expect(fieldset.disabled).toBe(true);
    }
  });

  it('shows an error message', () => {
    const fixture = render();

    fixture.componentInstance.error.set("Couldn't copy this meal. Please try again.");
    fixture.detectChanges();

    expect(el(fixture, '[role="alert"]').textContent?.trim()).toBe("Couldn't copy this meal. Please try again.");
  });
});
