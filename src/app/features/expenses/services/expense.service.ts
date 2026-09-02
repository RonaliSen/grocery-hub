import { computed, inject, Injectable, signal } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { DEFAULT_CURRENCY_CODE, normalizeCurrencyCode } from '../../../core/utils/currency.utils';
import { createId } from '../../../core/utils/id.utils';
import {
  Budget,
  BudgetCycle,
  BudgetSettings,
  BudgetStore,
  BudgetType,
  Expense,
  ExpenseCategory,
  ExpenseDraft,
  ExpensePaymentMethod,
  PurchaseRecord
} from '../models/expense.model';

const DEFAULT_BUDGET: Budget = {
  amount: 0,
  currency: DEFAULT_CURRENCY_CODE
};
const DEFAULT_PAYMENT_METHOD: ExpensePaymentMethod = 'Cash';
const EMPTY_BUDGET_STORE: BudgetStore = {
  settings: null,
  cycles: []
};

type LegacyBudget = {
  readonly monthlyLimit: number;
  readonly currency: string;
};

type LegacyBudgetMap = Readonly<Record<string, LegacyBudget>>;

export interface BudgetOverview {
  readonly cycle: BudgetCycle;
  readonly budgetAmount: number;
  readonly spent: number;
  readonly remaining: number;
  readonly remainingDisplay: number;
  readonly overspent: number;
  readonly saved: number;
  readonly totalDays: number;
  readonly daysElapsed: number;
  readonly daysLeft: number;
  readonly progressPercent: number;
}

export interface ExpectedSpendSummary {
  readonly expectedSpend: number;
  readonly dailyBudget: number;
  readonly difference: number;
  readonly status: 'under_expected' | 'on_track' | 'over_expected' | 'budget_fully_used';
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private readonly storage = inject(StorageService);
  private readonly expensesState = signal<readonly Expense[]>([]);
  private readonly purchasesState = signal<readonly PurchaseRecord[]>([]);
  private readonly budgetStoreState = signal<BudgetStore>(EMPTY_BUDGET_STORE);
  private readonly loadedState = signal(false);
  private loadPromise: Promise<void> | null = null;

  readonly expenses = computed(() => this.expensesState());
  readonly purchases = computed(() => this.purchasesState());
  readonly budgetStore = computed(() => this.budgetStoreState());

