import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryAuditSessionService } from '../services/pantry-audit-session.service';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { PantryAuditCountPage } from './pantry-audit-count.page';

function pantryItem(overrides: Partial<PantryItem> & Pick<PantryItem, 'id' | 'name'>): PantryItem {
  return {
    category: 'grains',
    unit: 'count',
    quantity: 1,
    minQuantity: 1,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: null,
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const ITEMS: PantryItem[] = [
  pantryItem({ id: 'rice', name: 'Rice', quantity: 2, unit: 'kg' }),
  pantryItem({ id: 'milk', name: 'Milk', category: 'dairy', quantity: 1.5, unit: 'l' }),
  pantryItem({ id: 'apples', name: 'Apples', category: 'fruits', quantity: 6, unit: 'count' })
];

describe('PantryAuditCountPage', () => {
  const repository = { getAll: vi.fn(), saveAll: vi.fn() };
  const navigationHistory = { back: vi.fn() };

  beforeEach(async () => {
    repository.getAll.mockResolvedValue(ITEMS);
    repository.saveAll.mockResolvedValue(undefined);
    navigationHistory.back.mockReset().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [PantryAuditCountPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        { provide: PantryRepositoryService, useValue: repository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } },
        { provide: NavigationHistoryService, useValue: navigationHistory }
      ]
    }).compileComponents();
  });

  async function render(selectedIds: string[] = ['rice', 'milk']): Promise<ComponentFixture<PantryAuditCountPage>> {
    await TestBed.inject(PantryStateService).load();
    const session = TestBed.inject(PantryAuditSessionService);
    selectedIds.forEach((id) => session.setSelected(id, true));

    const fixture = TestBed.createComponent(PantryAuditCountPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const cards = (fixture: ComponentFixture<unknown>) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="audit-count-item"]')
    ) as HTMLElement[];
  const cardFor = (fixture: ComponentFixture<unknown>, name: string) =>
    cards(fixture).find((card) => card.querySelector('.count-card__name')?.textContent?.trim() === name)!;
  const inputIn = (card: HTMLElement) =>
    card.querySelector('[data-testid="audit-actual-input"]') as HTMLInputElement;
  const differenceIn = (card: HTMLElement) =>
    card.querySelector('[data-testid="audit-difference"]') as HTMLElement;
  const errorIn = (card: HTMLElement) => card.querySelector('.count-card__error')?.textContent?.trim();

  function type(fixture: ComponentFixture<unknown>, name: string, value: string): void {
    const input = inputIn(cardFor(fixture, name));
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows each selected item with its name, saved quantity and unit, and an actual quantity input', async () => {
    const fixture = await render();

    expect(cards(fixture).map((card) => card.querySelector('.count-card__name')?.textContent?.trim())).toEqual([
      'Milk',
      'Rice'
    ]);

    const rice = cardFor(fixture, 'Rice');
    expect(rice.querySelector('[data-testid="audit-saved-quantity"]')?.textContent?.trim()).toBe('2 kg');
    expect(inputIn(rice).value).toBe('');
    expect(inputIn(rice).getAttribute('inputmode')).toBe('decimal');
    expect(rice.querySelector('.count-input__unit')?.textContent?.trim()).toBe('kg');
    expect(rice.querySelector('label')?.getAttribute('for')).toBe(inputIn(rice).id);
    expect(differenceIn(rice).textContent?.trim()).toBe('Not counted yet');

    expect(cardFor(fixture, 'Milk').querySelector('[data-testid="audit-saved-quantity"]')?.textContent?.trim()).toBe(
      '1.5 l'
    );
  });

  it('shows a positive, negative or zero difference between the saved and actual quantity', async () => {
    const fixture = await render();
    const rice = () => differenceIn(cardFor(fixture, 'Rice'));

    type(fixture, 'Rice', '5');
    expect(rice().textContent?.trim()).toBe('+3 kg');
    expect(rice().classList).toContain('is-more');

    type(fixture, 'Rice', '0.5');
    expect(rice().textContent?.trim()).toBe('\u22121.5 kg');
    expect(rice().classList).toContain('is-less');

    type(fixture, 'Rice', '2');
    expect(rice().textContent?.trim()).toBe('No change');
    expect(rice().classList).toContain('is-same');

    type(fixture, 'Milk', '1,2');
    expect(differenceIn(cardFor(fixture, 'Milk')).textContent?.trim()).toBe('\u22120.3 l');
  });

  it('accepts zero as an actual quantity', async () => {
    const fixture = await render();

    type(fixture, 'Rice', '0');

    const rice = cardFor(fixture, 'Rice');
    expect(errorIn(rice)).toBeUndefined();
    expect(inputIn(rice).getAttribute('aria-invalid')).toBe('false');
    expect(differenceIn(rice).textContent?.trim()).toBe('\u22122 kg');
  });

  it('blocks typing a minus sign', async () => {
    const fixture = await render();
    const event = new KeyboardEvent('keydown', { key: '-', cancelable: true });

    inputIn(cardFor(fixture, 'Rice')).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('rejects a negative quantity (e.g. pasted) with an error and no difference', async () => {
    const fixture = await render();

    type(fixture, 'Rice', '-3');

    const rice = cardFor(fixture, 'Rice');
    expect(errorIn(rice)).toBe('Quantity can’t be negative.');
    expect(inputIn(rice).getAttribute('aria-invalid')).toBe('true');
    expect(inputIn(rice).getAttribute('aria-describedby')).toBe(rice.querySelector('.count-card__error')?.id);
    expect(differenceIn(rice).textContent?.trim()).toBe('—');

    type(fixture, 'Rice', '3');
    expect(errorIn(cardFor(fixture, 'Rice'))).toBeUndefined();
    expect(differenceIn(cardFor(fixture, 'Rice')).textContent?.trim()).toBe('+1 kg');
  });

  it('rejects text that is not a number', async () => {
    const fixture = await render();

    type(fixture, 'Milk', 'two');

    expect(errorIn(cardFor(fixture, 'Milk'))).toBe('Enter a number, like 2 or 1.5.');
  });

  it('never rewrites a partially typed decimal', async () => {
    const fixture = await render();

    type(fixture, 'Milk', '1.');

    expect(inputIn(cardFor(fixture, 'Milk')).value).toBe('1.');
    expect(differenceIn(cardFor(fixture, 'Milk')).textContent?.trim()).toBe('\u22120.5 l');
  });

  it('keeps entered counts when the screen is reopened', async () => {
    const first = await render();
    type(first, 'Rice', '4');
    first.destroy();

    const second = TestBed.createComponent(PantryAuditCountPage);
    second.detectChanges();

    expect(inputIn(cardFor(second, 'Rice')).value).toBe('4');
    expect(differenceIn(cardFor(second, 'Rice')).textContent?.trim()).toBe('+2 kg');
  });

  describe('Continue', () => {
    const continueButton = (fixture: ComponentFixture<unknown>) =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="audit-footer-continue"]') as HTMLButtonElement;
    const status = (fixture: ComponentFixture<unknown>) =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="audit-footer-status"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();

    it('is disabled until every item has a quantity, with a hint about what is missing', async () => {
      const fixture = await render();

      expect(continueButton(fixture).disabled).toBe(true);
      expect(status(fixture)).toBe('0 of 2 counted 2 still to count');

      type(fixture, 'Rice', '0');
      expect(continueButton(fixture).disabled).toBe(true);
      expect(status(fixture)).toBe('1 of 2 counted 1 still to count');

      type(fixture, 'Milk', '1.5');
      expect(continueButton(fixture).disabled).toBe(false);
      expect(status(fixture)).toBe('2 of 2 counted');
    });

    it('is disabled while any quantity is invalid', async () => {
      const fixture = await render();
      type(fixture, 'Rice', '2');

      type(fixture, 'Milk', '-1');
      expect(continueButton(fixture).disabled).toBe(true);
      expect(status(fixture)).toBe('1 of 2 counted 1 invalid quantity');

      type(fixture, 'Rice', 'abc');
      expect(status(fixture)).toBe('0 of 2 counted 2 invalid quantities');

      type(fixture, 'Rice', '');
      expect(status(fixture)).toBe('0 of 2 counted 1 invalid · 1 still to count');
      expect(continueButton(fixture).disabled).toBe(true);
    });

    it('opens the review step once everything is counted', async () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = await render();

      continueButton(fixture).click();
      expect(navigateSpy).not.toHaveBeenCalled();

      type(fixture, 'Rice', '2');
      type(fixture, 'Milk', '0');
      continueButton(fixture).click();

      expect(navigateSpy).toHaveBeenCalledWith('/tabs/pantry/audit/review');
    });
  });

  it('asks the user to select items first when nothing is selected', async () => {
    const fixture = await render([]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('No items selected');
    expect(text).toContain('Select items');
    expect(cards(fixture)).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="audit-footer-continue"]')).toBeNull();
  });

  it('returns to item selection from the header back button', async () => {
    const fixture = await render();

    ((fixture.nativeElement as HTMLElement).querySelector('.audit-header__back') as HTMLButtonElement).click();

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/pantry/audit/select');
  });
});
