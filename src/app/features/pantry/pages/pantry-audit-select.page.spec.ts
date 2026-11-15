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
import { PantryAuditSelectPage } from './pantry-audit-select.page';

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
  pantryItem({ id: 'rice', name: 'Rice', category: 'grains', quantity: 2, unit: 'kg' }),
  pantryItem({ id: 'milk', name: 'Milk', category: 'dairy', quantity: 1.5, unit: 'l' }),
  pantryItem({ id: 'apples', name: 'Apples', category: 'fruits', quantity: 6, unit: 'count' })
];

describe('PantryAuditSelectPage', () => {
  const repository = { getAll: vi.fn(), saveAll: vi.fn() };
  const navigationHistory = { back: vi.fn() };

  beforeEach(async () => {
    repository.getAll.mockResolvedValue(ITEMS);
    repository.saveAll.mockResolvedValue(undefined);
    navigationHistory.back.mockReset().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [PantryAuditSelectPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        { provide: PantryRepositoryService, useValue: repository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } },
        { provide: NavigationHistoryService, useValue: navigationHistory }
      ]
    }).compileComponents();
  });

  async function render(): Promise<ComponentFixture<PantryAuditSelectPage>> {
    const fixture = TestBed.createComponent(PantryAuditSelectPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const query = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector) as T;
  const queryAll = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector)) as T[];
  const selectedCountText = (fixture: ComponentFixture<unknown>) =>
    query<HTMLElement>(fixture, '[data-testid="audit-footer-status"]').textContent?.replace(/\s+/g, ' ').trim();
  const continueButton = (fixture: ComponentFixture<unknown>) =>
    query<HTMLButtonElement>(fixture, '[data-testid="audit-footer-continue"]');

  function click(fixture: ComponentFixture<unknown>, element: HTMLElement): void {
    element.click();
    fixture.detectChanges();
  }

  it('lists every pantry item with its name, category, quantity and unit', async () => {
    const fixture = await render();
    const rows = queryAll<HTMLElement>(fixture, '.audit-item');

    expect(rows.map((row) => row.querySelector('.audit-item__name')?.textContent?.trim())).toEqual([
      'Apples',
      'Milk',
      'Rice'
    ]);
    expect(rows.map((row) => row.querySelector('.audit-item__category')?.textContent?.trim())).toEqual([
      'Fruits',
      'Dairy & Eggs',
      'Grains'
    ]);
    expect(
      queryAll<HTMLElement>(fixture, '[data-testid="audit-item-quantity"]').map((el) => el.textContent?.trim())
    ).toEqual(['6 count', '1.5 l', '2 kg']);
  });

  it('starts with nothing selected and Continue disabled', async () => {
    const fixture = await render();

    expect(selectedCountText(fixture)).toContain('0 of 3 selected');
    expect(selectedCountText(fixture)).toContain('Select at least one item to continue');
    expect(continueButton(fixture).disabled).toBe(true);
    expect(queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]').every((box) => !box.checked)).toBe(true);
  });

  it('enables Continue and updates the count when individual items are selected', async () => {
    const fixture = await render();
    const boxes = queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]');

    click(fixture, boxes[0]);
    expect(selectedCountText(fixture)).toContain('1 of 3 selected');
    expect(selectedCountText(fixture)).not.toContain('Select at least one item');
    expect(continueButton(fixture).disabled).toBe(false);

    click(fixture, boxes[2]);
    expect(selectedCountText(fixture)).toContain('2 of 3 selected');

    const selectAll = query<HTMLInputElement>(fixture, '[data-testid="audit-select-all"]');
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(true);

    click(fixture, boxes[0]);
    click(fixture, boxes[2]);
    expect(selectedCountText(fixture)).toContain('0 of 3 selected');
    expect(continueButton(fixture).disabled).toBe(true);
  });

  it('selects and deselects everything with Select all', async () => {
    const fixture = await render();
    const selectAll = query<HTMLInputElement>(fixture, '[data-testid="audit-select-all"]');

    click(fixture, selectAll);
    expect(selectedCountText(fixture)).toContain('3 of 3 selected');
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
    expect(queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]').every((box) => box.checked)).toBe(true);
    expect(continueButton(fixture).disabled).toBe(false);

    click(fixture, selectAll);
    expect(selectedCountText(fixture)).toContain('0 of 3 selected');
    expect(queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]').some((box) => box.checked)).toBe(false);
    expect(continueButton(fixture).disabled).toBe(true);
  });

  it('selects everything when Select all is clicked while partially selected', async () => {
    const fixture = await render();
    click(fixture, queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]')[1]);

    click(fixture, query<HTMLInputElement>(fixture, '[data-testid="audit-select-all"]'));

    expect(selectedCountText(fixture)).toContain('3 of 3 selected');
  });

  it('keeps the chosen items in the audit session and continues to the count step', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = await render();
    const boxes = queryAll<HTMLInputElement>(fixture, '[data-testid="audit-item-checkbox"]');
    click(fixture, boxes[1]);
    click(fixture, boxes[2]);

    click(fixture, continueButton(fixture));

    const session = TestBed.inject(PantryAuditSessionService);
    expect(session.selectedItems().map((item) => item.name)).toEqual(['Milk', 'Rice']);
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/pantry/audit/count');
  });

  it('does not continue while nothing is selected', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = await render();

    click(fixture, continueButton(fixture));

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows a friendly empty state and no Continue button when the pantry is empty', async () => {
    repository.getAll.mockResolvedValue([]);
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Your pantry is empty');
    expect(text).toContain('Add pantry item');
    expect(continueButton(fixture)).toBeNull();
    expect(query(fixture, '[data-testid="audit-select-all"]')).toBeNull();
  });

  it('returns to the audit introduction from the header back button', async () => {
    const fixture = await render();

    click(fixture, query<HTMLButtonElement>(fixture, '.audit-header__back'));

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/pantry/audit');
  });
});