  async load(): Promise<void> {
    if (this.loadedState()) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadFromStorage().finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  private async loadFromStorage(): Promise<void> {
    const [storedExpenses, storedBudgetStore, storedPurchases] = await Promise.all([
      this.storage.get<readonly Expense[]>(STORAGE_KEYS.expenses, []),
      this.storage.get<BudgetStore | Budget | LegacyBudgetMap>(STORAGE_KEYS.expenseBudget, EMPTY_BUDGET_STORE),
      this.storage.get<readonly PurchaseRecord[]>(STORAGE_KEYS.expensePurchases, [])
    ]);

    const normalizedExpenses = storedExpenses
      .filter((item) => item && item.id && Number.isFinite(item.amount) && item.amount > 0)
      .map((item) => {
        const quantity = this.normalizeQuantity(item.quantity);
        const discount = this.normalizeMoney(item.discount);
        const amount = this.roundCurrency(item.amount);
        const totalAmount = this.normalizeExpenseTotal(item.totalAmount, amount, quantity, discount);

        return {
          ...item,
          amount,
          quantity,
          discount,
          totalAmount,
          category: this.normalizeCategory(item.category),
          title: item.title.trim(),
          store: item.store?.trim() || undefined,
          paymentMethod: item.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
          notes: item.notes?.trim() || undefined,
          budgetCycleId: item.budgetCycleId || undefined
        } satisfies Expense;
      });

    const normalizedPurchases = storedPurchases
      .filter((item) => item && item.id && Number.isFinite(item.totalAmount) && item.totalAmount >= 0)
      .map((item) => ({
        ...item,
        store: item.store?.trim() || undefined,
        budgetCycleId: item.budgetCycleId || undefined,
        items: item.items.map((expenseItem) => ({
          ...expenseItem,
          quantity: this.normalizeQuantity(expenseItem.quantity),
          unitPrice: this.roundCurrency(Math.max(0, expenseItem.unitPrice)),
          totalPrice: this.roundCurrency(Math.max(0, expenseItem.totalPrice)),
          purchaseDate: expenseItem.purchaseDate || item.createdAt,
          budgetCycleId: expenseItem.budgetCycleId || undefined
        }))
      }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const normalizedBudgetStore = this.ensureBudgetCycles(
      this.normalizeBudgetStore(storedBudgetStore),
      new Date(),
      this.getEarliestTrackedDateForCollections(normalizedExpenses, normalizedPurchases)
    );

    const expensesWithCycles = this.attachCycleIdsToExpenses(normalizedExpenses, normalizedBudgetStore.cycles);
    const purchasesWithCycles = this.attachCycleIdsToPurchases(normalizedPurchases, normalizedBudgetStore.cycles);

    this.expensesState.set([...expensesWithCycles].sort((a, b) => +new Date(b.date) - +new Date(a.date)));
    this.purchasesState.set(purchasesWithCycles);
    this.budgetStoreState.set(normalizedBudgetStore);
    this.loadedState.set(true);

    await Promise.all([
      this.storage.set(STORAGE_KEYS.expenses, this.expensesState()),
      this.storage.set(STORAGE_KEYS.expensePurchases, this.purchasesState()),
      this.storage.set(STORAGE_KEYS.expenseBudget, this.budgetStoreState())
    ]);
  }

  getBudgetSettings(): BudgetSettings | null {
    return this.budgetStoreState().settings;
  }

  getDisplayBudget(referenceDate: string | Date = new Date()): Budget {
    const cycle = this.getCycleForDate(referenceDate) ?? this.getActiveBudgetCycle(referenceDate);
    if (cycle) {
      return {
        amount: cycle.budgetAmount,
        currency: cycle.currency
      };
    }

    const settings = this.getBudgetSettings();
    if (settings) {
      return {
        amount: settings.budgetAmount,
        currency: settings.currency
      };
    }

    return DEFAULT_BUDGET;
  }

  getDisplayCurrency(referenceDate: string | Date = new Date()): string {
    return this.getDisplayBudget(referenceDate).currency;
  }

  async saveBudgetSettings(draft: Omit<BudgetSettings, 'updatedAt' | 'currency'> & { currency?: string }): Promise<void> {
    const settings: BudgetSettings = {
      budgetType: draft.budgetType,
      budgetAmount: this.roundCurrency(Math.max(0, draft.budgetAmount)),
      startDate: this.normalizeDateOnly(draft.startDate),
      currency: normalizeCurrencyCode(draft.currency),
      updatedAt: new Date().toISOString()
    };
    const nextStore = this.buildStoreFromSettings(settings, this.budgetStoreState().cycles, new Date());
    const nextExpenses = this.attachCycleIdsToExpenses(this.expensesState(), nextStore.cycles);
    const nextPurchases = this.attachCycleIdsToPurchases(this.purchasesState(), nextStore.cycles);

    this.budgetStoreState.set(nextStore);
    this.expensesState.set(nextExpenses);
    this.purchasesState.set(nextPurchases);

    await Promise.all([
      this.storage.set(STORAGE_KEYS.expenseBudget, nextStore),
      this.storage.set(STORAGE_KEYS.expenses, nextExpenses),
      this.storage.set(STORAGE_KEYS.expensePurchases, nextPurchases)
    ]);
  }

  async resetBudget(): Promise<void> {
    this.budgetStoreState.set(EMPTY_BUDGET_STORE);
    this.expensesState.set(this.expensesState().map((expense) => ({ ...expense, budgetCycleId: undefined })));
    this.purchasesState.set(
      this.purchasesState().map((purchase) => ({
        ...purchase,
        budgetCycleId: undefined,
        items: purchase.items.map((item) => ({ ...item, budgetCycleId: undefined }))
      }))
    );

    await Promise.all([
      this.storage.set(STORAGE_KEYS.expenseBudget, EMPTY_BUDGET_STORE),
      this.storage.set(STORAGE_KEYS.expenses, this.expensesState()),
      this.storage.set(STORAGE_KEYS.expensePurchases, this.purchasesState())
    ]);
  }

  getBudgetCycles(): readonly BudgetCycle[] {
    return this.getBudgetCyclesForType(this.getConfiguredBudgetType());
  }

  getBudgetCyclesByType(budgetType: BudgetType): readonly BudgetCycle[] {
    return this.getBudgetCyclesForType(budgetType);
  }

  getCycleById(cycleId: string): BudgetCycle | undefined {
    return this.budgetStoreState().cycles.find((cycle) => cycle.id === cycleId);
  }

  getActiveBudgetCycle(referenceDate: string | Date = new Date()): BudgetCycle | null {
    return this.findCycleForDate(referenceDate, this.getConfiguredBudgetType());
  }

  getCycleForDate(referenceDate: string | Date): BudgetCycle | null {
    return this.findCycleForDate(referenceDate, this.getConfiguredBudgetType());
  }

  getCycleExpenses(cycleId: string): readonly Expense[] {
    const cycle = this.getCycleById(cycleId);
    if (!cycle) {
      return [];
    }
    return this.expensesState().filter((expense) => this.isDateWithinCycle(expense.date, cycle));
  }

  getCyclePurchases(cycleId: string): readonly PurchaseRecord[] {
    const cycle = this.getCycleById(cycleId);
    if (!cycle) {
      return [];
    }
    return this.purchasesState().filter((purchase) => this.isDateWithinCycle(purchase.createdAt, cycle));
  }

  getCycleSpent(cycleId: string): number {
    return this.roundCurrency(this.getCycleExpenses(cycleId).reduce((sum, item) => sum + this.getExpenseTotal(item), 0));
  }

  getCycleCategoryTotals(cycleId: string): ReadonlyArray<{ category: ExpenseCategory; total: number }> {
    const totals = new Map<ExpenseCategory, number>();
    for (const expense of this.getCycleExpenses(cycleId)) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + this.getExpenseTotal(expense));
    }

    return [...totals.entries()]
      .map(([category, total]) => ({ category, total: this.roundCurrency(total) }))
      .sort((a, b) => b.total - a.total);
  }

  getCycleOverview(cycleId: string, referenceDate: string | Date = new Date()): BudgetOverview | null {
    const cycle = this.getCycleById(cycleId);
    if (!cycle) {
      return null;
    }

    const spent = this.getCycleSpent(cycleId);
    const remaining = this.roundCurrency(cycle.budgetAmount - spent);
    const totalDays = this.getCycleLengthDays(cycle);
    const today = this.startOfDay(referenceDate);
    const cycleStart = this.startOfDay(cycle.startDate);
    const cycleEnd = this.startOfDay(cycle.endDate);
    const daysElapsed =
      today < cycleStart ? 0 : Math.min(totalDays, this.differenceInDays(cycleStart, today) + 1);
    const daysLeft = today > cycleEnd ? 0 : Math.max(0, this.differenceInDays(today, cycleEnd));
    const progressPercent = cycle.budgetAmount <= 0 ? 0 : Math.round((spent / cycle.budgetAmount) * 100);

    return {
      cycle,
      budgetAmount: cycle.budgetAmount,
      spent,
      remaining,
      remainingDisplay: Math.max(0, remaining),
      overspent: Math.max(0, this.roundCurrency(spent - cycle.budgetAmount)),
      saved: Math.max(0, this.roundCurrency(cycle.budgetAmount - spent)),
      totalDays,
      daysElapsed,
      daysLeft,
      progressPercent
    };
  }

  getExpectedSpendSummary(cycleId: string, referenceDate: string | Date = new Date()): ExpectedSpendSummary | null {
    const overview = this.getCycleOverview(cycleId, referenceDate);
    if (!overview) {
      return null;
    }

    const dailyBudget = overview.totalDays > 0 ? this.roundCurrency(overview.budgetAmount / overview.totalDays) : 0;
    const expectedSpend = this.roundCurrency(dailyBudget * overview.daysElapsed);
    const difference = this.roundCurrency(overview.spent - expectedSpend);

    if (overview.spent >= overview.budgetAmount) {
      return {
        expectedSpend,
        dailyBudget,
        difference,
        status: 'budget_fully_used'
      };
    }

    if (Math.abs(difference) <= dailyBudget) {
      return {
        expectedSpend,
        dailyBudget,
        difference,
        status: 'on_track'
      };
    }

    return {
      expectedSpend,
      dailyBudget,
      difference,
      status: difference > 0 ? 'over_expected' : 'under_expected'
    };
  }

  getRiskWarning(cycleId: string, referenceDate: string | Date = new Date()):
    | {
        readonly remaining: number;
        readonly daysLeft: number;
        readonly recommendedDailyLimit: number;
      }
    | null {
    const overview = this.getCycleOverview(cycleId, referenceDate);
    const expected = this.getExpectedSpendSummary(cycleId, referenceDate);
    if (!overview || !expected || overview.remaining <= 0 || overview.daysLeft <= 0) {
      return null;
    }

    const recommendedDailyLimit = this.roundCurrency(overview.remaining / overview.daysLeft);
    if (recommendedDailyLimit >= expected.dailyBudget) {
      return null;
    }

    return {
      remaining: overview.remaining,
      daysLeft: overview.daysLeft,
      recommendedDailyLimit
    };
  }

  getCycleTrend(limit = 6): ReadonlyArray<{ cycleId: string; label: string; total: number }> {
    return this.getBudgetCycles()
      .slice(0, limit)
      .reverse()
      .map((cycle) => ({
        cycleId: cycle.id,
        label: this.formatCycleLabel(cycle),
        total: this.getCycleSpent(cycle.id)
      }));
  }

  async addExpense(draft: ExpenseDraft): Promise<Expense> {
    await this.ensureCyclesCoverDate(draft.date);

    const amount = this.roundCurrency(draft.amount);
    const quantity = this.normalizeQuantity(draft.quantity);
    const discount = this.normalizeMoney(draft.discount);
    const totalAmount = this.calculateTotalAmount(amount, quantity, discount);
    const cycle = this.getCycleForDate(draft.date);
    const expense: Expense = {
      id: createId('expense'),
      title: draft.title.trim(),
      amount,
      category: draft.category,
      quantity,
      discount,
      totalAmount,
      store: draft.store?.trim() || undefined,
      paymentMethod: draft.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
      notes: draft.notes?.trim() || undefined,
      receiptImageUrl: draft.receiptImageUrl?.trim() || undefined,
      itemImageUrl: draft.itemImageUrl?.trim() || undefined,
      date: draft.date,
      budgetCycleId: cycle?.id
    };

    const next = [expense, ...this.expensesState()].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    await this.persistExpenses(next);
    return expense;
  }

  async updateExpense(expenseId: string, draft: ExpenseDraft): Promise<void> {
    await this.ensureCyclesCoverDate(draft.date);

    const amount = this.roundCurrency(draft.amount);
    const quantity = this.normalizeQuantity(draft.quantity);
    const discount = this.normalizeMoney(draft.discount);
    const totalAmount = this.calculateTotalAmount(amount, quantity, discount);
    const cycle = this.getCycleForDate(draft.date);
    const next = this.expensesState().map((item) =>
      item.id === expenseId
        ? {
            ...item,
            title: draft.title.trim(),
            amount,
            category: draft.category,
            quantity,
            discount,
            totalAmount,
            store: draft.store?.trim() || undefined,
            paymentMethod: draft.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
            notes: draft.notes?.trim() || undefined,
            receiptImageUrl: draft.receiptImageUrl?.trim() || undefined,
            itemImageUrl: draft.itemImageUrl?.trim() || undefined,
            date: draft.date,
            budgetCycleId: cycle?.id
          }
        : item
    );
    await this.persistExpenses(next.sort((a, b) => +new Date(b.date) - +new Date(a.date)));
  }

  async deleteExpense(expenseId: string): Promise<void> {
    const next = this.expensesState().filter((expense) => expense.id !== expenseId);
    await this.persistExpenses(next);
  }

  getById(expenseId: string): Expense | undefined {
    return this.expensesState().find((item) => item.id === expenseId);
  }

  async addPurchaseRecord(
    draft: Omit<PurchaseRecord, 'id' | 'createdAt' | 'totalAmount' | 'totalItems' | 'budgetCycleId'> & { createdAt?: string }
  ): Promise<PurchaseRecord> {
    const createdAt = draft.createdAt ?? new Date().toISOString();
    await this.ensureCyclesCoverDate(createdAt);
    const cycle = this.getActiveBudgetCycle(createdAt) ?? this.getCycleForDate(createdAt);
    const items = draft.items.map((item) => ({
      ...item,
      quantity: Math.max(1, Math.round(item.quantity)),
      unitPrice: this.roundCurrency(Math.max(0, item.unitPrice)),
      totalPrice: this.roundCurrency(Math.max(0, item.totalPrice)),
      purchaseDate: item.purchaseDate || createdAt,
      budgetCycleId: cycle?.id
    }));
    const totalAmount = this.roundCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0));
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    const purchase: PurchaseRecord = {
      id: createId('purchase'),
      totalAmount,
      totalItems,
      items,
      createdAt,
      store: draft.store?.trim() || undefined,
      budgetCycleId: cycle?.id
    };

