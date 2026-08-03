import { CATEGORY_FILTER_ORDER } from '../../../core/constants/app-config';
import { CurrencyCode } from '../../../core/utils/currency.utils';
import { PantryCategory } from '../../pantry/models/pantry-item.model';

export const EXPENSE_CATEGORIES = [...CATEGORY_FILTER_ORDER] as const;

export type ExpenseCategory = PantryCategory;

export const EXPENSE_PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Other'] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export interface Expense {
  readonly id: string;
  readonly title: string;
  readonly amount: number;
  readonly category: ExpenseCategory;
  readonly quantity?: number;
  readonly discount?: number;
  readonly totalAmount?: number;
  readonly unitPrice?: number;
  readonly purchaseRecordId?: string;
  readonly store?: string;
  readonly paymentMethod?: ExpensePaymentMethod;
  readonly notes?: string;
  readonly receiptImageUrl?: string;
  readonly itemImageUrl?: string;
  readonly date: string;
  readonly budgetCycleId?: string;
}

export interface ExpenseDraft {
  readonly title: string;
  readonly amount: number;
  readonly quantity: number;
  readonly discount: number;
  readonly category: ExpenseCategory;
  readonly store?: string;
  readonly paymentMethod?: ExpensePaymentMethod;
  readonly notes?: string;
  readonly receiptImageUrl?: string;
  readonly itemImageUrl?: string;
  readonly date: string;
}

export interface Budget {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export type BudgetType = 'weekly' | 'monthly';

export interface BudgetSettings {
  readonly budgetType: BudgetType;
  readonly budgetAmount: number;
  readonly startDate: string;
  readonly currency: CurrencyCode;
  readonly updatedAt: string;
}

export interface BudgetCycle {
  readonly id: string;
  readonly budgetType: BudgetType;
  readonly budgetAmount: number;
  readonly currency: CurrencyCode;
  readonly startDate: string;
  readonly endDate: string;
  readonly createdAt: string;
}

export interface BudgetStore {
  readonly settings: BudgetSettings | null;
  readonly cycles: readonly BudgetCycle[];
}

export interface ExpenseItem {
  readonly id: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
  readonly category: string;
  readonly purchaseDate: string;
  readonly store?: string;
  readonly budgetCycleId?: string;
}

export interface PurchaseRecord {
  readonly id: string;
  readonly totalAmount: number;
  readonly totalItems: number;
  readonly items: readonly ExpenseItem[];
  readonly createdAt: string;
  readonly store?: string;
  readonly budgetCycleId?: string;
}
