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
    expect(formatCurrencyAmount(1234.5, 'GBP')).toContain('1,234.50');
    expect(formatCurrencyAmount(1234.5, 'GBP')).toContain('£');
  });
});
