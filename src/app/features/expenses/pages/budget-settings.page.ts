import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, calendarOutline, chevronDownOutline, walletOutline } from 'ionicons/icons';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import {
  CURRENCY_OPTIONS,
  CurrencyCode,
  DEFAULT_CURRENCY_CODE,
  getCurrencySymbol
} from '../../../core/utils/currency.utils';
import { BudgetSettings, BudgetType } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-budget-settings-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="page-header">
      <button class="icon-btn" (click)="goBack()" aria-label="Back">
        <ion-icon aria-hidden="true" [icon]="backIcon" />
      </button>
      <div class="header-text">
        <h1>Budget Settings</h1>
        <p>Plan your grocery spending</p>
      </div>
      <span class="icon-btn icon-btn--ghost" aria-hidden="true"></span>
    </header>

    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell">
        <!-- Live preview -->
        <section class="intro-card" aria-label="Budget preview">
          <div class="hero-dots" aria-hidden="true"></div>
          <div class="intro-top">
            <span class="intro-icon" aria-hidden="true"><ion-icon [icon]="walletIcon" /></span>
            <p class="intro-eyebrow">{{ budgetType() === 'weekly' ? 'Weekly' : 'Monthly' }} budget</p>
          </div>
          <p class="intro-amount">
            <span>{{ currencySymbol() }}</span>{{ budgetAmount() || '0' }}
            <small>/ {{ budgetType() === 'weekly' ? 'week' : 'month' }}</small>
          </p>
          @if (cyclePreview()) {
            <div class="preview-card">
              <p class="preview-title">Budget Cycle Preview</p>
              <strong>{{ cyclePreview().replace(' -> ', ' → ') }}</strong>
            </div>
          }
          <p class="intro-copy">
            Set your budget for groceries and track your spending. The budget resets automatically after each cycle.
          </p>
        </section>

        <section class="card">
          <div class="field">
            <span class="field-label" id="budget-type-label">Budget Type</span>
            <div class="segmented" role="radiogroup" aria-labelledby="budget-type-label">
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="budgetType() === 'weekly'"
                [class.is-active]="budgetType() === 'weekly'"
                (click)="budgetType.set('weekly')"
              >
                <span aria-hidden="true">🗓️</span> Weekly
              </button>
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="budgetType() === 'monthly'"
                [class.is-active]="budgetType() === 'monthly'"
                (click)="budgetType.set('monthly')"
              >
                <span aria-hidden="true">📆</span> Monthly
              </button>
            </div>
          </div>

          <label class="field">
            <span class="field-label">Budget Amount</span>
            <span class="amount-wrap" [class.has-error]="amountError()">
              <strong>{{ currencySymbol() }}</strong>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                [ngModel]="budgetAmount()"
                (ngModelChange)="budgetAmount.set($event)"
              />
            </span>
          </label>
          @if (amountError()) {
            <p class="error">Budget amount is required and must be greater than 0.</p>
          }

          <div class="field-row">
            <label class="field">
              <span class="field-label">Currency</span>
              <span class="control-wrap">
                <select [ngModel]="currency()" (ngModelChange)="currency.set($event)">
                  @for (option of currencyOptions; track option.code) {
                    <option [value]="option.code">{{ option.label }} ({{ option.code }})</option>
                  }
                </select>
                <ion-icon aria-hidden="true" [icon]="downIcon" />
              </span>
            </label>

            <label class="field">
              <span class="field-label">Start Date</span>
              <span class="control-wrap" [class.has-error]="dateError()">
                <input type="date" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" />
                <ion-icon aria-hidden="true" [icon]="calendarIcon" />
              </span>
            </label>
          </div>
          @if (dateError()) {
            <p class="error">Start date is required.</p>
          }
        </section>

        <div class="actions" [class.actions--single]="!hasExistingBudget()">
          @if (hasExistingBudget()) {
            <button class="ghost" (click)="reset()">Reset Budget</button>
          }
          <button class="save" (click)="save()">Save Settings</button>
        </div>
      </main>
    </ion-content>
  `,
  styles: [`
    /* Budget settings — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
    :host { display:flex; flex-direction:column; height:100%; background:var(--h-canvas); }
    .page-content::part(background) { background:var(--h-canvas); }
    ion-icon { flex-shrink:0; }

    .page-header {
      position:sticky; top:0; z-index:20;
      display:grid; grid-template-columns:44px minmax(0, 1fr) 44px; align-items:center; gap:12px;
      padding:calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent); backdrop-filter:blur(18px);
    }
    .icon-btn {
      width:44px; height:44px; border-radius:50%; border:1px solid var(--h-line);
      background:var(--h-surface); color:var(--h-ink); display:grid; place-items:center; font-size:20px;
    }
    .icon-btn--ghost { visibility:hidden; }
    .header-text { text-align:center; }
    .header-text h1 { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.03em; color:var(--h-ink); }
    .header-text p { margin:2px 0 0; font-size:0.76rem; font-weight:600; color:var(--h-muted); }

    .shell {
      width:min(100%, 40rem); margin:0 auto; padding:4px var(--h-gutter) 24px;
      display:grid; grid-template-columns:minmax(0, 1fr); gap:16px;
    }

    /* Ink preview */
    .intro-card {
      position:relative; isolation:isolate; overflow:hidden;
      display:grid; gap:12px; padding:20px 22px 22px; border-radius:30px; color:#fff;
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
    .intro-top { display:flex; align-items:center; gap:10px; }
    .intro-icon {
      width:42px; height:42px; border-radius:14px; display:grid; place-items:center;
      background:var(--h-sun); color:#16141d; font-size:20px; transform:rotate(-6deg);
    }
    .intro-eyebrow {
      margin:0; padding:5px 11px; border-radius:10px; background:var(--h-lilac); color:#16141d;
      font-size:0.66rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; transform:rotate(-2deg);
    }
    .intro-amount {
      margin:4px 0 0; font-family:var(--h-display); font-size:clamp(2.3rem, 11vw, 3rem); font-weight:800;
      letter-spacing:-0.04em; line-height:1; color:var(--h-sun); overflow-wrap:anywhere;
    }
    .intro-amount span { margin-right:4px; font-size:0.6em; vertical-align:0.35em; }
    .intro-amount small { font-size:0.36em; font-weight:700; letter-spacing:0; color:rgba(255,255,255,0.7); }
    .preview-card {
      display:grid; gap:2px; padding:12px 14px; border-radius:16px;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
    }
    .preview-title { margin:0; font-size:0.66rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.6); }
    .preview-card strong { font-size:0.98rem; font-weight:800; }
    .intro-copy { margin:0; font-size:0.8rem; line-height:1.45; color:rgba(255,255,255,0.7); }

    /* Form card */
    .card {
      display:grid; gap:18px; padding:18px; border-radius:26px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .field { min-width:0; display:grid; gap:8px; }
    .field-label { font-size:0.78rem; font-weight:700; color:var(--h-ink-soft); }
    .field-row { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }

    .segmented {
      display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:4px; padding:4px;
      border-radius:999px; background:var(--h-canvas); border:1px solid var(--h-line);
    }
    .segmented button {
      min-height:44px; border:none; border-radius:999px; background:transparent;
      color:var(--h-ink-soft); font-size:0.9rem; font-weight:800; transition:background-color 180ms ease, color 180ms ease;
    }
    .segmented button.is-active { background:var(--h-btn-bg); color:var(--h-btn-fg); box-shadow:0 6px 14px -8px rgba(22,20,29,0.6); }

    .amount-wrap, .control-wrap {
      position:relative; display:flex; align-items:center; min-width:0;
      border:1px solid var(--h-line); border-radius:18px; background:var(--h-canvas);
    }
    .amount-wrap { gap:8px; min-height:68px; padding:0 18px; }
    .amount-wrap strong { font-family:var(--h-display); font-size:1.5rem; font-weight:800; color:var(--h-accent); }
    .amount-wrap input {
      flex:1; min-width:0; border:none; background:transparent; padding:0;
      font-family:var(--h-display); font-size:1.7rem; font-weight:800; letter-spacing:-0.03em; color:var(--h-ink);
    }
    .control-wrap { min-height:52px; }
    .control-wrap select, .control-wrap input {
      flex:1; width:100%; min-width:0; height:52px; border:none; background:transparent; padding:0 40px 0 14px;
      color:var(--h-ink); font-size:0.9rem; font-weight:700; appearance:none;
    }
    .control-wrap ion-icon { position:absolute; right:14px; color:var(--h-muted); font-size:18px; pointer-events:none; }
    .control-wrap input::-webkit-calendar-picker-indicator { position:absolute; right:0; width:44px; height:100%; opacity:0; cursor:pointer; }
    .amount-wrap:focus-within, .control-wrap:focus-within { border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow); }
    .has-error { border-color:var(--h-danger); }
    /* The wrapper draws the focus ring; beat the global input:not(…):focus rule (0,5,1). */
    :host .card .field input:focus, :host .card .field select:focus { outline:none; box-shadow:none; }
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { margin:0; -webkit-appearance:none; }
    input[type='number'] { appearance:textfield; -moz-appearance:textfield; }
    .error { margin:-8px 0 0; color:var(--h-danger); font-size:0.8rem; font-weight:700; }

    /* Sticky actions */
    .actions {
      position:sticky; bottom:0; z-index:10;
      margin:0 calc(var(--h-gutter) * -1); padding:12px var(--h-gutter) calc(12px + env(safe-area-inset-bottom, 0px));
      display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.5fr); gap:10px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent); backdrop-filter:blur(18px);
      border-top:1px solid var(--h-line);
    }
    .actions--single { grid-template-columns:1fr; }
    .save, .ghost { min-height:54px; border-radius:999px; font-size:0.95rem; font-weight:800; transition:transform 140ms ease; }
    .save:active, .ghost:active { transform:scale(0.97); }
    .save { border:none; background:var(--h-accent); color:#fff; box-shadow:0 12px 24px -12px var(--h-accent-glow); }
    .ghost { border:1px solid var(--h-line); background:var(--h-surface); color:var(--h-danger); }

    @media (max-width: 359px) {
      .field-row { grid-template-columns:1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetSettingsPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly backIcon = arrowBackOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly downIcon = chevronDownOutline;
  protected readonly walletIcon = walletOutline;
  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly budgetType = signal<BudgetType>('monthly');
  protected readonly budgetAmount = signal('');
  protected readonly startDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly currency = signal<CurrencyCode>(DEFAULT_CURRENCY_CODE);
  protected readonly amountError = signal(false);
  protected readonly dateError = signal(false);
  protected readonly hasExistingBudget = computed(() => !!this.expenseService.budgetStore().settings);
  protected readonly cyclePreview = computed(() => {
    const start = this.startDate().trim();
    if (!start) {
      return '';
    }
    const startDate = new Date(`${start}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) {
      return '';
    }
    const endDate = this.budgetType() === 'weekly'
      ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6)
      : new Date(this.addMonthsClamped(startDate, 1).getFullYear(), this.addMonthsClamped(startDate, 1).getMonth(), this.addMonthsClamped(startDate, 1).getDate() - 1);

    return `${this.formatDate(startDate)} -> ${this.formatDate(endDate)}`;
  });

  constructor() {
    void this.initialize();
  }

  protected currencySymbol(): string {
    return getCurrencySymbol(this.currency());
  }

  protected async save(): Promise<void> {
    const amount = Number(this.budgetAmount());
    const startDate = this.startDate().trim();

    this.amountError.set(!Number.isFinite(amount) || amount <= 0);
    this.dateError.set(startDate.length === 0);
    if (this.amountError() || this.dateError()) {
      return;
    }

    await this.expenseService.saveBudgetSettings({
      budgetType: this.budgetType(),
      budgetAmount: amount,
      startDate,
      currency: this.currency()
    });
    await this.navigationHistory.back('/tabs/expenses');
  }

  protected async reset(): Promise<void> {
    await this.expenseService.resetBudget();
    this.applySettings(null);
  }

  protected async goBack(): Promise<void> {
    await this.navigationHistory.back('/tabs/expenses');
  }

  private async initialize(): Promise<void> {
    await this.expenseService.load();
    this.applySettings(this.expenseService.getBudgetSettings());
  }

  private applySettings(settings: BudgetSettings | null): void {
    this.budgetType.set(settings?.budgetType ?? 'monthly');
    this.budgetAmount.set(settings?.budgetAmount ? String(settings.budgetAmount) : '');
    this.startDate.set(settings?.startDate ?? new Date().toISOString().slice(0, 10));
    this.currency.set(settings?.currency ?? DEFAULT_CURRENCY_CODE);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private addMonthsClamped(date: Date, months: number): Date {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
  }
}
