import { PantryConsumptionActionType, PantryConsumptionLog } from '../models/pantry-consumption.model';
import { summarizePantryConsumption } from './pantry-consumption-summary.util';

let nextId = 0;
function log(itemId: string, actionType: PantryConsumptionActionType, amount: number): PantryConsumptionLog {
  nextId++;
  return {
    id: `log-${nextId}`,
    itemId,
    actionType,
    amount,
    previousQuantity: 0,
    nextQuantity: 0,
    createdAt: `2026-03-01T08:00:${String(nextId % 60).padStart(2, '0')}.000Z`
  };
}

describe('summarizePantryConsumption', () => {
  it('returns zeros when nothing has been recorded', () => {
    expect(summarizePantryConsumption([])).toEqual({ itemsConsumed: 0, unitsUsed: 0, itemsRestocked: 0 });
  });

  it('counts each used item once but adds up every amount used', () => {
    const summary = summarizePantryConsumption([
      log('milk', 'decrement', 1),
      log('milk', 'decrement', 1),
      log('rice', 'decrement', 2)
    ]);

    expect(summary.itemsConsumed).toBe(2);
    expect(summary.unitsUsed).toBe(4);
  });

  it('counts each restocked item once', () => {
    const summary = summarizePantryConsumption([
      log('milk', 'increment', 1),
      log('milk', 'increment', 1),
      log('eggs', 'increment', 1)
    ]);

    expect(summary.itemsRestocked).toBe(2);
  });

  it('keeps restocks out of consumption and consumption out of restocks', () => {
    const summary = summarizePantryConsumption([
      log('milk', 'increment', 3),
      log('rice', 'decrement', 1)
    ]);

    expect(summary).toEqual({ itemsConsumed: 1, unitsUsed: 1, itemsRestocked: 1 });
  });

  it('counts an item that was both used and restocked in both cards', () => {
    const summary = summarizePantryConsumption([
      log('milk', 'decrement', 1),
      log('milk', 'increment', 1)
    ]);

    expect(summary).toEqual({ itemsConsumed: 1, unitsUsed: 1, itemsRestocked: 1 });
  });

  it('treats emptying an item as using what was left', () => {
    const summary = summarizePantryConsumption([log('oil', 'empty', 0.75)]);

    expect(summary).toEqual({ itemsConsumed: 1, unitsUsed: 0.75, itemsRestocked: 0 });
  });

  it('adds decimal amounts without floating-point noise', () => {
    const summary = summarizePantryConsumption([
      log('oil', 'decrement', 0.1),
      log('oil', 'decrement', 0.2)
    ]);

    expect(summary.unitsUsed).toBe(0.3);
  });

  it('ignores malformed or zero entries from storage', () => {
    const summary = summarizePantryConsumption([
      log('milk', 'decrement', 0),
      log('milk', 'decrement', Number.NaN),
      log('eggs', 'increment', -1),
      { ...log('rice', 'decrement', 1), actionType: 'unknown' as PantryConsumptionActionType }
    ]);

    expect(summary).toEqual({ itemsConsumed: 0, unitsUsed: 0, itemsRestocked: 0 });
  });

  it('does not count deleting an item as consumption or restocking', () => {
    const before = [log('rice', 'decrement', 1), log('milk', 'increment', 1)];
    const after = [log('rice', 'deleted', 5), log('eggs', 'deleted', 12), ...before];

    expect(summarizePantryConsumption(after)).toEqual(summarizePantryConsumption(before));
    expect(summarizePantryConsumption(after)).toEqual({ itemsConsumed: 1, unitsUsed: 1, itemsRestocked: 1 });
  });
});
