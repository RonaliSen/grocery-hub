import { describe, expect, it } from 'vitest';

import { toLocalDateOnly } from '../../../core/utils/date.utils';
import {
  buildPlannerWeek,
  describeRelativeDay,
  describeWeekOffset,
  formatPlannerDate,
  formatWeekRange,
  parseDateOnly,
  shiftWeek,
  startOfWeek,
  weekOffsetFromToday
} from './meal-planner-week.util';

/** Local date (months are 1-based here for readability). */
function localDate(year: number, month: number, day: number, hours = 0): Date {
  return new Date(year, month - 1, day, hours);
}

describe('meal planner week utils', () => {
  describe('parseDateOnly', () => {
    it('parses a valid YYYY-MM-DD as local midnight', () => {
      expect(parseDateOnly('2025-11-17')?.getTime()).toBe(localDate(2025, 11, 17).getTime());
    });

    it.each([
      ['an empty value', ''],
      ['null', null],
      ['undefined', undefined],
      ['a non-date', 'tomorrow'],
      ['a partial date', '2025-11'],
      ['a date with a time', '2025-11-17T10:00'],
      ['a day that does not exist', '2025-02-30'],
      ['a month that does not exist', '2025-13-01']
    ])('returns null for %s', (_label, value) => {
      expect(parseDateOnly(value)).toBeNull();
    });

    it('accepts 29 February in a leap year only', () => {
      expect(parseDateOnly('2024-02-29')).not.toBeNull();
      expect(parseDateOnly('2025-02-29')).toBeNull();
    });
  });

  describe('startOfWeek', () => {
    it('returns the Monday of the week at local midnight', () => {
      // Wednesday afternoon
      expect(startOfWeek(localDate(2025, 11, 19, 15)).getTime()).toBe(localDate(2025, 11, 17).getTime());
    });

    it('keeps a Monday as the start of its own week', () => {
      expect(toLocalDateOnly(startOfWeek(localDate(2025, 11, 17)))).toBe('2025-11-17');
    });

    it('treats Sunday as the last day of the week, not the first', () => {
      expect(toLocalDateOnly(startOfWeek(localDate(2025, 11, 23)))).toBe('2025-11-17');
    });

    it('crosses month and year boundaries', () => {
      expect(toLocalDateOnly(startOfWeek(localDate(2026, 1, 1)))).toBe('2025-12-29');
    });
  });

  describe('shiftWeek', () => {
    it('moves forward and back by whole weeks', () => {
      const monday = localDate(2025, 11, 17);
      expect(toLocalDateOnly(shiftWeek(monday, 1))).toBe('2025-11-24');
      expect(toLocalDateOnly(shiftWeek(monday, -1))).toBe('2025-11-10');
      expect(toLocalDateOnly(shiftWeek(monday, 0))).toBe('2025-11-17');
    });

    it('stays on Monday across a daylight-saving change', () => {
      // Most of Europe switches clocks on the last Sunday of March / October.
      expect(toLocalDateOnly(shiftWeek(localDate(2026, 3, 23), 1))).toBe('2026-03-30');
      expect(toLocalDateOnly(shiftWeek(localDate(2025, 10, 27), -1))).toBe('2025-10-20');
    });
  });

  describe('buildPlannerWeek', () => {
    it('lists Monday to Sunday with their dates', () => {
      const week = buildPlannerWeek(localDate(2025, 12, 29), localDate(2025, 11, 1), 'en-GB');

      expect(week.map((day) => day.date)).toEqual([
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04'
      ]);
      expect(week.map((day) => day.weekdayShort)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      expect(week[0].weekday).toBe('Monday');
      expect(week[6].weekday).toBe('Sunday');
      expect(week.map((day) => day.dayOfMonth)).toEqual([29, 30, 31, 1, 2, 3, 4]);
      expect(week[3].fullDate).toBe('1 January 2026');
    });

    it('marks only today', () => {
      const week = buildPlannerWeek(localDate(2025, 11, 17), localDate(2025, 11, 19, 22), 'en-GB');

      expect(week.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2025-11-19']);
    });

    it('marks no day when today is in another week', () => {
      const week = buildPlannerWeek(localDate(2025, 11, 24), localDate(2025, 11, 19), 'en-GB');

      expect(week.some((day) => day.isToday)).toBe(false);
    });
  });

  describe('weekOffsetFromToday', () => {
    const today = localDate(2025, 11, 19);

    it('is 0 for the current week', () => {
      expect(weekOffsetFromToday(localDate(2025, 11, 17), today)).toBe(0);
    });

    it('counts whole weeks forward and back', () => {
      expect(weekOffsetFromToday(localDate(2025, 11, 24), today)).toBe(1);
      expect(weekOffsetFromToday(localDate(2025, 11, 10), today)).toBe(-1);
      expect(weekOffsetFromToday(localDate(2025, 12, 15), today)).toBe(4);
    });

    it('is not thrown off by a daylight-saving change', () => {
      expect(weekOffsetFromToday(localDate(2026, 4, 6), localDate(2026, 3, 25))).toBe(2);
    });
  });

  describe('describeWeekOffset', () => {
    it.each([
      [0, 'This week'],
      [1, 'Next week'],
      [-1, 'Last week'],
      [3, 'In 3 weeks'],
      [-2, '2 weeks ago']
    ])('describes an offset of %i as "%s"', (offset, label) => {
      expect(describeWeekOffset(offset)).toBe(label);
    });
  });

  describe('describeRelativeDay', () => {
    const today = localDate(2025, 11, 19, 21);

    it.each([
      [localDate(2025, 11, 19), 'Today'],
      [localDate(2025, 11, 20), 'Tomorrow'],
      [localDate(2025, 11, 18), 'Yesterday'],
      [localDate(2025, 11, 21), null],
      [localDate(2025, 11, 12), null]
    ])('describes %s relative to today', (date, label) => {
      expect(describeRelativeDay(date, today)).toBe(label);
    });
  });

  describe('formatting', () => {
    /**
     * ICU (bundled with Node) decides the exact typography of a range, and it changes between
     * versions — e.g. "17–23 Nov 2025" vs "17 – 23 Nov 2025", with thin or narrow no-break
     * spaces. Compare the content, not those details: any spaces become one plain space and any
     * dash, however spaced, becomes " – ".
     */
    function normalizeRange(range: string): string {
      return range
        .replace(/\s+/g, ' ')
        .replace(/ ?[-‐‑‒–—] ?/g, ' – ')
        .trim();
    }

    function occurrences(text: string, part: string): number {
      return text.split(part).length - 1;
    }

    it('formats a week inside one month compactly', () => {
      const range = formatWeekRange(localDate(2025, 11, 17), 'en-GB');

      expect(normalizeRange(range)).toBe('17 – 23 Nov 2025');
      // Compact: the month and year are written once, not for both ends.
      expect(occurrences(range, 'Nov')).toBe(1);
      expect(occurrences(range, '2025')).toBe(1);
    });

    it('names both months, but the year once, when a week spans two months', () => {
      const range = formatWeekRange(localDate(2026, 11, 30), 'en-GB');

      expect(normalizeRange(range)).toBe('30 Nov – 6 Dec 2026');
      expect(occurrences(range, '2026')).toBe(1);
    });

    it('names both months and years when a week spans the new year', () => {
      const range = formatWeekRange(localDate(2025, 12, 29), 'en-GB');

      expect(normalizeRange(range)).toBe('29 Dec 2025 – 4 Jan 2026');
    });

    it('normalizes the typography differences seen between ICU versions', () => {
      // U+2009 thin space, U+202F narrow no-break space, hyphen vs en dash.
      expect(normalizeRange('17–23 Nov 2025')).toBe('17 – 23 Nov 2025');
      expect(normalizeRange('17\u2009–\u200923 Nov 2025')).toBe('17 – 23 Nov 2025');
      expect(normalizeRange('17 - 23\u202fNov 2025')).toBe('17 – 23 Nov 2025');
    });

    it('formats a full day date', () => {
      expect(formatPlannerDate(localDate(2025, 11, 17), 'en-GB')).toBe('17 November 2025');
    });
  });
});
