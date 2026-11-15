import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular, ToastController } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryAuditSessionService } from '../services/pantry-audit-session.service';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { auditUpdateMessage, PantryAuditReviewPage } from './pantry-audit-review.page';

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
  pantryItem({ id: 'milk', name: 'Milk', quantity: 1.5, unit: 'l' }),
  pantryItem({ id: 'apples', name: 'Apples', quantity: 6, unit: 'count' }),
  pantryItem({ id: 'oats', name: 'Oats', quantity: 1, unit: 'box' })
];

describe('PantryAuditReviewPage', () => {
  const repository = { getAll: vi.fn(), saveAll: vi.fn() };
  const navigationHistory = { back: vi.fn(), backTo: vi.fn() };
  const toast = { present: vi.fn() };
  const toastController = { create: vi.fn() };

  beforeEach(async () => {
    repository.getAll.mockReset().mockResolvedValue(ITEMS);
    repository.saveAll.mockReset().mockResolvedValue(undefined);
    navigationHistory.back.mockReset().mockResolvedValue(true);
    navigationHistory.backTo.mockReset().mockResolvedValue(true);
    toast.present.mockReset().mockResolvedValue(undefined);
    toastController.create.mockReset().mockResolvedValue(toast);

    await TestBed.configureTestingModule({
      imports: [PantryAuditReviewPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        { provide: PantryRepositoryService, useValue: repository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } },
        { provide: NavigationHistoryService, useValue: navigationHistory },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();
  });

  /** Selects the given items and enters their counted quantities, as the earlier steps would. */
  async function render(counts: Record<string, string>): Promise<ComponentFixture<PantryAuditReviewPage>> {
    await TestBed.inject(PantryStateService).load();
    const session = TestBed.inject(PantryAuditSessionService);
    for (const [id, raw] of Object.entries(counts)) {
      session.setSelected(id, true);
      session.setCountInput(id, raw);
    }

    const fixture = TestBed.createComponent(PantryAuditReviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const stat = (fixture: ComponentFixture<unknown>, testId: string) => {
    const tile = el(fixture).querySelector(`[data-testid="${testId}"]`);
    return [text(tile?.querySelector('.summary-stat__value')), text(tile?.querySelector('.summary-stat__label'))];
  };
  const rowsIn = (fixture: ComponentFixture<unknown>, section: string) =>
    Array.from(el(fixture).querySelectorAll(`[data-testid="${section}"] [data-testid="audit-review-item"]`)).map(
      (row) => ({
        name: text(row.querySelector('.review-row__name')),
        saved: text(row.querySelector('[data-testid="audit-review-saved"]')),
        actual: text(row.querySelector('[data-testid="audit-review-actual"]')),
        difference: text(row.querySelector('[data-testid="audit-difference"]'))
      })
    );

  it('summarises how many items need adjustment and how many are unchanged', async () => {
    const fixture = await render({ rice: '0', milk: '1.5', apples: '8', oats: '1' });

    expect(stat(fixture, 'audit-adjustment-count')).toEqual(['2', 'Need adjustment']);
    expect(stat(fixture, 'audit-unchanged-count')).toEqual(['2', 'Unchanged']);
    expect(text(el(fixture).querySelector('.review-summary__caption'))).toBe(
      '4 items reviewed. Nothing in your pantry has been changed yet.'
    );
  });

  it('lists each item with its saved quantity, actual quantity and difference, grouped by outcome', async () => {
    const fixture = await render({ rice: '0', milk: '1,5', apples: '8', oats: '1' });

    expect(rowsIn(fixture, 'audit-adjustments-section')).toEqual([
      { name: 'Apples', saved: '6 count', actual: '8 count', difference: '+2 count' },
      { name: 'Rice', saved: '2 kg', actual: '0 kg', difference: '\u22122 kg' }
    ]);
    expect(rowsIn(fixture, 'audit-unchanged-section')).toEqual([
      { name: 'Milk', saved: '1.5 l', actual: '1.5 l', difference: 'No change' },
      { name: 'Oats', saved: '1 box', actual: '1 box', difference: 'No change' }
    ]);
  });

  it('uses the singular label for a single adjustment', async () => {
    const fixture = await render({ rice: '3' });

    expect(stat(fixture, 'audit-adjustment-count')).toEqual(['1', 'Needs adjustment']);
    expect(stat(fixture, 'audit-unchanged-count')).toEqual(['0', 'Unchanged']);
    expect(text(el(fixture).querySelector('.review-summary__caption'))).toContain('1 item reviewed.');
  });

  it('says so when everything matches', async () => {
    const fixture = await render({ rice: '2', oats: '1' });

    expect(text(el(fixture).querySelector('[data-testid="audit-adjustments-section"]'))).toContain(
      'Everything matches what’s saved — no adjustments needed.'
    );
    expect(rowsIn(fixture, 'audit-unchanged-section').length).toBe(2);
  });

  it('hides the Unchanged section when every item needs adjustment', async () => {
    const fixture = await render({ rice: '5' });

    expect(el(fixture).querySelector('[data-testid="audit-unchanged-section"]')).toBeNull();
  });

  it.each([
    ['missing', ''],
    ['invalid', '-2']
  ])('does not show a review while a quantity is %s', async (_case, raw) => {
    const fixture = await render({ rice: '2', milk: raw });

    expect(text(el(fixture))).toContain('Some quantities still need attention');
    expect(text(el(fixture))).toContain('Back to counts');
    expect(el(fixture).querySelector('[data-testid="audit-review-item"]')).toBeNull();
  });

  it('asks the user to select items when nothing is selected', async () => {
    const fixture = await render({});

    expect(text(el(fixture))).toContain('No items selected');
    expect(el(fixture).querySelector('[data-testid="audit-review-item"]')).toBeNull();
  });

  it('goes back to the count screen to edit quantities, keeping what was entered', async () => {
    const fixture = await render({ rice: '0', milk: '3' });

    (el(fixture).querySelector('[data-testid="audit-edit-quantities"]') as HTMLButtonElement).click();
    (el(fixture).querySelector('.audit-header__back') as HTMLButtonElement).click();

    expect(navigationHistory.back).toHaveBeenCalledTimes(2);
    expect(navigationHistory.back).toHaveBeenNthCalledWith(1, '/tabs/pantry/audit/count');
    expect(navigationHistory.back).toHaveBeenNthCalledWith(2, '/tabs/pantry/audit/count');
    const session = TestBed.inject(PantryAuditSessionService);
    expect(session.countEntries().map((entry) => entry.rawInput)).toEqual(['3', '0']);
  });

  it('does not change the pantry', async () => {
    await render({ rice: '0', milk: '3' });

    expect(repository.saveAll).not.toHaveBeenCalled();
  });

  describe('Confirm & Update Pantry', () => {
    const confirmButton = (fixture: ComponentFixture<unknown>) =>
      el(fixture).querySelector('[data-testid="audit-confirm-update"]') as HTMLButtonElement | null;

    async function confirm(fixture: ComponentFixture<unknown>): Promise<void> {
      confirmButton(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('updates only the adjusted items in the pantry storage', async () => {
      // rice 2 -> 0, apples 6 -> 8 (adjusted); milk 1.5 -> 1.5 (unchanged); oats not selected.
      const fixture = await render({ rice: '0', milk: '1.5', apples: '8' });
      expect(confirmButton(fixture)?.textContent?.trim()).toBe('Confirm & Update Pantry');

      await confirm(fixture);

      expect(repository.saveAll).toHaveBeenCalledTimes(1);
      const saved = repository.saveAll.mock.calls[0][0] as PantryItem[];
      const byId = new Map(saved.map((item) => [item.id, item]));
      expect(byId.get('rice')?.quantity).toBe(0);
      expect(byId.get('apples')?.quantity).toBe(8);
      expect(byId.get('milk')).toEqual(ITEMS[1]);
      expect(byId.get('oats')).toEqual(ITEMS[3]);
      expect(saved).toHaveLength(ITEMS.length);
    });

    it('shows a success message with the number of updated items, then returns to My Pantry', async () => {
      const fixture = await render({ rice: '0', milk: '1.5', apples: '8' });

      await confirm(fixture);

      expect(toastController.create).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Pantry updated: 2 items adjusted.', color: 'success' })
      );
      expect(toast.present).toHaveBeenCalled();
      expect(navigationHistory.backTo).toHaveBeenCalledWith('/tabs/pantry');
      expect(toast.present.mock.invocationCallOrder[0]).toBeLessThan(
        navigationHistory.backTo.mock.invocationCallOrder[0]
      );
    });

    it('ends the audit but keeps showing what was confirmed while leaving', async () => {
      const fixture = await render({ rice: '0', milk: '1.5' });

      await confirm(fixture);

      expect(TestBed.inject(PantryAuditSessionService).selectedCount()).toBe(0);
      expect(stat(fixture, 'audit-adjustment-count')).toEqual(['1', 'Needs adjustment']);
      expect(rowsIn(fixture, 'audit-adjustments-section')[0]).toEqual({
        name: 'Rice',
        saved: '2 kg',
        actual: '0 kg',
        difference: '\u22122 kg'
      });
      expect(confirmButton(fixture)?.disabled).toBe(true);
      expect(confirmButton(fixture)?.textContent?.trim()).toBe('Updating…');
    });

    it('cannot save twice', async () => {
      let finishSave!: () => void;
      repository.saveAll.mockReturnValue(new Promise<void>((resolve) => (finishSave = resolve)));
      const fixture = await render({ rice: '0' });

      confirmButton(fixture)!.click();
      fixture.detectChanges();
      expect(confirmButton(fixture)?.disabled).toBe(true);
      expect(confirmButton(fixture)?.textContent?.trim()).toBe('Updating…');
      confirmButton(fixture)!.click();

      finishSave();
      await vi.waitFor(() => expect(navigationHistory.backTo).toHaveBeenCalled());

      expect(repository.saveAll).toHaveBeenCalledTimes(1);
      expect(navigationHistory.backTo).toHaveBeenCalledTimes(1);
    });

    it('finishes without writing when everything already matches', async () => {
      const fixture = await render({ rice: '2', milk: '1.5' });

      await confirm(fixture);

      expect(repository.saveAll).not.toHaveBeenCalled();
      expect(toastController.create).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Audit complete. Your pantry was already up to date.' })
      );
      expect(navigationHistory.backTo).toHaveBeenCalledWith('/tabs/pantry');
    });

    it('stays on the review with the audit intact when saving fails', async () => {
      repository.saveAll.mockRejectedValue(new Error('storage unavailable'));
      const fixture = await render({ rice: '0', milk: '3' });

      await confirm(fixture);

      expect(toastController.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'danger', message: expect.stringContaining('Couldn’t update your pantry') })
      );
      expect(navigationHistory.backTo).not.toHaveBeenCalled();
      expect(confirmButton(fixture)?.disabled).toBe(false);
      expect(confirmButton(fixture)?.textContent?.trim()).toBe('Confirm & Update Pantry');
      expect(TestBed.inject(PantryStateService).getById('rice')?.quantity).toBe(2);
      expect(TestBed.inject(PantryAuditSessionService).countEntries().map((entry) => entry.rawInput)).toEqual([
        '3',
        '0'
      ]);
    });

    it.each([
      ['a quantity is missing', { rice: '2', milk: '' }],
      ['nothing is selected', {}]
    ])('is not offered when %s', async (_case, counts) => {
      const fixture = await render(counts);

      expect(confirmButton(fixture)).toBeNull();
    });
  });

  it('words the success message for one or many items', () => {
    expect(auditUpdateMessage(1)).toBe('Pantry updated: 1 item adjusted.');
    expect(auditUpdateMessage(3)).toBe('Pantry updated: 3 items adjusted.');
  });
});
