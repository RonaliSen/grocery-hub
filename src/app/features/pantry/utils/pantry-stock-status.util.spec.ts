import { describe, expect, it } from 'vitest';

import {
  getPantryLowStockThreshold,
  getPantryStockStatus,
  isPantryItemBelowThreshold
} from './pantry-stock-status.util';

describe('pantry-stock-status.util', () => {
  it('treats quantity of 0 or 1 as low stock regardless of unit', () => {
    expect(
      isPantryItemBelowThreshold({
        quantity: 1,
        minQuantity: 50,
        unit: 'g',
        expiryDate: null
      })
    ).toBe(true);

    expect(
      isPantryItemBelowThreshold({
        quantity: 0,
        minQuantity: 0.25,
        unit: 'l',
        expiryDate: null
      })
    ).toBe(true);
  });

  it('still applies the unit floor threshold when quantity is above 1', () => {
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

  it('still applies the settings threshold when quantity is above 1', () => {
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
