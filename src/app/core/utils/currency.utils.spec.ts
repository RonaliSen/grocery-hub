import { describe, expect, it } from 'vitest';

import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY_CODE,
  formatCurrencyAmount,
  getCurrencySymbol,
  isCurrencyCode,
  normalizeCurrencyCode
} from './currency.utils';

describe('currency utils', () => {
  it('exposes a broad supported currency list', () => {
    expect(CURRENCY_OPTIONS.map((option) => option.code)).toContain('INR');
    expect(CURRENCY_OPTIONS.map((option) => option.code)).toContain('GBP');
    expect(CURRENCY_OPTIONS.map((option) => option.code)).toContain('USD');
    expect(CURRENCY_OPTIONS.length).toBeGreaterThan(50);
  });

  it('normalizes and validates currency codes', () => {
    expect(normalizeCurrencyCode('gbp')).toBe('GBP');
    expect(normalizeCurrencyCode(' invalid ')).toBe(DEFAULT_CURRENCY_CODE);
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('ZZZ')).toBe(false);
  });

  it('formats amounts with the selected currency symbol', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    // Amounts follow the device's locale (e.g. "£1,234.50" in English, "1.234,50 £" in German),
    // so check the symbol and the digits rather than one locale's separators.
    const formatted = formatCurrencyAmount(1234.5, 'GBP');
    expect(formatted).toContain('£');
    expect(formatted).toMatch(/1\D?234\D50/);
  });
});
