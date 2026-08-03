import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';
import { addOutline, alertCircleOutline, calendarOutline, chevronDownOutline, informationCircleOutline, walletOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { ExpenseCategory } from '../models/expense.model';
import { BudgetOverview, ExpenseService, ExpectedSpendSummary } from '../services/expense.service';

@Component({
  selector: 'app-expenses-dashboard-page',
  standalone: true,
  imports: [IonContent, IonFab, IonFabButton, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="expenses-content">
      <main class="page-shell app-mobile-shell app-mobile-shell--tabbed" [class.page-shell--empty]="!hasBudget() || !overview()">
        @if (!hasBudget()) {
          <section class="empty-state app-mobile-card">
            <h2>No budget configured.</h2>
            <p>Set up your weekly or monthly budget to start tracking spending.</p>
            <a class="primary-btn" [routerLink]="['/tabs/expenses/budget']">Configure Budget</a>
          </section>
        } @else if (!overview()) {
          <section class="empty-state app-mobile-card">
            <h2>Budget starts soon</h2>
            <p>Your selected budget cycle has not started yet.</p>
          </section>
        } @else {
          <header class="expenses-header">
            <div class="header-top">
              <div class="title-group">
                <ion-icon aria-hidden="true" [icon]="walletIcon" class="header-icon" />
                <h1 class="header-title">{{ overview()!.cycle.budgetType === 'weekly' ? 'Weekly Expenses' : 'Monthly Expenses' }}</h1>
              </div>
            </div>
            @if (cycleOptions().length > 0) {
              <label class="cycle-picker cycle-picker--plain" aria-label="Select budget cycle">
                <span class="cycle-picker__label">Cycle</span>
                <div class="cycle-picker__control" [class.cycle-picker__control--active]="isViewingActiveCycle()" [class.cycle-picker__control--past]="!isViewingActiveCycle()">
                  <ion-icon [icon]="calendarIcon" />
                  <select [value]="selectedCycleId()" (change)="onCycleChange($event)">
                    @for (cycle of cycleOptions(); track cycle.id) {
                      <option [value]="cycle.id">{{ cycle.label }}</option>
                    }
                  </select>
                  <ion-icon [icon]="chevronDownIcon" class="cycle-picker__chevron" />
                </div>
                <span class="cycle-picker__meta" [class.cycle-picker__meta--active]="isViewingActiveCycle()">
                  {{ isViewingActiveCycle() ? 'Current cycle' : 'Past cycle' }}
                </span>
              </label>
            }
          </header>

          <section class="summary-card app-mobile-card">
            <div class="summary-head">
              <div>
                <h2>Budget Overview</h2>
                <p class="cycle-caption">{{ cycleLabel() }}</p>
              </div>
              <span class="status-pill" [class]="statusClass()">{{ statusTitle() }}</span>
            </div>

            <div class="overview-grid">
              <article class="overview-cell">
                <p>Budget Amount</p>
                <strong>{{ formatAmount(overview()!.budgetAmount) }}</strong>
              </article>
              <article class="overview-cell">
                <p>Spent</p>
                <strong>{{ formatAmount(overview()!.spent) }}</strong>
              </article>
              <article class="overview-cell">
                <p>{{ overview()!.overspent > 0 ? 'Overspent' : 'Remaining' }}</p>
                <strong [class.alert]="overview()!.overspent > 0">{{ formatAmount(overview()!.overspent > 0 ? overview()!.overspent : overview()!.remainingDisplay) }}</strong>
                <small>{{ summarySubLabel() }}</small>
              </article>
              <article class="overview-cell">
                <p>Days Left</p>
                <strong>{{ overview()!.daysLeft }} days</strong>
                <small>In this cycle</small>
              </article>
            </div>

            <div class="usage-head">
              <span>{{ usageLabel() }}</span>
              <span>{{ formatAmount(overview()!.budgetAmount) }}</span>
            </div>
            <div class="progress-track">
              <div class="progress-value" [class]="progressClass()" [style.width.%]="progressWidth()"></div>
            </div>
            <small>{{ usageSubcopy() }}</small>

            <p class="status-message" [class]="statusClass()">{{ statusMessage() }}</p>
          </section>

          <section class="expected-card app-mobile-card">
            <div class="card-head">
              <div>
                <h3>Expected Spend ({{ overview()!.daysLeft }} days left)</h3>
                <p>Based on your budget and cycle length</p>
              </div>
              <button type="button" class="info-button" (click)="showExpectedSpendInfo()" aria-label="How expected spend is calculated">
                <ion-icon [icon]="infoIcon" />
              </button>
            </div>
            <strong class="expected-amount" [class]="statusClass()">{{ formatAmount(expected()!.expectedSpend) }}</strong>
            <div class="expected-stats">
              <p>Expected per day: <strong>{{ formatAmount(expected()!.dailyBudget) }}</strong></p>
              <p>{{ expectedSupportCopy() }}</p>
            </div>
          </section>

          @if (warning()) {
            <section class="warning-card app-mobile-card">
              <div class="warning-head">
                <ion-icon [icon]="warningIcon" />
                <h3>Warning</h3>
              </div>
              <p>Only {{ formatAmount(warning()!.remaining) }} remains with {{ warning()!.daysLeft }} days left in this cycle.</p>
              <p>Recommended spending: {{ formatAmount(warning()!.recommendedDailyLimit) }} per day maximum.</p>
            </section>
          }

          <section class="cards app-mobile-card">
            <div class="section-head">
              <h3>Category Summary</h3>
              <a [routerLink]="['/tabs/expenses/analytics']">View Analytics</a>
            </div>
            @if (categoryTotals().length === 0) {
              <p class="empty-copy">No purchases recorded for this cycle yet.</p>
            } @else {
              <div class="chips-grid">
                @for (category of categoryTotals(); track category.category) {
                  <article class="category-chip">
                    <p>{{ categoryLabel(category.category) }}</p>
                    <strong>{{ formatAmount(category.total) }}</strong>
                  </article>
                }
              </div>
            }
          </section>

          <section class="cards app-mobile-card">
            <div class="section-head">
              <h3>Recent Purchases</h3>
              <a [routerLink]="['/tabs/expenses/history']">View History</a>
            </div>
            @if (recentExpenses().length === 0) {
              <p class="empty-copy">No purchases recorded for this cycle yet.</p>
            } @else {
              @for (expense of recentExpenses(); track expense.id) {
                <article class="expense-item" [routerLink]="['/tabs/expenses', expense.id]">
                  <div class="expense-main">
                    <div>
                      <strong>{{ expense.title }}</strong>
                      <p>{{ categoryLabel(expense.category) }} · {{ formatDate(expense.date) }}</p>
                    </div>
                  </div>
                  <div class="amount-wrap"><strong>{{ formatAmount(expenseTotal(expense)) }}</strong></div>
                </article>
              }
            }
          </section>

          <section class="actions app-mobile-card">
            <a [routerLink]="['/tabs/expenses/budget']">Budget Settings</a>
            <a [routerLink]="['/tabs/expenses/history']">View History</a>
            <a [routerLink]="['/tabs/expenses/analytics']">View Analytics</a>
          </section>
        }
      </main>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button [routerLink]="['/tabs/expenses/new']" class="add-fab" aria-label="Add expense">
          <ion-icon [icon]="addIcon" aria-hidden="true" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#f4f8f5; }
    .expenses-content {
      --background:#f6f8f7;
      --padding-top: 0;
      --padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4.9rem);
    }
    .page-shell { padding-top:0; padding-bottom:0; }
    .page-shell--empty {
      padding-top: calc(env(safe-area-inset-top, 0px) + 1rem);
      align-content: start;
    }
    .expenses-header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--app-header-background);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--app-border-strong);
      padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.75rem;
      margin: 0 -1rem 1rem;
      display: grid;
      gap: 0.75rem;
    }
    .header-top { display:flex; justify-content:space-between; align-items:center; }
    .title-group { display:flex; align-items:center; gap:0.75rem; flex:1; }
    .header-icon { color: var(--app-primary); font-size: 2rem; }
    .header-title {
      margin:0;
      font-family:'Plus Jakarta Sans', 'Manrope', sans-serif;
      font-size:clamp(1.55rem, 5.2vw, 2rem);
      font-weight:800;
      letter-spacing:-0.01em;
      line-height:1.15;
      color:#0a8f5b;
    }
    .cycle-picker { display:grid; gap:0.28rem; }
    .cycle-picker__label { color:#6a8075; font-size:0.68rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; }
    .cycle-picker__control { display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:0.45rem; min-height:2.55rem; border:1px solid #d8e6dc; border-radius:999px; background:#fff; color:#345745; padding:0 0.75rem; box-shadow:0 10px 22px rgba(15, 125, 77, 0.08); transition:border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, transform 160ms ease; }
    .cycle-picker__control--active { border-color:#8ad0aa; background:linear-gradient(180deg, #f5fcf8 0%, #eaf8f0 100%); box-shadow:0 14px 28px rgba(20, 146, 85, 0.14); }
    .cycle-picker__control--past { border-color:#d8e1db; background:linear-gradient(180deg, #ffffff 0%, #f6f8f7 100%); }
    .cycle-picker:focus-within .cycle-picker__control { border-color:#149255; box-shadow:0 0 0 3px rgba(20, 146, 85, 0.14); }
    .cycle-picker--plain { -webkit-tap-highlight-color: transparent; }
    .cycle-picker--plain:focus-within .cycle-picker__control { border-color:#d8e6dc; box-shadow:0 10px 22px rgba(15, 125, 77, 0.08); }
    .cycle-picker--plain:focus-within .cycle-picker__control--active { border-color:#8ad0aa; box-shadow:0 14px 28px rgba(20, 146, 85, 0.14); }
    .cycle-picker--plain:focus-within .cycle-picker__control--past { border-color:#d8e1db; box-shadow:0 10px 22px rgba(15, 125, 77, 0.08); }
    .cycle-picker__control ion-icon { color:#5e7d6c; font-size:0.95rem; }
    .cycle-picker__chevron { font-size:0.85rem; }
    .cycle-picker select { border:none; background:transparent; color:#244636; font-size:0.85rem; font-weight:700; min-width:11rem; outline:none; appearance:none; padding:0; }
    .cycle-picker--plain select:focus { border-color:transparent; box-shadow:none; outline:none; }
    .cycle-picker__meta { color:#708679; font-size:0.72rem; font-weight:700; }
    .cycle-picker__meta--active { color:#12814c; }
    .page-shell { }
    .summary-card,.cards,.empty-state,.expected-card,.warning-card,.actions { }
    .empty-state { text-align:center; display:grid; gap:0.7rem; }
    .empty-state h2,.empty-state p { margin:0; }
    .empty-state p { color:#5d7569; }
    .primary-btn { color:#fff; background:#149255; text-decoration:none; font-weight:700; display:inline-flex; justify-content:center; align-items:center; min-height:2.8rem; border-radius:999px; }
    .summary-card { display:grid; gap:1rem; border:1px solid #e6efe8; box-shadow:0 12px 28px rgba(16, 74, 43, 0.06); }
    .summary-head { display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; }
    .summary-head h2,.summary-head p { margin:0; }
    .summary-head h2 { color:#11492f; font-size:1.05rem; font-weight:800; }
    .cycle-caption { color:#64796d; font-size:0.78rem; margin-top:0.2rem; }
    .status-pill { padding:0.42rem 0.7rem; border-radius:999px; font-size:0.7rem; font-weight:800; white-space:nowrap; }
    .status-pill.under_expected,.status-pill.on_track { background:#e6f7ee; color:#12814c; }
    .status-pill.over_expected { background:#fff0e2; color:#d97706; }
    .status-pill.budget_fully_used { background:#fdeaea; color:#dc2626; }
    .overview-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); border-top:1px solid #edf3ee; border-left:1px solid #edf3ee; border-radius:1rem; overflow:hidden; }
    .overview-cell { background:#fff; padding:0.95rem 0.9rem; min-height:5.75rem; border-right:1px solid #edf3ee; border-bottom:1px solid #edf3ee; display:grid; align-content:start; gap:0.22rem; }
    .overview-cell p { margin:0; font-size:0.76rem; color:#5d7569; }
    .overview-cell strong { display:block; color:#11291d; font-size:1.42rem; line-height:1.1; letter-spacing:-0.02em; }
    .overview-cell strong.alert { color:#dc2626; }
    .overview-cell small { color:#5d7569; font-size:0.75rem; }
    .usage-head { display:flex; justify-content:space-between; color:#3f5b4d; font-size:0.76rem; font-weight:700; }
    .progress-track { width:100%; height:0.5rem; border-radius:999px; background:#e8efe9; overflow:hidden; }
    .progress-value { height:100%; }
    .progress-value.green { background:linear-gradient(90deg, #149255, #4bbb87); }
    .progress-value.orange { background:linear-gradient(90deg, #f59e0b, #fbbf24); }
    .progress-value.red { background:linear-gradient(90deg, #ef4444, #f87171); }
    .status-message, .warning-card p, .empty-copy { margin:0; color:#4f665b; }
    .status-message { border-radius:1rem; padding:0.95rem 1rem; background:#f6fbf7; line-height:1.5; font-size:0.88rem; }
    .status-message.on_track, .status-message.under_expected { background:#fff8ec; border:1px solid #f4deba; }
    .status-message.over_expected, .status-message.budget_fully_used { background:#fff1f1; border:1px solid #f7caca; }
    .expected-card,.warning-card { display:grid; gap:0.7rem; }
    .expected-card { border:1px dashed #ff9b9b; background:#fff; box-shadow:0 10px 24px rgba(220, 38, 38, 0.05); }
    .card-head,.warning-head,.section-head { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; }
    .card-head h3,.warning-head h3,.section-head h3 { margin:0; }
    .card-head { align-items:flex-start; }
    .card-head p { margin:0.2rem 0 0; font-size:0.78rem; color:#667d70; }
    .info-button { display:inline-flex; align-items:center; justify-content:center; width:2rem; height:2rem; border:none; border-radius:999px; background:#eef6f0; color:#0f7d4d; padding:0; flex:0 0 auto; }
    .expected-amount { font-size:1.7rem; line-height:1.1; letter-spacing:-0.03em; color:#f59e0b; }
    .expected-amount.over_expected, .expected-amount.budget_fully_used { color:#ef4444; }
    .expected-amount.on_track, .expected-amount.under_expected { color:#f59e0b; }
    .expected-stats { display:grid; gap:0.2rem; }
    .expected-stats p { margin:0; color:#23382c; font-size:0.86rem; }
    .expected-stats strong { font-weight:800; }
    .warning-card { border:1px solid #f0d7b2; background:#fff9ef; }
    .warning-head { color:#d97706; justify-content:flex-start; }
    .section-head { margin-bottom:0.8rem; }
    .chips-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap:0.5rem; }
    .category-chip { background:#fff; border:1px solid #d8e9de; border-radius:12px; padding:0.75rem; text-align:left; display:grid; gap:0.25rem; }
    .category-chip p { margin:0; color:#395747; font-size:0.82rem; }
    .expense-item { display:flex; justify-content:space-between; align-items:center; gap:0.7rem; padding:0.72rem 0; border-bottom:1px solid #edf5ef; color:inherit; text-decoration:none; }
    .expense-item:last-child { border-bottom:none; }
    .expense-main p { margin:0.1rem 0 0; color:#5f786b; font-size:0.82rem; }
    .amount-wrap { display:grid; justify-items:end; }
    .section-head a, .actions a { color:#0f7d4d; text-decoration:none; font-weight:700; }
    .actions { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:0.55rem; }
    .actions a { text-align:center; font-size:0.84rem; }
    .add-fab { --background:#149255; --border-radius:18px; --box-shadow:0 12px 22px rgba(20,146,85,0.35); width:3.4rem; height:3.4rem; }

    @media (max-width: 520px) {
      .cycle-picker { width:100%; justify-items:stretch; }
      .cycle-picker__control { width:100%; }
      .cycle-picker select { min-width:0; width:100%; }
      .summary-head { grid-template-columns:1fr; display:grid; }
      .actions { grid-template-columns:repeat(3, minmax(0, 1fr)); }
      .actions a { font-size:0.78rem; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesDashboardPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly alertController = inject(AlertController);

  protected readonly addIcon = addOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly chevronDownIcon = chevronDownOutline;
  protected readonly warningIcon = alertCircleOutline;
  protected readonly infoIcon = informationCircleOutline;
  protected readonly walletIcon = walletOutline;
  protected readonly selectedCycleId = signal('');
  protected readonly hasBudget = computed(() => !!this.expenseService.getBudgetSettings());
  protected readonly cycleOptions = computed(() =>
    this.expenseService.getBudgetCycles().map((cycle) => ({
      id: cycle.id,
      label: this.expenseService.formatCycleLabel(cycle)
    }))
  );
  protected readonly activeCycleId = computed(() => {
    const selected = this.selectedCycleId();
    if (selected) {
      return selected;
    }
    return this.expenseService.getActiveBudgetCycle()?.id ?? this.cycleOptions()[0]?.id ?? '';
  });
  protected readonly isViewingActiveCycle = computed(
    () => this.activeCycleId().length > 0 && this.activeCycleId() === (this.expenseService.getActiveBudgetCycle()?.id ?? '')
  );
  protected readonly overview = computed(() => this.expenseService.getCycleOverview(this.activeCycleId()));
  protected readonly expected = computed(() => this.expenseService.getExpectedSpendSummary(this.activeCycleId()));
  protected readonly warning = computed(() => this.expenseService.getRiskWarning(this.activeCycleId()));
  protected readonly categoryTotals = computed(() => this.expenseService.getCycleCategoryTotals(this.activeCycleId()));
  protected readonly recentExpenses = computed(() => this.expenseService.getCycleExpenses(this.activeCycleId()).slice(0, 5));

  constructor() {
    void this.expenseService.load().then(() => {
      const activeCycleId = this.expenseService.getActiveBudgetCycle()?.id ?? this.cycleOptions()[0]?.id ?? '';
      this.selectedCycleId.set(activeCycleId);
    });
  }

  protected onCycleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    this.selectedCycleId.set(value);
  }

  protected formatAmount(amount: number): string {
    return formatCurrencyAmount(amount, this.overview()?.cycle.currency ?? this.expenseService.getDisplayCurrency());
  }

  protected expenseTotal(expense: { amount: number; totalAmount?: number }): number {
    return typeof expense.totalAmount === 'number' && Number.isFinite(expense.totalAmount) ? expense.totalAmount : expense.amount;
  }

  protected async showExpectedSpendInfo(): Promise<void> {
    const overview = this.overview();
    const expected = this.expected();
    if (!overview || !expected) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Expected Spend',
      cssClass: 'expected-spend-alert',
      message:
        `Daily budget\n` +
        `${this.formatAmount(overview.budgetAmount)} divided by ${overview.totalDays} days = ${this.formatAmount(expected.dailyBudget)} per day\n\n` +
        `Expected spend\n` +
        `${overview.daysElapsed} day${overview.daysElapsed === 1 ? '' : 's'} elapsed x ${this.formatAmount(expected.dailyBudget)} = ${this.formatAmount(expected.expectedSpend)}\n\n` +
        `Spent so far\n` +
        `${this.formatAmount(overview.spent)}`,
      buttons: ['OK']
    });

    await alert.present();
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }

  protected categoryLabel(category: ExpenseCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected cycleLabel(): string {
    const cycle = this.overview()?.cycle;
    return cycle ? this.expenseService.formatCycleLabel(cycle) : '';
  }

  protected statusTitle(): string {
    const status = this.expected()?.status;
    if (status === 'budget_fully_used') {
      return 'Budget Fully Used';
    }
    if (status === 'over_expected') {
      return 'Spending Faster Than Planned';
    }
    if (status === 'on_track') {
      return 'On Track';
    }
    return 'Under Expected';
  }

  protected progressWidth(): number {
    return Math.min(100, this.overview()?.progressPercent ?? 0);
  }

  protected progressClass(): string {
    const progress = this.overview()?.progressPercent ?? 0;
    if (progress >= 100) {
      return 'red';
    }
    if (progress >= 81) {
      return 'orange';
    }
    return 'green';
  }

  protected statusClass(): string {
    return this.expected()?.status ?? 'under_expected';
  }

  protected statusMessage(): string {
    const expected = this.expected();
    const overview = this.overview();
    if (!expected || !overview) {
      return '';
    }
    if (expected.status === 'budget_fully_used') {
      return 'Any additional spending will be considered overspending.';
    }
    if (expected.status === 'over_expected') {
      return `You have spent ${this.formatAmount(expected.difference)} more than expected for this point in the cycle.`;
    }
    if (expected.status === 'on_track') {
      return 'Your spending is aligned with your budget.';
    }
    return `You are ${this.formatAmount(Math.abs(expected.difference))} below expected spending.`;
  }

  protected summarySubLabel(): string {
    const overview = this.overview();
    if (!overview) {
      return '';
    }
    if (overview.overspent > 0) {
      return `${Math.max(0, overview.progressPercent - 100)}% over budget`;
    }
    return `${overview.progressPercent}% of budget`;
  }

  protected usageLabel(): string {
    const overview = this.overview();
    if (!overview) {
      return '';
    }
    return overview.overspent > 0 ? 'Over budget' : 'Budget usage';
  }

  protected usageSubcopy(): string {
    const overview = this.overview();
    if (!overview) {
      return '';
    }
    if (overview.overspent > 0) {
      return `${overview.progressPercent}% used`;
    }
    if (overview.saved > 0 && overview.daysLeft === 0) {
      return `Saved ${this.formatAmount(overview.saved)} this cycle`;
    }
    return `${overview.progressPercent}% of your budget used`;
  }

  protected expectedSupportCopy(): string {
    const overview = this.overview();
    if (!overview) {
      return '';
    }
    return `Calculated from ${overview.totalDays} cycle days and ${overview.daysElapsed} day${overview.daysElapsed === 1 ? '' : 's'} elapsed.`;
  }
}