    const expensesFromPurchase: Expense[] = items
      .filter((item) => item.totalPrice > 0)
      .map((item) => ({
        id: createId('expense'),
        title: item.itemName.trim(),
        amount: this.roundCurrency(item.unitPrice),
        category: this.normalizeCategory(item.category),
        quantity: item.quantity,
        discount: 0,
        totalAmount: this.roundCurrency(item.totalPrice),
        unitPrice: this.roundCurrency(item.unitPrice),
        purchaseRecordId: purchase.id,
        store: purchase.store,
        paymentMethod: DEFAULT_PAYMENT_METHOD,
        itemImageUrl: undefined,
        date: item.purchaseDate,
        budgetCycleId: cycle?.id
      }));

    const nextExpenses = [...expensesFromPurchase, ...this.expensesState()].sort(
      (a, b) => +new Date(b.date) - +new Date(a.date)
    );
    const nextPurchases = [purchase, ...this.purchasesState()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    this.expensesState.set(nextExpenses);
    this.purchasesState.set(nextPurchases);

    await Promise.all([
      this.storage.set(STORAGE_KEYS.expenses, nextExpenses),
      this.storage.set(STORAGE_KEYS.expensePurchases, nextPurchases)
    ]);

    return purchase;
  }

  formatCycleLabel(cycle: BudgetCycle): string {
    return `${this.formatShortDate(cycle.startDate)} - ${this.formatShortDate(cycle.endDate)}`;
  }

