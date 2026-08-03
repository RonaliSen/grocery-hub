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
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="page-header app-mobile-header app-mobile-header--center">
      <button class="icon-btn app-mobile-icon-btn plain" (click)="goBack()" aria-label="Back">
        <ion-icon [icon]="backIcon" />
      </button>
      <h1>Budget Settings</h1>
      <div class="spacer app-mobile-icon-btn"></div>
    </header>

    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell app-mobile-shell">
        <section class="intro-card app-mobile-card">
          <div class="intro-icon"><ion-icon [icon]="walletIcon" /></div>
          <div>
            <p>Set your budget for groceries and track your spending. The budget resets automatically after each cycle.</p>
          </div>
        </section>

        <section class="card app-mobile-card">
          <label>
            <span>Budget Type</span>
            <div class="select-wrap">
              <select [ngModel]="budgetType()" (ngModelChange)="budgetType.set($event)">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <ion-icon [icon]="downIcon" />
            </div>
          </label>

          <label>
            <span>Currency</span>
            <div class="select-wrap">
              <select [ngModel]="currency()" (ngModelChange)="currency.set($event)">
                @for (option of currencyOptions; track option.code) {
                  <option [value]="option.code">{{ option.label }} ({{ option.code }})</option>
                }
              </select>
              <ion-icon [icon]="downIcon" />
            </div>
          </label>

          <label class="budget-field budget-field--amount">
            <span>Budget Amount</span>
            <div class="amount-wrap">
              <strong>{{ currencySymbol() }}</strong>
              <input type="number" min="0.01" step="0.01" [ngModel]="budgetAmount()" (ngModelChange)="budgetAmount.set($event)" />
            </div>
          </label>
          @if (amountError()) {
            <p class="error">Budget amount is required and must be greater than 0.</p>
          }

          <label class="budget-field budget-field--date">
            <span>Start Date</span>
            <div class="date-wrap">
              <input type="date" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" />
              <ion-icon [icon]="calendarIcon" />
            </div>
          </label>
          @if (dateError()) {
            <p class="error">Start date is required.</p>
          }
        </section>

        @if (cyclePreview()) {
          <section class="preview-card app-mobile-card">
            <p class="preview-title">Budget Cycle Preview</p>
            <strong>{{ cyclePreview() }}</strong>
          </section>
        }

        <div class="actions">
          <button class="save" (click)="save()">Save Settings</button>
          @if (hasExistingBudget()) {
            <button class="ghost" (click)="reset()">Reset Budget</button>
          }
        </div>
      </main>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#f4f8f5; }
    .page-header h1 { margin:0; text-align:center; font-size:clamp(1.3rem, 4.6vw, 1.7rem); color:#0f7d4d; font-weight:800; letter-spacing:-0.01em; }
    .icon-btn { border:none; display:grid; place-items:center; }
    .icon-btn.plain { background:transparent; color:#1f4e38; }
    .page-content { --background:#f4f8f5; }
    .shell { display:grid; gap:0.9rem; }
    .intro-card { display:grid; grid-template-columns:auto 1fr; gap:0.75rem; align-items:start; }
    .intro-card p { margin:0; color:#476356; }
    .intro-icon { width:2.75rem; height:2.75rem; border-radius:1rem; background:#eaf6ef; color:#149255; display:grid; place-items:center; font-size:1.3rem; }
    .card { display:grid; gap:0.85rem; }
    label { display:grid; gap:0.35rem; color:#355a48; font-weight:600; font-size:0.9rem; }
    label span { color:#244636; }
    input, select, .amount-wrap, .date-wrap, .select-wrap { border:1px solid #d7e2db; border-radius:14px; min-height:3rem; background:#fff; }
    input, select { width:100%; padding:0 0.85rem; color:#244636; }
    .amount-wrap { display:grid; grid-template-columns:auto 1fr; align-items:center; padding:0 0.85rem; gap:0.55rem; }
    .amount-wrap input { border:none; padding:0; }
    .date-wrap, .select-wrap { display:grid; grid-template-columns:1fr auto; align-items:center; padding-right:0.85rem; }
    .date-wrap input, .select-wrap select { border:none; background:transparent; }
    .budget-field--amount .amount-wrap,
    .budget-field--date .date-wrap { -webkit-tap-highlight-color: transparent; }
    .budget-field--amount .amount-wrap:focus-within,
    .budget-field--date .date-wrap:focus-within { border-color:#d7e2db; box-shadow:none; }
    .budget-field--amount .amount-wrap input:focus,
    .budget-field--date .date-wrap input:focus { border-color:transparent; box-shadow:none; outline:none; }
    .date-wrap input[type="date"] { appearance:none; -webkit-appearance:none; -moz-appearance:none; }
    .date-wrap input[type="date"]::-webkit-calendar-picker-indicator { opacity:0; width:0; margin:0; padding:0; }
    .select-wrap select { appearance:none; -webkit-appearance:none; -moz-appearance:none; }
    .preview-card { display:grid; gap:0.35rem; background:linear-gradient(180deg, #f7fbf8 0%, #eef8f1 100%); }
    .preview-title { margin:0; color:#3f5b4d; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.05em; }
    .preview-card strong { color:#0f7d4d; font-size:1.1rem; }
    .actions { display:grid; gap:0.6rem; }
    .save,.ghost { border:none; border-radius:999px; min-height:3rem; font-weight:700; }
    .save { background:#149255; color:#fff; }
    .ghost { background:#eaf3ee; color:#244636; }
    .error { margin:0; color:#c62828; font-size:0.84rem; }
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
