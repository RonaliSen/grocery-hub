import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  cardOutline,
  createOutline,
  documentTextOutline,
  ellipsisVerticalOutline,
  pricetagOutline,
  receiptOutline,
  resizeOutline,
  storefrontOutline
} from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount } from '../../../core/utils/currency.utils';
import { ExpenseCategory } from '../models/expense.model';
import { ExpenseService } from '../services/expense.service';

@Component({
  selector: 'app-expense-detail-page',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <header class="page-header app-mobile-header app-mobile-header--actions">
      <button class="icon-btn app-mobile-icon-btn plain" (click)="goBack()" aria-label="Back"><ion-icon [icon]="backIcon" /></button>
      <h1>Expense Details</h1>
      <div class="header-actions">
        <button class="icon-btn app-mobile-icon-btn plain" (click)="goToEdit()" aria-label="Edit"><ion-icon [icon]="editIcon" /></button>
        <button class="icon-btn app-mobile-icon-btn plain" aria-label="More options"><ion-icon [icon]="moreIcon" /></button>
      </div>
    </header>
    <ion-content [fullscreen]="true" class="page-content">
      <main class="shell app-mobile-shell">
        @if (!expense()) {
          <section class="card app-mobile-card">Expense not found.</section>
        } @else {
          <section class="top-card app-mobile-card">
            <img class="hero-image" [src]="expense()!.itemImageUrl || categoryImage(expense()!.category)" [alt]="expense()!.title" />
            <div class="hero-content">
              <h2>{{ expense()!.title }}</h2>
              <p class="meta">{{ categoryLabel(expense()!.category) }}</p>
              <p class="meta">{{ formatDateTime(expense()!.date) }}</p>
              <p class="amount-label">Total Amount</p>
              <p class="amount">{{ formatAmount(expenseTotal(expense()!)) }}</p>
            </div>
          </section>

          <section class="detail-card app-mobile-card">
            <article class="detail-row"><div class="label"><ion-icon [icon]="tagIcon" /> Category</div><div class="value">{{ categoryLabel(expense()!.category) }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="storeIcon" /> Store</div><div class="value">{{ expense()!.store || '-' }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="amountIcon" /> Amount</div><div class="value">{{ formatAmount(expense()!.amount) }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="qtyIcon" /> Quantity</div><div class="value">{{ expense()!.quantity || 1 }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="discountIcon" /> Discount</div><div class="value">{{ formatAmount(expense()!.discount || 0) }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="totalIcon" /> Total Amount</div><div class="value">{{ formatAmount(expenseTotal(expense()!)) }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="paymentIcon" /> Payment Method</div><div class="value">{{ expense()!.paymentMethod || 'Cash' }}</div></article>
            <article class="detail-row"><div class="label"><ion-icon [icon]="notesIcon" /> Notes</div><div class="value">{{ expense()!.notes || '-' }}</div></article>
            <article class="detail-row receipt-row">
              <div class="label"><ion-icon [icon]="receiptIcon" /> Receipt</div>
              <div class="value">
                @if (expense()!.receiptImageUrl) {
                  <img class="receipt-preview" [src]="expense()!.receiptImageUrl!" alt="Receipt image" />
                  <a class="receipt-link" [href]="expense()!.receiptImageUrl!" target="_blank" rel="noopener">View Receipt</a>
                } @else {
                  -
                }
              </div>
            </article>
          </section>

          <section class="delete-wrap app-mobile-card">
            <button class="danger" (click)="confirmDelete()">Delete Expense</button>
          </section>
        }
      </main>
    </ion-content>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; background:#f4f8f5; }
    .page-header { }
    .page-header h1 { margin:0; text-align:center; font-size:clamp(1.2rem, 4vw, 1.4rem); color:#0f7d4d; font-weight:800; letter-spacing:-0.01em; }
    .header-actions { display:flex; gap:0.15rem; }
    .icon-btn { border:none; background:transparent; color:#1f4e38; display:grid; place-items:center; }
    .page-content { --background:#f4f8f5; }
    .shell { }
    .card,.top-card,.detail-card,.delete-wrap { }
    .card { }
    .top-card { display:grid; grid-template-columns:auto minmax(0, 1fr); gap:0.9rem; align-items:flex-start; }
    .hero-image { width:4.3rem; height:4.3rem; border-radius:12px; object-fit:cover; }
    .hero-content h2 { margin:0; font-size:1.55rem; color:#162b20; }
    .hero-content .meta { margin:0.2rem 0 0; color:#516f5f; font-size:0.83rem; }
    .amount-label { margin:0.45rem 0 0; color:#5b7668; font-size:0.78rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
    .amount { margin:0.12rem 0 0; color:#f33a31; font-size:2rem; line-height:1; font-weight:800; letter-spacing:-0.02em; }
    .detail-card { overflow:hidden; padding:0; }
    .detail-row { display:flex; justify-content:space-between; gap:0.8rem; align-items:flex-start; padding:0.8rem 0.78rem; border-bottom:1px solid #edf2ef; }
    .detail-row:last-child { border-bottom:none; }
    .label { display:flex; align-items:center; gap:0.42rem; color:#385646; font-size:0.87rem; }
    .value { color:#213c2e; text-align:right; font-size:0.9rem; max-width:55%; word-break:break-word; }
    .receipt-row .value { display:grid; justify-items:end; gap:0.35rem; }
    .receipt-preview { width:4.2rem; height:3.2rem; border-radius:8px; object-fit:cover; border:1px solid #dce5df; }
    .receipt-link { color:#129354; text-decoration:none; font-size:0.8rem; font-weight:700; }
    .delete-wrap { }
    .danger { width:100%; border:1px solid #f04a48; background:#fff; color:#ef3a37; border-radius:12px; min-height:2.9rem; font-weight:700; font-size:0.95rem; }

    @media (max-width: 520px) {
      .top-card {
        grid-template-columns: 1fr;
      }

      .hero-image {
        width: 100%;
        height: min(48vw, 220px);
      }

      .value {
        max-width: 60%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseDetailPage {
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);

  protected readonly backIcon = arrowBackOutline;
  protected readonly editIcon = createOutline;
  protected readonly moreIcon = ellipsisVerticalOutline;
  protected readonly tagIcon = pricetagOutline;
  protected readonly storeIcon = storefrontOutline;
  protected readonly amountIcon = cardOutline;
  protected readonly qtyIcon = resizeOutline;
  protected readonly discountIcon = documentTextOutline;
  protected readonly totalIcon = receiptOutline;
  protected readonly paymentIcon = cardOutline;
  protected readonly notesIcon = documentTextOutline;
  protected readonly receiptIcon = receiptOutline;
  protected readonly expenseId = signal('');
  protected readonly expense = computed(() => {
    const id = this.expenseId();
    if (!id) {
      return undefined;
    }
    return this.expenseService.expenses().find((item) => item.id === id);
  });
  private readonly categoryImageMap: Readonly<Partial<Record<ExpenseCategory, string>>> = {
    vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=240&q=80',
    fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=240&q=80',
    dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=240&q=80',
    meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=240&q=80',
    frozen: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=240&q=80',
    spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=240&q=80',
    pulses: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=240&q=80',
    nuts: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=240&q=80',
    bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=240&q=80',
    biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=240&q=80',
    sauces: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=240&q=80',
    beverages: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=240&q=80',
    other: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=240&q=80'
  };
  private readonly toastController = inject(ToastController);

  constructor() {
    void this.expenseService.load().then(() => {
      const id = this.route.snapshot.paramMap.get('id') ?? '';
      this.expenseId.set(id);
    });
  }

  protected async confirmDelete(): Promise<void> {
    if (!this.expenseId()) return;
    const alert = await this.alertController.create({
      header: 'Delete expense?',
      message: 'This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => void this.deleteExpense() }
      ]
    });
    await alert.present();
  }

  private async deleteExpense(): Promise<void> {
    await this.expenseService.deleteExpense(this.expenseId());
    const toast = await this.toastController.create({
      message: 'Expense deleted successfully',
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    await this.navigationHistory.back('/tabs/expenses/history');
  }

  protected formatAmount(amount: number): string {
    return formatCurrencyAmount(amount, this.expenseService.getDisplayCurrency(this.expense()?.date ?? new Date()));
  }

  protected expenseTotal(expense: { amount: number; totalAmount?: number }): number {
    return typeof expense.totalAmount === 'number' && Number.isFinite(expense.totalAmount)
      ? expense.totalAmount
      : expense.amount;
  }

  protected formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  protected categoryLabel(category: ExpenseCategory): string { return CATEGORY_LABELS[category]; }
  protected categoryImage(category: ExpenseCategory): string { return this.categoryImageMap[category] ?? this.categoryImageMap.other ?? ''; }
  protected async goToEdit(): Promise<void> { await this.router.navigateByUrl(`/tabs/expenses/${this.expenseId()}/edit`); }
  protected async goBack(): Promise<void> { await this.navigationHistory.back('/tabs/expenses/history'); }
}