  private async persistExpenses(expenses: readonly Expense[]): Promise<void> {
    this.expensesState.set(expenses);
    await this.storage.set(STORAGE_KEYS.expenses, expenses);
  }

  private async ensureCyclesCoverDate(referenceDate: string | Date): Promise<void> {
    const store = this.budgetStoreState();
    const settings = store.settings;
    if (!settings) {
      return;
    }

    const targetDate = this.startOfDay(referenceDate);
    const isCovered = store.cycles.some(
      (cycle) => cycle.budgetType === settings.budgetType && this.isDateWithinCycle(targetDate, cycle)
    );
    if (isCovered) {
      return;
    }

    const nextStore = this.buildStoreFromSettings(settings, store.cycles, targetDate);
    if (nextStore.cycles.length === store.cycles.length) {
      return;
    }

    const nextExpenses = this.attachCycleIdsToExpenses(this.expensesState(), nextStore.cycles);
    const nextPurchases = this.attachCycleIdsToPurchases(this.purchasesState(), nextStore.cycles);

    this.budgetStoreState.set(nextStore);
    this.expensesState.set(nextExpenses);
    this.purchasesState.set(nextPurchases);

    await Promise.all([
      this.storage.set(STORAGE_KEYS.expenseBudget, nextStore),
      this.storage.set(STORAGE_KEYS.expenses, nextExpenses),
      this.storage.set(STORAGE_KEYS.expensePurchases, nextPurchases)
    ]);
  }

