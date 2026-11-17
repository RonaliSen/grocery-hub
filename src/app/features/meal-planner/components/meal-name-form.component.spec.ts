import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { MealNameFormComponent } from './meal-name-form.component';

@Component({
  standalone: true,
  imports: [MealNameFormComponent],
  template: `
    <app-meal-name-form
      inputId="meal-field"
      label="Dinner meal name"
      placeholder="e.g. Vegetable curry"
      [initialName]="initialName()"
      [saving]="saving()"
      [error]="error()"
      (save)="saved.push($event)"
      (cancelled)="cancelCount = cancelCount + 1"
    />
  `
})
class HostComponent {
  readonly initialName = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  saved: string[] = [];
  cancelCount = 0;
}

describe('MealNameFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  function render(initialName = '') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.initialName.set(initialName);
    // Attached to the document so focus and selection can be checked.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof render>;

  const field = (fixture: Fixture) => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const saveButton = (fixture: Fixture) =>
    fixture.nativeElement.querySelector('[data-testid="save-meal"]') as HTMLButtonElement;
  const cancelButton = (fixture: Fixture) => fixture.nativeElement.querySelector('.ghost-btn') as HTMLButtonElement;

  function type(fixture: Fixture, value: string): void {
    field(fixture).value = value;
    field(fixture).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(fixture: Fixture): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('labels the field and shows the placeholder', () => {
    const fixture = render();

    expect(fixture.nativeElement.querySelector('label[for="meal-field"]')?.textContent?.trim()).toBe(
      'Dinner meal name'
    );
    expect(field(fixture).placeholder).toBe('e.g. Vegetable curry');
    expect(field(fixture).maxLength).toBe(80);
  });

  it('starts empty and focused when adding', () => {
    const fixture = render();

    expect(field(fixture).value).toBe('');
    expect(document.activeElement).toBe(field(fixture));
  });

  it('starts with the current name selected when renaming, so typing replaces it', () => {
    const fixture = render('Vegetable curry');
    const input = field(fixture);

    expect(input.value).toBe('Vegetable curry');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Vegetable curry'.length]);
  });

  it('emits the tidied name on Save', () => {
    const fixture = render();

    type(fixture, '  Margherita   pizza ');
    saveButton(fixture).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.saved).toEqual(['Margherita pizza']);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   ']
  ])('does not save when the name is %s', (_label, value) => {
    const fixture = render('Curry');

    type(fixture, value);
    expect(saveButton(fixture).disabled).toBe(true);

    submit(fixture);
    expect(fixture.componentInstance.saved).toEqual([]);
  });

  it('cancels with the Cancel button and with Escape', () => {
    const fixture = render('Curry');

    cancelButton(fixture).click();
    field(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.cancelCount).toBe(2);
    expect(fixture.componentInstance.saved).toEqual([]);
  });

  it('locks the form while saving, keeping the text', () => {
    const fixture = render();
    type(fixture, 'Soup');

    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();

    expect(field(fixture).readOnly).toBe(true);
    expect(field(fixture).value).toBe('Soup');
    expect(saveButton(fixture).disabled).toBe(true);
    expect(saveButton(fixture).textContent?.trim()).toBe('Saving…');
    expect(cancelButton(fixture).disabled).toBe(true);

    submit(fixture);
    field(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.saved).toEqual([]);
    expect(fixture.componentInstance.cancelCount).toBe(0);
  });

  it('shows an error linked to the field', () => {
    const fixture = render();

    fixture.componentInstance.error.set("Couldn't save this meal. Please try again.");
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(error.textContent?.trim()).toBe("Couldn't save this meal. Please try again.");
    expect(field(fixture).getAttribute('aria-describedby')).toBe(error.id);
    expect(field(fixture).getAttribute('aria-invalid')).toBe('true');
  });
});
