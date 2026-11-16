import { addDays, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryConsumptionLog } from '../models/pantry-consumption.model';

export const USAGE_TREND_DAYS = 7;

export interface UsageTrendDay {
  /** Local calendar date, YYYY-MM-DD. */
  readonly date: string;
  /** Short weekday, e.g. "Mon". */
  readonly weekday: string;
  /** Day of the month, e.g. 10. */
  readonly dayOfMonth: number;
  /** Full label for screen readers, e.g. "Mon, Nov 10". */
  readonly fullLabel: string;
  readonly isToday: boolean;
  /** Units used that day. */
  readonly units: number;
  /** Short label for the bar, at most 4 characters (e.g. "2.25", "12.5", "123K"). */
  readonly valueLabel: string;
}

export interface UsageTrend {
  /** Oldest first, ending with today. */
  readonly days: readonly UsageTrendDay[];
  readonly total: number;
  /** Largest daily value (0 if nothing was used). */
  readonly max: number;
}

/**
 * Units used per local calendar day over the last `dayCount` days, today
 * included. Counts the same entries as "Units Used": "Use" (`decrement`) and
 * "mark empty" (`empty`). Restocks and deletions are ignored.
 */
export function buildUsageTrend(
  logs: readonly PantryConsumptionLog[],
  today: Date = new Date(),
  dayCount = USAGE_TREND_DAYS
): UsageTrend {
  const todayKey = toLocalDateOnly(today);
  const unitsByDate = new Map<string, number>();

  for (const log of logs) {
    if (log.actionType !== 'decrement' && log.actionType !== 'empty') {
      continue;
    }
    // Logs come from storage; skip anything that isn't a real, positive change.
    if (!Number.isFinite(log.amount) || log.amount <= 0) {
      continue;
    }
    const createdAt = new Date(log.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    const key = toLocalDateOnly(createdAt);
    unitsByDate.set(key, (unitsByDate.get(key) ?? 0) + log.amount);
  }

  const days: UsageTrendDay[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset--) {
    const day = addDays(today, -offset);
    const date = toLocalDateOnly(day);
    days.push({
      date,
      weekday: day.toLocaleDateString(undefined, { weekday: 'short' }),
      dayOfMonth: day.getDate(),
      fullLabel: day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      isToday: date === todayKey,
      units: roundUnits(unitsByDate.get(date) ?? 0),
      valueLabel: formatTrendValue(unitsByDate.get(date) ?? 0)
    });
  }

  return {
    days,
    total: roundUnits(days.reduce((sum, day) => sum + day.units, 0)),
    max: days.reduce((largest, day) => Math.max(largest, day.units), 0)
  };
}

const COMPACT_NUMBER = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 2 });

/**
 * Label for a bar. Chart columns are narrow on phones, so labels are kept to
 * at most 4 characters: whole numbers under 1000 and up to 2 decimals show as
 * they are ("3", "0.5", "2.25"); longer values are rounded ("12.5", "150")
 * and thousands are abbreviated to 2 significant digits ("1.5K", "12K",
 * "120K", "2.5M"). The exact value is
 * still given to screen readers.
 */
export function formatTrendValue(units: number): string {
  if (!Number.isFinite(units) || units <= 0) {
    return '0';
  }
  if (units >= 999.5) {
    return COMPACT_NUMBER.format(units);
  }

  const decimals = units < 10 ? 2 : units < 100 ? 1 : 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(units * factor) / factor;
  return rounded >= 1000 ? COMPACT_NUMBER.format(rounded) : String(rounded);
}

/** Drop floating-point noise from adding decimals (0.1 + 0.2 → 0.3). */
function roundUnits(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
