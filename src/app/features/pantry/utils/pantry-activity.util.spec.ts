import { PantryConsumptionActionType, PantryConsumptionLog } from '../models/pantry-consumption.model';
import { PantryItem } from '../models/pantry-item.model';
import { buildPantryActivity, formatActivityDateTime } from './pantry-activity.util';

function item(id: string, name: string, unit: PantryItem['unit']): PantryItem {
  return {
    id,
    name,
    category: 'dairy',
    unit,
    quantity: 1,
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

function log(
  id: string,
  itemId: string,
  actionType: PantryConsumptionActionType,
  amount: number,
  createdAt = '2026-03-01T08:00:00.000Z',
  extra: Partial<PantryConsumptionLog> = {}
): PantryConsumptionLog {
  return { id, itemId, actionType, amount, previousQuantity: 0, nextQuantity: 0, createdAt, ...extra };
}

describe('buildPantryActivity', () => {
  const items = [item('rice', 'Basmati Rice', 'kg'), item('milk', 'Oat Milk', 'count')];

  it('returns nothing when there is no history', () => {
    expect(buildPantryActivity([], items)).toEqual([]);
  });

  it('shows the item name, action, signed quantity with unit and date', () => {
    const [used, restocked] = buildPantryActivity(
      [
        log('a', 'rice', 'decrement', 0.5, '2026-03-02T09:30:00.000Z'),
        log('b', 'milk', 'increment', 2, '2026-03-01T08:00:00.000Z')
      ],
      items
    );

    expect(used).toEqual({
      id: 'a',
      itemId: 'rice',
      itemName: 'Basmati Rice',
      kind: 'used',
      quantityLabel: '−0.5 kg',
      createdAt: '2026-03-02T09:30:00.000Z',
      dateTimeLabel: formatActivityDateTime('2026-03-02T09:30:00.000Z')
    });
    expect(restocked).toEqual(
      expect.objectContaining({ itemName: 'Oat Milk', kind: 'restocked', quantityLabel: '+2 count' })
    );
  });

  it('keeps the history order (newest first from the service)', () => {
    const entries = buildPantryActivity(
      [log('newest', 'rice', 'decrement', 1), log('middle', 'milk', 'increment', 1), log('oldest', 'rice', 'decrement', 1)],
      items
    );

    expect(entries.map((entry) => entry.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('shows emptying an item as used', () => {
    const [entry] = buildPantryActivity([log('a', 'rice', 'empty', 1.25)], items);

    expect(entry).toEqual(expect.objectContaining({ kind: 'used', quantityLabel: '−1.25 kg' }));
  });

  it('falls back to no name or unit only when nothing records them', () => {
    // An item deleted before deletions were recorded, with no saved name.
    const [entry] = buildPantryActivity([log('a', 'gone', 'decrement', 1)], items);

    expect(entry).toEqual(expect.objectContaining({ itemName: null, kind: 'used', quantityLabel: '−1' }));
  });

  describe('deleted items', () => {
    const deletedRice = log('del', 'rice-old', 'deleted', 2, '2026-03-05T10:00:00.000Z', {
      itemName: 'Brown Rice',
      unit: 'kg'
    });

    it('shows a Deleted entry with the original name and no quantity change', () => {
      const [entry] = buildPantryActivity([deletedRice], items);

      expect(entry).toEqual({
        id: 'del',
        itemId: 'rice-old',
        itemName: 'Brown Rice',
        kind: 'deleted',
        quantityLabel: null,
        createdAt: '2026-03-05T10:00:00.000Z',
        dateTimeLabel: formatActivityDateTime('2026-03-05T10:00:00.000Z')
      });
    });

    it('shows a Deleted entry even if the item had nothing left', () => {
      const [entry] = buildPantryActivity(
        [log('del', 'x', 'deleted', 0, '2026-03-05T10:00:00.000Z', { itemName: 'Empty Jar', unit: 'count' })],
        items
      );

      expect(entry).toEqual(expect.objectContaining({ kind: 'deleted', itemName: 'Empty Jar' }));
    });

    it('keeps the original name and unit on earlier entries saved with them', () => {
      const entries = buildPantryActivity(
        [
          deletedRice,
          log('used', 'rice-old', 'decrement', 0.5, '2026-03-04T10:00:00.000Z', { itemName: 'Brown Rice', unit: 'kg' }),
          log('restocked', 'rice-old', 'increment', 1, '2026-03-03T10:00:00.000Z', { itemName: 'Brown Rice', unit: 'kg' })
        ],
        items
      );

      expect(entries.map((entry) => [entry.kind, entry.itemName, entry.quantityLabel])).toEqual([
        ['deleted', 'Brown Rice', null],
        ['used', 'Brown Rice', '−0.5 kg'],
        ['restocked', 'Brown Rice', '+1 kg']
      ]);
    });

    it('recovers the name and unit for older entries recorded without them', () => {
      const entries = buildPantryActivity(
        [deletedRice, log('legacy', 'rice-old', 'decrement', 1, '2026-03-01T10:00:00.000Z')],
        items
      );

      expect(entries[1]).toEqual(expect.objectContaining({ itemName: 'Brown Rice', quantityLabel: '−1 kg' }));
    });
  });

  it('keeps the name and unit from the time of the activity if the item changed since', () => {
    const [entry] = buildPantryActivity(
      [log('a', 'rice', 'decrement', 1, '2026-03-01T08:00:00.000Z', { itemName: 'White Rice', unit: 'count' })],
      items // now "Basmati Rice" in kg
    );

    expect(entry).toEqual(expect.objectContaining({ itemName: 'White Rice', quantityLabel: '−1 count' }));
  });

  it('skips malformed entries from storage', () => {
    const entries = buildPantryActivity(
      [
        log('zero', 'rice', 'decrement', 0),
        log('nan', 'rice', 'decrement', Number.NaN),
        log('unknown', 'rice', 'mystery' as PantryConsumptionActionType, 1),
        log('ok', 'rice', 'decrement', 1)
      ],
      items
    );

    expect(entries.map((entry) => entry.id)).toEqual(['ok']);
  });
});

describe('formatActivityDateTime', () => {
  it('formats a timestamp with date and time in local time', () => {
    const value = '2026-03-02T09:30:00.000Z';
    const expected = new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    expect(formatActivityDateTime(value)).toBe(expected);
    expect(formatActivityDateTime(value)).toMatch(/2026/);
  });

  it('handles an unreadable timestamp', () => {
    expect(formatActivityDateTime('not a date')).toBe('Unknown time');
  });
});
