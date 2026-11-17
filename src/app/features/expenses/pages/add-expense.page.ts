import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  calendarOutline,
  checkmarkOutline,
  chevronDownOutline,
  documentTextOutline
} from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { getCurrencySymbol } from '../../../core/utils/currency.utils';
import { todayDateOnly } from '../../../core/utils/date.utils';
import { CATEGORY_EMOJI, categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-add-expense-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="form-header">
      <button type="button" class="icon-btn" (click)="goBack()" aria-label="Back">
        <ion-icon [icon]="backIcon" aria-hidden="true" />
      </button>
      <div class="header-text">
        <h1>Add Expense</h1>
        <p>Log a grocery purchase</p>
      </div>
      <button type="button" class="icon-btn icon-btn--accent" (click)="saveExpense()" aria-label="Save expense">
        <ion-icon [icon]="checkIcon" aria-hidden="true" />
      </button>
    </header>

    <ion-content [fullscreen]="true" class="add-content">
      <main class="form-shell">
        <!-- Live total -->
        <section class="total-card" aria-label="Expense preview">
          <div class="hero-dots" aria-hidden="true"></div>
          <span class="total-emoji" [style.--tile]="tileColor(category)" aria-hidden="true">{{ categoryEmoji(category) }}</span>
          <div class="total-info">
            <p class="total-eyebrow">{{ categoryLabels[category] }}</p>
            <p class="total-title">{{ title.trim() || 'New expense' }}</p>
            <p class="total-label">Total Amount</p>
            <p class="total-value">{{ currencySymbol }}{{ totalAmount }}</p>
            <p class="total-breakdown">
              {{ currencySymbol }}{{ amount || '0.00' }} × {{ quantity || '1' }}
              @if (+discount > 0) { − {{ currencySymbol }}{{ discount }} discount }
            </p>
          </div>
        </section>

        <!-- What -->
        <section class="form-card">
          <header class="card-head">
            <span class="card-icon" aria-hidden="true">🛒</span>
            <div>
              <h2>What did you buy?</h2>
              <p>Name, price, quantity and any discount.</p>
            </div>
          </header>

          <label class="field-wrap">
            <span class="field-label">Title <em>*</em></span>
            <input class="text-input" type="text" placeholder="e.g. Milk, Onions, Rice" [(ngModel)]="title" />
          </label>

          <label class="field-wrap">
            <span class="field-label">Amount <em>*</em></span>
            <span class="amount-wrap amount-wrap--big">
              <span>{{ currencySymbol }}</span>
              <input type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" [(ngModel)]="amount" />
            </span>
          </label>

          <div class="field-row">
            <label class="field-wrap">
              <span class="field-label">Quantity <em>*</em></span>
              <span class="amount-wrap">
                <span aria-hidden="true">×</span>
                <input type="number" min="1" step="1" inputmode="numeric" placeholder="1" [(ngModel)]="quantity" />
              </span>
            </label>
            <label class="field-wrap">
              <span class="field-label">Discount <small>(optional)</small></span>
              <span class="amount-wrap">
                <span>{{ currencySymbol }}</span>
                <input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" [(ngModel)]="discount" />
              </span>
            </label>
          </div>
        </section>

        <!-- Category -->
        <section class="form-card">
          <header class="card-head">
            <span class="card-icon" aria-hidden="true">🏷️</span>
            <div>
              <h2>Category</h2>
              <p>Used for your spending breakdown.</p>
            </div>
          </header>

          <fieldset class="field-wrap">
            <legend class="visually-hidden">Category</legend>
            <div class="category-grid">
              @for (item of categories; track item) {
                <label class="category-chip" [class.is-selected]="category === item" [style.--tile]="tileColor(item)">
                  <input type="radio" class="visually-hidden" name="expense-category" [value]="item" [(ngModel)]="category" />
                  <span class="category-chip__emoji" aria-hidden="true">{{ categoryEmoji(item) }}</span>
                  {{ categoryLabels[item] }}
                </label>
              }
            </div>
          </fieldset>
        </section>

        <!-- Details -->
        <section class="form-card">
          <header class="card-head">
            <span class="card-icon" aria-hidden="true">📝</span>
            <div>
              <h2>Details</h2>
              <p>Where, when and anything to remember.</p>
            </div>
          </header>

          <div class="field-row">
            <label class="field-wrap">
              <span class="field-label">Store <small>(optional)</small></span>
              <input class="text-input" type="text" placeholder="e.g. Lidl, Aldi" [(ngModel)]="store" />
            </label>
            <label class="field-wrap">
              <span class="field-label">Date <em>*</em></span>
              <span class="date-wrap">
                <input type="date" [(ngModel)]="date" />
                <ion-icon [icon]="calendarIcon" aria-hidden="true" />
              </span>
            </label>
          </div>

          <label class="field-wrap">
            <span class="field-label">Notes <small>(optional)</small></span>
            <textarea class="text-input text-input--area" rows="3" placeholder="Add a note..." [(ngModel)]="notes"></textarea>
          </label>

          <label class="field-wrap">
            <span class="field-label">Attachment <small>(optional)</small></span>
            <input class="text-input" type="url" placeholder="Paste receipt image URL" [(ngModel)]="receiptImageUrl" />
          </label>
          <button type="button" class="attach-btn">
            <ion-icon [icon]="receiptIcon" aria-hidden="true" />
            Add receipt photo
          </button>
        </section>

        @if (showError) {
          <p class="error-copy" role="alert">Please enter a title and a positive amount.</p>
        }

        <div class="actions">
          <button class="cancel-btn" (click)="goBack()">Cancel</button>
          <button class="save-btn" (click)="saveExpense()">Save Expense</button>
        </div>
      </main>
    </ion-content>
  `,
  styles: [`
    /* Add expense — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
    :host { display:flex; flex-direction:column; height:100%; background:var(--h-canvas); }
    .add-content::part(background) { background:var(--h-canvas); }
    .visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
    ion-icon { flex-shrink:0; }

    .form-header {
      position:sticky; top:0; z-index:20;
      display:grid; grid-template-columns:44px minmax(0, 1fr) 44px; align-items:center; gap:12px;
      padding:calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent); backdrop-filter:blur(18px);
    }
    .icon-btn {
      width:44px; height:44px; padding:0; border-radius:50%; border:1px solid var(--h-line);
      background:var(--h-surface); color:var(--h-ink); display:grid; place-items:center; font-size:20px;
    }
    .icon-btn--accent { border:none; background:var(--h-accent); color:#fff; box-shadow:0 8px 16px -8px var(--h-accent-glow); }
    .header-text { text-align:center; }
    .header-text h1 { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.03em; color:var(--h-ink); }
    .header-text p { margin:2px 0 0; font-size:0.76rem; font-weight:600; color:var(--h-muted); }

    .form-shell {
      width:min(100%, 40rem); margin:0 auto; padding:4px var(--h-gutter) 0;
      display:grid; grid-template-columns:minmax(0, 1fr); gap:16px;
    }

    /* Ink live-total card */
    .total-card {
      position:relative; isolation:isolate; overflow:hidden;
      display:grid; grid-template-columns:88px minmax(0, 1fr); align-items:center; gap:16px;
      padding:18px; border-radius:28px; color:#fff;
      background:
        radial-gradient(70% 90% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
        var(--h-hero-bg);
      outline:1px solid var(--h-hero-border); outline-offset:-1px;
      box-shadow:0 24px 40px -24px rgba(22, 20, 29, 0.6);
    }
    .hero-dots {
      position:absolute; z-index:-1; inset:0 0 auto auto; width:50%; height:80%;
      background-image:radial-gradient(rgba(255,255,255,0.16) 1.2px, transparent 1.4px); background-size:14px 14px;
      mask-image:linear-gradient(225deg, #000 10%, transparent 70%);
    }
    .total-emoji {
      width:88px; height:88px; border-radius:24px; display:grid; place-items:center;
      background:var(--tile); font-size:2.6rem; transform:rotate(-5deg);
    }
    .total-info { min-width:0; display:grid; justify-items:start; }
    .total-eyebrow {
      margin:0 0 4px; padding:3px 9px; border-radius:8px; background:var(--h-lilac); color:#16141d;
      font-size:0.6rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
    }
    .total-title {
      max-width:100%; margin:0; font-size:1rem; font-weight:800; color:rgba(255,255,255,0.9);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .total-label { margin:8px 0 0; font-size:0.62rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.55); }
    .total-value { margin:0; font-family:var(--h-display); font-size:2rem; font-weight:800; letter-spacing:-0.04em; line-height:1.05; color:var(--h-sun); }
    .total-breakdown { margin:2px 0 0; font-size:0.74rem; font-weight:600; color:rgba(255,255,255,0.65); }

    /* Section cards */
    .form-card {
      display:grid; gap:16px; padding:18px; border-radius:26px;
      border:1px solid var(--h-line); background:var(--h-surface); box-shadow:var(--h-shadow);
    }
    .card-head { display:flex; align-items:center; gap:12px; }
    .card-icon {
      width:42px; height:42px; flex-shrink:0; border-radius:14px; display:grid; place-items:center;
      background:var(--h-tile-3); font-size:1.2rem; transform:rotate(-6deg);
    }
    .card-head h2 { margin:0; font-size:1.05rem; font-weight:800; letter-spacing:-0.02em; color:var(--h-ink); }
    .card-head p { margin:2px 0 0; font-size:0.78rem; color:var(--h-muted); }

    .field-wrap { min-width:0; margin:0; padding:0; border:0; display:grid; gap:8px; }
    .field-label { padding:0; font-size:0.78rem; font-weight:700; color:var(--h-ink-soft); }
    legend.field-label { margin-bottom:8px; }
    .field-label em { font-style:normal; color:var(--h-accent); }
    .field-label small { font-weight:600; color:var(--h-muted); }
    .field-row { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }

    .text-input, .amount-wrap, .date-wrap {
      width:100%; min-width:0; min-height:50px; border:1px solid var(--h-line); border-radius:16px;
      background:var(--h-canvas); color:var(--h-ink); font-size:0.92rem; font-weight:600;
    }
    .text-input { padding:0 14px; }
    .text-input--area { min-height:96px; padding:12px 14px; resize:vertical; }
    .text-input::placeholder, .amount-wrap input::placeholder { color:var(--h-muted); font-weight:500; }
    .amount-wrap, .date-wrap { position:relative; display:flex; align-items:center; gap:6px; padding:0 14px; }
    .amount-wrap > span { font-weight:800; color:var(--h-accent); }
    .amount-wrap input, .date-wrap input {
      flex:1; width:100%; min-width:0; height:48px; border:none; background:transparent; padding:0;
      color:var(--h-ink); font-size:0.92rem; font-weight:700; appearance:textfield; -moz-appearance:textfield;
    }
    .amount-wrap--big { min-height:64px; }
    .amount-wrap--big > span { font-family:var(--h-display); font-size:1.4rem; }
    .amount-wrap--big input { height:62px; font-family:var(--h-display); font-size:1.6rem; font-weight:800; letter-spacing:-0.03em; }
    .amount-wrap input::-webkit-outer-spin-button, .amount-wrap input::-webkit-inner-spin-button { margin:0; -webkit-appearance:none; }
    .date-wrap input { font-size:0.86rem; }
    .date-wrap ion-icon { position:absolute; right:12px; color:var(--h-muted); font-size:18px; pointer-events:none; }
    .date-wrap input::-webkit-calendar-picker-indicator { position:absolute; right:0; width:44px; height:100%; opacity:0; cursor:pointer; }
    .text-input:focus, .amount-wrap:focus-within, .date-wrap:focus-within {
      border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow);
    }
    /* Inner inputs: the wrapper draws the ring; beat the global input:not(…):focus rule (0,5,1). */
    :host .form-card .field-wrap .amount-wrap input:focus,
    :host .form-card .field-wrap .date-wrap input:focus { outline:none; box-shadow:none; }
    :host .form-card .field-wrap input.text-input:focus { outline:none; border-color:var(--h-accent); box-shadow:0 0 0 4px var(--h-accent-glow); }

    .category-grid { display:flex; flex-wrap:wrap; gap:6px; }
    .category-chip {
      display:inline-flex; align-items:center; gap:6px; min-height:36px; padding:0 12px 0 4px;
      border:1px solid var(--h-line); border-radius:999px; background:var(--h-canvas);
      color:var(--h-ink-soft); font-size:0.76rem; font-weight:700; cursor:pointer;
      transition:background-color 160ms ease, color 160ms ease;
    }
    .category-chip__emoji { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; background:var(--tile); font-size:0.9rem; }
    .category-chip.is-selected { background:var(--h-btn-bg); border-color:var(--h-btn-bg); color:var(--h-btn-fg); }
    .category-chip:has(input:focus-visible) { outline:3px solid var(--h-accent-glow); outline-offset:2px; }

    .attach-btn {
      min-height:52px; border:1.5px dashed color-mix(in srgb, var(--h-accent) 45%, transparent); border-radius:16px;
      background:transparent; color:var(--h-accent); display:flex; align-items:center; justify-content:center; gap:8px;
      font-size:0.88rem; font-weight:800;
    }
    .error-copy {
      margin:0; padding:12px 14px; border-radius:16px;
      background:var(--h-danger-surface); color:var(--h-danger); font-size:0.85rem; font-weight:700;
    }

    .actions {
      position:sticky; bottom:0; z-index:10;
      margin:0 calc(var(--h-gutter) * -1); padding:12px var(--h-gutter) calc(12px + env(safe-area-inset-bottom, 0px));
      display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.7fr); gap:10px;
      background:color-mix(in srgb, var(--h-canvas) 88%, transparent); backdrop-filter:blur(18px);
      border-top:1px solid var(--h-line);
    }
    .save-btn, .cancel-btn { min-height:54px; border-radius:999px; font-size:0.95rem; font-weight:800; transition:transform 140ms ease; }
    .save-btn:active, .cancel-btn:active { transform:scale(0.97); }
    .save-btn { border:none; background:var(--h-accent); color:#fff; box-shadow:0 12px 24px -12px var(--h-accent-glow); }
    .cancel-btn { border:1px solid var(--h-line); background:var(--h-surface); color:var(--h-ink); }

    @media (max-width: 359px) {
      .field-row { grid-template-columns:1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddExpensePage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  protected readonly backIcon = arrowBackOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly downIcon = chevronDownOutline;
  protected readonly checkIcon = checkmarkOutline;
  protected readonly receiptIcon = documentTextOutline;
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly categoryLabels = CATEGORY_LABELS;

  protected title = '';
  protected amount = '';
  protected quantity = '1';
  protected discount = '0';
  protected category: ExpenseCategory = 'vegetables';
  protected store = '';
  protected date = todayDateOnly();
  protected notes = '';
  protected receiptImageUrl = '';
  protected showError = false;

  protected categoryEmoji(category: ExpenseCategory): string {
    return CATEGORY_EMOJI[category] ?? '🛒';
  }

  protected tileColor(category: ExpenseCategory): string {
    return categoryTileColor(category);
  }

  protected get currencySymbol(): string {
    return getCurrencySymbol(this.expenseService.getDisplayCurrency());
  }

  protected get totalAmount(): string {
    return this.calculateTotalAmount().toFixed(2);
  }

  protected async saveExpense(): Promise<void> {
    const parsedAmount = Number(this.amount);
    const parsedQuantity = this.parsePositiveInteger(this.quantity);
    const parsedDiscount = this.parseNonNegativeNumber(this.discount);
    const totalAmount = this.calculateTotalAmount(parsedAmount, parsedQuantity, parsedDiscount);
    if (
      this.title.trim().length === 0 ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedQuantity <= 0 ||
      !Number.isFinite(parsedDiscount) ||
      totalAmount <= 0
    ) {
      this.showError = true;
      return;
    }

    await this.expenseService.addExpense({
      title: this.title,
      amount: parsedAmount,
      quantity: parsedQuantity,
      discount: parsedDiscount,
      category: this.category,
      store: this.store,
      date: new Date(this.date).toISOString(),
      notes: this.notes,
      receiptImageUrl: this.receiptImageUrl
    });

    const toast = await this.toastController.create({
      message: 'Expense added successfully',
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    await this.navigationHistory.back('/tabs/expenses');
  }

  protected async goBack(): Promise<void> {
    await this.navigationHistory.back('/tabs/expenses');
  }

  private calculateTotalAmount(
    amount: number = Number(this.amount),
    quantity: number = this.parsePositiveInteger(this.quantity),
    discount: number = this.parseNonNegativeNumber(this.discount)
  ): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    return Math.max(0, Math.round((amount * quantity - discount) * 100) / 100);
  }

  private parsePositiveInteger(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : 1;
  }

  private parseNonNegativeNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
  }
}
