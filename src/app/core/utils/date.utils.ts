function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, '0');
}

function toDayBoundary(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

export function toLocalDateOnly(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function differenceInCalendarDays(targetDate: string, start = new Date()): number {
  const target = toDayBoundary(targetDate);
  const from = toDayBoundary(start);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - from.getTime()) / millisecondsPerDay);
}

export function isExpired(targetDate: string): boolean {
  return differenceInCalendarDays(targetDate) < 0;
}

export function isExpiringWithin(targetDate: string, withinDays: number): boolean {
  const daysUntil = differenceInCalendarDays(targetDate);
  return daysUntil >= 0 && daysUntil <= withinDays;
}

export function scheduleAtLocalHour(dateOnly: string, hour: number): Date {
  const scheduledAt = new Date(`${dateOnly}T00:00:00`);
  scheduledAt.setHours(hour, 0, 0, 0);
  return scheduledAt;
}

export function nextOccurrenceAtHour(hour: number, from = new Date()): Date {
  const next = new Date(from);
  next.setHours(hour, 0, 0, 0);

  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function toDateInputValue(value: string | null): string {
  return value ?? '';
}
