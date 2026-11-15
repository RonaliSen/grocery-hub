import { describe, expect, it } from 'vitest';

import {
  auditQuantityDifference,
  formatAuditDifference,
  parseAuditQuantity
} from './pantry-audit.util';

describe('pantry-audit.util', () => {
  describe('parseAuditQuantity', () => {
    it('treats blank input as not yet counted', () => {
      expect(parseAuditQuantity('')).toEqual({ status: 'empty' });
      expect(parseAuditQuantity('   ')).toEqual({ status: 'empty' });
      expect(parseAuditQuantity(null)).toEqual({ status: 'empty' });
    });

    it('accepts zero', () => {
      expect(parseAuditQuantity('0')).toEqual({ status: 'valid', value: 0 });
      expect(parseAuditQuantity('0.0')).toEqual({ status: 'valid', value: 0 });
    });

    it('accepts whole and decimal numbers with "." or "," separators', () => {
      expect(parseAuditQuantity('12')).toEqual({ status: 'valid', value: 12 });
      expect(parseAuditQuantity(' 1.5 ')).toEqual({ status: 'valid', value: 1.5 });
      expect(parseAuditQuantity('1,5')).toEqual({ status: 'valid', value: 1.5 });
      expect(parseAuditQuantity('.5')).toEqual({ status: 'valid', value: 0.5 });
      expect(parseAuditQuantity('2.')).toEqual({ status: 'valid', value: 2 });
    });

    it('rejects negative numbers', () => {
      expect(parseAuditQuantity('-1')).toEqual({ status: 'invalid', reason: 'negative' });
      expect(parseAuditQuantity('-0.5')).toEqual({ status: 'invalid', reason: 'negative' });
    });

    it('rejects text that is not a number', () => {
      for (const value of ['abc', '1.2.3', '1e3', '+2', '2 kg', '.', '1,5,0']) {
        expect(parseAuditQuantity(value)).toEqual({ status: 'invalid', reason: 'not-a-number' });
      }
    });
  });

  describe('auditQuantityDifference', () => {
    it('is actual minus saved', () => {
      expect(auditQuantityDifference(2, 5)).toBe(3);
      expect(auditQuantityDifference(5, 2)).toBe(-3);
      expect(auditQuantityDifference(4, 4)).toBe(0);
      expect(auditQuantityDifference(3, 0)).toBe(-3);
    });

    it('removes floating-point noise from decimal quantities', () => {
      expect(auditQuantityDifference(1.2, 1.5)).toBe(0.3);
      expect(auditQuantityDifference(0.3, 0.1)).toBe(-0.2);
    });
  });

  describe('formatAuditDifference', () => {
    it('formats surplus, shortfall and no change with the unit', () => {
      expect(formatAuditDifference(2, 'kg')).toBe('+2 kg');
      expect(formatAuditDifference(-0.5, 'l')).toBe('\u22120.5 l');
      expect(formatAuditDifference(0, 'count')).toBe('No change');
    });
  });
});
