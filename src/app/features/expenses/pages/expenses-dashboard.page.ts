import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';
import { addOutline, alertCircleOutline, calendarOutline, chevronDownOutline, informationCircleOutline, optionsOutline, walletOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { CATEGORY_EMOJI, categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import { ExpenseCategory } from '../models/expense.model';
import { BudgetOverview, ExpenseService, ExpectedSpendSummary } from '../services/expense.service';

@Component({
  selector: 'app-expenses-dashboard-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonFab, IonFabButton, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="expenses-content">
      <main class="page-shell" [class.page-shell--empty]="!hasBudget() || !overview()">
        @if (!hasBudget()) {
          <section class="empty-state">
            <span class="empty-emoji" aria-hidden="true">💰</span>
            <h2>No budget configured.</h2>
            <p>Set up your weekly or monthly budget to start tracking spending.</p>
            <a class="primary-btn" [routerLink]="['/tabs/expenses/budget']">Configure Budget</a>
          </section>
        } @else if (!overview()) {
          <section class="empty-state">
            <span class="empty-emoji" aria-hidden="true">⏳</span>
            <h2>Budget starts soon</h2>
            <p>Your selected budget cycle has not started yet.</p>
          </section>
        } @else {
          @let o = overview()!;
          @let e = expected()!;

          <header class="expenses-header">
            <div class="header-top">
              <span class="header-icon" aria-hidden="true"><ion-icon [icon]="walletIcon" /></span>
              <div class="title-group">
                <h1 class="header-title">{{ o.cycle.budgetType === 'weekly' ? 'Weekly Expenses' : 'Monthly Expenses' }}</h1>
                <p class="header-subtitle">{{ o.daysLeft }} {{ o.daysLeft === 1 ? 'day' : 'days' }} left in this cycle</p>
              </div>
              <a class="icon-link" [routerLink]="['/tabs/expenses/budget']" aria-label="Budget settings">
                <ion-icon aria-hidden="true" [icon]="settingsIcon" />
              </a>
            </div>
            @if (cycleOptions().length > 0) {
              <label class="cycle-picker" aria-label="Select budget cycle">
                <span class="cycle-picker__label">Cycle</span>
                <span class="cycle-picker__control">
                  <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                  <select [value]="selectedCycleId()" (change)="onCycleChange($event)">
                    @for (cycle of cycleOptions(); track cycle.id) {
                      <option [value]="cycle.id">{{ cycle.label }}</option>
                    }
                  </select>
                  <ion-icon aria-hidden="true" [icon]="chevronDownIcon" class="cycle-picker__chevron" />
                </span>
                <span class="cycle-picker__meta" [class.cycle-picker__meta--active]="isViewingActiveCycle()">
                  {{ isViewingActiveCycle() ? 'Current cycle' : 'Past cycle' }}
                </span>
              </label>
            }
          </header>

          <!-- Budget overview (ink hero) -->
          <section class="summary-card" aria-label="Budget Overview">
            <div class="hero-dots" aria-hidden="true"></div>
            <div class="summary-head">
              <h2 class="visually-hidden">Budget Overview</h2>
              <span class="status-pill" [class]="'status-pill ' + statusClass()">{{ statusTitle() }}</span>
            </div>

            <div class="summary-main">
              <div class="summary-figures">
                <p class="summary-label">{{ o.overspent > 0 ? 'Overspent' : 'Remaining' }}</p>
                <p class="summary-amount" [class.alert]="o.overspent > 0">
                  {{ formatAmount(o.overspent > 0 ? o.overspent : o.remainingDisplay) }}
                </p>
                <p class="summary-of">of {{ formatAmount(o.budgetAmount) }} · {{ cycleLabel() }}</p>
              </div>
              <div
                class="usage-ring"
                [class]="'usage-ring ' + progressClass()"
                [style.--p]="progressWidth()"
                role="img"
                [attr.aria-label]="usageSubcopy()"
              >
                <span class="usage-ring__value">{{ o.progressPercent }}%</span>
                <span class="usage-ring__caption">{{ usageLabel() }}</span>
              </div>
            </div>

            <p class="usage-subcopy">{{ usageSubcopy() }}</p>

            <p class="status-message" [class]="'status-message ' + statusClass()">{{ statusMessage() }}</p>
          </section>

          <!-- Key figures -->
          <section class="stat-grid" aria-label="Budget figures">
            <article class="stat-tile stat-tile--budget">
              <span class="stat-emoji" aria-hidden="true">💰</span>
              <p>Budget Amount</p>
              <strong>{{ formatAmount(o.budgetAmount) }}</strong>
              <small>{{ o.cycle.budgetType === 'weekly' ? 'Per week' : 'Per month' }}</small>
            </article>
            <article class="stat-tile stat-tile--spent">
              <span class="stat-emoji" aria-hidden="true">🧾</span>
              <p>Spent</p>
              <strong>{{ formatAmount(o.spent) }}</strong>
              <small>{{ summarySubLabel() }}</small>
            </article>
            <article class="stat-tile stat-tile--days">
              <span class="stat-emoji" aria-hidden="true">📅</span>
              <p>Days Left</p>
              <strong>{{ o.daysLeft }} days</strong>
              <small>In this cycle</small>
            </article>
          </section>

          <!-- Expected spend -->
          <section class="card expected-card">
            <div class="card-head">
              <span class="card-icon" aria-hidden="true">🎯</span>
              <div class="card-head__text">
                <h3>Expected Spend ({{ o.daysLeft }} days left)</h3>
                <p>Based on your budget and cycle length</p>
              </div>
              <button type="button" class="info-button" (click)="showExpectedSpendInfo()" aria-label="How expected spend is calculated">
                <ion-icon aria-hidden="true" [icon]="infoIcon" />
              </button>
            </div>
            <div class="expected-body">
              <strong class="expected-amount" [class]="'expected-amount ' + statusClass()">{{ formatAmount(e.expectedSpend) }}</strong>
              <span class="expected-daily">
                <small>Expected per day</small>
                <strong>{{ formatAmount(e.dailyBudget) }}</strong>
              </span>
            </div>
            <p class="expected-support">{{ expectedSupportCopy() }}</p>
          </section>

          @if (warning()) {
            <section class="card warning-card" role="status">
              <div class="card-head">
                <span class="card-icon card-icon--warn" aria-hidden="true"><ion-icon [icon]="warningIcon" /></span>
                <div class="card-head__text">
                  <h3>Warning</h3>
                  <p>Only {{ formatAmount(warning()!.remaining) }} remains with {{ warning()!.daysLeft }} days left in this cycle.</p>
                </div>
              </div>
              <p class="warning-tip">Recommended spending: <strong>{{ formatAmount(warning()!.recommendedDailyLimit) }}</strong> per day maximum.</p>
            </section>
          }

          <!-- Categories -->
          <section class="card">
            <div class="section-head">
              <h3>Category Summary</h3>
              <a [routerLink]="['/tabs/expenses/analytics']">View Analytics</a>
            </div>
            @if (categoryTotals().length === 0) {
              <p class="empty-copy">No purchases recorded for this cycle yet.</p>
            } @else {
              <div class="chips-grid">
                @for (category of categoryTotals(); track category.category) {
                  <article class="category-chip" [style.--tile]="tileColor(category.category)">
                    <span class="category-chip__emoji" aria-hidden="true">{{ categoryEmoji(category.category) }}</span>
                    <p>{{ categoryLabel(category.category) }}</p>
                    <strong>{{ formatAmount(category.total) }}</strong>
                    <span class="share-bar" aria-hidden="true">
                      <span [style.width.%]="o.spent > 0 ? (category.total / o.spent) * 100 : 0"></span>
                    </span>
                  </article>
                }
              </div>
            }
          </section>

          <!-- Recent purchases -->
          <section class="card">
            <div class="section-head">
              <h3>Recent Purchases</h3>
              <a [routerLink]="['/tabs/expenses/history']">View History</a>
            </div>
            @if (recentExpenses().length === 0) {
              <p class="empty-copy">No purchases recorded for this cycle yet.</p>
            } @else {
              <div class="expense-list">
                @for (expense of recentExpenses(); track expense.id) {
                  <a class="expense-item" [routerLink]="['/tabs/expenses', expense.id]">
                    <span class="expense-emoji" [style.--tile]="tileColor(expense.category)" aria-hidden="true">
                      {{ categoryEmoji(expense.category) }}
                    </span>
                    <span class="expense-main">
                      <strong>{{ expense.title }}</strong>
                      <small>{{ categoryLabel(expense.category) }} · {{ formatDate(expense.date) }}</small>
                    </span>
                    <strong class="expense-amount">{{ formatAmount(expenseTotal(expense)) }}</strong>
                  </a>
                }
              </div>
            }
          </section>

          <!-- Quick actions -->
          <nav class="actions" aria-label="Expense tools">
            <a [routerLink]="['/tabs/expenses/budget']"><span aria-hidden="true">⚙️</span>Budget Settings</a>
            <a [routerLink]="['/tabs/expenses/history']"><span aria-hidden="true">🗂️</span>View History</a>
            <a [routerLink]="['/tabs/expenses/analytics']"><span aria-hidden="true">📊</span>View Analytics</a>
          </nav>
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
    /* Expenses — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
       (src/theme/citrus.scss), shared with Home, Pantry and Cart. */
    :host { display:flex; flex-direction:column; height:100%; background:var(--h-canvas); }
    .expenses-content { --padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 6rem); }
    .expenses-content::part(background) { background:var(--h-canvas); }
    .visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
    ion-icon { flex-shrink:0; }

    .page-shell {
      width:min(100%, 720px);
      margin:0 auto;
      padding:0 var(--h-gutter) 24px;
      display:grid;
      grid-template-columns:minmax(0, 1fr);
      gap:16px;
    }
    .page-shell--empty { padding-top:calc(env(safe-area-inset-top, 0px) + 24px); }

    /* Header */
    .expenses-header {
      position:sticky; top:0; z-index:20;
      margin:0 calc(var(--h-gutter) * -1);
      padding:calc(env(safe-area-inset-top, 0px) + 14px) var(--h-gutter) 12px;
      display:grid; gap:12px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent);
      backdrop-filter:blur(18px);
      border-bottom:1px solid var(--h-line);
    }
    .header-top { display:flex; align-items:center; gap:12px; }
    .header-icon {
      width:44px; height:44px; border-radius:14px; display:grid; place-items:center;
      background:var(--h-sun); color:#16141d; font-size:22px; transform:rotate(-6deg);
    }
    .title-group { flex:1; min-width:0; }
    .header-title { margin:0; font-size:clamp(1.45rem, 5.4vw, 2rem); font-weight:800; line-height:1.05; letter-spacing:-0.035em; color:var(--h-ink); }
    .header-subtitle { margin:2px 0 0; font-size:0.8rem; font-weight:600; color:var(--h-muted); }
    .icon-link {
      width:44px; height:44px; border-radius:50%; border:1px solid var(--h-line);
      background:var(--h-surface); color:var(--h-ink); display:grid; place-items:center; font-size:20px;
    }

    .cycle-picker { display:flex; align-items:center; gap:10px; }
    .cycle-picker__label { font-size:0.66rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--h-muted); }
    .cycle-picker__control {
      flex:1; min-width:0; display:flex; align-items:center; gap:8px; min-height:44px; padding:0 14px;
      border:1px solid var(--h-line); border-radius:999px; background:var(--h-surface); color:var(--h-ink-soft);
    }
    .cycle-picker__control:focus-within { border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow); }
    .cycle-picker select {
      flex:1; min-width:0; border:none; background:transparent; padding:0; appearance:none;
      color:var(--h-ink); font-size:0.88rem; font-weight:800;
    }
    :host .cycle-picker select:focus { outline:none; box-shadow:none; }
    .cycle-picker__meta {
      padding:6px 10px; border-radius:999px; white-space:nowrap;
      background:var(--h-surface); color:var(--h-muted); font-size:0.7rem; font-weight:800;
    }
    .cycle-picker__meta--active { background:var(--h-btn-bg); color:var(--h-btn-fg); }

    /* Ink summary hero */
    .summary-card {
      position:relative; isolation:isolate; overflow:hidden;
      display:grid; gap:14px; padding:20px 22px 22px; border-radius:30px; color:#fff;
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
    .summary-head { display:flex; }
    .status-pill {
      padding:6px 12px; border-radius:10px; font-size:0.68rem; font-weight:800; letter-spacing:0.06em;
      text-transform:uppercase; transform:rotate(-2deg); background:var(--h-lilac); color:#16141d;
    }
    .status-pill.under_expected, .status-pill.on_track { background:#9fe3bf; }
    .status-pill.over_expected { background:var(--h-sun); }
    .status-pill.budget_fully_used { background:#ff9a9d; }
    .summary-main { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .summary-figures { min-width:0; }
    .summary-label { margin:0; font-size:0.72rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.6); }
    .summary-amount { margin:2px 0 0; font-family:var(--h-display); font-size:clamp(2rem, 9vw, 2.6rem); font-weight:800; letter-spacing:-0.04em; line-height:1; color:var(--h-sun); }
    .summary-of { margin:6px 0 0; font-size:0.85rem; font-weight:600; color:rgba(255,255,255,0.72); }

    .usage-ring {
      --ring:#4cc38a;
      flex-shrink:0; width:104px; height:104px; border-radius:50%;
      display:grid; place-content:center; text-align:center;
      background:
        radial-gradient(closest-side, var(--h-hero-bg) 76%, transparent 77% 100%),
        conic-gradient(var(--ring) calc(var(--p) * 1%), rgba(255,255,255,0.14) 0);
    }
    .usage-ring.orange { --ring:#ffb224; }
    .usage-ring.red { --ring:#ff6369; }
    .usage-ring__value { font-family:var(--h-display); font-size:1.4rem; font-weight:800; line-height:1; }
    .usage-ring__caption { margin-top:2px; font-size:0.6rem; font-weight:700; color:rgba(255,255,255,0.65); }

    .summary-amount.alert { color:#ff8a8e; }
    .usage-subcopy { margin:-4px 0 0; font-size:0.76rem; font-weight:700; color:rgba(255,255,255,0.7); }
    .status-message {
      margin:0; padding:12px 14px; border-radius:16px; font-size:0.85rem; line-height:1.45;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.88);
    }
    .status-message.over_expected, .status-message.budget_fully_used { background:rgba(255, 99, 105, 0.16); border-color:rgba(255, 99, 105, 0.3); }

    /* Stat tiles */
    .stat-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
    .stat-tile { min-width:0; display:grid; gap:2px; padding:12px; border-radius:22px; background:var(--tile); }
    .stat-tile--budget { --tile:var(--h-tile-4); }
    .stat-tile--spent { --tile:var(--h-tile-1); }
    .stat-tile--days { --tile:var(--h-tile-3); }
    .stat-emoji {
      width:36px; height:36px; margin-bottom:6px; border-radius:12px; display:grid; place-items:center;
      background:var(--h-surface); font-size:1.1rem;
    }
    .stat-tile p { margin:0; font-size:0.7rem; font-weight:700; color:var(--h-ink-soft); }
    .stat-tile strong { font-family:var(--h-display); font-size:clamp(0.98rem, 4.2vw, 1.3rem); font-weight:800; letter-spacing:-0.03em; color:var(--h-ink); }
    .stat-tile strong.alert { color:var(--h-danger); }
    .stat-tile small { font-size:0.72rem; font-weight:600; color:var(--h-muted); }

    /* Generic cards */
    .card {
      display:grid; gap:14px; padding:18px; border-radius:26px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .card-head { display:flex; align-items:flex-start; gap:12px; }
    .card-head__text { flex:1; min-width:0; }
    .card-head h3, .section-head h3 { margin:0; font-size:1.05rem; font-weight:800; letter-spacing:-0.02em; color:var(--h-ink); }
    .card-head p { margin:3px 0 0; font-size:0.8rem; line-height:1.4; color:var(--h-muted); }
    .card-icon {
      width:42px; height:42px; flex-shrink:0; border-radius:14px; display:grid; place-items:center;
      background:var(--h-tile-3); font-size:1.2rem; transform:rotate(-6deg);
    }
    .card-icon--warn { background:var(--h-warn-surface); color:var(--h-warn); font-size:22px; }
    .info-button {
      width:36px; height:36px; flex-shrink:0; padding:0; border:1px solid var(--h-line); border-radius:50%;
      background:var(--h-canvas); color:var(--h-ink); display:grid; place-items:center; font-size:18px;
    }
    .expected-body { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .expected-amount { font-family:var(--h-display); font-size:2rem; font-weight:800; letter-spacing:-0.04em; line-height:1; color:var(--h-ok); }
    .expected-amount.over_expected { color:var(--h-warn); }
    .expected-amount.budget_fully_used { color:var(--h-danger); }
    .expected-daily { display:grid; justify-items:end; padding:8px 12px; border-radius:14px; background:var(--h-canvas); }
    .expected-daily small { font-size:0.68rem; font-weight:700; color:var(--h-muted); }
    .expected-daily strong { font-size:0.95rem; font-weight:800; color:var(--h-ink); }
    .expected-support { margin:0; font-size:0.78rem; color:var(--h-muted); }

    .warning-card { background:var(--h-warn-surface); border-color:color-mix(in srgb, var(--h-warn) 30%, transparent); box-shadow:none; }
    .warning-card h3 { color:var(--h-warn); }
    .warning-card .card-head p, .warning-tip { color:var(--h-ink-soft); }
    .warning-tip { margin:0; font-size:0.85rem; }

    .section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .section-head a {
      min-height:32px; padding:0 12px; display:inline-flex; align-items:center; border-radius:999px;
      background:var(--h-canvas); color:var(--h-ink); font-size:0.76rem; font-weight:800; text-decoration:none;
    }
    .empty-copy { margin:0; color:var(--h-muted); font-size:0.88rem; }

    .chips-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 136px), 1fr)); gap:10px; }
    .category-chip { display:grid; gap:2px; padding:12px; border-radius:20px; background:var(--tile); }
    .category-chip__emoji { font-size:1.3rem; margin-bottom:4px; }
    .category-chip p { margin:0; font-size:0.74rem; font-weight:700; color:var(--h-ink-soft); }
    .category-chip strong { font-family:var(--h-display); font-size:1.05rem; font-weight:800; color:var(--h-ink); }
    .share-bar { height:5px; margin-top:6px; border-radius:999px; background:color-mix(in srgb, var(--h-ink) 10%, transparent); overflow:hidden; }
    .share-bar span { display:block; height:100%; border-radius:inherit; background:var(--h-ink); }

    .expense-list { display:grid; gap:4px; }
    .expense-item {
      display:flex; align-items:center; gap:12px; padding:8px; margin:0 -8px; border-radius:18px;
      color:inherit; text-decoration:none;
    }
    .expense-item:active { background:var(--h-canvas); }
    .expense-emoji {
      width:44px; height:44px; flex-shrink:0; border-radius:14px; display:grid; place-items:center;
      background:var(--tile); font-size:1.25rem;
    }
    .expense-main { flex:1; min-width:0; display:grid; gap:2px; }
    .expense-main strong { font-size:0.95rem; font-weight:800; color:var(--h-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .expense-main small { font-size:0.76rem; font-weight:600; color:var(--h-muted); }
    .expense-amount { font-family:var(--h-display); font-size:0.98rem; font-weight:800; color:var(--h-ink); white-space:nowrap; }

    .actions { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
    .actions a {
      display:grid; justify-items:center; gap:6px; padding:14px 8px; border-radius:22px;
      border:1px solid var(--h-line); background:var(--h-surface); color:var(--h-ink);
      font-size:0.76rem; font-weight:800; text-align:center; text-decoration:none;
    }
    .actions a span { font-size:1.3rem; }

    /* Empty states */
    .empty-state {
      display:grid; justify-items:center; gap:10px; padding:36px 20px; border-radius:28px; text-align:center;
      background:var(--h-surface); border:2px dashed var(--h-line);
    }
    .empty-emoji {
      width:68px; height:68px; border-radius:22px; display:grid; place-items:center;
      background:var(--h-tile-3); font-size:2rem; transform:rotate(-6deg);
    }
    .empty-state h2 { margin:0; font-size:1.3rem; font-weight:800; color:var(--h-ink); }
    .empty-state p { margin:0; color:var(--h-ink-soft); }
    .primary-btn {
      margin-top:6px; min-height:48px; padding:0 22px; display:inline-flex; align-items:center; border-radius:999px;
      background:var(--h-accent); color:#fff; font-weight:800; text-decoration:none;
      box-shadow:0 12px 24px -12px var(--h-accent-glow);
    }

    .add-fab {
      --background:var(--h-accent); --background-activated:var(--h-accent); --color:#fff;
      --border-radius:22px; --box-shadow:0 14px 28px -10px var(--h-accent-glow);
      width:60px; height:60px; transform:rotate(-6deg);
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
  protected readonly settingsIcon = optionsOutline;
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

  protected categoryEmoji(category: ExpenseCategory): string {
    return CATEGORY_EMOJI[category] ?? '🛒';
  }

  protected tileColor(category: ExpenseCategory): string {
    return categoryTileColor(category);
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
