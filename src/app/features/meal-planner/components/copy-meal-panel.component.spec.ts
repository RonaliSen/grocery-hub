import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { MealSlotId } from '../models/meal-slot.model';
import { formatWeekRange } from '../utils/meal-planner-week.util';
import { CopyMealPanelComponent, MealCopyTarget } from './copy-meal-panel.component';

@Component({
  standalone: true,
  imports: [CopyMealPanelComponent],
  template: `
    <app-copy-meal-panel
      mealName="Pasta"
      [mealDate]="mealDate()"
      [mealSlot]="mealSlot()"
      [busy]="busy()"
      [error]="error()"
      (copy)="copies.push($event)"
      (cancelled)="cancelCount = cancelCount + 1"
    />
  `
})
class HostComponent {
  readonly mealDate = signal('2026-11-16');
  readonly mealSlot = signal<MealSlotId>('dinner');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  copies: MealCopyTarget[] = [];
  cancelCount = 0;
}

/** Wednesday 18 November 2026. */
const NOW = new Date(2026, 10, 18, 10, 30);

describe('CopyMealPanelComponent', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof render>;
  const el = <T extends Element = HTMLElement>(fixture: Fixture, selector: string) =>
    fixture.nativeElement.querySelector(selector) as T | null;
  const copyButton = (fixture: Fixture) => el<HTMLButtonElement>(fixture, '[data-testid="confirm-copy"]')!;
  const dayDates = (fixture: Fixture) =>
    Array.from(fixture.nativeElement.querySelectorAll('input[name="copy-day"]') as NodeListOf<HTMLInputElement>).map(
      (input) => input.value
    );

  function choose(fixture: Fixture, name: 'copy-day' | 'copy-slot', value: string): void {
    const radio = el<HTMLInputElement>(fixture, `input[name="${name}"][value="${value}"]`)!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it("opens on the meal's week, Monday to Sunday, and focuses its title", () => {
    const fixture = render();

    expect(dayDates(fixture)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22'
    ]);
    expect(el(fixture, '[data-testid="copy-week-range"]')?.textContent?.trim()).toBe(
      formatWeekRange(new Date(2026, 10, 16))
    );
    expect(document.activeElement).toBe(el(fixture, '#copy-title'));
    expect(el(fixture, '#copy-title')?.textContent?.trim()).toBe('Copy Pasta');
  });

  it("marks the meal's own day and today for screen readers", () => {
    const fixture = render();

    expect(el(fixture, 'input[value="2026-11-16"]')?.getAttribute('aria-label')).toMatch(/^Monday, .+, this meal's day$/);
    expect(el(fixture, 'input[value="2026-11-18"]')?.getAttribute('aria-label')).toMatch(/^Wednesday, .+, today$/);
    expect(el(fixture, 'label.day.is-original input')?.getAttribute('value')).toBe('2026-11-16');
  });

  it("starts with no day picked and the meal's own slot", () => {
    const fixture = render();

    expect(el(fixture, 'input[name="copy-day"]:checked')).toBeNull();
    expect(el<HTMLInputElement>(fixture, 'input[name="copy-slot"]:checked')?.value).toBe('dinner');
    expect(copyButton(fixture).disabled).toBe(true);
    expect(copyButton(fixture).textContent?.trim()).toBe('Copy');
  });

  it('emits the chosen day and slot', () => {
    const fixture = render();

    choose(fixture, 'copy-day', '2026-11-18');
    choose(fixture, 'copy-slot', 'lunch');
    expect(copyButton(fixture).disabled).toBe(false);
    expect(copyButton(fixture).textContent?.trim()).toMatch(/^Copy to \S+ 18 · Lunch$/);

    copyButton(fixture).click();

    expect(fixture.componentInstance.copies).toEqual([{ date: '2026-11-18', slot: 'lunch' }]);
  });

  it('moves between weeks to reach other days', () => {
    const fixture = render();

    el<HTMLButtonElement>(fixture, '[aria-label="Next week"]')!.click();
    fixture.detectChanges();
    expect(dayDates(fixture)[0]).toBe('2026-11-23');

    choose(fixture, 'copy-day', '2026-11-25');
    copyButton(fixture).click();
    expect(fixture.componentInstance.copies).toEqual([{ date: '2026-11-25', slot: 'dinner' }]);

    el<HTMLButtonElement>(fixture, '[aria-label="Previous week"]')!.click();
    el<HTMLButtonElement>(fixture, '[aria-label="Previous week"]')!.click();
    fixture.detectChanges();
    expect(dayDates(fixture)[0]).toBe('2026-11-09');
  });

  it("will not copy onto the meal's own day and slot", () => {
    const fixture = render();

    choose(fixture, 'copy-day', '2026-11-16');

    expect(copyButton(fixture).disabled).toBe(true);
    expect(el(fixture, '[data-testid="copy-same-spot"]')).not.toBeNull();

    choose(fixture, 'copy-slot', 'breakfast');
    expect(copyButton(fixture).disabled).toBe(false);
    expect(el(fixture, '[data-testid="copy-same-spot"]')).toBeNull();
  });

  it('does not emit when submitted without a day', () => {
    const fixture = render();

    el(fixture, 'form')!.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(fixture.componentInstance.copies).toEqual([]);
  });

  it('cancels with the Cancel button and with Escape', () => {
    const fixture = render();

    el<HTMLButtonElement>(fixture, '.ghost-btn')!.click();
    el(fixture, 'form')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.cancelCount).toBe(2);
  });

  it('locks while copying and shows errors', () => {
    const fixture = render();
    choose(fixture, 'copy-day', '2026-11-18');

    fixture.componentInstance.busy.set(true);
    fixture.componentInstance.error.set("Couldn't copy this meal. Please try again.");
    fixture.detectChanges();

    expect(copyButton(fixture).disabled).toBe(true);
    expect(copyButton(fixture).textContent?.trim()).toBe('Copying…');
    expect(el<HTMLButtonElement>(fixture, '.ghost-btn')!.disabled).toBe(true);
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('fieldset') as NodeListOf<HTMLFieldSetElement>).every(
        (fieldset) => fieldset.disabled
      )
    ).toBe(true);
    expect(el(fixture, '[role="alert"]')?.textContent?.trim()).toBe("Couldn't copy this meal. Please try again.");
  });
});
