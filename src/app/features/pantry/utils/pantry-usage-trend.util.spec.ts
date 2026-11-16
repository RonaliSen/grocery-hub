import { PantryConsumptionActionType, PantryConsumptionLog } from '../models/pantry-consumption.model';
import { buildUsageTrend, formatTrendValue } from './pantry-usage-trend.util';

// Local times, so the tests hold in any time zone.
const TODAY = new Date(2026, 2, 10, 15, 0); // Tue Mar 10, 2026, 3 PM local

let nextId = 0;
function log(actionType: PantryConsumptionActionType, amount: number, at: Date): PantryConsumptionLog {
  nextId++;
  return {
    id: `log-${nextId}`,
    itemId: 'rice',
    actionType,
    amount,
    previousQuantity: 0,
    nextQuantity: 0,
    createdAt: at.toISOString()
  };
}

describe('buildUsageTrend', () => {
  it('returns the last 7 days, oldest first, ending today', () => {
    const trend = buildUsageTrend([], TODAY);

    expect(trend.days.map((day) => day.date)).toEqual([
      '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'
    ]);
    expect(trend.days.map((day) => day.isToday)).toEqual([false, false, false, false, false, false, true]);
    expect(trend.days.map((day) => day.dayOfMonth)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(trend.days.at(-1)?.weekday).toBe(TODAY.toLocaleDateString(undefined, { weekday: 'short' }));
  });

  it('is all zeros when nothing was used', () => {
    const trend = buildUsageTrend([], TODAY);

    expect(trend.days.map((day) => day.units)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(trend.total).toBe(0);
    expect(trend.max).toBe(0);
  });

  it('adds up units used per day', () => {
    const trend = buildUsageTrend(
      [
        log('decrement', 1, new Date(2026, 2, 10, 9)),
        log('decrement', 2, new Date(2026, 2, 10, 12)),
        log('empty', 0.5, new Date(2026, 2, 8, 18)),
        log('decrement', 3, new Date(2026, 2, 4, 7))
      ],
      TODAY
    );

    expect(trend.days.map((day) => day.units)).toEqual([3, 0, 0, 0, 0.5, 0, 3]);
    expect(trend.total).toBe(6.5);
    expect(trend.max).toBe(3);
  });

  it('ignores restocks and deletions', () => {
    const trend = buildUsageTrend(
      [
        log('increment', 5, new Date(2026, 2, 10, 9)),
        log('deleted', 4, new Date(2026, 2, 10, 10)),
        log('decrement', 1, new Date(2026, 2, 10, 11))
      ],
      TODAY
    );

    expect(trend.days.at(-1)?.units).toBe(1);
    expect(trend.total).toBe(1);
  });

  it('leaves out activity older than 7 days or in the future', () => {
    const trend = buildUsageTrend(
      [
        log('decrement', 9, new Date(2026, 2, 3, 23, 59)), // day before the window
        log('decrement', 9, new Date(2026, 2, 11, 0, 1)), // tomorrow
        log('decrement', 1, new Date(2026, 2, 4, 0, 0)) // first minute of the window
      ],
      TODAY
    );

    expect(trend.total).toBe(1);
    expect(trend.days[0].units).toBe(1);
  });

  it('groups by local calendar day, right up to midnight', () => {
    const trend = buildUsageTrend(
      [log('decrement', 1, new Date(2026, 2, 9, 23, 59, 59)), log('decrement', 2, new Date(2026, 2, 10, 0, 0, 1))],
      TODAY
    );

    expect(trend.days.slice(-2).map((day) => day.units)).toEqual([1, 2]);
  });

  it('adds decimals without floating-point noise and skips bad entries', () => {
    const trend = buildUsageTrend(
      [
        log('decrement', 0.1, new Date(2026, 2, 10, 9)),
        log('decrement', 0.2, new Date(2026, 2, 10, 10)),
        log('decrement', Number.NaN, new Date(2026, 2, 10, 11)),
        log('decrement', -2, new Date(2026, 2, 10, 11)),
        { ...log('decrement', 5, new Date(2026, 2, 10, 11)), createdAt: 'not a date' }
      ],
      TODAY
    );

    expect(trend.days.at(-1)?.units).toBe(0.3);
    expect(trend.total).toBe(0.3);
  });

  it('handles a week that crosses a month boundary', () => {
    const trend = buildUsageTrend([], new Date(2026, 2, 2, 12));

    expect(trend.days.map((day) => day.date)).toEqual([
      '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'
    ]);
  });

  it('gives each day a short bar label', () => {
    const trend = buildUsageTrend(
      [log('decrement', 2.25, new Date(2026, 2, 10, 9)), log('decrement', 12345, new Date(2026, 2, 9, 9))],
      TODAY
    );

    expect(trend.days.slice(-2).map((day) => [day.units, day.valueLabel])).toEqual([
      [12345, '12K'],
      [2.25, '2.25']
    ]);
  });
});

describe('formatTrendValue', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [3, '3'],
    [0.5, '0.5'],
    [2.25, '2.25'],
    [0.333, '0.33'],
    [9.999, '10'],
    [12.5, '12.5'],
    [12.25, '12.3'],
    [99.96, '100'],
    [150, '150'],
    [999, '999'],
    [999.4, '999'],
    [999.6, '1K'],
    [1000, '1K'],
    [1500, '1.5K'],
    [9999.125, '10K'],
    [123456.75, '120K'],
    [2500000, '2.5M']
  ])('formats %s as %s', (units, label) => {
    expect(formatTrendValue(units)).toBe(label);
    expect(formatTrendValue(units).length).toBeLessThanOrEqual(4);
  });

  it('treats bad values as 0', () => {
    expect(formatTrendValue(Number.NaN)).toBe('0');
    expect(formatTrendValue(-3)).toBe('0');
  });
});
