import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../../../../testing/ionic-standalone.stubs'));

import { IonModal, ToastController } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryConsumptionLog } from '../../pantry/models/pantry-consumption.model';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryConsumptionService } from '../../pantry/services/pantry-consumption.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { AppSettings } from '../../settings/models/app-settings.model';
import { SettingsService } from '../../settings/services/settings.service';
import { ExpiryTrackerPage } from './expiry-tracker.page';

function inDays(days: number): string {
  return toLocalDateOnly(addDays(new Date(), days));
}

function createItem(id: string, name: string, expiryDate: string | null, quantity = 2): PantryItem {
  return {
    id,
    name,
    imageUrl: null,
    category: 'dairy',
    unit: 'count',
    quantity,
    minQuantity: 0,
    avgDailyUsage: null,
    autoAddToShoppingList: false,
    expiryDate,
    germanStore: true,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

describe('ExpiryTrackerPage', () => {
  const itemsState = signal<readonly PantryItem[]>([]);
  const settingsState = signal<AppSettings>(DEFAULT_APP_SETTINGS);

  function setLeadDays(expiryLeadDays: number): void {
    settingsState.update((settings) => ({
      ...settings,
      reminderSettings: { ...settings.reminderSettings, expiryLeadDays }
    }));
  }

  const navigationHistory = { back: vi.fn().mockResolvedValue(true) };
  const toast = {
    present: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(true),
    onDidDismiss: vi.fn(() => new Promise(() => undefined))
  };
  const toastController = { create: vi.fn() };

  function setQuantity(id: string, quantity: number): void {
    itemsState.update((items) => items.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }

  const pantryState = {
    items: itemsState,
    getById: (id: string) => itemsState().find((item) => item.id === id),
    save: vi.fn(async (draft: PantryItem, id: string) => {
      itemsState.update((items) => items.map((item) => (item.id === id ? { ...item, ...draft } : item)));
      return draft;
    })
  };

  /** Mirrors the real service: never below zero; undo adds the amount back and drops the entry. */
  let logs: PantryConsumptionLog[] = [];
  const consumption = {
    consumeUndoable: vi.fn(async (id: string, amount: number): Promise<PantryConsumptionLog | null> => {
      const item = pantryState.getById(id);
      if (!item || item.quantity <= 0) return null;
      const used = Math.min(item.quantity, amount);
      const log: PantryConsumptionLog = {
        id: `log-${logs.length + 1}`,
        itemId: id,
        actionType: 'decrement',
        amount: used,
        previousQuantity: item.quantity,
        nextQuantity: item.quantity - used,
        createdAt: new Date().toISOString()
      };
      setQuantity(id, log.nextQuantity);
      logs = [log, ...logs];
      return log;
    }),
    undoConsumption: vi.fn(async (logId: string) => {
      const log = logs.find((entry) => entry.id === logId);
      const item = log && pantryState.getById(log.itemId);
      if (!log || !item) return false;
      setQuantity(item.id, item.quantity + log.amount);
      logs = logs.filter((entry) => entry !== log);
      return true;
    }),
    adjust: vi.fn(async (id: string, amount: number) => {
      const item = pantryState.getById(id);
      if (!item) return false;
      setQuantity(id, item.quantity + amount);
      return true;
    })
  };

  beforeEach(async () => {
    itemsState.set([
      createItem('milk', 'Milk', inDays(-2)),
      createItem('yogurt', 'Yogurt', inDays(0)),
      createItem('cheese', 'Cheese', inDays(4)),
      createItem('jam', 'Jam', inDays(90)),
      createItem('rice', 'Rice', null)
    ]);
    // Most expectations below were written for a one-week window; the
    // 'reminder lead time' tests cover the other choices and the default.
    settingsState.set(DEFAULT_APP_SETTINGS);
    setLeadDays(7);
    navigationHistory.back.mockClear();
    pantryState.save.mockClear();
    logs = [];
    consumption.consumeUndoable.mockClear();
    consumption.undoConsumption.mockClear();
    consumption.adjust.mockClear();
    toast.present.mockClear();
    toast.dismiss.mockClear();
    toastController.create.mockReset();
    toastController.create.mockResolvedValue(toast);

    await TestBed.configureTestingModule({
      imports: [ExpiryTrackerPage],
      providers: [
        provideRouter([]),
        { provide: PantryStateService, useValue: pantryState },
        { provide: PantryConsumptionService, useValue: consumption },
        { provide: ToastController, useValue: toastController },
        { provide: SettingsService, useValue: { settings: settingsState } },
        { provide: NavigationHistoryService, useValue: navigationHistory }
      ]
    }).compileComponents();
  });

  type ToastOptions = {
    message: string;
    duration: number;
    cssClass: string[];
    buttons?: { text: string; handler: () => void }[];
  };

  function lastToast(): ToastOptions {
    return toastController.create.mock.calls.at(-1)?.[0];
  }

  /** Taps the toast's Undo button and lets the undo finish. */
  async function tapUndo(fixture: ReturnType<typeof render>, options: ToastOptions = lastToast()) {
    const undo = options.buttons?.find((button) => button.text === 'Undo');
    expect(undo).toBeDefined();
    undo!.handler();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function markUsed(fixture: ReturnType<typeof render>, name: string): Promise<void> {
    (card(fixture, name).querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).click();
    return fixture.whenStable().then(() => fixture.detectChanges());
  }

  function card(fixture: ReturnType<typeof render>, name: string): HTMLElement {
    const match = Array.from(fixture.nativeElement.querySelectorAll('article.entry-card') as NodeListOf<HTMLElement>).find(
      (element) => element.querySelector('.entry-card__name')?.textContent?.trim() === name
    );
    expect(match).toBeDefined();
    return match as HTMLElement;
  }

  function restockSheet(fixture: ReturnType<typeof render>): IonModal {
    return fixture.debugElement.query(By.directive(IonModal)).componentInstance as IonModal;
  }

  /** The sheet's form lives in an ng-template the Ionic stub doesn't render, so call the page handler. */
  function submitRestock(fixture: ReturnType<typeof render>, item: PantryItem, amount: number, expiryDate: string | null) {
    return (fixture.componentInstance as any).confirmRestock(item, { amount, expiryDate }) as Promise<void>;
  }

  function render() {
    const fixture = TestBed.createComponent(ExpiryTrackerPage);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ReturnType<typeof render>, selector: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector) as NodeListOf<HTMLElement>).map(
      (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
  }

  it('summarises pantry freshness in the hero', () => {
    const fixture = render();

    // "Expiring soon" includes today (same 0–7 day window as the Pantry screen).
    expect(text(fixture, '.hero__title')[0]).toBe('3 items need your attention.');
    expect(text(fixture, '.hero-stat dt')).toEqual(['Expired', 'Expiring soon', 'Fresh']);
    expect(text(fixture, '.hero-stat dd')).toEqual(['1', '2', '1']);
    expect(text(fixture, '.page-header__text p')[0]).toBe('4 of 5 items dated');
  });

  it('lists items in timeline groups, soonest first', () => {
    const fixture = render();

    expect(text(fixture, '.group-title')).toEqual([
      'Expired 1',
      'Today 1',
      'Within a week 1',
      'Later 1',
      'No expiry date 1'
    ]);
    expect(text(fixture, '.entry-card__name')).toEqual(['Milk', 'Yogurt', 'Cheese', 'Jam', 'Rice']);
    expect(text(fixture, '.entry-card__badge strong')).toEqual(['2', 'Today', '4', '90']);
    expect(text(fixture, '.entry-card__badge small')).toEqual(['days ago', 'use now', 'days left', 'days left']);
  });

  it('links each item to its pantry edit screen', () => {
    const fixture = render();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.entry-card__main') as NodeListOf<HTMLAnchorElement>);

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tabs/pantry/milk/edit',
      '/tabs/pantry/yogurt/edit',
      '/tabs/pantry/cheese/edit',
      '/tabs/pantry/jam/edit',
      '/tabs/pantry/rice/edit'
    ]);
    expect(links[0].getAttribute('aria-label')).toBe('Milk, Expired. Edit item');
  });

  it('filters the timeline with the status pills', () => {
    const fixture = render();
    const pills = Array.from(fixture.nativeElement.querySelectorAll('.filter-pill') as NodeListOf<HTMLButtonElement>);

    expect(pills.map((pill) => pill.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All 5',
      'Expired 1',
      'Expiring soon 2',
      'Fresh 1',
      'No date 1',
      'Used up 0'
    ]);

    pills[2].click();
    fixture.detectChanges();

    expect(pills[2].getAttribute('aria-pressed')).toBe('true');
    expect(text(fixture, '.entry-card__name')).toEqual(['Yogurt', 'Cheese']);
  });

  it('shows a reset option when a filter has no matches', () => {
    itemsState.set([createItem('milk', 'Milk', inDays(3))]);
    const fixture = render();

    (fixture.nativeElement.querySelectorAll('.filter-pill')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(fixture, '.empty-card h2')).toEqual(['Nothing in this view']);

    (fixture.nativeElement.querySelector('.empty-card button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(fixture, '.entry-card__name')).toEqual(['Milk']);
  });

  it('reports an all-fresh pantry', () => {
    itemsState.set([createItem('jam', 'Jam', inDays(30))]);

    expect(text(render(), '.hero__title')[0]).toBe('Everything is fresh.');
  });

  it('invites the user to add items when the pantry is empty', () => {
    itemsState.set([]);
    const fixture = render();

    expect(text(fixture, '.empty-card h2')).toEqual(['Your pantry is empty']);
    expect(fixture.nativeElement.querySelector('.filter-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hero-stats')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-card a').getAttribute('href')).toBe('/tabs/pantry/new');
  });

  it('goes back with Home as the fallback', () => {
    const fixture = render();

    (fixture.nativeElement.querySelector('button[aria-label="Go back"]') as HTMLButtonElement).click();

    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/home');
  });

  describe('quick actions', () => {
    it('offers Mark as used and Restock on every item that has something left', () => {
      const fixture = render();

      for (const name of ['Milk', 'Yogurt', 'Cheese', 'Jam', 'Rice']) {
        const actions = Array.from(card(fixture, name).querySelectorAll('.entry-card__actions button')).map((button) =>
          button.textContent?.trim()
        );
        expect(actions).toEqual(['Mark as used', 'Restock']);
      }

      expect(
        card(fixture, 'Yogurt').querySelector('[data-testid="expiry-mark-used"]')?.getAttribute('aria-label')
      ).toBe('Mark 1 count of Yogurt as used');
    });

    it('keeps the actions outside the edit link', () => {
      const fixture = render();

      expect(fixture.nativeElement.querySelectorAll('a.entry-card__main button').length).toBe(0);
    });

    it('uses one unit, updates the row and confirms with a toast', async () => {
      const fixture = render();

      (card(fixture, 'Yogurt').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(consumption.consumeUndoable).toHaveBeenCalledWith('yogurt', 1);
      expect(card(fixture, 'Yogurt').querySelector('.entry-card__meta')?.textContent).toContain('1 count');
      expect(lastToast().message).toBe('Used 1 count of Yogurt · 1 count left');
      expect(lastToast().cssClass).toContain('expiry-toast--success');
      expect(toast.present).toHaveBeenCalled();
    });

    it('moves an item to Used up when the last unit is used, out of the expiry counts', async () => {
      itemsState.set([createItem('milk', 'Milk', inDays(-2), 1), createItem('jam', 'Jam', inDays(90))]);
      const fixture = render();
      expect(text(fixture, '.hero-stat dd')).toEqual(['1', '0', '1']);

      (card(fixture, 'Milk').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(lastToast().message).toBe('Milk is used up');
      expect(text(fixture, '.group-title')).toEqual(['Later 1', 'Used up 1']);
      expect(text(fixture, '.hero-stat dd')).toEqual(['0', '0', '1']);
      expect(text(fixture, '.hero__title')[0]).toBe('Everything is fresh.');

      const usedUpCard = card(fixture, 'Milk');
      expect(usedUpCard.classList).toContain('is-used-up');
      expect(usedUpCard.querySelector('.entry-card__date')?.textContent).toContain('Nothing left');
      expect(usedUpCard.querySelector('.entry-card__badge')).toBeNull();
      expect(
        Array.from(usedUpCard.querySelectorAll('.entry-card__actions button')).map((button) => button.textContent?.trim())
      ).toEqual(['Restock']);
      expect(usedUpCard.querySelector('a.entry-card__main')?.getAttribute('aria-label')).toBe('Milk, used up. Edit item');
    });

    it('ignores a second tap while the first one is still saving', async () => {
      let finish!: () => void;
      consumption.consumeUndoable.mockImplementationOnce(
        () => new Promise<PantryConsumptionLog | null>((resolve) => (finish = () => resolve(null)))
      );
      const fixture = render();
      const button = card(fixture, 'Cheese').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement;

      button.click();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);
      button.click();

      finish();
      await fixture.whenStable();

      expect(consumption.consumeUndoable).toHaveBeenCalledTimes(1);
    });

    it('reports a failed update', async () => {
      consumption.consumeUndoable.mockRejectedValueOnce(new Error('storage full'));
      const fixture = render();

      (card(fixture, 'Cheese').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(lastToast().message).toBe("Couldn't update Cheese. Please try again.");
      expect(lastToast().cssClass).toContain('expiry-toast--danger');
      expect(lastToast().buttons).toBeUndefined();
      expect((card(fixture, 'Cheese').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).disabled).toBe(false);
    });

    it('opens the restock sheet for the tapped item and closes it on dismiss', () => {
      const fixture = render();
      expect(restockSheet(fixture).isOpen).toBe(false);

      (card(fixture, 'Milk').querySelector('[data-testid="expiry-restock"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(restockSheet(fixture).isOpen).toBe(true);
      expect((fixture.componentInstance as any).restockTarget()?.id).toBe('milk');

      restockSheet(fixture).didDismiss.emit();
      fixture.detectChanges();
      expect(restockSheet(fixture).isOpen).toBe(false);
    });

    it('restocks through the consumption log and sets the new expiry date', async () => {
      const fixture = render();
      const milk = pantryState.getById('milk')!;
      const newDate = inDays(7);

      (card(fixture, 'Milk').querySelector('[data-testid="expiry-restock"]') as HTMLButtonElement).click();
      await submitRestock(fixture, milk, 3, newDate);
      fixture.detectChanges();

      expect(consumption.adjust).toHaveBeenCalledWith('milk', 3);
      expect(pantryState.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 5, expiryDate: newDate }), 'milk');
      expect(restockSheet(fixture).isOpen).toBe(false);
      expect(lastToast().message).toMatch(/^Restocked Milk · 5 count, expires /);

      // Milk leaves "Expired" and joins the coming week.
      expect(text(fixture, '.group-title')).toEqual(['Today 1', 'Within a week 2', 'Later 1', 'No expiry date 1']);
    });

    it('brings a used-up item back onto the timeline', async () => {
      itemsState.set([createItem('milk', 'Milk', inDays(-2), 0)]);
      const fixture = render();
      expect(text(fixture, '.group-title')).toEqual(['Used up 1']);

      await submitRestock(fixture, pantryState.getById('milk')!, 1, inDays(3));
      fixture.detectChanges();

      expect(text(fixture, '.group-title')).toEqual(['Within a week 1']);
      expect(text(fixture, '.page-header__text p')[0]).toBe('1 of 1 item dated');
    });

    it('only adds stock when the date is unchanged', async () => {
      const fixture = render();
      const cheese = pantryState.getById('cheese')!;

      await submitRestock(fixture, cheese, 1, cheese.expiryDate);

      expect(consumption.adjust).toHaveBeenCalledWith('cheese', 1);
      expect(pantryState.save).not.toHaveBeenCalled();
    });

    it('can clear the date when the restocked item does not expire', async () => {
      const fixture = render();

      await submitRestock(fixture, pantryState.getById('jam')!, 1, null);
      fixture.detectChanges();

      expect(pantryState.save).toHaveBeenCalledWith(expect.objectContaining({ expiryDate: null }), 'jam');
      expect(lastToast().message).toBe('Restocked Jam · 3 count');
      expect(text(fixture, '.group-title')).toContain('No expiry date 2');
    });

    it('keeps the sheet open and reports a failed restock', async () => {
      consumption.adjust.mockRejectedValueOnce(new Error('storage full'));
      const fixture = render();

      (card(fixture, 'Milk').querySelector('[data-testid="expiry-restock"]') as HTMLButtonElement).click();
      await submitRestock(fixture, pantryState.getById('milk')!, 1, inDays(5));
      fixture.detectChanges();

      expect(restockSheet(fixture).isOpen).toBe(true);
      expect(lastToast().message).toBe("Couldn't restock Milk. Please try again.");
      expect(pantryState.save).not.toHaveBeenCalled();
    });
  });

  describe('undo after Mark as used', () => {
    it('offers Undo on the confirmation, for longer than other messages', async () => {
      const fixture = render();

      await markUsed(fixture, 'Yogurt');

      expect(lastToast().message).toBe('Used 1 count of Yogurt · 1 count left');
      expect(lastToast().buttons?.map((button) => button.text)).toEqual(['Undo']);
      expect(lastToast().duration).toBe(5000);
    });

    it('restores the quantity and removes the use from the history', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      const usedLog = logs[0];

      await tapUndo(fixture);

      expect(consumption.undoConsumption).toHaveBeenCalledWith(usedLog.id);
      expect(logs).toEqual([]);
      expect(consumption.adjust).not.toHaveBeenCalled();
      expect(card(fixture, 'Yogurt').querySelector('.entry-card__meta')?.textContent).toContain('2 count');
      expect(lastToast().message).toBe('Restored Yogurt · 2 count');
      expect(lastToast().buttons).toBeUndefined();
    });

    it('brings a used-up item back to its expiry group and counts', async () => {
      itemsState.set([createItem('milk', 'Milk', inDays(-2), 1), createItem('jam', 'Jam', inDays(90))]);
      const fixture = render();
      await markUsed(fixture, 'Milk');
      expect(text(fixture, '.group-title')).toEqual(['Later 1', 'Used up 1']);

      await tapUndo(fixture);

      expect(text(fixture, '.group-title')).toEqual(['Expired 1', 'Later 1']);
      expect(text(fixture, '.hero-stat dd')).toEqual(['1', '0', '1']);
      expect(text(fixture, '.hero__title')[0]).toBe('1 item needs your attention.');
    });

    it('undoes only the use its message belongs to', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      await markUsed(fixture, 'Cheese');
      const [cheeseToast] = toastController.create.mock.calls.slice(-1).map((call) => call[0]);

      await tapUndo(fixture, cheeseToast);

      expect(card(fixture, 'Cheese').querySelector('.entry-card__meta')?.textContent).toContain('2 count');
      expect(card(fixture, 'Yogurt').querySelector('.entry-card__meta')?.textContent).toContain('1 count');
    });

    it('replaces the previous message so an old Undo does not linger', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      expect(toast.dismiss).not.toHaveBeenCalled();

      await markUsed(fixture, 'Cheese');

      expect(toast.dismiss).toHaveBeenCalledTimes(1);
    });

    it('ignores a second Undo tap for the same use', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      const undoToast = lastToast();

      await tapUndo(fixture, undoToast);
      await tapUndo(fixture, undoToast);

      expect(card(fixture, 'Yogurt').querySelector('.entry-card__meta')?.textContent).toContain('2 count');
      expect(lastToast().message).toBe("Couldn't undo — Yogurt was changed or removed.");
    });

    it('explains when the item was removed before Undo', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      const undoToast = lastToast();
      itemsState.update((items) => items.filter((item) => item.id !== 'yogurt'));

      await tapUndo(fixture, undoToast);

      expect(lastToast().message).toBe("Couldn't undo — Yogurt was changed or removed.");
      expect(lastToast().cssClass).toContain('expiry-toast--danger');
    });

    it('reports a failed undo and re-enables the actions', async () => {
      const fixture = render();
      await markUsed(fixture, 'Yogurt');
      consumption.undoConsumption.mockRejectedValueOnce(new Error('storage full'));

      await tapUndo(fixture);

      expect(lastToast().message).toBe("Couldn't undo for Yogurt. Please try again.");
      expect((card(fixture, 'Yogurt').querySelector('[data-testid="expiry-mark-used"]') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('reminder lead time', () => {
    beforeEach(() => {
      itemsState.set([
        createItem('yogurt', 'Yogurt', inDays(0)),
        createItem('spinach', 'Spinach', inDays(1)),
        createItem('berries', 'Berries', inDays(3)),
        createItem('cheese', 'Cheese', inDays(5)),
        createItem('jam', 'Jam', inDays(30))
      ]);
    });

    it('uses the app default of 3 days when nothing was chosen', () => {
      settingsState.set(DEFAULT_APP_SETTINGS);
      const fixture = render();

      expect(text(fixture, '.hero-stat dd')).toEqual(['0', '3', '2']);
      expect(text(fixture, '.group-title')).toEqual(['Today 1', 'Tomorrow 1', 'Within 3 days 1', 'Later 2']);
      expect(text(fixture, '.hero__window')[0]).toContain('Expiring soon = within 3 days');
    });

    it.each([
      [1, ['0', '2', '3'], ['Today 1', 'Tomorrow 1', 'Later 3'], 'Expiring soon 2'],
      [3, ['0', '3', '2'], ['Today 1', 'Tomorrow 1', 'Within 3 days 1', 'Later 2'], 'Expiring soon 3'],
      [7, ['0', '4', '1'], ['Today 1', 'Tomorrow 1', 'Within a week 2', 'Later 1'], 'Expiring soon 4']
    ])('with %i day(s) it counts, groups and filters by that window', (leadDays, stats, groups, pill) => {
      setLeadDays(leadDays);
      const fixture = render();

      expect(text(fixture, '.hero-stat dd')).toEqual(stats);
      expect(text(fixture, '.group-title')).toEqual(groups);
      expect(text(fixture, '.filter-pill')).toContain(pill);
    });

    it('updates straight away when the preference changes', () => {
      setLeadDays(1);
      const fixture = render();
      expect(text(fixture, '.hero-stat dd')).toEqual(['0', '2', '3']);

      setLeadDays(7);
      fixture.detectChanges();

      expect(text(fixture, '.hero-stat dd')).toEqual(['0', '4', '1']);
      expect(text(fixture, '.hero__window')[0]).toContain('within 7 days');
    });

    it('links the window to Account settings', () => {
      const link = render().nativeElement.querySelector('[data-testid="expiry-window-link"]') as HTMLAnchorElement;

      expect(link.getAttribute('href')).toBe('/tabs/settings');
      expect(link.getAttribute('aria-label')).toBe('Expiring soon means within 7 days. Change in Account settings');
    });
  });
});
