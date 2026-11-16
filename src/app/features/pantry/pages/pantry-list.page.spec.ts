import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryAuditSessionService } from '../services/pantry-audit-session.service';
import { PantryConsumptionRepositoryService } from '../services/pantry-consumption-repository.service';
import { PantryConsumptionService } from '../services/pantry-consumption.service';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { formatActivityDateTime } from '../utils/pantry-activity.util';
import { PantryListPage } from './pantry-list.page';

function dateOnlyFromOffset(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

describe('PantryListPage', () => {
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };
  const consumptionRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };

  beforeEach(async () => {
    repository.getAll.mockResolvedValue([]);
    repository.saveAll.mockResolvedValue(undefined);
    consumptionRepository.getAll.mockResolvedValue([]);
    consumptionRepository.saveAll.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PantryListPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        PantryStateService,
        {
          provide: PantryRepositoryService,
          useValue: repository
        },
        {
          provide: PantryConsumptionRepositoryService,
          useValue: consumptionRepository
        },
        {
          provide: SettingsService,
          useValue: {
            settings: () => DEFAULT_APP_SETTINGS
          }
        },
        {
          provide: ShoppingListStateService,
          useValue: {
            addFromPantryItem: vi.fn()
          }
        },
        {
          provide: AlertController,
          useValue: {
            create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) })
          }
        }
      ]
    }).compileComponents();
  });

  it('renders an empty state when there are no pantry items', async () => {
    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Your pantry is empty');
    expect(textContent).toContain('Add pantry item');
    // Note: 'View shopping list' removed in new design
  });

  it.each([
    ['empty', []],
    [
      'populated',
      [
        {
          id: 'pasta',
          name: 'Pasta',
          category: 'grains',
          unit: 'box',
          quantity: 4,
          minQuantity: 1,
          avgDailyUsage: null,
          autoAddToShoppingList: true,
          expiryDate: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    ]
  ])('shows a Start Inventory Audit button linking to the audit when the pantry is %s', async (_state, items) => {
    repository.getAll.mockResolvedValue(items);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const auditButton = fixture.nativeElement.querySelector(
      '[data-testid="start-inventory-audit"]'
    ) as HTMLButtonElement | null;

    expect(auditButton).not.toBeNull();
    expect(auditButton?.textContent).toContain('Start Inventory Audit');

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auditButton?.click();

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(router.serializeUrl(navigateSpy.mock.calls[0][0] as UrlTree)).toBe('/tabs/pantry/audit');
  });

  it.each([
    ['empty', []],
    [
      'populated',
      [
        {
          id: 'pasta',
          name: 'Pasta',
          category: 'grains',
          unit: 'box',
          quantity: 4,
          minQuantity: 1,
          avgDailyUsage: null,
          autoAddToShoppingList: true,
          expiryDate: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    ]
  ])('shows the consumption insights between the overview and the pantry items when the pantry is %s', async (_state, items) => {
    repository.getAll.mockResolvedValue(items);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const insights = fixture.nativeElement.querySelector('app-pantry-consumption-insights') as HTMLElement | null;
    expect(insights).not.toBeNull();
    expect(insights?.previousElementSibling?.classList.contains('pantry-hero')).toBe(true);

    // The pantry content (empty state or item list) follows the insights.
    const next = insights?.nextElementSibling as HTMLElement | null;
    if (items.length === 0) {
      expect(next?.textContent).toContain('Your pantry is empty');
    } else {
      expect(next?.classList.contains('section-title-row')).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Pasta');
    }

    // Sections appear in the requested order, each below the previous one.
    expect(
      Array.from(insights?.querySelectorAll(':scope > section') ?? []).map((section) => section.getAttribute('data-testid'))
    ).toEqual(['consumption-analytics', 'top-consumed', 'usage-trend', 'recent-activity']);

    const cards = Array.from(insights?.querySelectorAll('.consumption-stat') ?? []).map((card) => ({
      label: card.querySelector('dt')?.textContent?.trim(),
      value: card.querySelector('dd')?.textContent?.trim()
    }));
    expect(cards).toEqual([
      { label: 'Items Consumed', value: '0' },
      { label: 'Units Used', value: '0' },
      { label: 'Items Restocked', value: '0' }
    ]);
  });

  it('starts each inventory audit with a fresh selection', async () => {
    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();
    const auditSession = TestBed.inject(PantryAuditSessionService);
    const resetSpy = vi.spyOn(auditSession, 'reset');
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="start-inventory-audit"]') as HTMLButtonElement).click();

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('renders pantry items and filters them by search query', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'milk';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Milk');
    expect(textContent).not.toContain('Pasta');
    // Note: 'Showing X of Y' stats removed in new design
  });

  it('filters by category using the pill bar', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.filter-pill')) as HTMLButtonElement[];
    const dairyButton = buttons.find((button) => button.textContent?.includes('Dairy'));

    dairyButton?.click();
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Milk');
    expect(textContent).not.toContain('Pasta');
  });

  it('clears search text from the clear icon button', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'milk';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const clearButton = fixture.nativeElement.querySelector('.search-clear') as HTMLButtonElement | null;
    expect(clearButton).not.toBeNull();

    clearButton?.click();
    fixture.detectChanges();

    expect(pantryState.searchQuery()).toBe('');
    expect((fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
  });

  it('resets to all items when pantry is opened without a filter query param', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();
    pantryState.setStockFilter('expiring');
    expect(pantryState.stockFilter()).toBe('expiring');

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    expect(pantryState.stockFilter()).toBe('all');
    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Milk');
    expect(textContent).toContain('Pasta');
  });

  describe('Use and Restock', () => {
    function pantryItem(overrides: Record<string, unknown> = {}) {
      return {
        id: 'rice',
        name: 'Rice',
        category: 'grains',
        unit: 'kg',
        quantity: 2,
        minQuantity: 0,
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

    async function renderWith(item: ReturnType<typeof pantryItem>) {
      repository.getAll.mockResolvedValue([item]);
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();

      const button = (testId: string) =>
        fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
      const settle = async () => {
        await fixture.whenStable();
        fixture.detectChanges();
      };

      return {
        fixture,
        pantryState,
        navigateSpy,
        useButton: () => button('pantry-item-use'),
        restockButton: () => button('pantry-item-restock'),
        settle
      };
    }

    it('decreases the quantity by one and records the use', async () => {
      const view = await renderWith(pantryItem({ quantity: 2 }));

      view.useButton().click();
      await view.settle();

      expect(view.pantryState.getById('rice')?.quantity).toBe(1);
      expect(view.fixture.nativeElement.querySelector('.quantity-line').textContent).toContain('1 kg');
      expect(TestBed.inject(PantryConsumptionService).logs()).toEqual([
        expect.objectContaining({ itemId: 'rice', actionType: 'decrement', amount: 1, previousQuantity: 2, nextQuantity: 1 })
      ]);
      expect(view.navigateSpy).not.toHaveBeenCalled();
    });

    it('increases the quantity by one and records the restock', async () => {
      const view = await renderWith(pantryItem({ quantity: 2 }));

      view.restockButton().click();
      await view.settle();

      expect(view.pantryState.getById('rice')?.quantity).toBe(3);
      expect(TestBed.inject(PantryConsumptionService).logs()).toEqual([
        expect.objectContaining({ itemId: 'rice', actionType: 'increment', amount: 1, previousQuantity: 2, nextQuantity: 3 })
      ]);
      expect(view.navigateSpy).not.toHaveBeenCalled();
    });

    it('disables Use when nothing is left but still allows Restock', async () => {
      const view = await renderWith(pantryItem({ quantity: 0 }));

      expect(view.useButton().disabled).toBe(true);
      expect(view.restockButton().disabled).toBe(false);

      view.restockButton().click();
      await view.settle();

      expect(view.pantryState.getById('rice')?.quantity).toBe(1);
      expect(view.useButton().disabled).toBe(false);
    });

    it('never uses more than is available, even with rapid taps', async () => {
      const view = await renderWith(pantryItem({ quantity: 1 }));
      // Storage writes take a moment, as they do with IndexedDB.
      repository.saveAll.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));

      view.useButton().click();
      view.useButton().click();
      view.useButton().click();
      await vi.waitFor(() => expect(view.pantryState.getById('rice')?.quantity).toBe(0));
      await new Promise((resolve) => setTimeout(resolve, 30));
      await view.settle();

      const logs = TestBed.inject(PantryConsumptionService).logs();
      expect(view.pantryState.getById('rice')?.quantity).toBe(0);
      expect(logs.reduce((total, log) => total + log.amount, 0)).toBe(1);
      expect(view.useButton().disabled).toBe(true);
    });

    it('only uses the remaining amount when less than one unit is left', async () => {
      const view = await renderWith(pantryItem({ quantity: 0.5 }));

      view.useButton().click();
      await view.settle();

      expect(view.pantryState.getById('rice')?.quantity).toBe(0);
      expect(TestBed.inject(PantryConsumptionService).logs()).toEqual([
        expect.objectContaining({ amount: 0.5, previousQuantity: 0.5, nextQuantity: 0 })
      ]);
    });

    it('labels the buttons with the item and step for screen readers', async () => {
      const view = await renderWith(pantryItem());

      expect(view.useButton().getAttribute('aria-label')).toBe('Use 1 kg of Rice');
      expect(view.restockButton().getAttribute('aria-label')).toBe('Restock 1 kg of Rice');
    });
  });

  describe('Consumption Analytics values', () => {
    function historyLog(itemId: string, actionType: 'increment' | 'decrement' | 'empty', amount: number, id: string) {
      return {
        id,
        itemId,
        actionType,
        amount,
        previousQuantity: 5,
        nextQuantity: 5,
        createdAt: '2026-03-01T08:00:00.000Z'
      };
    }

    const rice = {
      id: 'rice',
      name: 'Rice',
      category: 'grains',
      unit: 'kg',
      quantity: 3,
      minQuantity: 0,
      avgDailyUsage: null,
      autoAddToShoppingList: true,
      expiryDate: null,
      germanStore: false,
      indianStore: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    function statValues(fixture: { nativeElement: HTMLElement }) {
      return Array.from(fixture.nativeElement.querySelectorAll('.consumption-stat dd')).map((dd) =>
        dd.textContent?.trim()
      );
    }

    async function render() {
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }



    it('updates straight away after Use and Restock', async () => {
      repository.getAll.mockResolvedValue([rice]);
      const fixture = await render();
      const button = (testId: string) =>
        fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;

      expect(statValues(fixture)).toEqual(['0', '0', '0']);

      button('pantry-item-use').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(statValues(fixture)).toEqual(['1', '1', '0']);

      button('pantry-item-use').click();
      await fixture.whenStable();
      fixture.detectChanges();
      // Same item again: still one item consumed, two units used.
      expect(statValues(fixture)).toEqual(['1', '2', '0']);

      button('pantry-item-restock').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(statValues(fixture)).toEqual(['1', '2', '1']);

      // The recorded history, which is what a refresh reads back, matches.
      expect(consumptionRepository.saveAll).toHaveBeenLastCalledWith([
        expect.objectContaining({ actionType: 'increment', itemId: 'rice' }),
        expect.objectContaining({ actionType: 'decrement', itemId: 'rice' }),
        expect.objectContaining({ actionType: 'decrement', itemId: 'rice' })
      ]);
    });
  });

  describe('Recent Activity', () => {
    const rice = {
      id: 'rice',
      name: 'Basmati Rice',
      category: 'grains',
      unit: 'kg',
      quantity: 3,
      minQuantity: 0,
      avgDailyUsage: null,
      autoAddToShoppingList: true,
      expiryDate: null,
      germanStore: false,
      indianStore: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const milk = { ...rice, id: 'milk', name: 'Oat Milk', unit: 'count' };

    function historyLog(id: string, itemId: string, actionType: string, amount: number, createdAt: string) {
      return { id, itemId, actionType, amount, previousQuantity: 5, nextQuantity: 5, createdAt };
    }

    async function render() {
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    function section(fixture: { nativeElement: HTMLElement }): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="recent-activity"]') as HTMLElement;
    }

    function rows(fixture: { nativeElement: HTMLElement }) {
      return Array.from(section(fixture).querySelectorAll('[data-testid="recent-activity-entry"]')).map((row) => ({
        name: row.querySelector('.activity-name')?.textContent?.trim(),
        kind: row.querySelector('.activity-kind')?.textContent?.trim(),
        amount: row.querySelector('.activity-amount')?.textContent?.trim(),
        time: row.querySelector('time')?.textContent?.trim(),
        datetime: row.querySelector('time')?.getAttribute('datetime')
      }));
    }






    it('adds new activity to the top straight away after Use and Restock', async () => {
      repository.getAll.mockResolvedValue([rice]);
      const fixture = await render();
      const button = (testId: string) =>
        fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;

      button('pantry-item-use').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(rows(fixture).map((row) => [row.name, row.kind, row.amount])).toEqual([['Basmati Rice', 'Used', '−1 kg']]);

      button('pantry-item-restock').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(rows(fixture).map((row) => [row.kind, row.amount])).toEqual([
        ['Restocked', '+1 kg'],
        ['Used', '−1 kg']
      ]);
      expect(section(fixture).querySelector('[data-testid="recent-activity-empty"]')).toBeNull();
    });

    it('records a deletion and keeps earlier entries readable without changing the analytics', async () => {
      repository.getAll.mockResolvedValue([rice, milk]);
      const fixture = await render();
      const riceCard = () =>
        Array.from(fixture.nativeElement.querySelectorAll('app-pantry-item-card') as NodeListOf<HTMLElement>).find(
          (card) => card.textContent?.includes('Basmati Rice')
        ) as HTMLElement;
      const analytics = () =>
        Array.from(fixture.nativeElement.querySelectorAll('.consumption-stat dd')).map((dd) =>
          (dd as HTMLElement).textContent?.trim()
        );

      (riceCard().querySelector('[data-testid="pantry-item-use"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      (riceCard().querySelector('[data-testid="pantry-item-restock"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      const analyticsBefore = analytics();
      expect(analyticsBefore).toEqual(['1', '1', '1']);

      // Delete via the card's trash button and confirm in the alert.
      const alertController = TestBed.inject(AlertController) as unknown as { create: ReturnType<typeof vi.fn> };
      alertController.create.mockClear();
      (riceCard().querySelector('.delete-button') as HTMLButtonElement).click();
      await fixture.whenStable();
      const alertOptions = alertController.create.mock.calls[0][0];
      await alertOptions.buttons.find((button: { role?: string }) => button.role === 'destructive').handler();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(TestBed.inject(PantryStateService).getById('rice')).toBeUndefined();
      expect(rows(fixture).map((row) => [row.name, row.kind, row.amount])).toEqual([
        ['Basmati Rice', 'Deleted', undefined],
        ['Basmati Rice', 'Restocked', '+1 kg'],
        ['Basmati Rice', 'Used', '−1 kg']
      ]);
      expect(rows(fixture)[0].time).toBeTruthy();
      expect(section(fixture).textContent).not.toContain('Deleted item');
      expect(analytics()).toEqual(analyticsBefore);
    });

  });

  describe('Top Items Consumed', () => {
    function pantryItem(id: string, name: string, unit: string, quantity = 20) {
      return {
        id,
        name,
        category: 'grains',
        unit,
        quantity,
        minQuantity: 0,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        germanStore: false,
        indianStore: false,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };
    }

    let logId = 0;
    function used(itemId: string, amount: number, createdAt = '2026-03-01T08:00:00.000Z', extra = {}) {
      logId++;
      return { id: `used-${logId}`, itemId, actionType: 'decrement', amount, previousQuantity: 9, nextQuantity: 9, createdAt, ...extra };
    }

    async function render() {
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    function section(fixture: { nativeElement: HTMLElement }): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="top-consumed"]') as HTMLElement;
    }

    function ranking(fixture: { nativeElement: HTMLElement }) {
      return Array.from(section(fixture).querySelectorAll('[data-testid="top-consumed-entry"]')).map((row) => ({
        rank: row.querySelector('.top-rank')?.textContent?.trim(),
        name: row.querySelector('.activity-name')?.textContent?.replace(/^\s*Rank \d+:\s*/, '').trim(),
        amount: row.querySelector('[data-testid="top-consumed-amount"]')?.textContent?.trim(),
        deleted: !!row.querySelector('.top-deleted')
      }));
    }





    it('updates the ranking straight away when an item is used', async () => {
      repository.getAll.mockResolvedValue([
        pantryItem('rice', 'Basmati Rice', 'kg'),
        pantryItem('milk', 'Oat Milk', 'count')
      ]);
      consumptionRepository.getAll.mockResolvedValue([used('milk', 2, '2026-03-01T08:00:00.000Z')]);
      const fixture = await render();
      const useButton = (name: string) =>
        Array.from(fixture.nativeElement.querySelectorAll('app-pantry-item-card') as NodeListOf<HTMLElement>)
          .find((card) => card.textContent?.includes(name))!
          .querySelector('[data-testid="pantry-item-use"]') as HTMLButtonElement;

      expect(ranking(fixture).map((row) => [row.name, row.amount])).toEqual([['Oat Milk', '2 count']]);

      useButton('Basmati Rice').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(ranking(fixture).map((row) => [row.name, row.amount])).toEqual([
        ['Oat Milk', '2 count'],
        ['Basmati Rice', '1 kg']
      ]);

      useButton('Basmati Rice').click();
      await fixture.whenStable();
      fixture.detectChanges();
      // Tied at 2: the most recently used item goes first.
      expect(ranking(fixture).map((row) => [row.name, row.amount])).toEqual([
        ['Basmati Rice', '2 kg'],
        ['Oat Milk', '2 count']
      ]);

      // Restocking doesn't change the ranking.
      const restock = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="pantry-item-restock"]'))[0] as HTMLButtonElement;
      restock.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(ranking(fixture).map((row) => row.amount)).toEqual(['2 kg', '2 count']);
    });


  });

  describe('Usage Trend', () => {
    const rice = {
      id: 'rice',
      name: 'Basmati Rice',
      category: 'grains',
      unit: 'kg',
      quantity: 20,
      minQuantity: 0,
      avgDailyUsage: null,
      autoAddToShoppingList: true,
      expiryDate: null,
      germanStore: false,
      indianStore: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    /** Local noon `daysAgo` days before today. */
    function daysAgo(days: number): Date {
      const date = new Date();
      date.setDate(date.getDate() - days);
      date.setHours(12, 0, 0, 0);
      return date;
    }

    function localKey(date: Date): string {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    let logId = 0;
    function historyLog(actionType: string, amount: number, at: Date) {
      logId++;
      return { id: `trend-${logId}`, itemId: 'rice', actionType, amount, previousQuantity: 9, nextQuantity: 9, createdAt: at.toISOString() };
    }

    async function render() {
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    function section(fixture: { nativeElement: HTMLElement }): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="usage-trend"]') as HTMLElement;
    }

    function chart(fixture: { nativeElement: HTMLElement }) {
      return Array.from(section(fixture).querySelectorAll('[data-testid="usage-trend-day"]')).map((day) => ({
        date: day.getAttribute('data-date'),
        value: day.querySelector('.trend-value')?.textContent?.trim(),
        height: (day.querySelector('.trend-bar') as HTMLElement).style.height,
        today: day.classList.contains('is-today'),
        label: day.querySelector('.trend-weekday')?.textContent?.trim()
      }));
    }

    const total = (fixture: { nativeElement: HTMLElement }) =>
      section(fixture).querySelector('[data-testid="usage-trend-total"]')?.textContent?.replace(/\s+/g, ' ').trim();



    it('updates today\'s bar straight away after using an item', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('decrement', 2, daysAgo(1))]);
      const fixture = await render();
      expect(chart(fixture).at(-1)?.value).toBe('0');

      (fixture.nativeElement.querySelector('[data-testid="pantry-item-use"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(chart(fixture).slice(-2).map((day) => [day.value, day.height])).toEqual([
        ['2', '100%'],
        ['1', '50%']
      ]);
      expect(total(fixture)).toBe('3 units · last 7 days');
    });





    describe('when the day changes while the app is open', () => {
      afterEach(() => {
        vi.useRealTimers();
      });


      it('re-checks the day when the Pantry tab is shown again', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 2, 10, 20, 0));

        const fixture = await render();
        expect(chart(fixture).at(-1)?.date).toBe('2026-03-10');

        vi.setSystemTime(new Date(2026, 2, 12, 8, 0));
        fixture.componentInstance.ionViewWillEnter();
        fixture.detectChanges();

        expect(chart(fixture).at(-1)?.date).toBe('2026-03-12');
      });
    });
  });

  describe('existing pantry features alongside the insights', () => {
    const items = [
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 3,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        germanStore: false,
        indianStore: false,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        germanStore: false,
        indianStore: false,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ];
    const history = [
      { id: 'a', itemId: 'milk', actionType: 'decrement', amount: 1, previousQuantity: 4, nextQuantity: 3, createdAt: '2026-03-01T08:00:00.000Z' },
      { id: 'b', itemId: 'pasta', actionType: 'decrement', amount: 2, previousQuantity: 6, nextQuantity: 4, createdAt: '2026-03-01T09:00:00.000Z' }
    ];

    async function render() {
      repository.getAll.mockResolvedValue(items);
      consumptionRepository.getAll.mockResolvedValue(history);
      await TestBed.inject(PantryStateService).load();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(PantryListPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    const itemNames = (fixture: { nativeElement: HTMLElement }) =>
      Array.from(fixture.nativeElement.querySelectorAll('app-pantry-item-card .item-name')).map((name) =>
        (name as HTMLElement).textContent?.trim()
      );
    const insightsText = (fixture: { nativeElement: HTMLElement }) =>
      (fixture.nativeElement.querySelector('app-pantry-consumption-insights') as HTMLElement).textContent;

    it('searching or filtering the pantry only narrows the item list, not the insights', async () => {
      const fixture = await render();
      const before = insightsText(fixture);

      const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput.value = 'milk';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(itemNames(fixture)).toEqual(['Milk']);
      expect(insightsText(fixture)).toBe(before);

      (fixture.nativeElement.querySelector('.search-clear') as HTMLButtonElement).click();
      fixture.detectChanges();
      const grainsPill = Array.from(fixture.nativeElement.querySelectorAll('.pantry-header .filter-pill')).find((pill) =>
        (pill as HTMLElement).textContent?.includes('Grains')
      ) as HTMLButtonElement | undefined;
      grainsPill?.click();
      fixture.detectChanges();
      if (grainsPill) {
        expect(itemNames(fixture)).toEqual(['Pasta']);
      }
      expect(insightsText(fixture)).toBe(before);
    });

    it('keeps the header filter pills and the Recent Activity filter pills independent', async () => {
      const fixture = await render();
      const headerPills = () =>
        Array.from(fixture.nativeElement.querySelectorAll('.pantry-header .filter-pill.is-active')).map((pill) =>
          (pill as HTMLElement).textContent?.replace(/\s+/g, ' ').trim()
        );
      const activityFilter = (value: string) =>
        fixture.nativeElement.querySelector(`[data-testid="recent-activity-filter"][data-filter="${value}"]`) as HTMLButtonElement;

      activityFilter('restocked').click();
      fixture.detectChanges();

      expect(headerPills()).toEqual(['All 2']);
      expect(activityFilter('restocked').getAttribute('aria-pressed')).toBe('true');
      expect(itemNames(fixture).sort()).toEqual(['Milk', 'Pasta']);
    });

    it('still opens an item for editing from its card, but not from Use or Restock', async () => {
      const fixture = await render();
      const navigateSpy = TestBed.inject(Router).navigateByUrl as unknown as ReturnType<typeof vi.fn>;
      const milkCard = Array.from(fixture.nativeElement.querySelectorAll('app-pantry-item-card')).find((card) =>
        (card as HTMLElement).textContent?.includes('Milk')
      ) as HTMLElement;

      (milkCard.querySelector('[data-testid="pantry-item-use"]') as HTMLButtonElement).click();
      (milkCard.querySelector('[data-testid="pantry-item-restock"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(navigateSpy).not.toHaveBeenCalled();

      (milkCard.querySelector('.item-card') as HTMLElement).click();
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(Router).serializeUrl(navigateSpy.mock.calls[0][0])).toBe('/tabs/pantry/milk/edit');
    });

    it('keeps the overview summary in step with Use', async () => {
      const fixture = await render();
      const heroText = () => (fixture.nativeElement.querySelector('.pantry-hero') as HTMLElement).textContent?.replace(/\s+/g, ' ');
      expect(heroText()).toContain('Everything looks fresh.');

      const milkCard = Array.from(fixture.nativeElement.querySelectorAll('app-pantry-item-card') as NodeListOf<HTMLElement>).find(
        (card) => card.textContent?.includes('Milk')
      ) as HTMLElement;
      const milkUse = milkCard.querySelector('[data-testid="pantry-item-use"]') as HTMLButtonElement;
      milkUse.click();
      await fixture.whenStable();
      milkUse.click();
      await fixture.whenStable();
      fixture.detectChanges();

      // Milk is now at 1 with a minimum of 1: running low.
      expect(heroText()).toContain('1 item needs a look.');
    });
  });
});
