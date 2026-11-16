import { describe, expect, it } from 'vitest';

import { getExpiryDateTone, getPantryExpiryStatus } from './pantry-expiry.util';

// Tue 10 Mar 2026, late afternoon local time.
const TODAY = new Date(2026, 2, 10, 17, 45);

const item = (expiryDate: string | null, quantity = 1) => ({ expiryDate, quantity });

describe('getPantryExpiryStatus', () => {
  it('classifies by calendar days against the lead time', () => {
    expect(getPantryExpiryStatus(item('2026-03-09'), 3, TODAY)).toBe('expired');
    expect(getPantryExpiryStatus(item('2026-03-10'), 3, TODAY)).toBe('expiring');
    expect(getPantryExpiryStatus(item('2026-03-13'), 3, TODAY)).toBe('expiring');
    expect(getPantryExpiryStatus(item('2026-03-14'), 3, TODAY)).toBe('fresh');
    expect(getPantryExpiryStatus(item(null), 3, TODAY)).toBe('no-date');
  });

  it.each([
    [1, ['expiring', 'expiring', 'fresh', 'fresh', 'fresh']],
    [3, ['expiring', 'expiring', 'expiring', 'fresh', 'fresh']],
    [7, ['expiring', 'expiring', 'expiring', 'expiring', 'fresh']]
  ])('with a %i-day lead time', (leadDays, expected) => {
    const dates = ['2026-03-10', '2026-03-11', '2026-03-13', '2026-03-17', '2026-03-18'];

    expect(dates.map((date) => getPantryExpiryStatus(item(date), leadDays, TODAY))).toEqual(expected);
  });

  it('treats items with nothing left as used up, whatever their date', () => {
    expect(getPantryExpiryStatus(item('2026-03-01', 0), 3, TODAY)).toBe('used-up');
    expect(getPantryExpiryStatus(item('2026-03-11', 0), 3, TODAY)).toBe('used-up');
    expect(getPantryExpiryStatus(item(null, 0), 3, TODAY)).toBe('used-up');
    expect(getPantryExpiryStatus(item('2026-03-01', 0.25), 3, TODAY)).toBe('expired');
  });
});

describe('getExpiryDateTone', () => {
  it('follows the lead time', () => {
    expect(getExpiryDateTone('2026-03-15', 3, TODAY)).toBe('muted');
    expect(getExpiryDateTone('2026-03-15', 7, TODAY)).toBe('warning');
    expect(getExpiryDateTone('2026-03-11', 1, TODAY)).toBe('warning');
    expect(getExpiryDateTone('2026-03-12', 1, TODAY)).toBe('muted');
  });

  it('marks past dates as danger and missing dates as muted', () => {
    expect(getExpiryDateTone('2026-03-09', 3, TODAY)).toBe('danger');
    expect(getExpiryDateTone(null, 3, TODAY)).toBe('muted');
  });

  it('treats an item expiring today as expiring, not expired, late in the day (regression)', () => {
    expect(getExpiryDateTone('2026-03-10', 1, TODAY)).toBe('warning');
    expect(getExpiryDateTone('2026-03-10', 3, new Date(2026, 2, 10, 23, 59))).toBe('warning');
  });
});
