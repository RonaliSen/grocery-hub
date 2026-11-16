import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, calendarOutline, chevronDownOutline, statsChartOutline, trendingUpOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { CATEGORY_EMOJI, categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expenses-breakdown-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon],
  template: `
    <header class="page-header">
      <button type="button" class="icon-btn" (click)="goBack()" aria-label="Back">
        <ion-icon aria-hidden="true" [icon]="backIcon" />
      </button>
      <div class="header-text">
        <h1>Analytics</h1>
        <p>Where your grocery money goes</p>
      </div>
      <span class="icon-btn icon-btn--ghost" aria-hidden="true"></span>
    </header>

    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell">
        @if (cycleOptions().length > 0) {
          <section class="filters" aria-label="Filters">
            <div class="cycle-row">
              <label class="select-wrap">
                <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                <select [value]="selectedCycleId()" (change)="onCycleChange($event)" aria-label="Select cycle">
                  @for (cycle of cycleOptions(); track cycle.id) {
                    <option [value]="cycle.id">{{ cycle.label }}</option>
                  }
                </select>
                <ion-icon aria-hidden="true" [icon]="downIcon" class="select-chevron" />
              </label>
              <p class="cycle-state" [class.cycle-state--active]="isViewingActiveCycle()">
                {{ isViewingActiveCycle() ? 'Current cycle selected' : 'Past cycle selected' }}
              </p>
            </div>

            <nav class="category-chips" aria-label="Select category">
              <button
                type="button"
                class="chip"
                [class.is-active]="categoryFilter() === 'All'"
                [attr.aria-pressed]="categoryFilter() === 'All'"
                (click)="categoryFilter.set('All')"
              >
                <span aria-hidden="true">🧺</span> All Categories
              </button>
              @for (category of categories; track category) {
                <button
                  type="button"
                  class="chip"
                  [class.is-active]="categoryFilter() === category"
                  [attr.aria-pressed]="categoryFilter() === category"
                  (click)="categoryFilter.set(category)"
                >
                  <span aria-hidden="true">{{ categoryEmoji(category) }}</span> {{ categoryLabels[category] }}
                </button>
              }
            </nav>
          </section>
        }

        @if (!overview() || filteredExpenses().length === 0) {
          <section class="empty">
            <span class="empty-emoji" aria-hidden="true">📊</span>
            <h2>Not enough data for analytics</h2>
            <p>Analytics will appear once purchases are added to a budget cycle.</p>
          </section>
        } @else {
          @let o = overview()!;
          @let e = expected()!;

          <!-- Total spent (ink hero) -->
          <section class="total-card" aria-label="Total Spent">
            <div class="hero-dots" aria-hidden="true"></div>
            <div class="total-top">
              <div>
                <p class="card-title">Total Spent</p>
                <strong class="total-amount">{{ formatAmount(o.spent) }}</strong>
                <small class="total-sub">
                  Expected {{ formatAmount(e.expectedSpend) }}
                  <span class="delta" [class]="'delta ' + e.status">
                    <ion-icon aria-hidden="true" [icon]="trendUpIcon" /> {{ statusLabel() }}
                  </span>
                </small>
              </div>
              <span class="round-icon" aria-hidden="true"><ion-icon [icon]="chartIcon" /></span>
            </div>

            <div class="compare">
              <div class="compare-track">
                <span class="compare-fill" [class.is-over]="o.spent > e.expectedSpend" [style.width.%]="pct(o.spent, o.budgetAmount)"></span>
                <span class="compare-marker" [style.left.%]="pct(e.expectedSpend, o.budgetAmount)"></span>
              </div>
              <div class="compare-legend">
                <span><i class="swatch swatch--spent"></i>Spent</span>
                <span><i class="swatch swatch--expected"></i>Expected today</span>
                <span class="compare-max">{{ formatAmount(o.budgetAmount) }}</span>
              </div>
            </div>
          </section>

          <section class="kpi-grid">
            <article class="kpi kpi--budget"><span aria-hidden="true">💰</span><p>Budget</p><strong>{{ formatAmount(o.budgetAmount) }}</strong></article>
            <article class="kpi kpi--remaining"><span aria-hidden="true">🪙</span><p>Remaining</p><strong>{{ formatAmount(o.remainingDisplay) }}</strong></article>
            <article class="kpi kpi--days"><span aria-hidden="true">📅</span><p>Days Left</p><strong>{{ o.daysLeft }}</strong></article>
            <article class="kpi kpi--daily"><span aria-hidden="true">🎯</span><p>Daily Budget</p><strong>{{ formatAmount(e.dailyBudget) }}</strong></article>
          </section>

          @if (topCategorySpend(); as top) {
            <section class="top-category-card" [style.--tile]="tileColor(top.category)">
              <span class="top-emoji" aria-hidden="true">{{ categoryEmoji(top.category) }}</span>
              <div class="top-category-content">
                <p class="top-category-label">Most Spend Category</p>
                <strong>{{ categoryLabel(top.category) }}</strong>
                <small>{{ top.percent }}% of this cycle</small>
              </div>
              <span class="top-amount">{{ formatAmount(top.total) }}</span>
            </section>
          }

          <section class="card chart-card">
            <div class="card-head">
              <h3>Spending by Category</h3>
              <span class="card-badge">{{ categoryRows().length }}</span>
            </div>
            <div class="chart-layout">
              <div class="donut" [style.background]="pieGradient()">
                <span class="donut-center">
                  <small>Total</small>
                  <strong>{{ formatAmount(o.spent) }}</strong>
                </span>
              </div>
              <div class="legend">
                @for (row of categoryRows(); track row.category) {
                  <div class="legend-row">
                    <span class="dot" [style.background]="colorAt(row.category)"></span>
                    <span class="name">{{ categoryEmoji(row.category) }} {{ categoryLabel(row.category) }}</span>
                    <span class="values">{{ formatAmount(row.total) }} <em>{{ row.percent }}%</em></span>
                  </div>
                }
              </div>
            </div>
          </section>

          <section class="card trend-card">
            <div class="card-head">
              <h3>Cycle Trend</h3>
              <span class="card-hint">Last {{ trend().length }} {{ trend().length === 1 ? 'cycle' : 'cycles' }}</span>
            </div>
            <div class="line-plot">
              <div class="y-labels">
                @for (tick of trendTicks(); track tick.value) { <span>{{ formatAmount(tick.value) }}</span> }
              </div>
              <div class="plot-area">
                <div class="line-grid"></div>
                <div class="bar-series" aria-hidden="true">
                  @for (point of trend(); track point.cycleId) {
                    <span
                      class="bar"
                      [class.is-selected]="point.cycleId === selectedCycleId()"
                      [style.height.%]="trendBarHeight(point.total)"
                      [style.background]="trendBarGradient(point.category)"
                    ></span>
                  }
                </div>
                <div class="x-labels">
                  @for (point of trend(); track point.cycleId) {
                    <span [class.is-selected]="point.cycleId === selectedCycleId()">{{ shortLabel(point.label) }}</span>
                  }
                </div>
              </div>
            </div>
          </section>
        }
      </main>
    </ion-content>
  `,
  styles: [`
    /* Analytics — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
    :host { display:flex; flex-direction:column; height:100%; background:var(--h-canvas); color:var(--h-ink); }
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
    .header-text h1 { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.03em; }
    .header-text p { margin:2px 0 0; font-size:0.76rem; font-weight:600; color:var(--h-muted); }

    .shell {
      width:min(100%, 720px); margin:0 auto; padding:4px var(--h-gutter) 24px;
      display:grid; grid-template-columns:minmax(0, 1fr); gap:16px;
    }

    /* Filters */
    .filters { display:grid; gap:10px; }
    .cycle-row { display:flex; align-items:center; gap:10px; }
    .select-wrap {
      position:relative; flex:1; min-width:0; display:flex; align-items:center; gap:8px; min-height:46px; padding:0 14px;
      border:1px solid var(--h-line); border-radius:999px; background:var(--h-surface); color:var(--h-muted);
    }
    .select-wrap:focus-within { border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow); }
    .select-wrap select {
      flex:1; min-width:0; border:none; background:transparent; padding:0; appearance:none;
      color:var(--h-ink); font-size:0.88rem; font-weight:800;
    }
    :host .select-wrap select:focus { outline:none; box-shadow:none; }
    .cycle-state {
      margin:0; padding:6px 10px; border-radius:999px; white-space:nowrap;
      background:var(--h-surface); color:var(--h-muted); font-size:0.68rem; font-weight:800;
    }
    .cycle-state--active { background:var(--h-btn-bg); color:var(--h-btn-fg); }
    .category-chips {
      display:flex; gap:8px; margin:-4px calc(var(--h-gutter) * -1); padding:4px var(--h-gutter);
      scroll-padding-inline:var(--h-gutter); overflow-x:auto; scrollbar-width:none;
    }
    .category-chips::-webkit-scrollbar { display:none; }
    .chip {
      flex-shrink:0; display:inline-flex; align-items:center; gap:6px; min-height:38px; padding:0 14px 0 11px;
      border:1px solid var(--h-line); border-radius:999px; background:var(--h-surface);
      color:var(--h-ink-soft); font-size:0.8rem; font-weight:700;
    }
    .chip.is-active { background:var(--h-btn-bg); border-color:var(--h-btn-bg); color:var(--h-btn-fg); }

    /* Ink total card */
    .total-card {
      position:relative; isolation:isolate; overflow:hidden;
      display:grid; gap:18px; padding:20px 22px 22px; border-radius:30px; color:#fff;
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
    .total-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .card-title { margin:0; font-size:0.7rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.6); }
    .total-amount { display:block; margin-top:4px; font-family:var(--h-display); font-size:clamp(2rem, 9vw, 2.6rem); font-weight:800; letter-spacing:-0.04em; line-height:1; color:var(--h-sun); }
    .total-sub { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:8px; font-size:0.8rem; font-weight:600; color:rgba(255,255,255,0.72); }
    .delta {
      display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:999px;
      background:rgba(76, 195, 138, 0.2); color:#8be0b4; font-size:0.72rem; font-weight:800;
    }
    .delta.over_expected { background:rgba(255, 178, 36, 0.2); color:#ffcf70; }
    .delta.budget_fully_used { background:rgba(255, 99, 105, 0.2); color:#ffa3a6; }
    .round-icon {
      width:46px; height:46px; flex-shrink:0; border-radius:16px; display:grid; place-items:center;
      background:var(--h-sun); color:#16141d; font-size:22px; transform:rotate(-6deg);
    }
    .compare { display:grid; gap:8px; }
    .compare-track { position:relative; height:12px; border-radius:999px; background:rgba(255,255,255,0.14); }
    .compare-fill { position:absolute; inset:0 auto 0 0; max-width:100%; border-radius:inherit; background:#4cc38a; }
    .compare-fill.is-over { background:linear-gradient(90deg, var(--h-sun), var(--h-accent)); }
    .compare-marker {
      position:absolute; top:-5px; bottom:-5px; width:3px; margin-left:-1.5px; border-radius:2px; background:#fff;
      box-shadow:0 0 0 3px rgba(22, 20, 29, 0.5);
    }
    .compare-legend { display:flex; align-items:center; gap:14px; font-size:0.7rem; font-weight:700; color:rgba(255,255,255,0.7); }
    .compare-legend span { display:inline-flex; align-items:center; gap:6px; }
    .compare-max { margin-left:auto; }
    .swatch { width:10px; height:10px; border-radius:3px; }
    .swatch--spent { background:linear-gradient(90deg, var(--h-sun), var(--h-accent)); }
    .swatch--expected { width:3px; background:#fff; }

    /* KPI tiles */
    .kpi-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .kpi { display:grid; gap:2px; padding:14px; border-radius:22px; background:var(--tile); }
    .kpi--budget { --tile:var(--h-tile-4); }
    .kpi--remaining { --tile:var(--h-tile-2); }
    .kpi--days { --tile:var(--h-tile-3); }
    .kpi--daily { --tile:var(--h-tile-1); }
    .kpi span {
      width:34px; height:34px; margin-bottom:6px; border-radius:12px; display:grid; place-items:center;
      background:var(--h-surface); font-size:1.05rem;
    }
    .kpi p { margin:0; font-size:0.72rem; font-weight:700; color:var(--h-ink-soft); }
    .kpi strong { font-family:var(--h-display); font-size:1.25rem; font-weight:800; letter-spacing:-0.03em; }

    /* Top category */
    .top-category-card { display:flex; align-items:center; gap:14px; padding:16px; border-radius:24px; background:var(--tile); }
    .top-emoji {
      width:56px; height:56px; flex-shrink:0; border-radius:18px; display:grid; place-items:center;
      background:var(--h-surface); font-size:1.8rem; transform:rotate(-6deg);
    }
    .top-category-content { flex:1; min-width:0; display:grid; }
    .top-category-label { margin:0; font-size:0.64rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--h-ink-soft); }
    .top-category-content strong { font-size:1.15rem; font-weight:800; }
    .top-category-content small { font-size:0.76rem; font-weight:600; color:var(--h-ink-soft); }
    .top-amount { font-family:var(--h-display); font-size:1.2rem; font-weight:800; white-space:nowrap; }

    /* Chart cards */
    .card {
      display:grid; gap:14px; padding:18px; border-radius:26px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .card-head h3 { margin:0; font-size:1.05rem; font-weight:800; letter-spacing:-0.02em; }
    .card-badge {
      min-width:28px; height:24px; padding:0 8px; border-radius:999px; display:grid; place-items:center;
      background:var(--h-btn-bg); color:var(--h-btn-fg); font-size:0.72rem; font-weight:800;
    }
    .card-hint { font-size:0.74rem; font-weight:700; color:var(--h-muted); }

    .chart-layout { display:grid; grid-template-columns:136px minmax(0, 1fr); gap:16px; align-items:center; }
    .donut { position:relative; width:136px; height:136px; border-radius:50%; display:grid; place-items:center; }
    .donut-center {
      width:92px; height:92px; border-radius:50%; display:grid; place-content:center; text-align:center;
      background:var(--h-surface);
    }
    .donut-center small { font-size:0.62rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:var(--h-muted); }
    .donut-center strong { font-family:var(--h-display); font-size:0.92rem; font-weight:800; }
    .legend { display:grid; gap:8px; min-width:0; }
    .legend-row { display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:8px; font-size:0.78rem; }
    .dot { width:10px; height:10px; border-radius:4px; }
    .name { font-weight:700; color:var(--h-ink-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .values { font-weight:800; white-space:nowrap; }
    .values em {
      margin-left:4px; padding:1px 6px; border-radius:999px; background:var(--h-canvas);
      font-style:normal; font-size:0.68rem; color:var(--h-muted);
    }

    .line-plot { display:grid; grid-template-columns:auto 1fr; gap:8px; height:190px; }
    .y-labels { display:grid; align-content:space-between; justify-items:end; padding-bottom:24px; }
    .y-labels span { font-size:0.64rem; font-weight:700; color:var(--h-muted); line-height:1; }
    .plot-area { position:relative; }
    .line-grid {
      position:absolute; inset:0 0 24px;
      background:repeating-linear-gradient(to top, var(--h-line) 0 1px, transparent 1px 33.3%);
    }
    .bar-series {
      position:absolute; inset:0 0 24px; display:grid; grid-template-columns:repeat(6, minmax(0, 1fr));
      align-items:end; gap:10px; padding:0 4px;
    }
    .bar { width:100%; min-height:3px; border-radius:10px 10px 4px 4px; opacity:0.55; transition:opacity 200ms ease; }
    .bar.is-selected { opacity:1; box-shadow:0 8px 16px -8px rgba(22, 20, 29, 0.5); }
    .x-labels { position:absolute; left:0; right:0; bottom:0; height:18px; display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); padding:0 4px; gap:10px; }
    .x-labels span { text-align:center; font-size:0.66rem; font-weight:700; color:var(--h-muted); white-space:nowrap; }
    .x-labels span.is-selected { color:var(--h-ink); font-weight:800; }

    /* Empty */
    .empty {
      display:grid; justify-items:center; gap:10px; padding:36px 20px; border-radius:28px; text-align:center;
      background:var(--h-surface); border:2px dashed var(--h-line);
    }
    .empty-emoji {
      width:68px; height:68px; border-radius:22px; display:grid; place-items:center;
      background:var(--h-tile-4); font-size:2rem; transform:rotate(-6deg);
    }
    .empty h2 { margin:0; font-size:1.25rem; font-weight:800; }
    .empty p { margin:0; color:var(--h-ink-soft); }

    @media (max-width: 440px) {
      .chart-layout { grid-template-columns:1fr; justify-items:center; }
      .donut { width:168px; height:168px; }
      .donut-center { width:112px; height:112px; }
      .legend { width:100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesBreakdownPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly backIcon = arrowBackOutline;
  protected readonly downIcon = chevronDownOutline;
  protected readonly calendarIcon = calendarOutline;
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
  /** Chart colours per category, tuned to the Citrus & Ink palette. */
  private readonly categoryPalette: Record<ExpenseCategory, { solid: string; gradient: string }> = {
    produce: { solid: '#3fb67b', gradient: 'linear-gradient(180deg, color-mix(in srgb, #3fb67b 55%, white) 0%, #3fb67b 100%)' },
    grains: { solid: '#c2a878', gradient: 'linear-gradient(180deg, color-mix(in srgb, #c2a878 55%, white) 0%, #c2a878 100%)' },
    masala: { solid: '#d9480f', gradient: 'linear-gradient(180deg, color-mix(in srgb, #d9480f 55%, white) 0%, #d9480f 100%)' },
    vegetables: { solid: '#3fb67b', gradient: 'linear-gradient(180deg, color-mix(in srgb, #3fb67b 55%, white) 0%, #3fb67b 100%)' },
    fruits: { solid: '#ff6a3d', gradient: 'linear-gradient(180deg, color-mix(in srgb, #ff6a3d 55%, white) 0%, #ff6a3d 100%)' },
    dairy: { solid: '#5b8def', gradient: 'linear-gradient(180deg, color-mix(in srgb, #5b8def 55%, white) 0%, #5b8def 100%)' },
    meat: { solid: '#e5484d', gradient: 'linear-gradient(180deg, color-mix(in srgb, #e5484d 55%, white) 0%, #e5484d 100%)' },
    frozen: { solid: '#38bdf8', gradient: 'linear-gradient(180deg, color-mix(in srgb, #38bdf8 55%, white) 0%, #38bdf8 100%)' },
    spices: { solid: '#f08c00', gradient: 'linear-gradient(180deg, color-mix(in srgb, #f08c00 55%, white) 0%, #f08c00 100%)' },
    pulses: { solid: '#c08457', gradient: 'linear-gradient(180deg, color-mix(in srgb, #c08457 55%, white) 0%, #c08457 100%)' },
    nuts: { solid: '#8d5b3e', gradient: 'linear-gradient(180deg, color-mix(in srgb, #8d5b3e 55%, white) 0%, #8d5b3e 100%)' },
    bakery: { solid: '#f5b400', gradient: 'linear-gradient(180deg, color-mix(in srgb, #f5b400 55%, white) 0%, #f5b400 100%)' },
    biscuits: { solid: '#d4a373', gradient: 'linear-gradient(180deg, color-mix(in srgb, #d4a373 55%, white) 0%, #d4a373 100%)' },
    snacks: { solid: '#f06595', gradient: 'linear-gradient(180deg, color-mix(in srgb, #f06595 55%, white) 0%, #f06595 100%)' },
    sauces: { solid: '#c2255c', gradient: 'linear-gradient(180deg, color-mix(in srgb, #c2255c 55%, white) 0%, #c2255c 100%)' },
    beverages: { solid: '#14b8a6', gradient: 'linear-gradient(180deg, color-mix(in srgb, #14b8a6 55%, white) 0%, #14b8a6 100%)' },
    other: { solid: '#7a5af8', gradient: 'linear-gradient(180deg, color-mix(in srgb, #7a5af8 55%, white) 0%, #7a5af8 100%)' }
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

  protected categoryEmoji(category: ExpenseCategory): string {
    return CATEGORY_EMOJI[category] ?? '🛒';
  }

  protected tileColor(category: ExpenseCategory): string {
    return categoryTileColor(category);
  }

  /** Percentage of `value` against `max`, clamped to 0–100 (for bar widths). */
  protected pct(value: number, max: number): number {
    return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
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
