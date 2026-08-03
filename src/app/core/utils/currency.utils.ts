export interface CurrencyOption {
  readonly code: string;
  readonly label: string;
  readonly symbol: string;
}

export type CurrencyCode = string;

export const DEFAULT_CURRENCY_CODE: CurrencyCode = 'EUR';

const FALLBACK_CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK'] as const;
const CURRENCY_NAME_DISPLAY = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'currency' })
  : null;

const CURRENCY_SYMBOL_OVERRIDES: Readonly<Record<string, string>> = {
  AUD: 'A$',
  CAD: 'CA$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  USD: '$'
};

const SUPPORTED_CURRENCY_CODES = (() => {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('currency')
      .map((code) => code.toUpperCase())
      .filter((code, index, values) => /^[A-Z]{3}$/.test(code) && values.indexOf(code) === index);
  }
  return [...FALLBACK_CURRENCY_CODES];
})();

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = [...SUPPORTED_CURRENCY_CODES]
  .map((code) => ({
    code,
    label: getCurrencyLabel(code),
    symbol: getCurrencySymbolFromIntl(code)
  }))
  .sort((left, right) => left.label.localeCompare(right.label));

const CURRENCY_SYMBOL_MAP = new Map<string, string>(CURRENCY_OPTIONS.map((option) => [option.code, option.symbol] as const));

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function getCurrencyLabel(code: string): string {
  return CURRENCY_NAME_DISPLAY?.of(code) ?? code;
}

function getCurrencySymbolFromIntl(code: string): string {
  const override = CURRENCY_SYMBOL_OVERRIDES[code];
  if (override) {
    return override;
  }

  try {
    const currencyPart = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;

    return currencyPart?.trim() || code;
  } catch {
    return code;
  }
}

export function normalizeCurrencyCode(value: string | null | undefined): CurrencyCode {
  const normalized = value?.trim().toUpperCase();
  return isCurrencyCode(normalized) ? normalized : DEFAULT_CURRENCY_CODE;
}

export function isCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return CURRENCY_OPTIONS.some((option) => option.code === value);
}

export function getCurrencySymbol(currency: string | null | undefined): string {
  const normalized = normalizeCurrencyCode(currency);
  return CURRENCY_SYMBOL_MAP.get(normalized) ?? normalized;
}

export function formatCurrencyAmount(amount: number, currency: string | null | undefined): string {
  const normalized = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${getCurrencySymbol(normalized)}${NUMBER_FORMAT.format(amount)}`;
  }
}
