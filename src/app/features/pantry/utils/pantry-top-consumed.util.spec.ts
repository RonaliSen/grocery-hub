import { PantryConsumptionActionType, PantryConsumptionLog } from '../models/pantry-consumption.model';
import { PantryItem } from '../models/pantry-item.model';
import { rankTopConsumedItems } from './pantry-top-consumed.util';

function item(id: string, name: string, unit: PantryItem['unit']): PantryItem {
  return {
    id,
    name,
    category: 'dairy',
    unit,
    quantity: 10,
    minQuantity: 0,
    avgDailyUsage: null,
    autoAddToShoppingList: false,
    expiryDate: null,
    germanStore: false,
    indianStore: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

let nextId = 0;
function log(
  itemId: string,
  actionType: PantryConsumptionActionType,
  amount: number,
  createdAt = '2026-03-01T08:00:00.000Z',
  extra: Partial<PantryConsumptionLog> = {}
): PantryConsumptionLog {
  nextId++;
  return { id: `log-${nextId}`, itemId, actionType, amount, previousQuantity: 0, nextQuantity: 0, createdAt, ...extra };
}

const rice = item('rice', 'Basmati Rice', 'kg');
const milk = item('milk', 'Oat Milk', 'count');
const oil = item('oil', 'Olive Oil', 'l');

describe('rankTopConsumedItems', () => {
  it('returns nothing when nothing has been used', () => {
    expect(rankTopConsumedItems([], [rice])).toEqual([]);
    expect(
      rankTopConsumedItems(
        [log('rice', 'increment', 2), log('rice', 'deleted', 2, undefined, { itemName: 'Basmati Rice', unit: 'kg' })],
        []
      )
    ).toEqual([]);
  });

  it('ranks items by total quantity used with name and unit', () => {
    const ranked = rankTopConsumedItems(
      [
        log('milk', 'decrement', 1),
        log('rice', 'decrement', 2),
        log('milk', 'decrement', 1),
        log('rice', 'empty', 1.5),
        log('oil', 'decrement', 0.5)
      ],
      [rice, milk, oil]
    );

    expect(ranked.map((entry) => [entry.itemName, entry.totalUsed, entry.unit, entry.quantityLabel])).toEqual([
      ['Basmati Rice', 3.5, 'kg', '3.5 kg'],
      ['Oat Milk', 2, 'count', '2 count'],
      ['Olive Oil', 0.5, 'l', '0.5 l']
    ]);
  });

  it('ignores restocks and deletions', () => {
    const ranked = rankTopConsumedItems(
      [
        log('rice', 'increment', 50),
        log('milk', 'deleted', 40, undefined, { itemName: 'Oat Milk', unit: 'count' }),
        log('milk', 'decrement', 1),
        log('rice', 'decrement', 2)
      ],
      [rice]
    );

    expect(ranked.map((entry) => [entry.itemId, entry.totalUsed])).toEqual([
      ['rice', 2],
      ['milk', 1]
    ]);
  });

  it('shows only the top 5', () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`item-${index}`, `Item ${index}`, 'count'));
    const logs = items.map((entry, index) => log(entry.id, 'decrement', index + 1));

    const ranked = rankTopConsumedItems(logs, items);

    expect(ranked.map((entry) => entry.itemName)).toEqual(['Item 6', 'Item 5', 'Item 4', 'Item 3', 'Item 2']);
  });

  it('breaks ties by most recent use, then by name', () => {
    const ranked = rankTopConsumedItems(
      [
        log('milk', 'decrement', 2, '2026-03-05T08:00:00.000Z'),
        log('rice', 'decrement', 2, '2026-03-01T08:00:00.000Z'),
        log('oil', 'decrement', 2, '2026-03-01T08:00:00.000Z')
      ],
      [rice, milk, oil]
    );

    expect(ranked.map((entry) => entry.itemName)).toEqual(['Oat Milk', 'Basmati Rice', 'Olive Oil']);
  });

  it('keeps deleted items with their name and unit, marked as deleted', () => {
    const ranked = rankTopConsumedItems(
      [
        log('gone', 'deleted', 0, '2026-03-05T08:00:00.000Z', { itemName: 'Brown Rice', unit: 'kg' }),
        log('gone', 'decrement', 3, '2026-03-04T08:00:00.000Z', { itemName: 'Brown Rice', unit: 'kg' }),
        log('legacy-gone', 'decrement', 1, '2026-03-03T08:00:00.000Z'),
        log('legacy-gone-2', 'decrement', 0.5, '2026-03-02T08:00:00.000Z'),
        log('legacy-gone-2', 'deleted', 0, '2026-03-02T09:00:00.000Z', { itemName: 'Greek Yogurt', unit: 'count' })
      ],
      []
    );

    expect(ranked.map((entry) => [entry.itemName, entry.quantityLabel, entry.isDeleted])).toEqual([
      ['Brown Rice', '3 kg', true],
      // Deleted before deletions were recorded: nothing tells us the name or unit.
      [null, '1', true],
      // Older use without a saved name: recovered from its deleted entry.
      ['Greek Yogurt', '0.5 count', true]
    ]);
  });

  it('totals each unit separately if an item changed unit', () => {
    const ranked = rankTopConsumedItems(
      [
        log('rice', 'decrement', 500, '2026-03-05T08:00:00.000Z', { itemName: 'Basmati Rice', unit: 'g' }),
        log('rice', 'decrement', 1, '2026-03-01T08:00:00.000Z', { itemName: 'Basmati Rice', unit: 'kg' }),
        log('rice', 'decrement', 1, '2026-03-02T08:00:00.000Z', { itemName: 'Basmati Rice', unit: 'kg' })
      ],
      [item('rice', 'Basmati Rice', 'g')]
    );

    expect(ranked.map((entry) => entry.quantityLabel)).toEqual(['500 g', '2 kg']);
  });

  it("uses the item's current name if it was renamed", () => {
    const ranked = rankTopConsumedItems(
      [
        log('rice', 'decrement', 1, '2026-03-01T08:00:00.000Z', { itemName: 'White Rice', unit: 'kg' }),
        log('rice', 'decrement', 1, '2026-03-02T08:00:00.000Z', { itemName: 'White Rice', unit: 'kg' })
      ],
      [rice]
    );

    expect(ranked).toEqual([
      expect.objectContaining({ itemName: 'Basmati Rice', totalUsed: 2, isDeleted: false, lastUsedAt: '2026-03-02T08:00:00.000Z' })
    ]);
  });

  it('adds decimal amounts without floating-point noise and skips bad entries', () => {
    const ranked = rankTopConsumedItems(
      [
        log('oil', 'decrement', 0.1),
        log('oil', 'decrement', 0.2),
        log('oil', 'decrement', Number.NaN),
        log('oil', 'decrement', -1),
        log('oil', 'decrement', 0)
      ],
      [oil]
    );

    expect(ranked.map((entry) => entry.quantityLabel)).toEqual(['0.3 l']);
  });
});
