import { describe, expect, it } from 'vitest';

import { PantryItem } from '../../pantry/models/pantry-item.model';
import { getPantryExpiryStatus } from '../../pantry/utils/pantry-expiry.util';
import {
  countForFilter,
  dateInDays,
  describeDaysLeft,
  describeLeadDays,
  expiryBucketLabel,
  formatExpiryDate,
  getExpiryBucket,
  getExpiryTone,
  groupExpiryEntries,
  isValidRestockDate,
  suggestedRestockDate,
  summarizeExpiry,
  toExpiryEntry
} from './expiry-tracker.util';

const TODAY = new Date(2026, 2, 10, 15, 30); // 10 Mar 2026, mid-afternoon local time

function createItem(name: string, expiryDate: string | null, quantity = 1): PantryItem {
  return {
    id: `item-${name.toLowerCase()}`,
    name,
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
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z'
  };
}

function entriesFor(items: PantryItem[], leadDays = 7) {
  return items.map((item) => toExpiryEntry(item, leadDays, TODAY));
}

describe('getExpiryBucket', () => {
  it('maps days until expiry onto timeline buckets', () => {
    expect(getExpiryBucket(null, 7)).toBe('no-date');
    expect(getExpiryBucket(-1, 7)).toBe('expired');
    expect(getExpiryBucket(0, 7)).toBe('today');
    expect(getExpiryBucket(1, 7)).toBe('tomorrow');
    expect(getExpiryBucket(2, 7)).toBe('soon');
    expect(getExpiryBucket(7, 7)).toBe('soon');
    expect(getExpiryBucket(8, 7)).toBe('later');
  });

  it('uses the chosen reminder lead time as the "expiring soon" window', () => {
    expect(getExpiryBucket(3, 3)).toBe('soon');
    expect(getExpiryBucket(4, 3)).toBe('later');

    // 1 day: only today and tomorrow are "soon"; nothing falls in the soon group.
    expect(getExpiryBucket(0, 1)).toBe('today');
    expect(getExpiryBucket(1, 1)).toBe('tomorrow');
    expect(getExpiryBucket(2, 1)).toBe('later');

    // Expired and undated items don't depend on the window.
    expect(getExpiryBucket(-1, 1)).toBe('expired');
    expect(getExpiryBucket(null, 3)).toBe('no-date');
  });
});

describe('getExpiryTone', () => {
  it('uses danger for expired/today, warn for the coming week, ok for later', () => {
    expect(getExpiryTone('expired')).toBe('danger');
    expect(getExpiryTone('today')).toBe('danger');
    expect(getExpiryTone('tomorrow')).toBe('warn');
    expect(getExpiryTone('soon')).toBe('warn');
    expect(getExpiryTone('later')).toBe('ok');
    expect(getExpiryTone('no-date')).toBe('muted');
    expect(getExpiryTone('used-up')).toBe('muted');
  });
});

describe('toExpiryEntry', () => {
  it('counts calendar days from the local day, ignoring the time of day', () => {
    expect(toExpiryEntry(createItem('Milk', '2026-03-10'), 7, TODAY)).toMatchObject({ daysUntil: 0, bucket: 'today' });
    expect(toExpiryEntry(createItem('Milk', '2026-03-09'), 7, TODAY)).toMatchObject({ daysUntil: -1, bucket: 'expired' });
    expect(toExpiryEntry(createItem('Milk', '2026-03-17'), 7, TODAY)).toMatchObject({ daysUntil: 7, bucket: 'soon' });
    expect(toExpiryEntry(createItem('Milk', null), 7, TODAY)).toMatchObject({ daysUntil: null, bucket: 'no-date' });
  });

  it('treats items with nothing left as used up, whatever their date', () => {
    expect(toExpiryEntry(createItem('Milk', '2026-03-01', 0), 7, TODAY)).toMatchObject({ daysUntil: -9, bucket: 'used-up' });
    expect(toExpiryEntry(createItem('Milk', '2026-03-12', 0), 7, TODAY)).toMatchObject({ bucket: 'used-up' });
    expect(toExpiryEntry(createItem('Milk', null, 0), 7, TODAY)).toMatchObject({ bucket: 'used-up' });
    expect(toExpiryEntry(createItem('Milk', '2026-03-01', 0.5), 7, TODAY)).toMatchObject({ bucket: 'expired' });
  });
});

