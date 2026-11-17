import { addDays, differenceInCalendarDays, toLocalDateOnly } from '../../../core/utils/date.utils';

/** One day of the planner week. */
export interface PlannerDay {
  /** Local `YYYY-MM-DD`, also used as the day's route segment. */
  readonly date: string;
  /** e.g. "Monday". */
  readonly weekday: string;
  /** e.g. "Mon". */
  readonly weekdayShort: string;
  /** Day of the month, e.g. 17. */
  readonly dayOfMonth: number;
  /** e.g. "17 November 2025". */
  readonly fullDate: string;
  readonly isToday: boolean;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Parses a local `YYYY-MM-DD` date. Returns null for anything malformed or for
 * dates that don't exist (e.g. `2025-02-30`), so a bad URL can't turn into a
 * silently shifted day.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value ?? '');
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** Monday (local midnight) of the week containing `date`. Weeks run Monday to Sunday. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % DAYS_PER_WEEK;
  return addDays(start, -daysSinceMonday);
}

/** `weekStart` moved by a whole number of weeks (negative = earlier). */
export function shiftWeek(weekStart: Date, weeks: number): Date {
  return addDays(weekStart, weeks * DAYS_PER_WEEK);
}

/** The seven days, Monday to Sunday, of the week starting at `weekStart`. */
export function buildPlannerWeek(
  weekStart: Date,
  today: Date = new Date(),
  locale?: string
): readonly PlannerDay[] {
  const todayKey = toLocalDateOnly(today);

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const day = addDays(weekStart, index);
    const date = toLocalDateOnly(day);

    return {
      date,
      weekday: day.toLocaleDateString(locale, { weekday: 'long' }),
      weekdayShort: day.toLocaleDateString(locale, { weekday: 'short' }),
      dayOfMonth: day.getDate(),
      fullDate: formatPlannerDate(day, locale),
      isToday: date === todayKey
    };
  });
}

/** Whole weeks between the current week and the one starting at `weekStart`. */
export function weekOffsetFromToday(weekStart: Date, today: Date = new Date()): number {
  const current = startOfWeek(today);
  const target = startOfWeek(weekStart);
  // Round: a daylight-saving change makes a week an hour shorter or longer.
  return Math.round((target.getTime() - current.getTime()) / (MS_PER_DAY * DAYS_PER_WEEK));
}

/** "This week", "Next week", "Last week", "In 3 weeks" or "3 weeks ago". */
export function describeWeekOffset(offset: number): string {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  return offset > 0 ? `In ${offset} weeks` : `${Math.abs(offset)} weeks ago`;
}

/** The week's date range, e.g. "17–23 Nov 2025" or "29 Dec 2025 – 4 Jan 2026" (locale-dependent). */
export function formatWeekRange(weekStart: Date, locale?: string): string {
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(
    weekStart,
    weekEnd
  );
}

/** "Today", "Tomorrow" or "Yesterday" for those days; null for any other day. */
export function describeRelativeDay(date: Date, today: Date = new Date()): string | null {
  switch (differenceInCalendarDays(toLocalDateOnly(date), today)) {
    case 0:
      return 'Today';
    case 1:
      return 'Tomorrow';
    case -1:
      return 'Yesterday';
    default:
      return null;
  }
}

/** A day's full date, e.g. "17 November 2025" (locale-dependent). */
export function formatPlannerDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
