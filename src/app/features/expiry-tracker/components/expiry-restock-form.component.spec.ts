import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { ExpiryRestockFormComponent, ExpiryRestockRequest } from './expiry-restock-form.component';

function inDays(days: number): string {
  return toLocalDateOnly(addDays(new Date(), days));
}

function createItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'milk',
    name: 'Milk',
    imageUrl: null,
    category: 'dairy',
    unit: 'l',
    quantity: 2,
    minQuantity: 0,
    avgDailyUsage: null,
    autoAddToShoppingList: false,
    expiryDate: inDays(3),
    germanStore: true,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('ExpiryRestockFormComponent', () => {
  let fixture: ComponentFixture<ExpiryRestockFormComponent>;
  let emitted: ExpiryRestockRequest[];
  let cancelled: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpiryRestockFormComponent] }).compileComponents();
  });

  function render(item: PantryItem = createItem()) {
    fixture = TestBed.createComponent(ExpiryRestockFormComponent);
    fixture.componentRef.setInput('item', item);
    emitted = [];
    cancelled = 0;
    fixture.componentInstance.restock.subscribe((request) => emitted.push(request));
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
  }

  const el = <T extends HTMLElement = HTMLElement>(selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;
  const textOf = (selector: string) => el(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  function type(selector: string, value: string): void {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('starts with one unit and keeps a date that is still ahead', () => {
    render();

    expect(textOf('h2')).toBe('Restock Milk');
    expect(textOf('.sheet__title p')).toBe('You have 2 l right now.');
    expect(el<HTMLInputElement>('#restock-amount').value).toBe('1');
    expect(textOf('.stepper__unit')).toBe('l');
    expect(el<HTMLInputElement>('#restock-date').value).toBe(inDays(3));
    expect(textOf('.field__hint')).toBe('Keeps the current expiry date.');
    expect(textOf('.sheet__summary')).toContain('After restock: 3 l · expires');
  });

  it('starts blank and explains why when the old date has passed', () => {
    render(createItem({ expiryDate: inDays(-4) }));

    expect(el<HTMLInputElement>('#restock-date').value).toBe('');
    expect(textOf('.field__hint')).toMatch(/^The old date \(.+\) has passed/);
    expect(textOf('.sheet__summary')).toContain('no expiry date');
  });

  it('steps the amount, never below 1', () => {
    render();
    const minus = el<HTMLButtonElement>('button[aria-label="Decrease amount"]');
    const plus = el<HTMLButtonElement>('button[aria-label="Increase amount"]');

    expect(minus.disabled).toBe(true);
    plus.click();
    plus.click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('#restock-amount').value).toBe('3');
    expect(minus.disabled).toBe(false);

    minus.click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('#restock-amount').value).toBe('2');
  });

  it('picks a date from the quick chips', () => {
    render(createItem({ expiryDate: null }));
    const weekChip = Array.from(fixture.nativeElement.querySelectorAll('.date-chip') as NodeListOf<HTMLButtonElement>).find(
      (chip) => chip.textContent?.trim() === '1 week'
    )!;

    weekChip.click();
    fixture.detectChanges();

    expect(el<HTMLInputElement>('#restock-date').value).toBe(inDays(7));
    expect(weekChip.getAttribute('aria-pressed')).toBe('true');
    expect(textOf('.field__hint')).toBe('Adds an expiry date to this item.');
  });

  it('says when a picked date replaces the current one', () => {
    render();
    type('#restock-date', inDays(12));

    expect(textOf('.field__hint')).toMatch(/^Replaces the current date \(.+\)\.$/);
  });

  it('emits the amount and date on submit', () => {
    render();
    type('#restock-amount', '2.5');
    type('#restock-date', inDays(10));

    submit();

    expect(emitted).toEqual([{ amount: 2.5, expiryDate: inDays(10) }]);
  });

  it('emits a null date when the date is left empty', () => {
    render();
    type('#restock-date', '');

    submit();

    expect(emitted).toEqual([{ amount: 1, expiryDate: null }]);
  });

  it.each(['0', '-2', ''])('rejects an amount of "%s"', (amount) => {
    render();
    type('#restock-amount', amount);

    expect(textOf('.field__error')).toBe('Enter an amount above 0.');
    expect(el<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    submit();
    expect(emitted).toEqual([]);
  });

  it('rejects a date in the past', () => {
    render();
    type('#restock-date', inDays(-1));

    expect(textOf('.field__error')).toBe('Pick today or a later date.');
    expect(el<HTMLInputElement>('#restock-date').getAttribute('aria-invalid')).toBe('true');
    expect(el<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    expect(el('.sheet__summary')).toBeNull();
  });

  it('disables saving while the page is applying the restock', () => {
    render();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const save = el<HTMLButtonElement>('button[type="submit"]');
    expect(save.disabled).toBe(true);
    expect(save.textContent?.trim()).toBe('Saving…');
  });

  it('emits cancel', () => {
    render();

    el<HTMLButtonElement>('.ghost-btn').click();

    expect(cancelled).toBe(1);
    expect(emitted).toEqual([]);
  });

  it('resets the form when another item is restocked', () => {
    render();
    type('#restock-amount', '4');
    type('#restock-date', inDays(20));

    fixture.componentRef.setInput('item', createItem({ id: 'eggs', name: 'Eggs', unit: 'count', expiryDate: null }));
    fixture.detectChanges();

    expect(textOf('h2')).toBe('Restock Eggs');
    expect(el<HTMLInputElement>('#restock-amount').value).toBe('1');
    expect(el<HTMLInputElement>('#restock-date').value).toBe('');
  });
});