describe('lead time labels', () => {
  it('names the soon group after the window', () => {
    expect(expiryBucketLabel('soon', 7)).toBe('Within a week');
    expect(expiryBucketLabel('soon', 3)).toBe('Within 3 days');
    expect(expiryBucketLabel('today', 3)).toBe('Today');
    expect(expiryBucketLabel('used-up', 1)).toBe('Used up');
  });

  it('describes the window', () => {
    expect(describeLeadDays(1)).toBe('1 day');
    expect(describeLeadDays(3)).toBe('3 days');
    expect(describeLeadDays(7)).toBe('7 days');
  });
});

describe('expiring-soon counts follow the lead time', () => {
  const items = [
    createItem('Today', '2026-03-10'),
    createItem('Tomorrow', '2026-03-11'),
    createItem('ThreeDays', '2026-03-13'),
    createItem('FiveDays', '2026-03-15'),
    createItem('SevenDays', '2026-03-17'),
    createItem('TwoWeeks', '2026-03-24')
  ];

  it.each([
    [1, 2, 4],
    [3, 3, 3],
    [7, 5, 1]
  ])('%i day(s): %i expiring soon, %i fresh', (leadDays, expiring, fresh) => {
    const summary = summarizeExpiry(entriesFor(items, leadDays));

    expect(summary.expiring).toBe(expiring);
    expect(summary.fresh).toBe(fresh);
  });

  it('labels the soon group for a 3-day window', () => {
    const groups = groupExpiryEntries(entriesFor(items, 3), 3);

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Tomorrow', 'Within 3 days', 'Later']);
  });
});

describe('summarizeExpiry / countForFilter', () => {
  const entries = entriesFor([
    createItem('Expired', '2026-03-01'),
    createItem('Today', '2026-03-10'),
    createItem('Tomorrow', '2026-03-11'),
    createItem('Week', '2026-03-15'),
    createItem('Later', '2026-05-01'),
    createItem('Undated', null),
    createItem('Finished', '2026-03-02', 0)
  ]);

  it('tallies each status once, keeping used-up items out of the expiry counts', () => {
    expect(summarizeExpiry(entries)).toEqual({
      total: 7,
      inStock: 6,
      tracked: 5,
      expired: 1,
      expiring: 3,
      fresh: 1,
      noDate: 1,
      usedUp: 1
    });
  });

  it('returns the pill count for each filter', () => {
    const summary = summarizeExpiry(entries);

    expect(countForFilter(summary, 'all')).toBe(7);
    expect(countForFilter(summary, 'expired')).toBe(1);
    expect(countForFilter(summary, 'expiring')).toBe(3);
    expect(countForFilter(summary, 'fresh')).toBe(1);
    expect(countForFilter(summary, 'no-date')).toBe(1);
    expect(countForFilter(summary, 'used-up')).toBe(1);
  });

  it('handles an empty pantry', () => {
    expect(summarizeExpiry([])).toEqual({
      total: 0,
      inStock: 0,
      tracked: 0,
      expired: 0,
      expiring: 0,
      fresh: 0,
      noDate: 0,
      usedUp: 0
    });
  });
});

describe('groupExpiryEntries', () => {
  const entries = entriesFor([
    createItem('Yogurt', '2026-03-14'),
    createItem('Rice', null),
    createItem('Cheese', '2026-03-12'),
    createItem('Beans', null),
    createItem('Milk', '2026-03-05'),
    createItem('Eggs', '2026-03-08'),
    createItem('Apples', '2026-03-12'),
    createItem('Tofu', '2026-03-01', 0),
    createItem('Butter', '2026-04-01', 0)
  ]);

  it('orders groups along the timeline and skips empty ones', () => {
    const groups = groupExpiryEntries(entries, 7);

    expect(groups.map((group) => group.bucket)).toEqual(['expired', 'soon', 'no-date', 'used-up']);
    expect(groups.map((group) => group.label)).toEqual(['Expired', 'Within a week', 'No expiry date', 'Used up']);
  });

  it('sorts dated items soonest first (ties by name), undated and used-up items by name', () => {
    const groups = groupExpiryEntries(entries, 7);
    const names = (bucket: string) =>
      groups.find((group) => group.bucket === bucket)?.entries.map((entry) => entry.item.name);

    expect(names('expired')).toEqual(['Milk', 'Eggs']);
    expect(names('soon')).toEqual(['Apples', 'Cheese', 'Yogurt']);
    expect(names('no-date')).toEqual(['Beans', 'Rice']);
    expect(names('used-up')).toEqual(['Butter', 'Tofu']);
  });

  it('limits the groups to the selected filter', () => {
    expect(groupExpiryEntries(entries, 7, 'expired').map((group) => group.bucket)).toEqual(['expired']);
    expect(groupExpiryEntries(entries, 7, 'expiring').map((group) => group.bucket)).toEqual(['soon']);
    expect(groupExpiryEntries(entries, 7, 'fresh')).toEqual([]);
    expect(groupExpiryEntries(entries, 7, 'used-up').map((group) => group.bucket)).toEqual(['used-up']);
  });
});

