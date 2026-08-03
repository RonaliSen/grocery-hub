import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { arrowBackOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  ExpenseCategory,
  ExpensePaymentMethod
} from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-edit-expense-page',
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="page-header app-mobile-header app-mobile-header--center"><button class="icon-btn app-mobile-icon-btn" (click)="goBack()"><ion-icon [icon]="backIcon" /></button><h1>Edit Expense</h1><div class="spacer app-mobile-icon-btn"></div></header>
    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell app-mobile-shell">
        <section class="card app-mobile-card">
          <label>Title<input type="text" [(ngModel)]="title" /></label>
          <label>Amount<input type="number" min="0.01" step="0.01" [(ngModel)]="amount" /></label>
          <label>Quantity<input type="number" min="1" step="1" [(ngModel)]="quantity" /></label>
          <label>Discount<input type="number" min="0" step="0.01" [(ngModel)]="discount" /></label>
          <label>Total Amount<input type="number" [value]="totalAmount" readonly /></label>
          <label>Category<select [(ngModel)]="category">@for (c of categories; track c) {<option [value]="c">{{ categoryLabels[c] }}</option>}</select></label>
          <label>Store (optional)<input type="text" [(ngModel)]="store" /></label>
          <label>Payment Method<select [(ngModel)]="paymentMethod">@for (method of paymentMethods; track method) {<option [value]="method">{{ method }}</option>}</select></label>
          <label>Date<input type="date" [(ngModel)]="date" /></label>
          <label>Notes (optional)<textarea rows="4" [(ngModel)]="notes"></textarea></label>
          <label>Receipt image URL (optional)<input type="url" [(ngModel)]="receiptImageUrl" /></label>
          <div class="actions"><button class="save" (click)="save()">Save Changes</button></div>
        </section>
      </main>
    </ion-content>
  `,
  styles: [`.page-header { border-bottom:1px solid #dce5df; } .icon-btn,.spacer{} .icon-btn{border:none;background:#edf3ef}.page-content{--background:#f6f8f7}.shell{}.card{display:grid;gap:0.75rem}label{display:grid;gap:0.35rem;color:#4f685c;font-weight:600;font-size:0.85rem}input,select,textarea{border:1px solid #d7e2db;border-radius:10px;min-height:2.5rem;padding:0.55rem 0.75rem}input[readonly]{background:#f7faf8;color:#1f5038;font-weight:700}.actions{display:grid;gap:0.5rem}.save{border:none;border-radius:999px;min-height:2.7rem;font-weight:700;background:#149255;color:#fff}`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditExpensePage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly backIcon = arrowBackOutline;
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly paymentMethods = EXPENSE_PAYMENT_METHODS;
  protected readonly expenseId = signal('');

  protected title = '';
  protected amount = '';
  protected quantity = '1';
  protected discount = '0';
  protected category: ExpenseCategory = 'vegetables';
  protected paymentMethod: ExpensePaymentMethod = 'Cash';
  protected store = '';
  protected date = '';
  protected notes = '';
  protected receiptImageUrl = '';

  constructor() {
    void this.expenseService.load().then(() => {
      const id = this.route.snapshot.paramMap.get('id') ?? '';
      const expense = this.expenseService.getById(id);
      if (!expense) return;
      this.expenseId.set(id);
      this.title = expense.title;
      this.amount = String(expense.amount);
      this.quantity = String(expense.quantity ?? 1);
      this.discount = String(expense.discount ?? 0);
      this.category = expense.category;
      this.paymentMethod = expense.paymentMethod ?? 'Cash';
      this.store = expense.store ?? '';
      this.date = expense.date.slice(0, 10);
      this.notes = expense.notes ?? '';
      this.receiptImageUrl = expense.receiptImageUrl ?? '';
      this.cdr.markForCheck();
    });
  }

  protected async save(): Promise<void> {
    if (!this.expenseId()) return;
    const parsed = Number(this.amount);
    const quantity = this.parsePositiveInteger(this.quantity);
    const discount = this.parseNonNegativeNumber(this.discount);
    const totalAmount = this.calculateTotalAmount(parsed, quantity, discount);
    if (
      !Number.isFinite(parsed) ||
      parsed <= 0 ||
      quantity <= 0 ||
      this.title.trim().length === 0 ||
      totalAmount <= 0
    ) return;
    await this.expenseService.updateExpense(this.expenseId(), {
      title: this.title,
      amount: parsed,
      quantity,
      discount,
      category: this.category,
      paymentMethod: this.paymentMethod,
      store: this.store,
      notes: this.notes,
      receiptImageUrl: this.receiptImageUrl,
      date: new Date(this.date).toISOString()
    });
    const toast = await this.toastController.create({
      message: 'Expense updated successfully',
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    await this.navigationHistory.back(`/tabs/expenses/${this.expenseId()}`);
  }

  protected async goBack(): Promise<void> { await this.navigationHistory.back(`/tabs/expenses/${this.expenseId()}`); }

  protected get totalAmount(): string {
    return this.calculateTotalAmount(Number(this.amount), this.parsePositiveInteger(this.quantity), this.parseNonNegativeNumber(this.discount)).toFixed(2);
  }

  private calculateTotalAmount(amount: number, quantity: number, discount: number): number {
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
