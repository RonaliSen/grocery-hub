import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../../core/constants/app-config';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { StorageService } from '../../core/services/storage.service';
import { SettingsService } from '../settings/services/settings.service';
import { PantryItem } from './models/pantry-item.model';
import { PantryAuditSessionService } from './services/pantry-audit-session.service';
import { PantryStateService } from './services/pantry-state.service';

/**
 * End-to-end check of the inventory audit data flow through the real pantry state, repository
 * and audit session. Only the low-level key/value store is replaced, by an in-memory map that
 * survives an "app restart" (tearing down and rebuilding the Angular injector).
 */

class InMemoryStorage {
  constructor(private readonly data: Map<string, unknown>) {}

  async initialize(): Promise<void> {}

  async get<T>(key: string, fallback: T): Promise<T> {
    // Round-trip through JSON like a real store, so no object references are shared.
    return this.data.has(key) ? (JSON.parse(JSON.stringify(this.data.get(key))) as T) : fallback;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

const ORIGINAL_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function pantryItem(id: string, name: string, quantity: number, unit: PantryItem['unit']): PantryItem {
  return {
    id,
    name,
    category: 'grains',
    unit,
    quantity,
    minQuantity: 1,
    avgDailyUsage: null,
    autoAddToShoppingList: false,
    expiryDate: null,
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: ORIGINAL_TIMESTAMP,
    updatedAt: ORIGINAL_TIMESTAMP
  };
}

const INITIAL_PANTRY: PantryItem[] = [
  pantryItem('rice', 'Basmati Rice', 2, 'kg'), // counted as 0        -> zero adjustment
  pantryItem('milk', 'Whole Milk', 1.5, 'l'), // counted as "1,5"    -> unchanged
  pantryItem('apples', 'Apples', 6, 'count'), // counted 8, edited 7  -> increase
  pantryItem('oil', 'Olive Oil', 500, 'ml'), // never selected        -> untouched
  pantryItem('oats', 'Oats', 0, 'box'), // already 0, counted 0   -> unchanged zero
  pantryItem('cumin', 'Cumin Seeds', 100, 'g') // counted 75.5        -> decrease
];

/** Boots the pantry + audit services on top of `data`, as a fresh app launch would. */
async function launchApp(data: Map<string, unknown>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: StorageService, useValue: new InMemoryStorage(data) },
      { provide: SettingsService, useValue: { settings: () => DEFAULT_APP_SETTINGS } }
    ]
  });

  const pantry = TestBed.inject(PantryStateService);
  await pantry.load();
  return { pantry, audit: TestBed.inject(PantryAuditSessionService) };
}

function storedPantry(data: Map<string, unknown>): Map<string, PantryItem> {
  const items = data.get(STORAGE_KEYS.pantryItems) as PantryItem[];
  return new Map(items.map((item) => [item.id, item]));
}

describe('Inventory audit flow (integration)', () => {
  it('selects, counts, edits, reviews and saves — and the result survives an app restart', async () => {
    const data = new Map<string, unknown>([[STORAGE_KEYS.pantryItems, INITIAL_PANTRY]]);
    const { pantry, audit } = await launchApp(data);

    // 1. Select: everything except the olive oil.
    audit.reset();
    audit.selectAll();
    audit.setSelected('oil', false);
    expect(audit.selectedCount()).toBe(5);

    // 2. Count. Review is blocked until every selected item has a valid count.
    audit.setCountInput('rice', '0');
    audit.setCountInput('milk', '1,5');
    audit.setCountInput('apples', '8');
    audit.setCountInput('oats', '0');
    expect(audit.allCounted()).toBe(false); // cumin missing
    audit.setCountInput('cumin', '-3');
    expect(audit.allCounted()).toBe(false); // cumin invalid
    await expect(audit.applyAdjustments()).rejects.toThrow();
    audit.setCountInput('cumin', '75.5');
    expect(audit.allCounted()).toBe(true);

    // 3. Go back and edit: earlier entries are all still there; correct apples.
    expect(audit.countEntries().map((entry) => [entry.item.id, entry.rawInput])).toEqual([
      ['apples', '8'],
      ['rice', '0'],
      ['cumin', '75.5'],
      ['oats', '0'],
      ['milk', '1,5']
    ]);
    audit.setCountInput('apples', '7');

    //    ...and back to selection: deselecting then reselecting an item keeps its count.
    audit.setSelected('cumin', false);
    expect(audit.countEntries().some((entry) => entry.item.id === 'cumin')).toBe(false);
    audit.setSelected('cumin', true);
    expect(audit.countEntries().find((entry) => entry.item.id === 'cumin')?.rawInput).toBe('75.5');

    // 4. Review: zero counts are real adjustments; matching counts (including 0 = 0) are unchanged.
    expect(audit.adjustments().map((entry) => [entry.item.id, entry.difference])).toEqual([
      ['apples', 1],
      ['rice', -2],
      ['cumin', -24.5]
    ]);
    expect(audit.unchanged().map((entry) => entry.item.id)).toEqual(['oats', 'milk']);

    // Nothing has been written yet.
    expect(storedPantry(data).get('rice')?.quantity).toBe(2);

    // 5. Confirm & update.
    expect(await audit.applyAdjustments()).toBe(3);
    expect(audit.selectedCount()).toBe(0);
    expect(audit.countEntries()).toEqual([]);
    expect(pantry.getById('rice')?.quantity).toBe(0);

    // 6. Restart the app and read everything back from storage.
    const afterRestart = await launchApp(data);
    const stored = storedPantry(data);

    expect(afterRestart.pantry.items().map((item) => [item.id, item.quantity])).toEqual(
      expect.arrayContaining([
        ['rice', 0],
        ['milk', 1.5],
        ['apples', 7],
        ['oil', 500],
        ['oats', 0],
        ['cumin', 75.5]
      ])
    );
    expect(afterRestart.pantry.totalCount()).toBe(INITIAL_PANTRY.length);

    // Adjusted items: only quantity and updatedAt changed.
    for (const id of ['rice', 'apples', 'cumin']) {
      const original = INITIAL_PANTRY.find((item) => item.id === id)!;
      const { quantity: _q, updatedAt, ...rest } = stored.get(id)!;
      const { quantity: _oq, updatedAt: _ou, ...originalRest } = original;
      expect(rest).toEqual(originalRest);
      expect(updatedAt).not.toBe(ORIGINAL_TIMESTAMP);
    }

    // Unchanged and unselected items are byte-for-byte what they were.
    for (const id of ['milk', 'oats', 'oil']) {
      expect(stored.get(id)).toEqual(INITIAL_PANTRY.find((item) => item.id === id));
    }

    // A new audit after the restart starts clean.
    expect(afterRestart.audit.selectedCount()).toBe(0);
  });

  it('leaves storage untouched when an audit finds nothing to change', async () => {
    const data = new Map<string, unknown>([[STORAGE_KEYS.pantryItems, INITIAL_PANTRY]]);
    const { audit } = await launchApp(data);

    audit.setSelected('oats', true);
    audit.setSelected('rice', true);
    audit.setCountInput('oats', '0.0');
    audit.setCountInput('rice', '2');

    expect(await audit.applyAdjustments()).toBe(0);
    expect(data.get(STORAGE_KEYS.pantryItems)).toEqual(INITIAL_PANTRY);
  });
});