  private buildStoreFromSettings(
    settings: BudgetSettings,
    existingCycles: readonly BudgetCycle[],
    referenceDate: Date,
    earliestTrackedDate: Date | null = this.getEarliestTrackedDate()
  ): BudgetStore {
    const generatedCycles = this.generateCyclesFromSettings(settings, referenceDate, earliestTrackedDate);
    const mergedCycles = new Map<string, BudgetCycle>();

    for (const cycle of existingCycles) {
      mergedCycles.set(cycle.id, cycle);
    }
    for (const cycle of generatedCycles) {
      mergedCycles.set(cycle.id, cycle);
    }

    return {
      settings,
      cycles: [...mergedCycles.values()].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    };
  }

  private ensureBudgetCycles(
    store: BudgetStore,
    referenceDate: Date,
    earliestTrackedDate: Date | null = this.getEarliestTrackedDate()
  ): BudgetStore {
    const settings = store.settings;
    if (!settings) {
      return {
        settings: null,
        cycles: [...store.cycles].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      };
    }
    return this.buildStoreFromSettings(settings, store.cycles, referenceDate, earliestTrackedDate);
  }

  private generateCyclesFromSettings(
    settings: BudgetSettings,
    referenceDate: Date,
    earliestTrackedDate: Date | null = null
  ): BudgetCycle[] {
    const startDate = this.startOfDay(settings.startDate);
    const today = this.startOfDay(referenceDate);
    const cycles: BudgetCycle[] = [];
    let cursor = startDate;

    if (earliestTrackedDate && earliestTrackedDate < startDate) {
      while (earliestTrackedDate < cursor) {
        cursor = this.getPreviousCycleStartDate(cursor, settings.budgetType);
      }
    }

    if (today < startDate) {
      const upcomingEnd = this.getCycleEndDate(cursor, settings.budgetType);
      cycles.push(this.createCycle(settings, cursor, upcomingEnd));
      return cycles;
    }

    while (cursor <= today) {
      const cycleEnd = this.getCycleEndDate(cursor, settings.budgetType);
      cycles.push(this.createCycle(settings, cursor, cycleEnd));
      cursor = this.addDays(cycleEnd, 1);
    }

    return cycles;
  }

