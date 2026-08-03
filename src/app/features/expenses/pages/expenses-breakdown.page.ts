import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, chevronDownOutline, statsChartOutline, trendingUpOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expenses-breakdown-page',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <header class="page-header app-mobile-header app-mobile-header--center">
      <button type="button" class="icon-btn app-mobile-icon-btn plain" (click)="goBack()" aria-label="Back"><ion-icon [icon]="backIcon" /></button>
      <h1>Analytics</h1>
      <div class="spacer"></div>
    </header>
    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell app-mobile-shell">
        @if (cycleOptions().length > 0) {
          <section class="filters app-mobile-card">
            <div class="select-wrap select-wrap--cycle" [class.select-wrap--active]="isViewingActiveCycle()" [class.select-wrap--past]="!isViewingActiveCycle()">
              <select [value]="selectedCycleId()" (change)="onCycleChange($event)" aria-label="Select cycle">
                @for (cycle of cycleOptions(); track cycle.id) {
                  <option [value]="cycle.id">{{ cycle.label }}</option>
                }
              </select>
              <ion-icon [icon]="downIcon" />
            </div>
            <div class="select-wrap">
              <select [value]="categoryFilter()" (change)="onCategoryChange($event)" aria-label="Select category">
                <option value="All">All Categories</option>
                @for (category of categories; track category) {
                  <option [value]="category">{{ categoryLabels[category] }}</option>
                }
              </select>
              <ion-icon [icon]="downIcon" />
            </div>
            <p class="cycle-state" [class.cycle-state--active]="isViewingActiveCycle()">
              {{ isViewingActiveCycle() ? 'Current cycle selected' : 'Past cycle selected' }}
            </p>
          </section>
        }

        @if (!overview() || filteredExpenses().length === 0) {
          <section class="empty app-mobile-card">
            <h2>Not enough data for analytics</h2>
            <p>Analytics will appear once purchases are added to a budget cycle.</p>
          </section>
        } @else {
          <section class="card total-card app-mobile-card">
            <div>
              <p class="card-title">Total Spent</p>
              <strong>{{ formatAmount(overview()!.spent) }}</strong>
              <small>
                Expected {{ formatAmount(expected()!.expectedSpend) }}
                <span class="delta"><ion-icon [icon]="trendUpIcon" /> {{ statusLabel() }}</span>
              </small>
            </div>
            <div class="round-icon"><ion-icon [icon]="chartIcon" /></div>
          </section>

          <section class="kpi-grid">
            <article class="kpi app-mobile-card"><p>Budget</p><strong>{{ formatAmount(overview()!.budgetAmount) }}</strong></article>
            <article class="kpi app-mobile-card"><p>Remaining</p><strong>{{ formatAmount(overview()!.remainingDisplay) }}</strong></article>
            <article class="kpi app-mobile-card"><p>Days Left</p><strong>{{ overview()!.daysLeft }}</strong></article>
            <article class="kpi app-mobile-card"><p>Daily Budget</p><strong>{{ formatAmount(expected()!.dailyBudget) }}</strong></article>
          </section>

          @if (topCategorySpend()) {
            <section class="card top-category-card app-mobile-card" [style.background]="topCategoryBackground()">
              <p class="top-category-label">Most Spend Category</p>
              <div class="top-category-content">
                <div>
                  <strong>{{ categoryLabel(topCategorySpend()!.category) }}</strong>
                  <small>{{ topCategorySpend()!.percent }}% of this cycle</small>
                </div>
                <span>{{ formatAmount(topCategorySpend()!.total) }}</span>
              </div>
            </section>
          }

          <section class="card chart-card app-mobile-card">
            <h3>Spending by Category</h3>
            <div class="chart-layout">
              <div class="donut" [style.background]="pieGradient()"></div>
              <div class="legend">
                @for (row of categoryRows(); track row.category) {
                  <div class="legend-row">
                    <span class="dot" [style.background]="colorAt(row.category)"></span>
                    <span class="name">{{ categoryLabel(row.category) }}</span>
                    <span class="values">{{ formatAmount(row.total) }} ({{ row.percent }}%)</span>
                  </div>
                }
              </div>
            </div>
          </section>

          <section class="card trend-card app-mobile-card">
            <h3>Cycle Trend</h3>
            <div class="line-plot">
              <div class="y-labels">
                @for (tick of trendTicks(); track tick.value) { <span>{{ formatAmount(tick.value) }}</span> }
              </div>
              <div class="plot-area">
                <div class="line-grid"></div>
                <div class="bar-series" aria-hidden="true">
                  @for (point of trend(); track point.cycleId) {
                    <span class="bar" [style.height.%]="trendBarHeight(point.total)" [style.background]="trendBarGradient(point.category)"></span>
                  }
                </div>
                <div class="x-labels">
                  @for (point of trend(); track point.cycleId) { <span>{{ shortLabel(point.label) }}</span> }
                </div>
              </div>
            </div>
          </section>
        }
      </main>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#edf4f0; color:#0f1f1a; }
    .page-header { border-bottom:1px solid #deebe2; }
    .page-header h1 { margin:0; text-align:center; font-size:clamp(1.2rem, 4vw, 1.42rem); color:#0a7b4a; font-weight:750; letter-spacing:-0.01em; }
    .icon-btn { border:none; background:transparent; color:#1a5c40; display:grid; place-items:center; }
    .page-content { --background:#edf4f0; }
    .filters { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap:0.5rem; }
    .select-wrap { border:1px solid #cfddd4; border-radius:10px; min-height:2.8rem; display:grid; grid-template-columns:1fr auto; align-items:center; padding-right:0.55rem; color:#738a7f; background:#f7fbf8; transition:border-color 160ms ease, box-shadow 160ms ease, background 160ms ease; }
    .select-wrap--cycle.select-wrap--active { border-color:#8ad0aa; background:linear-gradient(180deg, #f5fcf8 0%, #eaf8f0 100%); box-shadow:0 10px 22px rgba(20, 146, 85, 0.12); }
    .select-wrap--cycle.select-wrap--past { background:linear-gradient(180deg, #ffffff 0%, #f6f8f7 100%); }
    .select-wrap select { border:none; background:transparent; padding:0 0.6rem; min-height:2.8rem; color:#314e40; font-size:0.8rem; appearance:none; }
    .cycle-state { grid-column:1 / -1; margin:0.05rem 0 0; color:#6d8377; font-size:0.74rem; font-weight:700; }
    .cycle-state--active { color:#12814c; }
    .card,.empty,.kpi { }
    .total-card { display:flex; justify-content:space-between; align-items:center; }
    .card-title { margin:0; color:#22372e; font-size:0.85rem; font-weight:650; }
    .total-card strong { font-size:2rem; line-height:1.05; color:#0f8b55; display:block; margin-top:0.2rem; font-weight:800; letter-spacing:-0.015em; }
    .total-card small { color:#708679; display:flex; align-items:center; gap:0.22rem; margin-top:0.26rem; font-size:0.76rem; flex-wrap:wrap; }
    .delta { color:#169a56; font-weight:700; display:inline-flex; align-items:center; gap:0.1rem; }
    .round-icon { width:2.1rem; height:2.1rem; border-radius:999px; background:#87d7ad; color:#fff; display:grid; place-items:center; }
    .chart-card h3,.trend-card h3 { margin:0 0 0.5rem; font-size:0.86rem; color:#1f3229; font-weight:700; }
    .top-category-card { border:1px solid rgba(255,255,255,0.7); box-shadow:0 12px 28px rgba(24, 39, 31, 0.08); }
    .top-category-label { margin:0 0 0.45rem; font-size:0.74rem; font-weight:700; color:#335246; text-transform:uppercase; letter-spacing:0.06em; }
    .top-category-content { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
    .top-category-content strong { display:block; font-size:1.1rem; color:#10281f; }
    .top-category-content small { display:block; margin-top:0.2rem; color:#4f6c60; font-size:0.78rem; }
    .top-category-content span { font-size:1rem; font-weight:800; color:#153528; }
    .chart-layout { display:grid; grid-template-columns:118px minmax(0, 1fr); gap:0.75rem; align-items:center; }
    .donut { width:108px; height:108px; border-radius:50%; border:9px solid #f4f7f5; justify-self:center; }
    .legend { display:grid; gap:0.3rem; }
    .legend-row { display:grid; grid-template-columns:auto auto 1fr; align-items:center; gap:0.35rem; font-size:0.73rem; }
    .dot { width:0.52rem; height:0.52rem; border-radius:999px; }
    .name { color:#3a5447; }
    .values { text-align:right; color:#4b6256; }
    .line-plot { display:grid; grid-template-columns:2.1rem 1fr; gap:0.38rem; height:166px; border:1px solid #e3ece6; border-radius:10px; background:#fbfdfc; padding:0.5rem 0.5rem 0.36rem; }
    .y-labels { display:grid; align-content:space-between; justify-items:end; padding-bottom:1.14rem; }
    .y-labels span { font-size:0.66rem; color:#708679; line-height:1; }
    .plot-area { position:relative; overflow:hidden; border-radius:8px; }
    .line-grid { position:absolute; inset:0 0 1.14rem; background:repeating-linear-gradient(to top, #edf4ef 0 1px, transparent 1px 24px); border-radius:8px; }
    .bar-series { position:absolute; inset:0 0 1.14rem; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); align-items:end; gap:0.5rem; padding:0.2rem 0.25rem 0; }
    .bar { width:100%; border-radius:0.5rem 0.5rem 0 0; background:linear-gradient(180deg, #53bb86 0%, #149255 100%); min-height:2px; }
    .x-labels { position:absolute; left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); }
    .x-labels span { text-align:center; font-size:0.71rem; color:#667d71; }
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap:0.5rem; }
    .kpi p { margin:0; color:#667f72; font-size:0.7rem; font-weight:550; }
    .kpi strong { margin-top:0.25rem; display:block; color:#113427; font-size:1rem; }
    .empty { text-align:center; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesBreakdownPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly backIcon = arrowBackOutline;
  protected readonly downIcon = chevronDownOutline;
  protected readonly chartIcon = statsChartOutline;
  protected readonly trendUpIcon = trendingUpOutline;
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly selectedCycleId = signal('');
  protected readonly categoryFilter = signal<'All' | ExpenseCategory>('All');
  protected readonly cycleOptions = computed(() =>
    this.expenseService.getBudgetCycles().map((cycle) => ({
      id: cycle.id,
      label: this.expenseService.formatCycleLabel(cycle)
    }))
  );
  protected readonly isViewingActiveCycle = computed(
    () => this.selectedCycleId().length > 0 && this.selectedCycleId() === (this.expenseService.getActiveBudgetCycle()?.id ?? '')
  );
  protected readonly overview = computed(() => this.expenseService.getCycleOverview(this.selectedCycleId()));
  protected readonly expected = computed(() => this.expenseService.getExpectedSpendSummary(this.selectedCycleId()));
  protected readonly filteredExpenses = computed(() => {
    const category = this.categoryFilter();
    const all = this.expenseService.getCycleExpenses(this.selectedCycleId());
    return category === 'All' ? all : all.filter((item) => item.category === category);
  });
  protected readonly categoryRows = computed(() => {
    const total = this.filteredExpenses().reduce((sum, item) => sum + this.expenseTotal(item), 0);
    const byCategory = new Map<ExpenseCategory, number>();
    for (const item of this.filteredExpenses()) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + this.expenseTotal(item));
    }
    return [...byCategory.entries()]
      .map(([category, value]) => ({
        category,
        total: value,
        percent: total > 0 ? Math.round((value / total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  });
  protected readonly topCategorySpend = computed(() => this.categoryRows()[0] ?? null);
  protected readonly trend = computed(() => {
    const selectedCategory = this.categoryFilter();
    return this.expenseService
      .getBudgetCycles()
      .slice(0, 6)
      .reverse()
      .map((cycle) => {
        const expenses = this.expenseService.getCycleExpenses(cycle.id);
        const relevantExpenses =
          selectedCategory === 'All' ? expenses : expenses.filter((item) => item.category === selectedCategory);

        return {
          cycleId: cycle.id,
          label: this.expenseService.formatCycleLabel(cycle),
          total: relevantExpenses.reduce((sum, item) => sum + this.expenseTotal(item), 0),
          category:
            selectedCategory === 'All'
              ? this.getDominantCategory(expenses)
              : selectedCategory
        };
      });
  });
  protected readonly trendMax = computed(() => {
    const max = Math.max(...this.trend().map((item) => item.total), 0);
    if (max <= 0) {
      return 100;
    }
    const step = max <= 100 ? 20 : max <= 300 ? 50 : 100;
    return Math.ceil(max / step) * step;
  });
  private readonly categoryPalette: Record<ExpenseCategory, { solid: string; gradient: string }> = {
    produce: { solid: '#12b886', gradient: 'linear-gradient(180deg, #8ce8c4 0%, #12b886 100%)' },
    grains: { solid: '#b08968', gradient: 'linear-gradient(180deg, #e6c7a3 0%, #b08968 100%)' },
    masala: { solid: '#f08c00', gradient: 'linear-gradient(180deg, #ffd27a 0%, #f08c00 100%)' },
    vegetables: { solid: '#2f9e44', gradient: 'linear-gradient(180deg, #7bd66f 0%, #2f9e44 100%)' },
    fruits: { solid: '#f76707', gradient: 'linear-gradient(180deg, #ffb347 0%, #f76707 100%)' },
    dairy: { solid: '#4c6ef5', gradient: 'linear-gradient(180deg, #9ab8ff 0%, #4c6ef5 100%)' },
    meat: { solid: '#d94841', gradient: 'linear-gradient(180deg, #ff9a8f 0%, #d94841 100%)' },
    frozen: { solid: '#1098ad', gradient: 'linear-gradient(180deg, #86dff2 0%, #1098ad 100%)' },
    spices: { solid: '#c77d0a', gradient: 'linear-gradient(180deg, #ffd166 0%, #c77d0a 100%)' },
    pulses: { solid: '#8e44ad', gradient: 'linear-gradient(180deg, #d3a6f2 0%, #8e44ad 100%)' },
    nuts: { solid: '#8d6e63', gradient: 'linear-gradient(180deg, #d8b69f 0%, #8d6e63 100%)' },
    bakery: { solid: '#e67700', gradient: 'linear-gradient(180deg, #ffd08a 0%, #e67700 100%)' },
    biscuits: { solid: '#a0612b', gradient: 'linear-gradient(180deg, #e2b982 0%, #a0612b 100%)' },
    snacks: { solid: '#e64980', gradient: 'linear-gradient(180deg, #ff9cc0 0%, #e64980 100%)' },
    sauces: { solid: '#c92a2a', gradient: 'linear-gradient(180deg, #ff8b8b 0%, #c92a2a 100%)' },
    beverages: { solid: '#0b7285', gradient: 'linear-gradient(180deg, #7fd4e5 0%, #0b7285 100%)' },
    other: { solid: '#495057', gradient: 'linear-gradient(180deg, #adb5bd 0%, #495057 100%)' }
  };

  constructor() {
    void this.expenseService.load().then(() => {
      this.selectedCycleId.set(this.expenseService.getActiveBudgetCycle()?.id ?? this.cycleOptions()[0]?.id ?? '');
    });
  }

  protected onCycleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    this.selectedCycleId.set(value);
  }

  protected onCategoryChange(event: Event): void {
    this.categoryFilter.set(((event.target as HTMLSelectElement | null)?.value as 'All' | ExpenseCategory) || 'All');
  }

  protected formatAmount(amount: number): string {
    return formatCurrencyAmount(amount, this.overview()?.cycle.currency ?? this.expenseService.getDisplayCurrency());
  }

  protected expenseTotal(expense: { amount: number; totalAmount?: number }): number {
    return typeof expense.totalAmount === 'number' && Number.isFinite(expense.totalAmount) ? expense.totalAmount : expense.amount;
  }

  protected statusLabel(): string {
    const status = this.expected()?.status;
    if (status === 'budget_fully_used') return 'Budget Fully Used';
    if (status === 'over_expected') return 'Over Expected';
    if (status === 'on_track') return 'On Track';
    return 'Under Expected';
  }

  protected pieGradient(): string {
    const rows = this.categoryRows();
    if (rows.length === 0) return 'conic-gradient(#d9e8df 0 100%)';
    let start = 0;
    const segments = rows.map((row) => {
      const end = Math.min(100, start + row.percent);
      const segment = `${this.colorAt(row.category)} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  protected colorAt(category: ExpenseCategory): string {
    return this.categoryPalette[category]?.solid ?? '#8aa398';
  }

  protected trendBarGradient(category: ExpenseCategory | null): string {
    return category ? this.categoryPalette[category]?.gradient ?? 'linear-gradient(180deg, #b8c5be 0%, #6c7f74 100%)' : 'linear-gradient(180deg, #d4ddd8 0%, #90a39a 100%)';
  }

  protected topCategoryBackground(): string {
    const topCategory = this.topCategorySpend()?.category;
    return topCategory
      ? `linear-gradient(135deg, color-mix(in srgb, ${this.colorAt(topCategory)} 18%, white) 0%, #ffffff 100%)`
      : 'linear-gradient(135deg, #f5f8f6 0%, #ffffff 100%)';
  }

  protected categoryLabel(category: ExpenseCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected trendTicks(): ReadonlyArray<{ value: number }> {
    const max = this.trendMax();
    return [max, max * 0.66, max * 0.33, 0].map((value) => ({ value: Math.round(value) }));
  }

  protected trendBarHeight(total: number): number {
    return this.trendMax() <= 0 ? 0 : Math.max(2, Math.round((total / this.trendMax()) * 100));
  }

  private getDominantCategory(expenses: readonly { category: ExpenseCategory; amount: number; totalAmount?: number }[]): ExpenseCategory | null {
    const totals = new Map<ExpenseCategory, number>();
    for (const expense of expenses) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + this.expenseTotal(expense));
    }

    let topCategory: ExpenseCategory | null = null;
    let topAmount = 0;
    for (const [category, total] of totals.entries()) {
      if (total > topAmount) {
        topCategory = category;
        topAmount = total;
      }
    }

    return topCategory;
  }

  protected shortLabel(label: string): string {
    return label.split(' - ')[0] ?? label;
  }

  protected async goBack(): Promise<void> {
    await this.navigationHistory.back('/tabs/expenses');
  }
}
