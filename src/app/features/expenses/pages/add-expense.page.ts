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
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-add-expense-page',
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="form-header app-mobile-header app-mobile-header--center">
      <button type="button" class="icon-btn app-mobile-icon-btn plain" (click)="goBack()" aria-label="Back">
        <ion-icon [icon]="backIcon" aria-hidden="true" />
      </button>
      <h1>Add Expense</h1>
      <button type="button" class="icon-btn app-mobile-icon-btn success" (click)="saveExpense()" aria-label="Save expense">
        <ion-icon [icon]="checkIcon" aria-hidden="true" />
      </button>
    </header>

    <ion-content [fullscreen]="true" class="add-content">
      <main class="form-shell app-mobile-shell">
        <section class="form-card app-mobile-card">
          <label class="field-wrap"><span>Title <em>*</em></span><input type="text" placeholder="e.g. Milk, Onions, Rice" [(ngModel)]="title" /></label>
          <label class="field-wrap"><span>Amount <em>*</em></span><div class="amount-wrap"><span>{{ currencySymbol }}</span><input type="number" min="0.01" step="0.01" placeholder="0.00" [(ngModel)]="amount" /></div></label>
          <label class="field-wrap"><span>Quantity <em>*</em></span><input type="number" min="1" step="1" placeholder="1" [(ngModel)]="quantity" /></label>
          <label class="field-wrap"><span>Discount <small>(optional)</small></span><div class="amount-wrap"><span>{{ currencySymbol }}</span><input type="number" min="0" step="0.01" placeholder="0.00" [(ngModel)]="discount" /></div></label>
          <label class="field-wrap"><span>Total Amount</span><div class="amount-wrap readonly"><span>{{ currencySymbol }}</span><input type="number" [value]="totalAmount" readonly /></div></label>
          <label class="field-wrap"><span>Category <em>*</em></span><div class="select-wrap"><select [(ngModel)]="category">@for (item of categories; track item) {<option [value]="item">{{ categoryLabels[item] }}</option>}</select><ion-icon [icon]="downIcon" aria-hidden="true" /></div></label>
          <label class="field-wrap"><span>Store <small>(optional)</small></span><input type="text" placeholder="e.g. Lidl, Aldi" [(ngModel)]="store" /></label>
          <label class="field-wrap"><span>Date <em>*</em></span><div class="date-wrap"><input type="date" [(ngModel)]="date" /><ion-icon [icon]="calendarIcon" aria-hidden="true" /></div></label>
          <label class="field-wrap"><span>Notes <small>(optional)</small></span><textarea rows="4" placeholder="Add a note..." [(ngModel)]="notes"></textarea></label>
          <label class="field-wrap"><span>Attachment <small>(optional)</small></span><input type="url" placeholder="Paste receipt image URL" [(ngModel)]="receiptImageUrl" /></label>
          <button type="button" class="attach-btn">
            <ion-icon [icon]="receiptIcon" aria-hidden="true" />
            Add receipt photo
          </button>
        </section>

        @if (showError) {
          <p class="error-copy">Please enter a title and a positive amount.</p>
        }

        <div class="actions">
          <button class="save-btn" (click)="saveExpense()">Save Expense</button>
          <button class="cancel-btn" (click)="goBack()">Cancel</button>
        </div>
      </main>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#f4f8f5; }
    .form-header { }
    .form-header h1 { margin:0; text-align:center; font-size:clamp(1.3rem, 4.6vw, 1.7rem); color:#0f7d4d; font-weight:800; letter-spacing:-0.01em; }
    .icon-btn { border:none; }
    .icon-btn.plain { background:transparent; color:#1f4e38; }
    .icon-btn.success { background:#149255; color:#fff; }
    .add-content { --background:#f4f8f5; }
    .form-shell { }
    .form-card { display:grid; gap:0.75rem; }
    .field-wrap { display:grid; gap:0.35rem; }
    .field-wrap span { font-size:0.9rem; font-weight:600; color:#355a48; }
    .field-wrap em { color:#e53e3e; font-style:normal; }
    .field-wrap small { color:#6a8577; font-weight:500; }
    .field-wrap > input, .field-wrap > select, .field-wrap > textarea, .amount-wrap, .date-wrap, .select-wrap { width:100%; border:1px solid #d8e3dd; border-radius:9px; background:#fff; min-height:2.45rem; font-size:0.94rem; color:#11291d; }
    .field-wrap > input, .field-wrap > select, .field-wrap > textarea { padding:0.6rem 0.7rem; }
    .field-wrap > input:focus,
    .field-wrap > input:focus-visible,
    .field-wrap > select:focus,
    .field-wrap > select:focus-visible,
    .field-wrap > textarea:focus,
    .field-wrap > textarea:focus-visible {
      border-color:#d8e3dd;
      box-shadow:none;
      outline:none;
    }
    input::placeholder, textarea::placeholder { color:#98aa9f; }
    textarea { resize:none; }
    .amount-wrap, .date-wrap, .select-wrap { display:grid; align-items:center; }
    .amount-wrap { grid-template-columns:auto 1fr; padding:0 0.7rem; }
    .amount-wrap span { color:#335444; font-weight:700; font-size:1.05rem; }
    .amount-wrap:focus-within {
      border-color:#d8e3dd;
      box-shadow:none;
    }
    .amount-wrap input {
      width:100%;
      min-height:2.45rem;
      border:none;
      border-radius:0;
      min-width:0;
      margin:0;
      padding-left:0.42rem;
      background:transparent;
      box-shadow:none;
      outline:none;
      appearance:textfield;
      -webkit-appearance:none;
      -moz-appearance:textfield;
    }
    .amount-wrap input::-webkit-outer-spin-button,
    .amount-wrap input::-webkit-inner-spin-button {
      margin:0;
      -webkit-appearance:none;
    }
    .amount-wrap input:focus,
    .amount-wrap input:focus-visible {
      outline:none;
      box-shadow:none;
    }
    .amount-wrap.readonly { background:#f8fbf9; }
    .amount-wrap.readonly input { color:#1e5037; font-weight:700; }
    .date-wrap, .select-wrap { grid-template-columns:1fr auto; padding-right:0.65rem; }
    .date-wrap input, .select-wrap select { border:none; background:transparent; }
    .date-wrap:focus-within,
    .select-wrap:focus-within {
      border-color:#d8e3dd;
      box-shadow:none;
    }
    .date-wrap input:focus,
    .date-wrap input:focus-visible,
    .select-wrap select:focus,
    .select-wrap select:focus-visible {
      outline:none;
      box-shadow:none;
    }
    .date-wrap input[type="date"] { appearance:none; -webkit-appearance:none; -moz-appearance:none; }
    .date-wrap input[type="date"]::-webkit-calendar-picker-indicator { opacity:0; width:0; margin:0; padding:0; }
    .select-wrap select { appearance:none; -webkit-appearance:none; -moz-appearance:none; }
    .select-wrap select::-ms-expand { display:none; }
    .attach-btn { min-height:3rem; border:1px dashed #ccddd1; border-radius:10px; background:#fff; color:#149255; display:flex; align-items:center; justify-content:center; gap:0.45rem; font-weight:700; }
    .error-copy { margin:0.15rem 0; color:#c62828; font-size:0.84rem; }
    .actions { display:grid; gap:0.55rem; }
    .save-btn,.cancel-btn { border:none; border-radius:12px; min-height:2.8rem; font-weight:700; font-size:0.95rem; }
    .save-btn { background:#149255; color:#fff; }
    .cancel-btn { background:transparent; color:#1f6f4a; }
    input:focus,
    input:focus-visible,
    select:focus,
    select:focus-visible,
    textarea:focus,
    textarea:focus-visible,
    .amount-wrap:focus-within,
    .date-wrap:focus-within,
    .select-wrap:focus-within {
      outline:none !important;
      box-shadow:none !important;
      border-color:#d8e3dd !important;
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
  protected date = new Date().toISOString().slice(0, 10);
  protected notes = '';
  protected receiptImageUrl = '';
  protected showError = false;

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