describe('describeDaysLeft', () => {
  it('builds short badge copy', () => {
    expect(describeDaysLeft(null)).toEqual({ value: '—', caption: 'no date' });
    expect(describeDaysLeft(0)).toEqual({ value: 'Today', caption: 'use now' });
    expect(describeDaysLeft(1)).toEqual({ value: '1', caption: 'day left' });
    expect(describeDaysLeft(5)).toEqual({ value: '5', caption: 'days left' });
    expect(describeDaysLeft(-1)).toEqual({ value: '1', caption: 'day ago' });
    expect(describeDaysLeft(-3)).toEqual({ value: '3', caption: 'days ago' });
  });
});

describe('formatExpiryDate', () => {
  it('formats the local calendar date and only adds the year when it differs', () => {
    const sameYear = formatExpiryDate('2026-03-12', TODAY);
    const nextYear = formatExpiryDate('2027-01-05', TODAY);

    expect(sameYear).toContain('12');
    expect(sameYear).not.toContain('2026');
    expect(nextYear).toContain('2027');
  });

  it('returns the raw value for malformed dates', () => {
    expect(formatExpiryDate('not-a-date', TODAY)).toBe('not-a-date');
  });
});

describe('restock date helpers', () => {
  it('builds local dates relative to today', () => {
    expect(dateInDays(0, TODAY)).toBe('2026-03-10');
    expect(dateInDays(7, TODAY)).toBe('2026-03-17');
    expect(dateInDays(30, TODAY)).toBe('2026-04-09');
  });

  it('suggests keeping a date that is still ahead, and a blank one otherwise', () => {
    expect(suggestedRestockDate({ expiryDate: '2026-03-15' }, TODAY)).toBe('2026-03-15');
    expect(suggestedRestockDate({ expiryDate: '2026-03-10' }, TODAY)).toBe('2026-03-10');
    expect(suggestedRestockDate({ expiryDate: '2026-03-09' }, TODAY)).toBe('');
    expect(suggestedRestockDate({ expiryDate: null }, TODAY)).toBe('');
  });

  it('accepts blank, today or future dates only', () => {
    expect(isValidRestockDate('', TODAY)).toBe(true);
    expect(isValidRestockDate('2026-03-10', TODAY)).toBe(true);
    expect(isValidRestockDate('2026-12-31', TODAY)).toBe(true);
    expect(isValidRestockDate('2026-03-09', TODAY)).toBe(false);
    expect(isValidRestockDate('soon', TODAY)).toBe(false);
  });
});

describe('consistency with My Pantry', () => {
  const items = [
    createItem('LongGone', '2026-02-20'),
    createItem('Yesterday', '2026-03-09'),
    createItem('Today', '2026-03-10'),
    createItem('Tomorrow', '2026-03-11'),
    createItem('TwoDays', '2026-03-12'),
    createItem('ThreeDays', '2026-03-13'),
    createItem('FourDays', '2026-03-14'),
    createItem('SevenDays', '2026-03-17'),
    createItem('EightDays', '2026-03-18'),
    createItem('NextYear', '2027-01-01'),
    createItem('Undated', null),
    createItem('UsedUpExpired', '2026-03-01', 0),
    createItem('UsedUpSoon', '2026-03-11', 0),
    createItem('HalfLeft', '2026-03-12', 0.5)
  ];

  it.each([1, 3, 7])('counts exactly what the Pantry screen counts with a %i-day lead time', (leadDays) => {
    const tracker = summarizeExpiry(entriesFor(items, leadDays));
    const pantry = items.map((item) => getPantryExpiryStatus(item, leadDays, TODAY));
    const count = (status: string) => pantry.filter((entry) => entry === status).length;

    expect(tracker.expired).toBe(count('expired'));
    expect(tracker.expiring).toBe(count('expiring'));
    expect(tracker.fresh).toBe(count('fresh'));
    expect(tracker.noDate).toBe(count('no-date'));
    expect(tracker.usedUp).toBe(count('used-up'));
  });
});

