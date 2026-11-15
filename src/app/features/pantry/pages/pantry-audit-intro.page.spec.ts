import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { PantryAuditIntroPage } from './pantry-audit-intro.page';

function pantryItem(id: string, name: string): PantryItem {
  return {
    id,
    name,
    category: 'grains',
    unit: 'count',
    quantity: 2,
    minQuantity: 1,
    avgDailyUsage: null,
    autoAddToShoppingList: true,
    expiryDate: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } as PantryItem;
}

describe('PantryAuditIntroPage', () => {
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };
  const navigationHistory = {
    back: vi.fn()
  };

  beforeEach(async () => {
    repository.getAll.mockResolvedValue([]);
    repository.saveAll.mockResolvedValue(undefined);
    navigationHistory.back.mockReset().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [PantryAuditIntroPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        PantryStateService,
        { provide: PantryRepositoryService, useValue: repository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } },
        { provide: NavigationHistoryService, useValue: navigationHistory }
      ]
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(PantryAuditIntroPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('explains the audit and shows the current pantry item count', async () => {
    repository.getAll.mockResolvedValue([
      pantryItem('rice', 'Rice'),
      pantryItem('pasta', 'Pasta'),
      pantryItem('oats', 'Oats')
    ]);

    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Inventory Audit');
    expect(text).toContain('What is an inventory audit?');
    expect(text).toContain('How it works');
    expect(element.querySelector('[data-testid="audit-item-count"]')?.textContent?.trim()).toBe('3');
    expect(text).toContain('You currently have 3 items to review.');
    expect(text).not.toContain('Your pantry is empty');
  });

  it('continues to the item selection step', async () => {
    repository.getAll.mockResolvedValue([pantryItem('rice', 'Rice')]);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = await render();
    const continueButton = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="audit-continue"]'
    ) as HTMLButtonElement | null;

    expect(continueButton?.textContent).toContain('Continue');
    continueButton?.click();

    expect(navigateSpy).toHaveBeenCalledWith('/tabs/pantry/audit/select');
  });

  it('uses the singular noun when there is exactly one item', async () => {
    repository.getAll.mockResolvedValue([pantryItem('rice', 'Rice')]);

    const fixture = await render();

    expect(fixture.nativeElement.textContent).toContain('You currently have 1 item to review.');
  });

  it('asks the user to add items first when the pantry is empty', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Your pantry is empty');
    expect(text).toContain('Add a few items to your pantry first');
    expect(text).toContain('Add pantry item');
    expect(text).not.toContain('What is an inventory audit?');
    expect(element.querySelector('[data-testid="audit-item-count"]')).toBeNull();
    expect(element.querySelector('[data-testid="audit-continue"]')).toBeNull();
  });

  it('shows a loading message instead of the empty state before pantry data has loaded', async () => {
    repository.getAll.mockReturnValue(new Promise(() => undefined));

    const fixture = TestBed.createComponent(PantryAuditIntroPage);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';

    expect(text).toContain('Loading your pantry');
    expect(text).not.toContain('Your pantry is empty');
  });

  it.each([
    ['populated', [pantryItem('rice', 'Rice')]],
    ['empty', []]
  ])('returns to My Pantry from the %s state', async (_state, items) => {
    repository.getAll.mockResolvedValue(items);

    const fixture = await render();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ) as HTMLButtonElement[];

    const backToPantry = buttons.find((button) => button.textContent?.includes('Back to My Pantry'));
    expect(backToPantry).toBeDefined();
    backToPantry?.click();
    expect(navigationHistory.back).toHaveBeenLastCalledWith('/tabs/pantry');

    const headerBack = (fixture.nativeElement as HTMLElement).querySelector(
      '.audit-header__back'
    ) as HTMLButtonElement;
    headerBack.click();
    expect(navigationHistory.back).toHaveBeenCalledTimes(2);
    expect(navigationHistory.back).toHaveBeenLastCalledWith('/tabs/pantry');
  });
});