  private createCycle(settings: BudgetSettings, startDate: Date, endDate: Date): BudgetCycle {
    const startDateOnly = this.toDateOnly(startDate);
    return {
      id: this.createCycleId(settings.budgetType, startDateOnly),
      budgetType: settings.budgetType,
      budgetAmount: settings.budgetAmount,
      currency: settings.currency,
      startDate: startDateOnly,
      endDate: this.toDateOnly(endDate),
      createdAt: settings.updatedAt
    };
  }

  private createCycleId(budgetType: BudgetType, startDate: string): string {
    return `cycle-${budgetType}-${startDate}`;
  }

  private getCycleEndDate(startDate: Date, budgetType: BudgetType): Date {
    if (budgetType === 'weekly') {
      return this.addDays(startDate, 6);
    }
    return this.addDays(this.addMonthsClamped(startDate, 1), -1);
  }

  private getPreviousCycleStartDate(startDate: Date, budgetType: BudgetType): Date {
    if (budgetType === 'weekly') {
      return this.addDays(startDate, -7);
    }
    return this.addMonthsClamped(startDate, -1);
  }

  private attachCycleIdsToExpenses(expenses: readonly Expense[], cycles: readonly BudgetCycle[]): readonly Expense[] {
    const preferredType = this.getConfiguredBudgetType();
    return expenses.map((expense) => {
      const cycle = this.findCycleForDateFromCycles(expense.date, cycles, preferredType);
      return {
        ...expense,
        budgetCycleId: cycle?.id
      };
    });
  }

