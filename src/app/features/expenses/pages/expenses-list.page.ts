import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, calendarOutline, chevronDownOutline, chevronUpOutline, searchOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { Expense, ExpenseCategory } from '../models/expense.model';
import { BudgetOverview, ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expenses-list-page',
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon, RouterLink],
  template: `
    <header class="page-header app-mobile-header app-mobile-header--actions">
      <button type="button" class="icon-btn app-mobile-icon-btn plain" (click)="goBack()" aria-label="Back">
        <ion-icon [icon]="backIcon" />
      </button>
      <h1>Budget History</h1>
      <div class="spacer app-mobile-icon-btn"></div>
    </header>

    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell app-mobile-shell app-mobile-shell--tabbed">
        @if (cycleCards().length === 0) {
          <section class="empty-card app-mobile-card">
            <h2>No budget configured.</h2>
            <p>Set up your weekly or monthly budget to start tracking spending.</p>
            <a class="primary-btn" [routerLink]="['/tabs/expenses/budget']">Configure Budget</a>
          </section>
        } @else {
          <section class="search-card app-mobile-card">
            <div class="search-wrap">
              <ion-icon [icon]="searchIcon" />
              <input
                type="search"
                placeholder="Search purchases across budget cycles..."
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
              />
            </div>
          </section>

          <section class="history-stack">
            @for (cycle of cycleCards(); track cycle.id) {
              <article class="history-card app-mobile-card">
                <div class="card-head">
                  <div>
                    <p class="card-kicker">{{ cycle.typeLabel }}</p>
                    <h2>{{ cycle.label }}</h2>
                  </div>
                  <span class="status-pill" [class.over]="cycle.overview.overspent > 0" [class.under]="cycle.overview.overspent <= 0">
                    {{ cycle.statusLabel }}
                  </span>
                </div>

                <div class="meta-strip">
                  <span><ion-icon [icon]="calendarIcon" /> {{ cycle.purchaseCount }} purchases</span>
                  <span>{{ cycle.overview.totalDays }} days</span>
                </div>

                <div class="summary-grid">
                  <article>
                    <p>Budget</p>
                    <strong>{{ formatAmount(cycle.overview.budgetAmount, cycle.overview) }}</strong>
                  </article>
                  <article>
                    <p>Spent</p>
                    <strong>{{ formatAmount(cycle.overview.spent, cycle.overview) }}</strong>
                  </article>
                </div>

                <div class="result-panel" [class.over]="cycle.overview.overspent > 0" [class.under]="cycle.overview.overspent <= 0">
                  @if (cycle.overview.overspent > 0) {
                    <p class="result-value">Overspent {{ formatAmount(cycle.overview.overspent, cycle.overview) }}</p>
                    <p class="result-copy">Status: Over Budget</p>
                  } @else {
                    <p class="result-value">
                      {{ cycle.overview.daysLeft === 0 ? 'Saved' : 'Remaining' }}
                      {{ formatAmount(cycle.overview.daysLeft === 0 ? cycle.overview.saved : cycle.overview.remainingDisplay, cycle.overview) }}
                    </p>
                    <p class="result-copy">
                      Status:
                      {{ cycle.overview.daysLeft === 0 ? 'Under Budget' : 'In Progress' }}
                    </p>
                  }
                </div>

                <button type="button" class="details-toggle" (click)="toggleDetails(cycle.id)">
                  <span>{{ isExpanded(cycle.id) ? 'Hide Details' : 'View Details' }}</span>
                  <ion-icon [icon]="isExpanded(cycle.id) ? upIcon : downIcon" />
                </button>

                @if (isExpanded(cycle.id)) {
                  <section class="details-panel">
                    <div class="detail-metrics">
                      <article>
                        <p>Remaining</p>
                        <strong>{{ formatAmount(cycle.overview.remainingDisplay, cycle.overview) }}</strong>
                      </article>
                      <article>
                        <p>Days Left</p>
                        <strong>{{ cycle.overview.daysLeft }}</strong>
                      </article>
                      <article>
                        <p>Daily Budget</p>
                        <strong>{{ formatAmount(cycle.dailyBudget, cycle.overview) }}</strong>
                      </article>
                      <article>
                        <p>Expected Spend</p>
                        <strong>{{ formatAmount(cycle.expectedSpend, cycle.overview) }}</strong>
                      </article>
                    </div>

                    <div class="purchases-wrap">
                      <div class="section-head">
                        <h3>Cycle Purchases</h3>
                        <span>{{ cycle.filteredExpenses.length }}</span>
                      </div>

                      @if (cycle.filteredExpenses.length === 0) {
                        <p class="empty-copy">
                          {{ query().trim() ? 'No matching purchases found for this cycle.' : 'No purchases recorded for this cycle yet.' }}
                        </p>
                      } @else {
                        @for (expense of cycle.filteredExpenses; track expense.id) {
                          <a class="expense-row" [routerLink]="['/tabs/expenses', expense.id]">
                            <div>
                              <strong>{{ expense.title }}</strong>
                              <p>{{ categoryLabel(expense.category) }} · {{ formatDate(expense.date) }}</p>
                            </div>
                            <span>{{ formatAmount(expenseTotal(expense), cycle.overview) }}</span>
                          </a>
                        }
                      }
                    </div>
                  </section>
                }
              </article>
            }
          </section>
        }
      </main>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#f4f8f5; }
    .page-header h1 { margin:0; text-align:center; font-size:clamp(1.2rem, 4vw, 1.45rem); color:#0f7d4d; font-weight:800; letter-spacing:-0.01em; }
    .icon-btn { border:none; display:grid; place-items:center; color:#1d4f37; background:transparent; }
    .page-content { --background:#f4f8f5; }
    .shell { display:grid; gap:0.9rem; }
    .empty-card { text-align:center; display:grid; gap:0.7rem; }
    .empty-card h2,.empty-card p,.empty-copy { margin:0; }
    .empty-card p,.empty-copy { color:#5d7569; }
    .primary-btn { color:#fff; background:#149255; text-decoration:none; font-weight:700; display:inline-flex; justify-content:center; align-items:center; min-height:2.8rem; border-radius:999px; }
    .search-wrap { min-height:2.9rem; border:1px solid #d7e2db; border-radius:14px; padding:0 0.8rem; display:flex; align-items:center; gap:0.5rem; color:#7a9184; background:#fff; }
    .search-wrap input { width:100%; border:none; outline:none; background:transparent; font-size:0.92rem; color:#2e4d3d; }
    .history-stack { display:grid; gap:0.85rem; }
    .history-card { display:grid; gap:0.9rem; }
    .card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; }
    .card-kicker { margin:0; color:#6b8377; font-size:0.76rem; text-transform:uppercase; letter-spacing:0.08em; }
    .card-head h2 { margin:0.2rem 0 0; color:#11291d; font-size:1.15rem; line-height:1.2; }
    .status-pill { border-radius:999px; padding:0.42rem 0.72rem; font-size:0.75rem; font-weight:700; white-space:nowrap; }
    .status-pill.under { background:#e8f7ee; color:#12814c; }
    .status-pill.over { background:#fdeaea; color:#dc2626; }
    .meta-strip { display:flex; justify-content:space-between; align-items:center; gap:0.6rem; color:#5c7569; font-size:0.82rem; }
    .meta-strip span { display:inline-flex; align-items:center; gap:0.3rem; }
    .summary-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0.75rem; }
    .summary-grid article,
    .detail-metrics article { border:1px solid #e3ece6; border-radius:1rem; padding:0.85rem; background:#fbfdfc; }
    .summary-grid p,
    .detail-metrics p { margin:0; color:#5d7569; font-size:0.78rem; }
    .summary-grid strong,
    .detail-metrics strong { display:block; margin-top:0.22rem; color:#11291d; font-size:1rem; }
    .result-panel { border-radius:1rem; padding:0.95rem 1rem; display:grid; gap:0.18rem; }
    .result-panel.under { background:linear-gradient(180deg, #f2fbf6 0%, #ecf8f1 100%); border:1px solid #d8ebe0; }
    .result-panel.over { background:linear-gradient(180deg, #fff4f4 0%, #ffefef 100%); border:1px solid #f5d4d4; }
    .result-value,
    .result-copy { margin:0; }
    .result-value { color:#11291d; font-size:1rem; font-weight:700; }
    .result-copy { color:#5b7066; font-size:0.82rem; }
    .details-toggle { width:100%; border:none; border-radius:999px; min-height:2.85rem; background:#eef6f1; color:#125337; display:flex; align-items:center; justify-content:space-between; padding:0 1rem; font-weight:700; }
    .details-panel { display:grid; gap:0.85rem; padding-top:0.1rem; }
    .detail-metrics { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0.7rem; }
    .purchases-wrap { display:grid; gap:0.5rem; }
    .section-head { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
    .section-head h3 { margin:0; font-size:0.96rem; color:#11291d; }
    .section-head span { color:#5c7569; font-size:0.82rem; font-weight:700; }
    .expense-row { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; padding:0.82rem 0; border-bottom:1px solid #edf2ef; text-decoration:none; color:inherit; }
    .expense-row:last-child { border-bottom:none; }
    .expense-row p { margin:0.16rem 0 0; color:#5f786b; font-size:0.82rem; }

    @media (max-width: 520px) {
      .card-head { display:grid; }
      .meta-strip { display:grid; gap:0.35rem; }
      .summary-grid,
      .detail-metrics { grid-template-columns:1fr 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesListPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly backIcon = arrowBackOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly downIcon = chevronDownOutline;
  protected readonly upIcon = chevronUpOutline;
  protected readonly query = signal('');
  protected readonly expandedCycleIds = signal<readonly string[]>([]);
  protected readonly cycleCards = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.expenseService.getBudgetCycles().map((cycle) => {
      const overview = this.expenseService.getCycleOverview(cycle.id) as BudgetOverview;
      const expected = this.expenseService.getExpectedSpendSummary(cycle.id);
      const expenses = [...this.expenseService.getCycleExpenses(cycle.id)].sort(
        (a, b) => +new Date(b.date) - +new Date(a.date)
      );
      const filteredExpenses = query
        ? expenses.filter((item) => item.title.toLowerCase().includes(query))
        : expenses;

      return {
        id: cycle.id,
        label: this.expenseService.formatCycleLabel(cycle),
        typeLabel: cycle.budgetType === 'weekly' ? 'Weekly Budget' : 'Monthly Budget',
        overview,
        filteredExpenses,
        purchaseCount: expenses.length,
        dailyBudget: expected?.dailyBudget ?? 0,
        expectedSpend: expected?.expectedSpend ?? 0,
        statusLabel: overview.overspent > 0 ? 'Over Budget' : overview.daysLeft === 0 ? 'Under Budget' : 'In Progress'
      };
    });
  });

  constructor() {
    void this.expenseService.load().then(() => {
      const active = this.expenseService.getActiveBudgetCycle()?.id;
      this.expandedCycleIds.set(active ? [active] : this.cycleCards().slice(0, 1).map((cycle) => cycle.id));
    });
  }

  protected toggleDetails(cycleId: string): void {
    const expanded = new Set(this.expandedCycleIds());
    if (expanded.has(cycleId)) {
      expanded.delete(cycleId);
    } else {
      expanded.add(cycleId);
    }
    this.expandedCycleIds.set([...expanded]);
  }

  protected isExpanded(cycleId: string): boolean {
    return this.expandedCycleIds().includes(cycleId);
  }

  protected formatAmount(amount: number, overview?: BudgetOverview): string {
    return formatCurrencyAmount(amount, overview?.cycle.currency ?? this.expenseService.getDisplayCurrency());
  }

  protected expenseTotal(expense: Expense): number {
    return typeof expense.totalAmount === 'number' && Number.isFinite(expense.totalAmount) ? expense.totalAmount : expense.amount;
  }

  protected categoryLabel(category: ExpenseCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected async goBack(): Promise<void> {
    await this.navigationHistory.back('/tabs/expenses');
  }
}
