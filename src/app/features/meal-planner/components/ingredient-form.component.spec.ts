import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { QuantityUnit } from '../../pantry/models/pantry-item.model';
import { IngredientDraft } from '../services/meal-plan-state.service';
import { IngredientFormComponent } from './ingredient-form.component';

@Component({
  standalone: true,
  imports: [IngredientFormComponent],
  template: `
    <app-ingredient-form
      idPrefix="ing"
      [mode]="mode()"
      [initial]="initial()"
      [defaultUnit]="defaultUnit()"
      [busy]="busy()"
      [error]="error()"
      (save)="saved.push($event)"
      (cancelled)="cancelCount = cancelCount + 1"
      (remove)="removeCount = removeCount + 1"
    />
  `
})
class HostComponent {
  readonly mode = signal<'add' | 'edit'>('add');
  readonly initial = signal<IngredientDraft | null>(null);
  readonly defaultUnit = signal<QuantityUnit>('count');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = viewChild.required(IngredientFormComponent);
  saved: IngredientDraft[] = [];
  cancelCount = 0;
  removeCount = 0;
}

describe('IngredientFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  function render(setup: (host: HostComponent) => void = () => {}) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    // Attached to the document so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  const editing = (host: HostComponent) => {
    host.mode.set('edit');
    host.initial.set({ name: 'Milk', quantity: 0.3, unit: 'l' });
  };

  type Fixture = ReturnType<typeof render>;
  const el = <T extends Element = HTMLElement>(fixture: Fixture, selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;
  const nameField = (fixture: Fixture) => el<HTMLInputElement>(fixture, '#ing-name');
  const amountField = (fixture: Fixture) => el<HTMLInputElement>(fixture, '#ing-amount');
  const saveButton = (fixture: Fixture) => el<HTMLButtonElement>(fixture, '[data-testid="save-ingredient"]');
  const selectedUnit = (fixture: Fixture) =>
    (fixture.nativeElement.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.value;

  function type(fixture: Fixture, field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pickUnit(fixture: Fixture, unit: string): void {
    const radio = el<HTMLInputElement>(fixture, `input[type="radio"][value="${unit}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  describe('adding', () => {
    it('starts empty, focused, with the default unit', () => {
      const fixture = render((host) => host.defaultUnit.set('g'));

      expect(nameField(fixture).value).toBe('');
      expect(amountField(fixture).value).toBe('');
      expect(selectedUnit(fixture)).toBe('g');
      expect(document.activeElement).toBe(nameField(fixture));
      expect(saveButton(fixture).textContent?.trim()).toBe('Add');
      expect(fixture.nativeElement.querySelector('[data-testid="remove-ingredient"]')).toBeNull();
    });

    it('emits the tidied ingredient', () => {
      const fixture = render();

      type(fixture, nameField(fixture), '  Red   onion ');
      type(fixture, amountField(fixture), '1,5');
      pickUnit(fixture, 'kg');
      saveButton(fixture).click();

      expect(fixture.componentInstance.saved).toEqual([{ name: 'Red onion', quantity: 1.5, unit: 'kg' }]);
    });

    it('shows the chosen unit inside the amount field', () => {
      const fixture = render();

      pickUnit(fixture, 'ml');

      expect(el(fixture, '.amount__unit').textContent?.trim()).toBe('ml');
    });

    it('offers every app unit as a labelled choice', () => {
      const fixture = render();
      const radios = Array.from(fixture.nativeElement.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];

      expect(radios.map((radio) => radio.value)).toEqual(['count', 'kg', 'g', 'l', 'ml', 'pack', 'box']);
      expect(new Set(radios.map((radio) => radio.name))).toEqual(new Set(['ing-unit']));
      expect(el(fixture, 'fieldset legend').textContent?.trim()).toBe('Unit');
    });

    it('clears name and amount on reset, keeping the unit, ready for the next one', () => {
      const fixture = render();
      type(fixture, nameField(fixture), 'Rice');
      type(fixture, amountField(fixture), '250');
      pickUnit(fixture, 'g');
      amountField(fixture).focus();

      fixture.componentInstance.form().reset();
      fixture.detectChanges();

      expect(nameField(fixture).value).toBe('');
      expect(amountField(fixture).value).toBe('');
      expect(selectedUnit(fixture)).toBe('g');
      expect(document.activeElement).toBe(nameField(fixture));
    });
  });

  describe('editing', () => {
    it('starts with the current name, amount and unit', () => {
      const fixture = render(editing);

      expect(nameField(fixture).value).toBe('Milk');
      expect(amountField(fixture).value).toBe('0.3');
      expect(selectedUnit(fixture)).toBe('l');
      expect(saveButton(fixture).textContent?.trim()).toBe('Save');
    });

    it('focuses the name with the cursor at the end', () => {
      const fixture = render(editing);

      expect(document.activeElement).toBe(nameField(fixture));
      expect([nameField(fixture).selectionStart, nameField(fixture).selectionEnd]).toEqual([4, 4]);
    });

    it('emits the changed values', () => {
      const fixture = render(editing);

      type(fixture, amountField(fixture), '300');
      pickUnit(fixture, 'ml');
      saveButton(fixture).click();

      expect(fixture.componentInstance.saved).toEqual([{ name: 'Milk', quantity: 300, unit: 'ml' }]);
    });

    it('offers Remove, labelled with the ingredient', () => {
      const fixture = render(editing);
      const remove = el<HTMLButtonElement>(fixture, '[data-testid="remove-ingredient"]');

      expect(remove.getAttribute('aria-label')).toBe('Remove Milk');
      remove.click();
      expect(fixture.componentInstance.removeCount).toBe(1);
      expect(fixture.componentInstance.saved).toEqual([]);
    });
  });

  describe('validation', () => {
    it.each([
      ['no name', '', '2'],
      ['a blank name', '  ', '2'],
      ['no amount', 'Rice', '']
    ])('disables Save with %s', (_label, name, amount) => {
      const fixture = render();

      type(fixture, nameField(fixture), name);
      type(fixture, amountField(fixture), amount);

      expect(saveButton(fixture).disabled).toBe(true);
    });

    it.each([
      ['0', 'Enter an amount above 0.'],
      ['abc', 'Enter a number, like 2 or 1.5.'],
      ['999999', 'That amount is too large.']
    ])('explains why "%s" is not a valid amount', (amount, message) => {
      const fixture = render();

      type(fixture, nameField(fixture), 'Rice');
      type(fixture, amountField(fixture), amount);

      expect(saveButton(fixture).disabled).toBe(true);
      expect(el(fixture, '#ing-amount-error').textContent?.trim()).toBe(message);
      expect(amountField(fixture).getAttribute('aria-invalid')).toBe('true');
      expect(amountField(fixture).getAttribute('aria-describedby')).toBe('ing-amount-error');
    });

    it('does not emit when an incomplete form is submitted', () => {
      const fixture = render();
      type(fixture, nameField(fixture), 'Rice');

      el(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));

      expect(fixture.componentInstance.saved).toEqual([]);
    });
  });

  describe('keyboard', () => {
    it('moves from the name to the amount on Enter while the amount is missing', () => {
      const fixture = render();
      type(fixture, nameField(fixture), 'Rice');

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      nameField(fixture).dispatchEvent(enter);

      expect(enter.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(amountField(fixture));
    });

    it('lets Enter submit once the amount is valid', () => {
      const fixture = render(editing);

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      nameField(fixture).dispatchEvent(enter);

      expect(enter.defaultPrevented).toBe(false);
    });

    it('cancels on Escape and with the Cancel button', () => {
      const fixture = render(editing);

      nameField(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      el<HTMLButtonElement>(fixture, '.ghost-btn').click();

      expect(fixture.componentInstance.cancelCount).toBe(2);
      expect(fixture.componentInstance.saved).toEqual([]);
    });
  });

  describe('while busy', () => {
    it('locks the form, keeping what was entered', () => {
      const fixture = render(editing);
      type(fixture, amountField(fixture), '300');

      fixture.componentInstance.busy.set(true);
      fixture.detectChanges();

      expect(nameField(fixture).readOnly).toBe(true);
      expect(amountField(fixture).readOnly).toBe(true);
      expect(amountField(fixture).value).toBe('300');
      expect(el<HTMLFieldSetElement>(fixture, 'fieldset').disabled).toBe(true);
      expect(saveButton(fixture).disabled).toBe(true);
      expect(saveButton(fixture).textContent?.trim()).toBe('Saving…');
      expect(el<HTMLButtonElement>(fixture, '.ghost-btn').disabled).toBe(true);
      expect(el<HTMLButtonElement>(fixture, '[data-testid="remove-ingredient"]').disabled).toBe(true);

      nameField(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(fixture.componentInstance.cancelCount).toBe(0);
    });
  });

  it('shows an error message', () => {
    const fixture = render(editing);

    fixture.componentInstance.error.set("Couldn't save your changes. Please try again.");
    fixture.detectChanges();

    expect(el(fixture, '[role="alert"]').textContent?.trim()).toBe("Couldn't save your changes. Please try again.");
  });
});