  private attachCycleIdsToPurchases(purchases: readonly PurchaseRecord[], cycles: readonly BudgetCycle[]): readonly PurchaseRecord[] {
    const preferredType = this.getConfiguredBudgetType();
    return purchases.map((purchase) => {
      const cycle = this.findCycleForDateFromCycles(purchase.createdAt, cycles, preferredType);
      return {
        ...purchase,
        budgetCycleId: cycle?.id,
        items: purchase.items.map((item) => ({
          ...item,
          budgetCycleId: cycle?.id
        }))
      };
    });
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private normalizeMoney(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? this.roundCurrency(Math.max(0, value)) : 0;
  }

  private normalizeQuantity(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1;
  }

  private calculateTotalAmount(amount: number, quantity: number, discount: number): number {
    return this.roundCurrency(Math.max(0, amount * quantity - discount));
  }

  private normalizeExpenseTotal(totalAmount: number | undefined, amount: number, quantity: number, discount: number): number {
    if (typeof totalAmount === 'number' && Number.isFinite(totalAmount) && totalAmount >= 0) {
      return this.roundCurrency(totalAmount);
    }
    return this.calculateTotalAmount(amount, quantity, discount);
  }

  private getExpenseTotal(expense: Expense): number {
    if (typeof expense.totalAmount === 'number' && Number.isFinite(expense.totalAmount)) {
      return this.roundCurrency(expense.totalAmount ?? 0);
    }
    if (Number.isFinite(expense.amount)) {
      return this.roundCurrency(expense.amount);
    }
    return 0;
  }

  private normalizeCategory(category: string): ExpenseCategory {
    const normalized = category.trim().toLowerCase();
    if (normalized === 'fruits') return 'fruits';
    if (normalized === 'vegetables' || normalized === 'produce') return 'vegetables';
    if (normalized === 'dairy' || normalized === 'dairy & eggs') return 'dairy';
    if (normalized === 'meat' || normalized === 'fish' || normalized === 'meat & fish') return 'meat';
    if (normalized === 'frozen') return 'frozen';
    if (normalized === 'spices' || normalized === 'masala') return 'spices';
    if (normalized === 'pulses' || normalized === 'grains' || normalized === 'lentils') return 'pulses';
    if (normalized === 'nuts') return 'nuts';
    if (normalized === 'bakery') return 'bakery';
    if (normalized === 'biscuits' || normalized === 'snacks') return 'biscuits';
    if (normalized === 'sauces') return 'sauces';
    if (normalized === 'beverages' || normalized === 'drinks') return 'beverages';
    if (normalized === 'household' || normalized === 'groceries' || normalized === 'others' || normalized === 'other') {
      return 'other';
    }
    return 'other';
  }

  private normalizeBudgetStore(raw: BudgetStore | Budget | LegacyBudgetMap): BudgetStore {
    if (this.isBudgetStore(raw)) {
      return {
        settings: raw.settings ? this.normalizeBudgetSettings(raw.settings) : null,
        cycles: (raw.cycles ?? []).map((cycle) => this.normalizeBudgetCycle(cycle))
      };
    }

    if (this.isLegacyBudget(raw)) {
      const monthStart = this.toDateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const settings: BudgetSettings = {
        budgetType: 'monthly',
        budgetAmount: Number.isFinite(raw.amount) ? this.roundCurrency(Math.max(0, raw.amount)) : 0,
        startDate: monthStart,
        currency: normalizeCurrencyCode(raw.currency),
        updatedAt: new Date().toISOString()
      };
      return {
        settings,
        cycles: []
      };
    }

    const entries = Object.entries(raw ?? {});
    const cycles = entries
      .filter(([, value]) => value && typeof value === 'object')
      .map(([monthKey, value]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const settings: BudgetSettings = {
          budgetType: 'monthly',
          budgetAmount:
            Number.isFinite(value.monthlyLimit) && value.monthlyLimit > 0 ? this.roundCurrency(value.monthlyLimit) : 0,
          startDate: this.toDateOnly(startDate),
          currency: normalizeCurrencyCode(value.currency),
          updatedAt: new Date().toISOString()
        };
        return this.createCycle(settings, startDate, endDate);
      })
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));

