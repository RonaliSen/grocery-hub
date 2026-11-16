import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryConsumptionRepositoryService } from '../services/pantry-consumption-repository.service';
import { PantryConsumptionService } from '../services/pantry-consumption.service';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { formatActivityDateTime } from '../utils/pantry-activity.util';
import { PantryConsumptionInsightsComponent } from './pantry-consumption-insights.component';

/**
 * The consumption insights sections on their own, built from a real
 * PantryConsumptionService over mocked storage. Flows that start from the
 * pantry cards (Use / Restock / Delete) are covered in pantry-list.page.spec.ts.
 */
describe('PantryConsumptionInsightsComponent', () => {
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };
  const consumptionRepository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.getAll.mockResolvedValue([]);
    repository.saveAll.mockResolvedValue(undefined);
    consumptionRepository.getAll.mockResolvedValue([]);
    consumptionRepository.saveAll.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PantryConsumptionInsightsComponent],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        PantryStateService,
        { provide: PantryRepositoryService, useValue: repository },
        { provide: PantryConsumptionRepositoryService, useValue: consumptionRepository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } }
      ]
    }).compileComponents();
  });

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

  async function renderInsights() {
    await TestBed.inject(PantryStateService).load();
    const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the four sections in order: analytics, top items, usage trend, recent activity', async () => {
    const fixture = await renderInsights();

    const sections = Array.from(fixture.nativeElement.querySelectorAll(':scope > section')) as HTMLElement[];
    expect(sections.map((section) => section.getAttribute('data-testid'))).toEqual([
      'consumption-analytics',
      'top-consumed',
      'usage-trend',
      'recent-activity'
    ]);
    expect(sections.map((section) => section.querySelector('h3')?.textContent?.trim())).toEqual([
      'Consumption Analytics',
      'Top Items Consumed',
      'Usage Trend',
      'Recent Activity'
    ]);
    // Each section is labelled by its own heading.
    for (const section of sections) {
      expect(section.querySelector(`#${section.getAttribute('aria-labelledby')}`)?.tagName).toBe('H3');
    }
  });

  it('shows every empty state together when there is no history', async () => {
    const fixture = await renderInsights();
    const text = (testId: string) =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

    expect(
      Array.from(fixture.nativeElement.querySelectorAll('.consumption-stat dd')).map((dd) => (dd as HTMLElement).textContent?.trim())
    ).toEqual(['0', '0', '0']);
    expect(text('top-consumed-empty')).toContain('Nothing consumed yet');
    expect(text('usage-trend-empty')).toBe('Nothing used in the last 7 days.');
    expect(text('recent-activity-empty')).toContain('No activity yet');
  });

  it('loads the saved history itself when it is shown', async () => {
    consumptionRepository.getAll.mockResolvedValue([]);

    await renderInsights();

    expect(consumptionRepository.getAll).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(PantryConsumptionService).loaded()).toBe(true);
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
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('shows totals from the saved history when the page opens (e.g. after a refresh)', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([
        historyLog('rice', 'decrement', 1, 'a'),
        historyLog('rice', 'decrement', 0.5, 'b'),
        historyLog('milk', 'empty', 2, 'c'),
        historyLog('rice', 'increment', 1, 'd'),
        historyLog('eggs', 'increment', 6, 'e'),
        historyLog('eggs', 'increment', 6, 'f')
      ]);

      const fixture = await render();

      // Items Consumed: rice + milk; Units Used: 1 + 0.5 + 2; Items Restocked: rice + eggs.
      expect(statValues(fixture)).toEqual(['2', '3.5', '2']);
    });

    it('shows a placeholder instead of 0 until the saved history has loaded', async () => {
      let resolveHistory: (logs: unknown[]) => void = () => undefined;
      consumptionRepository.getAll.mockReturnValue(new Promise((resolve) => (resolveHistory = resolve)));

      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
      fixture.detectChanges();

      expect(statValues(fixture)).toEqual(['–', '–', '–']);
      expect(fixture.nativeElement.querySelector('.consumption-stats').getAttribute('aria-busy')).toBe('true');

      resolveHistory([historyLog('rice', 'decrement', 1, 'a')]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(statValues(fixture)).toEqual(['1', '1', '0']);
      expect(fixture.nativeElement.querySelector('.consumption-stats').getAttribute('aria-busy')).toBe('false');
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
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
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

    it('sits below the analytics cards, Top Items Consumed and Usage Trend', async () => {
      const fixture = await render();

      expect(section(fixture).previousElementSibling?.getAttribute('data-testid')).toBe('usage-trend');
      expect(section(fixture).querySelector('h3')?.textContent?.trim()).toBe('Recent Activity');
    });

    it('shows a simple message when there is no activity yet', async () => {
      const fixture = await render();

      const empty = section(fixture).querySelector('[data-testid="recent-activity-empty"]');
      expect(empty?.textContent).toContain('No activity yet');
      expect(rows(fixture)).toEqual([]);
    });

    it('shows a loading message instead of the empty message while history loads', async () => {
      consumptionRepository.getAll.mockReturnValue(new Promise(() => undefined));
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
      fixture.detectChanges();

      expect(section(fixture).textContent).toContain('Loading activity');
      expect(section(fixture).querySelector('[data-testid="recent-activity-empty"]')).toBeNull();
    });

    it('lists name, action, quantity change and date/time, newest first', async () => {
      repository.getAll.mockResolvedValue([rice, milk]);
      consumptionRepository.getAll.mockResolvedValue([
        historyLog('old', 'rice', 'decrement', 0.5, '2026-03-01T08:00:00.000Z'),
        historyLog('new', 'milk', 'increment', 2, '2026-03-03T18:45:00.000Z'),
        historyLog('mid', 'rice', 'empty', 1.5, '2026-03-02T12:15:00.000Z')
      ]);

      const fixture = await render();

      expect(rows(fixture)).toEqual([
        {
          name: 'Oat Milk',
          kind: 'Restocked',
          amount: '+2 count',
          time: formatActivityDateTime('2026-03-03T18:45:00.000Z'),
          datetime: '2026-03-03T18:45:00.000Z'
        },
        {
          name: 'Basmati Rice',
          kind: 'Used',
          amount: '−1.5 kg',
          time: formatActivityDateTime('2026-03-02T12:15:00.000Z'),
          datetime: '2026-03-02T12:15:00.000Z'
        },
        {
          name: 'Basmati Rice',
          kind: 'Used',
          amount: '−0.5 kg',
          time: formatActivityDateTime('2026-03-01T08:00:00.000Z'),
          datetime: '2026-03-01T08:00:00.000Z'
        }
      ]);
      expect(section(fixture).querySelector('.section-title-row p')?.textContent?.trim()).toBe('3 entries');
    });

    it('keeps activity for items that were deleted', async () => {
      consumptionRepository.getAll.mockResolvedValue([
        historyLog('a', 'gone', 'decrement', 1, '2026-03-01T08:00:00.000Z')
      ]);

      const fixture = await render();

      expect(rows(fixture)).toEqual([expect.objectContaining({ name: 'Deleted item', kind: 'Used', amount: '−1' })]);
    });



    describe('filters and paging', () => {
      /** `count` entries of one kind, newest first, one minute apart per kind. */
      function many(kind: 'decrement' | 'increment' | 'deleted', count: number, day: number) {
        return Array.from({ length: count }, (_, index) =>
          historyLog(
            `${kind}-${index}`,
            'rice',
            kind,
            1,
            `2026-03-${String(day).padStart(2, '0')}T${String(23 - Math.floor(index / 60)).padStart(2, '0')}:${String(59 - (index % 60)).padStart(2, '0')}:00.000Z`
          )
        );
      }

      function filterButton(fixture: { nativeElement: HTMLElement }, value: string): HTMLButtonElement {
        return section(fixture).querySelector(`[data-testid="recent-activity-filter"][data-filter="${value}"]`) as HTMLButtonElement;
      }

      function pills(fixture: { nativeElement: HTMLElement }) {
        return Array.from(section(fixture).querySelectorAll('[data-testid="recent-activity-filter"]')).map((pill) => ({
          label: pill.firstChild?.textContent?.trim(),
          count: pill.querySelector('.filter-count')?.textContent?.trim(),
          pressed: pill.getAttribute('aria-pressed')
        }));
      }

      const byTestId = (fixture: { nativeElement: HTMLElement }, id: string) =>
        section(fixture).querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

      it('offers All, Used, Restocked and Deleted filters with counts', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue([...many('decrement', 3, 3), ...many('increment', 2, 2), ...many('deleted', 1, 1)]);

        const fixture = await render();

        expect(pills(fixture)).toEqual([
          { label: 'All', count: '6', pressed: 'true' },
          { label: 'Used', count: '3', pressed: 'false' },
          { label: 'Restocked', count: '2', pressed: 'false' },
          { label: 'Deleted', count: '1', pressed: 'false' }
        ]);
        expect(section(fixture).querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Filter activity');
      });

      it('shows only the matching activity for each filter, newest first', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue([...many('decrement', 3, 3), ...many('increment', 2, 2), ...many('deleted', 1, 1)]);
        const fixture = await render();

        filterButton(fixture, 'used').click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.kind)).toEqual(['Used', 'Used', 'Used']);
        expect(filterButton(fixture, 'used').getAttribute('aria-pressed')).toBe('true');
        expect(filterButton(fixture, 'all').getAttribute('aria-pressed')).toBe('false');
        const usedTimes = rows(fixture).map((row) => row.datetime ?? '');
        expect([...usedTimes].sort().reverse()).toEqual(usedTimes);

        filterButton(fixture, 'restocked').click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.kind)).toEqual(['Restocked', 'Restocked']);

        filterButton(fixture, 'deleted').click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.kind)).toEqual(['Deleted']);

        filterButton(fixture, 'all').click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.kind)).toEqual([
          'Used', 'Used', 'Used', 'Restocked', 'Restocked', 'Deleted'
        ]);
      });

      it('shows a short message when a filter has no matches', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue(many('decrement', 2, 1));
        const fixture = await render();

        filterButton(fixture, 'deleted').click();
        fixture.detectChanges();

        expect(rows(fixture)).toEqual([]);
        expect(byTestId(fixture, 'recent-activity-filter-empty')?.textContent?.trim()).toBe('No deleted items yet.');
        // Filters stay so you can switch back.
        expect(filterButton(fixture, 'all')).not.toBeNull();
        expect(filterButton(fixture, 'deleted').classList.contains('is-empty')).toBe(true);
      });

      it('hides the filters when there is no activity at all', async () => {
        const fixture = await render();

        expect(section(fixture).querySelector('[data-testid="recent-activity-filter"]')).toBeNull();
        expect(byTestId(fixture, 'recent-activity-empty')).not.toBeNull();
      });

      it('shows the latest 10, then 10 more per Show More, and Show Less collapses back', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue(many('decrement', 25, 1));
        const fixture = await render();
        const all = many('decrement', 25, 1).map((log) => log.createdAt);

        expect(rows(fixture).map((row) => row.datetime)).toEqual(all.slice(0, 10));
        expect(byTestId(fixture, 'recent-activity-showing')?.textContent?.trim()).toBe('Showing 10 of 25');
        expect(byTestId(fixture, 'recent-activity-show-less')).toBeNull();

        byTestId(fixture, 'recent-activity-show-more')!.click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.datetime)).toEqual(all.slice(0, 20));
        expect(byTestId(fixture, 'recent-activity-showing')?.textContent?.trim()).toBe('Showing 20 of 25');
        expect(byTestId(fixture, 'recent-activity-show-more')).not.toBeNull();
        expect(byTestId(fixture, 'recent-activity-show-less')).not.toBeNull();

        byTestId(fixture, 'recent-activity-show-more')!.click();
        fixture.detectChanges();
        expect(rows(fixture)).toHaveLength(25);
        expect(byTestId(fixture, 'recent-activity-showing')?.textContent?.trim()).toBe('Showing 25 of 25');
        expect(byTestId(fixture, 'recent-activity-show-more')).toBeNull();

        byTestId(fixture, 'recent-activity-show-less')!.click();
        fixture.detectChanges();
        expect(rows(fixture).map((row) => row.datetime)).toEqual(all.slice(0, 10));
        expect(byTestId(fixture, 'recent-activity-show-less')).toBeNull();
      });

      it('hides Show More and Show Less when everything fits', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue(many('decrement', 10, 1));
        const fixture = await render();

        expect(rows(fixture)).toHaveLength(10);
        expect(byTestId(fixture, 'recent-activity-show-more')).toBeNull();
        expect(byTestId(fixture, 'recent-activity-show-less')).toBeNull();
        expect(byTestId(fixture, 'recent-activity-showing')).toBeNull();
      });

      it('pages within the selected filter and starts from the latest 10 when switching filter', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue([...many('decrement', 14, 3), ...many('increment', 12, 2)]);
        const fixture = await render();

        filterButton(fixture, 'restocked').click();
        fixture.detectChanges();
        expect(rows(fixture)).toHaveLength(10);
        expect(rows(fixture).every((row) => row.kind === 'Restocked')).toBe(true);
        expect(byTestId(fixture, 'recent-activity-showing')?.textContent?.trim()).toBe('Showing 10 of 12');

        byTestId(fixture, 'recent-activity-show-more')!.click();
        fixture.detectChanges();
        expect(rows(fixture)).toHaveLength(12);

        filterButton(fixture, 'used').click();
        fixture.detectChanges();
        expect(rows(fixture)).toHaveLength(10);
        expect(byTestId(fixture, 'recent-activity-showing')?.textContent?.trim()).toBe('Showing 10 of 14');
      });

      it('keeps the selected filter and updates counts when new activity is recorded', async () => {
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue(many('increment', 1, 1));
        const fixture = await render();

        filterButton(fixture, 'restocked').click();
        fixture.detectChanges();
        await TestBed.inject(PantryConsumptionService).consume('rice', 1);
        fixture.detectChanges();

        expect(filterButton(fixture, 'restocked').getAttribute('aria-pressed')).toBe('true');
        expect(rows(fixture).map((row) => row.kind)).toEqual(['Restocked']);
        expect(pills(fixture).map((pill) => pill.count)).toEqual(['2', '1', '1', '0']);
      });
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
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
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

    it('sits directly below the analytics cards', async () => {
      const fixture = await render();

      expect(section(fixture).previousElementSibling?.getAttribute('data-testid')).toBe('consumption-analytics');
      expect(section(fixture).querySelector('h3')?.textContent?.trim()).toBe('Top Items Consumed');
    });

    it('shows a simple message when nothing has been consumed', async () => {
      repository.getAll.mockResolvedValue([pantryItem('rice', 'Basmati Rice', 'kg')]);
      // Restocks alone are not consumption.
      consumptionRepository.getAll.mockResolvedValue([{ ...used('rice', 1), actionType: 'increment' }]);

      const fixture = await render();

      expect(ranking(fixture)).toEqual([]);
      expect(section(fixture).querySelector('[data-testid="top-consumed-empty"]')?.textContent).toContain(
        'Nothing consumed yet'
      );
    });

    it('shows a loading message until the saved history has loaded', async () => {
      consumptionRepository.getAll.mockReturnValue(new Promise(() => undefined));
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
      fixture.detectChanges();

      expect(section(fixture).textContent).toContain('Loading top items');
      expect(section(fixture).querySelector('[data-testid="top-consumed-empty"]')).toBeNull();
    });

    it('ranks the top 5 items by total quantity used, with name and unit, from saved history', async () => {
      repository.getAll.mockResolvedValue([
        pantryItem('rice', 'Basmati Rice', 'kg'),
        pantryItem('milk', 'Oat Milk', 'count'),
        pantryItem('oil', 'Olive Oil', 'l'),
        pantryItem('eggs', 'Eggs', 'count'),
        pantryItem('flour', 'Flour', 'kg'),
        pantryItem('salt', 'Salt', 'g')
      ]);
      consumptionRepository.getAll.mockResolvedValue([
        used('milk', 1), used('milk', 1), used('milk', 1), used('milk', 1),
        used('rice', 2), used('rice', 0.5),
        used('oil', 0.75),
        used('eggs', 6),
        used('flour', 1),
        used('salt', 0.25)
      ]);

      const fixture = await render();

      expect(ranking(fixture)).toEqual([
        { rank: '1', name: 'Eggs', amount: '6 count', deleted: false },
        { rank: '2', name: 'Oat Milk', amount: '4 count', deleted: false },
        { rank: '3', name: 'Basmati Rice', amount: '2.5 kg', deleted: false },
        { rank: '4', name: 'Flour', amount: '1 kg', deleted: false },
        { rank: '5', name: 'Olive Oil', amount: '0.75 l', deleted: false }
      ]);
      expect(section(fixture).querySelector('.top-rank--first')?.textContent?.trim()).toBe('1');
    });


    it('keeps deleted items in the ranking, marked as deleted', async () => {
      repository.getAll.mockResolvedValue([pantryItem('milk', 'Oat Milk', 'count')]);
      consumptionRepository.getAll.mockResolvedValue([
        { ...used('gone', 0), actionType: 'deleted', createdAt: '2026-03-03T08:00:00.000Z', itemName: 'Brown Rice', unit: 'kg' },
        used('gone', 3, '2026-03-02T08:00:00.000Z', { itemName: 'Brown Rice', unit: 'kg' }),
        used('milk', 1)
      ]);

      const fixture = await render();

      expect(ranking(fixture)).toEqual([
        { rank: '1', name: 'Brown Rice', amount: '3 kg', deleted: true },
        { rank: '2', name: 'Oat Milk', amount: '1 count', deleted: false }
      ]);
    });

    it('announces the rank to screen readers', async () => {
      repository.getAll.mockResolvedValue([pantryItem('milk', 'Oat Milk', 'count')]);
      consumptionRepository.getAll.mockResolvedValue([used('milk', 1)]);

      const fixture = await render();

      expect(section(fixture).querySelector('.visually-hidden')?.textContent?.trim()).toBe('Rank 1:');
      expect(section(fixture).querySelector('.top-rank')?.getAttribute('aria-hidden')).toBe('true');
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
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
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

    it('sits directly below Top Items Consumed', async () => {
      const fixture = await render();

      expect(section(fixture).previousElementSibling?.getAttribute('data-testid')).toBe('top-consumed');
      expect(section(fixture).querySelector('h3')?.textContent?.trim()).toBe('Usage Trend');
    });

    it('charts units used per day for the last 7 days from saved history', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([
        historyLog('decrement', 2, daysAgo(0)),
        historyLog('decrement', 1, daysAgo(0)),
        historyLog('empty', 1.5, daysAgo(2)),
        historyLog('decrement', 1, daysAgo(6)),
        historyLog('decrement', 9, daysAgo(7)), // outside the window
        historyLog('increment', 5, daysAgo(1)) // restock: not usage
      ]);

      const fixture = await render();
      const days = chart(fixture);

      expect(days.map((day) => day.date)).toEqual([6, 5, 4, 3, 2, 1, 0].map((n) => localKey(daysAgo(n))));
      expect(days.map((day) => day.value)).toEqual(['1', '0', '0', '0', '1.5', '0', '3']);
      expect(days.map((day) => day.height)).toEqual(['33.3%', '0%', '0%', '0%', '50%', '0%', '100%']);
      expect(days.map((day) => day.today)).toEqual([false, false, false, false, false, false, true]);
      expect(days.at(-1)?.label).toBe('Today');
      expect(total(fixture)).toBe('5.5 units · last 7 days');
      expect(section(fixture).querySelector('[data-testid="usage-trend-empty"]')).toBeNull();
    });


    it('shows an empty chart with a short message when nothing was used in the last 7 days', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('decrement', 4, daysAgo(10))]);

      const fixture = await render();

      expect(chart(fixture)).toHaveLength(7);
      expect(chart(fixture).every((day) => day.value === '0' && day.height === '0%')).toBe(true);
      expect(section(fixture).querySelector('[data-testid="usage-trend-empty"]')?.textContent?.trim()).toBe(
        'Nothing used in the last 7 days.'
      );
      expect(total(fixture)).toBe('0 units · last 7 days');
    });

    it('keeps tiny amounts visible next to a big day', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([
        historyLog('decrement', 100, daysAgo(0)),
        historyLog('decrement', 1, daysAgo(1))
      ]);

      const fixture = await render();

      expect(chart(fixture).slice(-2).map((day) => day.height)).toEqual(['6%', '100%']);
    });

    it('reads each day out for screen readers', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('decrement', 1, daysAgo(0))]);

      const fixture = await render();
      const todayText = section(fixture)
        .querySelectorAll('[data-testid="usage-trend-day"]')[6]
        .querySelector('.visually-hidden')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();

      expect(section(fixture).querySelector('.trend-chart')?.getAttribute('aria-label')).toBe(
        'Units used per day over the last 7 days'
      );
      expect(todayText).toMatch(/^Today, .+: 1 unit used$/);
      expect(section(fixture).querySelector('.trend-track')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows a loading message until the saved history has loaded', async () => {
      consumptionRepository.getAll.mockReturnValue(new Promise(() => undefined));
      const pantryState = TestBed.inject(PantryStateService);
      await pantryState.load();
      const fixture = TestBed.createComponent(PantryConsumptionInsightsComponent);
      fixture.detectChanges();

      expect(section(fixture).textContent).toContain('Loading usage trend');
      expect(section(fixture).querySelector('[data-testid="usage-trend-day"]')).toBeNull();
    });

    describe('when the day changes while the app is open', () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it('moves the chart on at midnight', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(new Date(2026, 2, 10, 23, 59, 30));
        repository.getAll.mockResolvedValue([rice]);
        consumptionRepository.getAll.mockResolvedValue([historyLog('decrement', 2, new Date(2026, 2, 10, 9))]);

        const fixture = await render();
        expect(chart(fixture).at(-1)).toEqual(expect.objectContaining({ date: '2026-03-10', value: '2' }));

        vi.setSystemTime(new Date(2026, 2, 11, 0, 0, 30));
        vi.advanceTimersByTime(60_000);
        fixture.detectChanges();

        expect(chart(fixture).at(-1)).toEqual(expect.objectContaining({ date: '2026-03-11', value: '0', today: true }));
        expect(chart(fixture).at(-2)).toEqual(expect.objectContaining({ date: '2026-03-10', value: '2', today: false }));
      });

    });
  });

  describe('readability on narrow screens', () => {
    function historyLog(id: string, itemId: string, amount: number, createdAt: string, extra = {}) {
      return { id, itemId, actionType: 'decrement', amount, previousQuantity: 0, nextQuantity: 0, createdAt, ...extra };
    }

    function today(hour: number): string {
      const date = new Date();
      date.setHours(hour, 0, 0, 0);
      return date.toISOString();
    }

    it('shrinks very long analytics totals so they fit the card', async () => {
      repository.getAll.mockResolvedValue([{ ...rice, unit: 'g' }]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('a', 'rice', 123456.75, today(9))]);

      const fixture = await renderInsights();
      const values = Array.from(fixture.nativeElement.querySelectorAll('.consumption-stat dd')) as HTMLElement[];

      expect(values.map((dd) => [dd.textContent?.trim(), dd.classList.contains('is-long')])).toEqual([
        ['1', false],
        ['123456.75', true],
        ['0', false]
      ]);
    });

    it('keeps usage trend bar labels short but reads out the exact value', async () => {
      repository.getAll.mockResolvedValue([{ ...rice, unit: 'g' }]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('a', 'rice', 12345.5, today(9))]);

      const fixture = await renderInsights();
      const todayBar = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="usage-trend-day"]')).at(-1) as HTMLElement;

      expect(todayBar.querySelector('.trend-value')?.textContent?.trim()).toBe('12K');
      expect(todayBar.querySelector('.visually-hidden')?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
        /: 12345\.5 units used$/
      );
    });

    it('shows the activity action followed by its date and time', async () => {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue([historyLog('a', 'rice', 1, '2026-03-02T09:30:00.000Z')]);

      const fixture = await renderInsights();
      const meta = fixture.nativeElement.querySelector('[data-testid="recent-activity-entry"] .activity-meta') as HTMLElement;

      expect(Array.from(meta.children).map((child) => child.tagName)).toEqual(['SPAN', 'TIME']);
      expect(meta.querySelector('.activity-kind')?.textContent?.trim()).toBe('Used');
      expect(meta.querySelector('time')?.textContent?.trim()).toBe(formatActivityDateTime('2026-03-02T09:30:00.000Z'));
    });
  });

  describe('Show Less scrolling', () => {
    function manyUses(count: number) {
      return Array.from({ length: count }, (_, index) => ({
        id: `use-${index}`,
        itemId: 'rice',
        actionType: 'decrement',
        amount: 1,
        previousQuantity: 0,
        nextQuantity: 0,
        createdAt: `2026-03-01T08:${String(59 - index).padStart(2, '0')}:00.000Z`
      }));
    }

    /** Puts the component inside a fake ion-content whose visible area starts at y=100. */
    async function renderInScrollArea(headingTop: number) {
      repository.getAll.mockResolvedValue([rice]);
      consumptionRepository.getAll.mockResolvedValue(manyUses(25));
      const fixture = await renderInsights();

      const scroller = { scrollBy: vi.fn() };
      const content = document.createElement('ion-content') as HTMLElement & {
        getScrollElement: () => Promise<unknown>;
      };
      content.getScrollElement = async () => scroller;
      content.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
      document.body.appendChild(content);
      content.appendChild(fixture.nativeElement);
      const heading = fixture.nativeElement.querySelector('#recent-activity-title') as HTMLElement;
      heading.getBoundingClientRect = () => ({ top: headingTop }) as DOMRect;

      const button = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
      button('recent-activity-show-more').click();
      fixture.detectChanges();

      return { fixture, scroller, content, button };
    }

    it('scrolls the Recent Activity heading back into view if you had scrolled past it', async () => {
      const { fixture, scroller, content, button } = await renderInScrollArea(-300);

      button('recent-activity-show-less').click();
      await fixture.whenStable();

      // Heading lands 12px below the top of the visible area: -300 - 100 - 12.
      expect(scroller.scrollBy).toHaveBeenCalledWith({ top: -412, behavior: 'smooth' });
      content.remove();
    });

    it('does not scroll if the heading is still visible', async () => {
      const { fixture, scroller, content, button } = await renderInScrollArea(240);

      button('recent-activity-show-less').click();
      await fixture.whenStable();

      expect(scroller.scrollBy).not.toHaveBeenCalled();
      content.remove();
    });
  });

  describe('keeping the usage trend on the right day', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-checks the day when the app comes back to the foreground', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 2, 10, 22, 0));
      const fixture = await renderInsights();
      const lastDay = () =>
        (Array.from(fixture.nativeElement.querySelectorAll('[data-testid="usage-trend-day"]')).at(-1) as HTMLElement).getAttribute('data-date');
      expect(lastDay()).toBe('2026-03-10');

      vi.setSystemTime(new Date(2026, 2, 11, 7, 0));
      document.dispatchEvent(new Event('visibilitychange'));
      fixture.detectChanges();

      expect(lastDay()).toBe('2026-03-11');
    });

    it('stops its day check when removed', async () => {
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      const fixture = await renderInsights();

      fixture.destroy();

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
