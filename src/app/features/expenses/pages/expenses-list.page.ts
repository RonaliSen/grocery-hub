import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, calendarOutline, chevronDownOutline, chevronUpOutline, searchOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { CATEGORY_EMOJI, categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import { Expense, ExpenseCategory } from '../models/expense.model';
import { BudgetOverview, ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expenses-list-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [FormsModule, IonContent, IonIcon, RouterLink],
  template: `
    <header class="page-header">
      <button type="button" class="icon-btn" (click)="goBack()" aria-label="Back">
        <ion-icon aria-hidden="true" [icon]="backIcon" />
      </button>
      <div class="header-text">
        <h1>Budget History</h1>
        <p>{{ cycleCards().length }} {{ cycleCards().length === 1 ? 'cycle' : 'cycles' }} tracked</p>
      </div>
      <span class="icon-btn icon-btn--ghost" aria-hidden="true"></span>
    </header>

    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell">
        @if (cycleCards().length === 0) {
          <section class="empty-card">
            <span class="empty-emoji" aria-hidden="true">🗂️</span>
            <h2>No budget configured.</h2>
            <p>Set up your weekly or monthly budget to start tracking spending.</p>
            <a class="primary-btn" [routerLink]="['/tabs/expenses/budget']">Configure Budget</a>
          </section>
        } @else {
          @let summary = historySummary();

          <!-- Overview hero -->
          <section class="hero-card" aria-label="History overview">
            <div class="hero-dots" aria-hidden="true"></div>
            <p class="hero-eyebrow">Your track record</p>
            <h2 class="hero-title">
              @if (summary.completed > 0) {
                <span class="hero-highlight">{{ summary.onBudget }} of {{ summary.completed }}</span>
                {{ summary.completed === 1 ? 'cycle' : 'cycles' }} on budget.
              } @else {
                Your first cycle is <span class="hero-highlight">in progress.</span>
              }
            </h2>
            <div class="hero-chips">
              <span class="hero-chip hero-chip--ok">{{ summary.onBudget }} under</span>
              <span class="hero-chip hero-chip--over">{{ summary.over }} over</span>
              <span class="hero-chip">{{ summary.inProgress }} in progress</span>
            </div>
            <div class="usage-bars" aria-hidden="true">
              <span class="usage-bars__limit"></span>
              @for (bar of summary.bars; track bar.id) {
                <span class="usage-col">
                  <span class="usage-area">
                    <span class="usage-bar" [class.is-over]="bar.over" [class.is-live]="bar.live" [style.height.%]="bar.height"></span>
                  </span>
                  <span class="usage-label">{{ bar.label }}</span>
                </span>
              }
            </div>
            <p class="hero-caption">Budget used per cycle · line marks 100%</p>
          </section>

          <label class="search-wrap">
            <span class="search-icon" aria-hidden="true"><ion-icon [icon]="searchIcon" /></span>
            <input
              type="search"
              placeholder="Search purchases across budget cycles..."
              aria-label="Search purchases across budget cycles"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
          </label>

          <section class="history-stack">
            @for (cycle of cycleCards(); track cycle.id) {
              @let o = cycle.overview;
              <article class="history-card" [class.is-over]="o.overspent > 0">
                <div class="card-head">
                  <div class="card-head__text">
                    <p class="card-kicker">{{ cycle.typeLabel }}</p>
                    <h2>{{ cycle.label }}</h2>
                  </div>
                  <span
                    class="status-pill"
                    [class.over]="o.overspent > 0"
                    [class.under]="o.overspent <= 0 && o.daysLeft === 0"
                    [class.live]="o.overspent <= 0 && o.daysLeft > 0"
                  >
                    {{ cycle.statusLabel }}
                  </span>
                </div>

                <div class="usage">
                  <div class="usage-track">
                    <span
                      class="usage-fill"
                      [class.is-warn]="o.progressPercent >= 81 && o.progressPercent < 100"
                      [class.is-over]="o.progressPercent >= 100"
                      [style.width.%]="o.progressPercent > 100 ? 100 : o.progressPercent"
                    ></span>
                  </div>
                  <div class="meta-strip">
                    <span><ion-icon aria-hidden="true" [icon]="calendarIcon" /> {{ cycle.purchaseCount }} purchases</span>
                    <span>{{ o.totalDays }} days</span>
                    <strong>{{ o.progressPercent }}% used</strong>
                  </div>
                </div>

                <div class="summary-grid">
                  <article class="mini-tile mini-tile--budget">
                    <p>Budget</p>
                    <strong>{{ formatAmount(o.budgetAmount, o) }}</strong>
                  </article>
                  <article class="mini-tile mini-tile--spent">
                    <p>Spent</p>
                    <strong>{{ formatAmount(o.spent, o) }}</strong>
                  </article>
                </div>

                <div class="result-panel" [class.over]="o.overspent > 0" [class.under]="o.overspent <= 0">
                  <span class="result-emoji" aria-hidden="true">
                    {{ o.overspent > 0 ? '⚠️' : o.daysLeft === 0 ? '🎉' : '⏳' }}
                  </span>
                  <div>
                    @if (o.overspent > 0) {
                      <p class="result-value">Overspent {{ formatAmount(o.overspent, o) }}</p>
                      <p class="result-copy">Status: Over Budget</p>
                    } @else {
                      <p class="result-value">
                        {{ o.daysLeft === 0 ? 'Saved' : 'Remaining' }}
                        {{ formatAmount(o.daysLeft === 0 ? o.saved : o.remainingDisplay, o) }}
                      </p>
                      <p class="result-copy">
                        Status:
                        {{ o.daysLeft === 0 ? 'Under Budget' : 'In Progress' }}
                      </p>
                    }
                  </div>
                </div>

                <button
                  type="button"
                  class="details-toggle"
                  [attr.aria-expanded]="isExpanded(cycle.id)"
                  (click)="toggleDetails(cycle.id)"
                >
                  <span>{{ isExpanded(cycle.id) ? 'Hide Details' : 'View Details' }}</span>
                  <span class="details-toggle__icon" aria-hidden="true">
                    <ion-icon [icon]="isExpanded(cycle.id) ? upIcon : downIcon" />
                  </span>
                </button>

                @if (isExpanded(cycle.id)) {
                  <section class="details-panel">
                    <div class="detail-metrics">
                      <article>
                        <p>Remaining</p>
                        <strong>{{ formatAmount(o.remainingDisplay, o) }}</strong>
                      </article>
                      <article>
                        <p>Days Left</p>
                        <strong>{{ o.daysLeft }}</strong>
                      </article>
                      <article>
                        <p>Daily Budget</p>
                        <strong>{{ formatAmount(cycle.dailyBudget, o) }}</strong>
                      </article>
                      <article>
                        <p>Expected Spend</p>
                        <strong>{{ formatAmount(cycle.expectedSpend, o) }}</strong>
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
                            <span class="expense-emoji" [style.--tile]="tileColor(expense.category)" aria-hidden="true">
                              {{ categoryEmoji(expense.category) }}
                            </span>
                            <span class="expense-main">
                              <strong>{{ expense.title }}</strong>
                              <small>{{ categoryLabel(expense.category) }} · {{ formatDate(expense.date) }}</small>
                            </span>
                            <span class="expense-amount">{{ formatAmount(expenseTotal(expense), o) }}</span>
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
    /* Budget history — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
    :host { display:flex; flex-direction:column; height:100%; background:var(--h-canvas); }
    .page-content { --padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 2rem); }
    .page-content::part(background) { background:var(--h-canvas); }
    ion-icon { flex-shrink:0; }

    .page-header {
      position:sticky; top:0; z-index:20;
      display:grid; grid-template-columns:44px minmax(0, 1fr) 44px; align-items:center; gap:12px;
      padding:calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent); backdrop-filter:blur(18px);
    }
    .icon-btn {
      width:44px; height:44px; padding:0; border-radius:50%; border:1px solid var(--h-line);
      background:var(--h-surface); color:var(--h-ink); display:grid; place-items:center; font-size:20px;
    }
    .icon-btn--ghost { visibility:hidden; }
    .header-text { text-align:center; }
    .header-text h1 { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.03em; color:var(--h-ink); }
    .header-text p { margin:2px 0 0; font-size:0.76rem; font-weight:600; color:var(--h-muted); }

    .shell {
      width:min(100%, 720px); margin:0 auto; padding:4px var(--h-gutter) 24px;
      display:grid; grid-template-columns:minmax(0, 1fr); gap:16px;
    }

    /* Hero */
    .hero-card {
      position:relative; isolation:isolate; overflow:hidden;
      display:grid; justify-items:start; gap:12px; padding:20px 22px 18px; border-radius:30px; color:#fff;
      background:
        radial-gradient(70% 80% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
        radial-gradient(45% 55% at 0% 0%, rgba(201, 184, 255, 0.22), transparent 70%),
        var(--h-hero-bg);
      outline:1px solid var(--h-hero-border); outline-offset:-1px;
      box-shadow:0 24px 40px -24px rgba(22, 20, 29, 0.6);
    }
    .hero-dots {
      position:absolute; z-index:-1; inset:0 0 auto auto; width:55%; height:70%;
      background-image:radial-gradient(rgba(255,255,255,0.16) 1.2px, transparent 1.4px); background-size:14px 14px;
      mask-image:linear-gradient(225deg, #000 10%, transparent 70%);
    }
    .hero-eyebrow {
      margin:0; padding:6px 12px; border-radius:10px; background:var(--h-lilac); color:#16141d;
      font-size:0.68rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; transform:rotate(-3deg);
    }
    .hero-title { margin:0; font-size:clamp(1.45rem, 5.4vw, 1.9rem); font-weight:800; line-height:1.1; letter-spacing:-0.035em; color:#fff; }
    .hero-highlight { color:var(--h-sun); }
    .hero-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .hero-chip {
      display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px;
      background:rgba(255,255,255,0.1); font-size:0.72rem; font-weight:700;
    }
    .hero-chip::before { content:''; width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,0.6); }
    .hero-chip--ok::before { background:#4cc38a; }
    .hero-chip--over::before { background:#ff6369; }
    .usage-bars {
      --label-h:18px;
      position:relative; width:100%; height:calc(76px + var(--label-h)); margin-top:4px;
      display:flex; align-items:stretch; gap:8px;
    }
    .usage-bars__limit {
      position:absolute; left:0; right:0; bottom:calc(var(--label-h) + (100% - var(--label-h)) / 1.2); height:0;
      border-top:1.5px dashed rgba(255,255,255,0.35);
    }
    .usage-col { flex:1; max-width:48px; display:flex; flex-direction:column; }
    .usage-area { flex:1; position:relative; }
    .usage-bar {
      position:absolute; left:0; right:0; bottom:0; min-height:4px; border-radius:8px 8px 3px 3px;
      background:linear-gradient(180deg, #8be0b4, #4cc38a);
    }
    .usage-label {
      height:var(--label-h); padding-top:4px; text-align:center; white-space:nowrap;
      font-size:0.58rem; font-weight:700; color:rgba(255,255,255,0.6);
    }
    .usage-bar.is-over { background:linear-gradient(180deg, #ffa3a6, #ff6369); }
    .usage-bar.is-live { background:linear-gradient(180deg, #ffe29a, var(--h-sun)); }
    .hero-caption { margin:-4px 0 0; font-size:0.7rem; font-weight:600; color:rgba(255,255,255,0.6); }

    /* Search */
    .search-wrap {
      position:relative; display:flex; align-items:center; height:52px; border-radius:999px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .search-wrap:focus-within { border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow); }
    .search-icon {
      position:absolute; left:7px; width:38px; height:38px; border-radius:50%; display:grid; place-items:center;
      background:var(--h-accent); color:#fff; font-size:18px; pointer-events:none;
    }
    .search-wrap input {
      width:100%; height:100%; border:none; border-radius:inherit; background:transparent; padding:0 16px 0 56px;
      color:var(--h-ink); font-size:0.92rem; font-weight:600;
    }
    .search-wrap input::placeholder { color:var(--h-muted); font-weight:500; }
    :host .search-wrap input[type='search']:focus { outline:none; box-shadow:none; }

    /* Cycle cards */
    .history-stack { display:grid; gap:14px; }
    .history-card {
      display:grid; gap:14px; padding:18px; border-radius:26px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .card-head__text { min-width:0; }
    .card-kicker {
      display:inline-block; margin:0; padding:3px 9px; border-radius:8px; background:var(--h-tile-2); color:var(--h-ink);
      font-size:0.62rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
    }
    .card-head h2 { margin:6px 0 0; font-size:1.2rem; font-weight:800; letter-spacing:-0.02em; line-height:1.2; color:var(--h-ink); }
    .status-pill { padding:6px 11px; border-radius:999px; font-size:0.72rem; font-weight:800; white-space:nowrap; }
    .status-pill.under { background:color-mix(in srgb, var(--h-ok) 16%, transparent); color:var(--h-ok); }
    .status-pill.over { background:var(--h-danger-surface); color:var(--h-danger); }
    .status-pill.live { background:var(--h-btn-bg); color:var(--h-btn-fg); }

    .usage { display:grid; gap:8px; }
    .usage-track { height:10px; border-radius:999px; background:var(--h-canvas); overflow:hidden; }
    .usage-fill { display:block; height:100%; min-width:6px; border-radius:inherit; background:var(--h-ok); }
    .usage-fill.is-warn { background:var(--h-warn); }
    .usage-fill.is-over { background:var(--h-danger); }
    .meta-strip { display:flex; align-items:center; gap:12px; font-size:0.76rem; font-weight:600; color:var(--h-muted); }
    .meta-strip span { display:inline-flex; align-items:center; gap:5px; }
    .meta-strip strong { margin-left:auto; color:var(--h-ink); font-weight:800; }

    .summary-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .mini-tile { padding:12px 14px; border-radius:18px; background:var(--tile); }
    .mini-tile--budget { --tile:var(--h-tile-4); }
    .mini-tile--spent { --tile:var(--h-tile-1); }
    .mini-tile p, .detail-metrics p { margin:0; font-size:0.72rem; font-weight:700; color:var(--h-ink-soft); }
    .mini-tile strong { display:block; margin-top:2px; font-family:var(--h-display); font-size:1.2rem; font-weight:800; letter-spacing:-0.03em; color:var(--h-ink); }

    .result-panel { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px; }
    .result-panel.under { background:color-mix(in srgb, var(--h-ok) 12%, transparent); }
    .result-panel.over { background:var(--h-danger-surface); }
    .result-emoji {
      width:38px; height:38px; flex-shrink:0; border-radius:12px; display:grid; place-items:center;
      background:var(--h-surface); font-size:1.1rem;
    }
    .result-value, .result-copy { margin:0; }
    .result-value { font-size:0.98rem; font-weight:800; color:var(--h-ink); }
    .result-panel.over .result-value { color:var(--h-danger); }
    .result-copy { margin-top:1px; font-size:0.76rem; font-weight:600; color:var(--h-muted); }

    .details-toggle {
      width:100%; min-height:48px; padding:0 6px 0 18px; border:1px solid var(--h-line); border-radius:999px;
      background:var(--h-canvas); color:var(--h-ink); display:flex; align-items:center; justify-content:space-between;
      font-size:0.88rem; font-weight:800;
    }
    .details-toggle__icon {
      width:36px; height:36px; border-radius:50%; display:grid; place-items:center;
      background:var(--h-btn-bg); color:var(--h-btn-fg); font-size:16px;
    }

    .details-panel { display:grid; gap:14px; }
    .detail-metrics { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
    .detail-metrics article { padding:12px; border-radius:16px; background:var(--h-canvas); }
    .detail-metrics strong { display:block; margin-top:2px; font-size:1rem; font-weight:800; color:var(--h-ink); }
    .purchases-wrap { display:grid; gap:4px; }
    .section-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:4px; }
    .section-head h3 { margin:0; font-size:1rem; font-weight:800; color:var(--h-ink); }
    .section-head span {
      min-width:28px; height:24px; padding:0 8px; border-radius:999px; display:grid; place-items:center;
      background:var(--h-btn-bg); color:var(--h-btn-fg); font-size:0.72rem; font-weight:800;
    }
    .empty-copy { margin:0; color:var(--h-muted); font-size:0.86rem; }
    .expense-row {
      display:flex; align-items:center; gap:12px; padding:8px; margin:0 -8px; border-radius:16px;
      color:inherit; text-decoration:none;
    }
    .expense-row:active { background:var(--h-canvas); }
    .expense-emoji {
      width:42px; height:42px; flex-shrink:0; border-radius:14px; display:grid; place-items:center;
      background:var(--tile); font-size:1.15rem;
    }
    .expense-main { flex:1; min-width:0; display:grid; gap:2px; }
    .expense-main strong { font-size:0.92rem; font-weight:800; color:var(--h-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .expense-main small { font-size:0.74rem; font-weight:600; color:var(--h-muted); }
    .expense-amount { font-family:var(--h-display); font-size:0.95rem; font-weight:800; color:var(--h-ink); white-space:nowrap; }

    /* Empty */
    .empty-card {
      display:grid; justify-items:center; gap:10px; padding:36px 20px; border-radius:28px; text-align:center;
      background:var(--h-surface); border:2px dashed var(--h-line);
    }
    .empty-emoji {
      width:68px; height:68px; border-radius:22px; display:grid; place-items:center;
      background:var(--h-tile-3); font-size:2rem; transform:rotate(-6deg);
    }
    .empty-card h2 { margin:0; font-size:1.3rem; font-weight:800; color:var(--h-ink); }
    .empty-card p { margin:0; color:var(--h-ink-soft); }
    .primary-btn {
      margin-top:6px; min-height:48px; padding:0 22px; display:inline-flex; align-items:center; border-radius:999px;
      background:var(--h-accent); color:#fff; font-weight:800; text-decoration:none;
      box-shadow:0 12px 24px -12px var(--h-accent-glow);
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

  /**
   * Overview for the hero card. Uses counts and percentages only, so it stays
   * correct even if cycles were recorded in different currencies.
   */
  protected readonly historySummary = computed(() => {
    const cards = this.cycleCards();
    const completed = cards.filter((card) => card.overview.daysLeft === 0 || card.overview.overspent > 0);
    const over = cards.filter((card) => card.overview.overspent > 0).length;
    // Oldest → newest, most recent 8 cycles; heights scaled so 120% fills the chart.
    const bars = [...cards]
      .reverse()
      .slice(-8)
      .map((card) => ({
        id: card.id,
        label: card.label.split(' - ')[0] ?? card.label,
        height: Math.min(100, (card.overview.progressPercent / 120) * 100),
        over: card.overview.overspent > 0,
        live: card.overview.overspent <= 0 && card.overview.daysLeft > 0
      }));

    return {
      completed: completed.length,
      onBudget: completed.length - over,
      over,
      inProgress: cards.length - completed.length,
      bars
    };
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

  protected categoryEmoji(category: ExpenseCategory): string {
    return CATEGORY_EMOJI[category] ?? '🛒';
  }

  protected tileColor(category: ExpenseCategory): string {
    return categoryTileColor(category);
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