    const latest = cycles.at(-1);
    return {
      settings: latest
        ? {
            budgetType: latest.budgetType,
            budgetAmount: latest.budgetAmount,
            startDate: latest.startDate,
            currency: latest.currency,
            updatedAt: latest.createdAt
          }
        : null,
      cycles
    };
  }

  private normalizeBudgetSettings(settings: BudgetSettings): BudgetSettings {
    return {
      budgetType: settings.budgetType === 'weekly' ? 'weekly' : 'monthly',
      budgetAmount: Number.isFinite(settings.budgetAmount) ? this.roundCurrency(Math.max(0, settings.budgetAmount)) : 0,
      startDate: this.normalizeDateOnly(settings.startDate),
      currency: normalizeCurrencyCode(settings.currency),
      updatedAt: settings.updatedAt || new Date().toISOString()
    };
  }

  private normalizeBudgetCycle(cycle: BudgetCycle): BudgetCycle {
    return {
      id: cycle.id || this.createCycleId(cycle.budgetType, this.normalizeDateOnly(cycle.startDate)),
      budgetType: cycle.budgetType === 'weekly' ? 'weekly' : 'monthly',
      budgetAmount: Number.isFinite(cycle.budgetAmount) ? this.roundCurrency(Math.max(0, cycle.budgetAmount)) : 0,
      currency: normalizeCurrencyCode(cycle.currency),
      startDate: this.normalizeDateOnly(cycle.startDate),
      endDate: this.normalizeDateOnly(cycle.endDate),
      createdAt: cycle.createdAt || new Date().toISOString()
    };
  }

  private isBudgetStore(raw: BudgetStore | Budget | LegacyBudgetMap): raw is BudgetStore {
    return typeof raw === 'object' && raw !== null && 'cycles' in raw && 'settings' in raw;
  }

  private isLegacyBudget(raw: BudgetStore | Budget | LegacyBudgetMap): raw is Budget {
    return typeof (raw as Budget)?.amount === 'number';
  }

  private normalizeDateOnly(value: string): string {
    return this.toDateOnly(this.startOfDay(value));
  }

  private getConfiguredBudgetType(): BudgetType | null {
    return this.budgetStoreState().settings?.budgetType ?? null;
  }

  private getBudgetCyclesForType(budgetType: BudgetType | null): readonly BudgetCycle[] {
    const cycles = budgetType
      ? this.budgetStoreState().cycles.filter((cycle) => cycle.budgetType === budgetType)
      : this.budgetStoreState().cycles;

    return [...cycles].sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
  }

  private findCycleForDate(referenceDate: string | Date, budgetType: BudgetType | null): BudgetCycle | null {
    return this.findCycleForDateFromCycles(referenceDate, this.budgetStoreState().cycles, budgetType);
  }

  private findCycleForDateFromCycles(
    referenceDate: string | Date,
    cycles: readonly BudgetCycle[],
    budgetType: BudgetType | null
  ): BudgetCycle | null {
    const target = this.startOfDay(referenceDate);
    const matchingCycles = (budgetType ? cycles.filter((cycle) => cycle.budgetType === budgetType) : cycles)
      .filter((cycle) => this.isDateWithinCycle(target, cycle))
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));

    return matchingCycles[0] ?? null;
  }

  private getEarliestTrackedDate(): Date | null {
    return this.getEarliestTrackedDateForCollections(this.expensesState(), this.purchasesState());
  }

  private getEarliestTrackedDateForCollections(
    expenses: readonly Expense[],
    purchases: readonly PurchaseRecord[]
  ): Date | null {
    const dates = [...expenses.map((expense) => expense.date), ...purchases.map((purchase) => purchase.createdAt)]
      .map((value) => this.startOfDay(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => +a - +b);

    return dates[0] ?? null;
  }

  private startOfDay(value: string | Date): Date {
    const date = typeof value === 'string' ? new Date(value.length > 10 ? value : `${value}T00:00:00`) : new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private addMonthsClamped(date: Date, months: number): Date {
    const start = this.startOfDay(date);
    const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(start.getDate(), lastDay));
  }

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private differenceInDays(start: string | Date, end: string | Date): number {
    const startDate = this.startOfDay(start);
    const endDate = this.startOfDay(end);
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
  }

  private getCycleLengthDays(cycle: BudgetCycle): number {
    return this.differenceInDays(cycle.startDate, cycle.endDate) + 1;
  }

  private isDateWithinCycle(value: string | Date, cycle: BudgetCycle): boolean {
    const target = this.startOfDay(value);
    return target >= this.startOfDay(cycle.startDate) && target <= this.startOfDay(cycle.endDate);
  }

  private formatShortDate(value: string): string {
    return this.startOfDay(value).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short'
    });
  }
}
