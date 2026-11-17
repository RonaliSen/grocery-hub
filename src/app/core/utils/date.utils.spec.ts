import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { differenceInCalendarDays, toLocalDateOnly, todayDateOnly } from './date.utils';

/**
 * Runs `body` with the process in another timezone. Node applies a TZ change
 * immediately, so this works whatever timezone the test machine is in — which
 * matters: these bugs only show up when the local date and the UTC date differ.
 */
function inTimezone(timeZone: string, body: () => void): void {
  // Node's `process`, without pulling Node's types into the spec build.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const original = env['TZ'];
  env['TZ'] = timeZone;
  try {
    body();
  } finally {
    if (original === undefined) delete env['TZ'];
    else env['TZ'] = original;
  }
}

describe('date utils', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('todayDateOnly', () => {
    it.each([
      // Just after midnight ahead of UTC: the UTC date is still yesterday.
      ['Europe/Berlin', '2026-11-16T23:30:00.000Z', '2026-11-17'],
      ['Asia/Kolkata', '2026-11-16T19:00:00.000Z', '2026-11-17'],
      ['Pacific/Auckland', '2026-11-16T12:30:00.000Z', '2026-11-17'],
      // Evening behind UTC: the UTC date is already tomorrow.
      ['America/New_York', '2026-11-17T02:00:00.000Z', '2026-11-16'],
      ['America/Los_Angeles', '2026-11-17T07:30:00.000Z', '2026-11-16']
    ])('is the local calendar day in %s (at %s)', (timeZone, instant, expected) => {
      inTimezone(timeZone, () => {
        vi.setSystemTime(new Date(instant));
        expect(todayDateOnly()).toBe(expected);
      });
    });

    it('agrees with how expiry dates are compared (today is 0 days away)', () => {
      inTimezone('Asia/Kolkata', () => {
        vi.setSystemTime(new Date('2026-11-16T19:00:00.000Z'));
        expect(differenceInCalendarDays(todayDateOnly())).toBe(0);
      });
    });
  });

  describe('toLocalDateOnly', () => {
    it('formats the local date, zero-padded', () => {
      expect(toLocalDateOnly(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
  });
});
