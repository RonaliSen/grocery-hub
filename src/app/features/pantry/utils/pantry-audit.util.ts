import { formatQuantity } from '../../../core/utils/quantity.utils';
import { QuantityUnit } from '../models/pantry-item.model';

export type AuditQuantityInput =
  | { readonly status: 'empty' }
  | { readonly status: 'invalid'; readonly reason: 'negative' | 'not-a-number' }
  | { readonly status: 'valid'; readonly value: number };

/** Non-negative decimal; accepts "." or "," as the decimal separator (e.g. "1.5", "1,5", ".5"). */
const NON_NEGATIVE_DECIMAL = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
/** Rounds away floating-point noise such as 1.5 - 1.2 = 0.30000000000000004. */
const PRECISION = 1000;

/**
 * Parses what the user typed as an actual (counted) quantity.
 * Zero is valid; negative numbers and non-numeric text are rejected.
 */
export function parseAuditQuantity(raw: string | null | undefined): AuditQuantityInput {
  const text = (raw ?? '').trim();

  if (text === '') {
    return { status: 'empty' };
  }

  if (text.startsWith('-')) {
    return { status: 'invalid', reason: 'negative' };
  }

  if (!NON_NEGATIVE_DECIMAL.test(text)) {
    return { status: 'invalid', reason: 'not-a-number' };
  }

  return { status: 'valid', value: Number(text.replace(',', '.')) };
}

/** Actual minus saved: positive means you have more than the app thinks, negative means less. */
export function auditQuantityDifference(savedQuantity: number, actualQuantity: number): number {
  return Math.round((actualQuantity - savedQuantity) * PRECISION) / PRECISION;
}

/** e.g. "+2 kg", "−0.5 l", or "No change". */
export function formatAuditDifference(difference: number, unit: QuantityUnit): string {
  if (difference === 0) {
    return 'No change';
  }

  const sign = difference > 0 ? '+' : '\u2212';
  return `${sign}${formatQuantity(Math.abs(difference), unit)}`;
}
