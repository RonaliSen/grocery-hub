import { describe, expect, it } from 'vitest';

import {
  getPantryLowStockThreshold,
  getPantryStockStatus,
  isPantryItemBelowThreshold
} from './pantry-stock-status.util';

describe('pantry-stock-status.util', () => {
  it('treats gram-based items below 200g as low stock', () => {
    expect(
      isPantryItemBelowThreshold({
        quantity: 199,
        minQuantity: 50,
        unit: 'g',
        expiryDate: null
      })
    ).toBe(true);

    expect(
      isPantryItemBelowThreshold({
        quantity: 200,
        minQuantity: 50,
        unit: 'g',
        expiryDate: null
      })
    ).toBe(false);
  });

  it('treats liter-based items below 1l as low stock', () => {
    expect(
      isPantryItemBelowThreshold({
        quantity: 0.9,
        minQuantity: 0.25,
        unit: 'l',
        expiryDate: null
      })
    ).toBe(true);

    expect(
      isPantryItemBelowThreshold({
        quantity: 1,
        minQuantity: 0.25,
        unit: 'l',
        expiryDate: null
      })
    ).toBe(false);
  });

  it('still honors higher custom thresholds', () => {
    expect(
      getPantryLowStockThreshold({
        minQuantity: 300,
        unit: 'g'
      })
    ).toBe(300);

    expect(
      getPantryStockStatus({
        quantity: 250,
        minQuantity: 300,
        unit: 'g',
        expiryDate: new Date().toISOString().slice(0, 10)
      })
    ).toBe('low-stock');
  });

  it('uses the settings threshold as a higher global baseline', () => {
    expect(
      getPantryLowStockThreshold(
        {
          minQuantity: 2,
          unit: 'count'
        },
        5
      )
    ).toBe(5);

    expect(
      isPantryItemBelowThreshold(
        {
          quantity: 4,
          minQuantity: 2,
          unit: 'count',
          expiryDate: null
        },
        5
      )
    ).toBe(true);
  });
});
