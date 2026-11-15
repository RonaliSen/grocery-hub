import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryAuditSessionService } from './pantry-audit-session.service';
import { PantryRepositoryService } from './pantry-repository.service';
import { PantryStateService } from './pantry-state.service';

function item(id: string, name: string): PantryItem {
  return {
    id,
    name,
    category: 'dairy',
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
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

describe('PantryAuditSessionService', () => {
  const repository = { getAll: vi.fn(), saveAll: vi.fn() };
  let session: PantryAuditSessionService;
  let pantryState: PantryStateService;

  beforeEach(async () => {
    repository.getAll.mockReset().mockResolvedValue([item('c', 'cheese'), item('a', 'Apples'), item('b', 'Butter')]);
    repository.saveAll.mockReset().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: PantryRepositoryService, useValue: repository },
        { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } }
      ]
    });

    pantryState = TestBed.inject(PantryStateService);
    session = TestBed.inject(PantryAuditSessionService);
    await pantryState.load();
  });

  it('lists pantry items alphabetically (case-insensitive) with nothing selected initially', () => {
    expect(session.availableItems().map((entry) => entry.name)).toEqual(['Apples', 'Butter', 'cheese']);
    expect(session.selectedCount()).toBe(0);
    expect(session.hasSelection()).toBe(false);
    expect(session.allSelected()).toBe(false);
    expect(session.partiallySelected()).toBe(false);
  });

  it('toggles individual items and reports partial selection', () => {
    session.toggle('b');

    expect(session.isSelected('b')).toBe(true);
    expect(session.selectedCount()).toBe(1);
    expect(session.hasSelection()).toBe(true);
    expect(session.partiallySelected()).toBe(true);
    expect(session.selectedItems().map((entry) => entry.id)).toEqual(['b']);

    session.toggle('b');
    expect(session.isSelected('b')).toBe(false);
    expect(session.hasSelection()).toBe(false);
  });

  it('selects all and clears all', () => {
    session.selectAll();
    expect(session.allSelected()).toBe(true);
    expect(session.partiallySelected()).toBe(false);
    expect(session.selectedItems().map((entry) => entry.name)).toEqual(['Apples', 'Butter', 'cheese']);

    session.clearSelection();
    expect(session.selectedCount()).toBe(0);
  });

  it('drops items from the selection when they are removed from the pantry', async () => {
    session.setSelected('a', true);
    session.setSelected('c', true);

    await pantryState.remove('a');

    expect(session.selectedCount()).toBe(1);
    expect(session.selectedItems().map((entry) => entry.id)).toEqual(['c']);
  });

  it('is no longer "all selected" when a new item is added to the pantry', async () => {
    session.selectAll();
    expect(session.allSelected()).toBe(true);

    const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = item('d', 'Dates');
    await pantryState.save(draft);

    expect(session.allSelected()).toBe(false);
    expect(session.partiallySelected()).toBe(true);
    expect(session.selectedCount()).toBe(3);
  });

  it('builds count entries for selected items only, with the difference from the saved quantity', () => {
    session.setSelected('a', true);
    session.setSelected('b', true);

    expect(session.countEntries().map((entry) => [entry.item.id, entry.input.status, entry.difference])).toEqual([
      ['a', 'empty', null],
      ['b', 'empty', null]
    ]);

    session.setCountInput('a', '4');
    session.setCountInput('b', '0');
    session.setCountInput('c', '9');

    expect(session.countEntries().map((entry) => [entry.item.id, entry.rawInput, entry.difference])).toEqual([
      ['a', '4', 3],
      ['b', '0', -1]
    ]);
  });

  it('gives no difference for invalid counts', () => {
    session.setSelected('a', true);
    session.setCountInput('a', '-2');

    const [entry] = session.countEntries();
    expect(entry.input).toEqual({ status: 'invalid', reason: 'negative' });
    expect(entry.difference).toBeNull();
  });

  it('restores a count when an item is deselected and selected again', () => {
    session.setSelected('a', true);
    session.setCountInput('a', '7');
    session.setSelected('a', false);
    expect(session.countEntries()).toEqual([]);

    session.setSelected('a', true);
    expect(session.countEntries()[0].rawInput).toBe('7');
  });

  it('tracks counted, missing and invalid quantities and only allows review when all are valid', () => {
    session.selectAll();
    expect([session.countedCount(), session.missingCount(), session.invalidCount()]).toEqual([0, 3, 0]);
    expect(session.allCounted()).toBe(false);

    session.setCountInput('a', '2');
    session.setCountInput('b', 'x');
    expect([session.countedCount(), session.missingCount(), session.invalidCount()]).toEqual([1, 1, 1]);
    expect(session.allCounted()).toBe(false);

    session.setCountInput('b', '0');
    session.setCountInput('c', '1');
    expect([session.countedCount(), session.missingCount(), session.invalidCount()]).toEqual([3, 0, 0]);
    expect(session.allCounted()).toBe(true);
  });

  it('is never "all counted" with nothing selected', () => {
    expect(session.allCounted()).toBe(false);
  });

  it('splits counted items into adjustments and unchanged', () => {
    session.selectAll();
    session.setCountInput('a', '3');
    session.setCountInput('b', '1');
    session.setCountInput('c', '0');

    expect(session.adjustments().map((entry) => [entry.item.id, entry.difference])).toEqual([
      ['a', 2],
      ['c', -1]
    ]);
    expect(session.unchanged().map((entry) => entry.item.id)).toEqual(['b']);
  });

  it('reset() starts a fresh audit with no selection and no counts', () => {
    session.selectAll();
    session.setCountInput('a', '3');
    session.reset();
    expect(session.selectedCount()).toBe(0);

    session.setSelected('a', true);
    expect(session.countEntries()[0].rawInput).toBe('');
  });

  describe('applyAdjustments', () => {
    it('saves counted quantities for adjusted items only, in one write, then ends the audit', async () => {
      // a: Apples (1), b: Butter (1), c: cheese (1) — c stays unselected.
      session.setSelected('a', true);
      session.setSelected('b', true);
      session.setCountInput('a', '4');
      session.setCountInput('b', '1');

      const updated = await session.applyAdjustments();

      expect(updated).toBe(1);
      expect(repository.saveAll).toHaveBeenCalledTimes(1);
      expect(pantryState.items().map((entry) => [entry.id, entry.quantity])).toEqual([
        ['c', 1],
        ['a', 4],
        ['b', 1]
      ]);
      expect(pantryState.getById('a')?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect(pantryState.getById('b')?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(pantryState.getById('c')?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(session.selectedCount()).toBe(0);
      expect(session.countEntries()).toEqual([]);
    });

    it('saves zero counts', async () => {
      session.setSelected('c', true);
      session.setCountInput('c', '0');

      expect(await session.applyAdjustments()).toBe(1);
      expect(pantryState.getById('c')?.quantity).toBe(0);
    });

    it('writes nothing when every counted item is unchanged', async () => {
      session.selectAll();
      session.setCountInput('a', '1');
      session.setCountInput('b', '1');
      session.setCountInput('c', '1,0');

      expect(await session.applyAdjustments()).toBe(0);
      expect(repository.saveAll).not.toHaveBeenCalled();
      expect(session.selectedCount()).toBe(0);
    });

    it('refuses to update while any selected item is uncounted or invalid', async () => {
      session.setSelected('a', true);
      session.setSelected('b', true);
      session.setCountInput('a', '3');
      await expect(session.applyAdjustments()).rejects.toThrow();

      session.setCountInput('b', '-1');
      await expect(session.applyAdjustments()).rejects.toThrow();

      expect(repository.saveAll).not.toHaveBeenCalled();
      expect(pantryState.getById('a')?.quantity).toBe(1);
    });

    it('keeps the audit when saving fails so it can be retried', async () => {
      session.setSelected('a', true);
      session.setCountInput('a', '3');
      repository.saveAll.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(session.applyAdjustments()).rejects.toThrow('storage unavailable');

      expect(pantryState.getById('a')?.quantity).toBe(1);
      expect(session.countEntries().map((entry) => entry.rawInput)).toEqual(['3']);
    });
  });
});
