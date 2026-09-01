import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Platform } from '@ionic/angular';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { jsPDF } from 'jspdf';
import {
  addOutline,
  calendarOutline,
  cartOutline,
  closeCircleOutline,
  copyOutline,
  documentOutline,
  logoWhatsapp,
  searchOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';

import { CATEGORY_FILTER_OPTIONS, CATEGORY_LABELS } from '../../../core/constants/app-config';
import { formatCurrencyAmount, getCurrencySymbol } from '../../../core/utils/currency.utils';
import { isExpired } from '../../../core/utils/date.utils';
import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { isPantryItemBelowThreshold } from '../../pantry/utils/pantry-stock-status.util';
import { ExpenseService } from '../../expenses/services/expense.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { ShoppingItemRowComponent } from '../components/shopping-item-row.component';
import { ShoppingListStateService } from '../services/shopping-list-state.service';

type ShoppingCategoryFilter = 'all' | PantryCategory;
type CheckoutLine = {
  itemId: string;
  name: string;
  quantity: number;
  category: PantryCategory;
  imageUrl: string | null;
  unitPriceInput: string;
  isCustom: boolean;
  linkedPantryItemId: string | null;
};

type ShareMethod = 'whatsapp' | 'clipboard' | 'pdf';

type ShareOption = {
  readonly method: ShareMethod;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
};
@Component({
  selector: 'app-shopping-list-page',
  standalone: true,
  imports: [IonContent, IonIcon, FormsModule, ShoppingItemRowComponent],
  template: `
    <header class="cart-header">
      <div class="header-top">
        <div class="title-group">
          <ion-icon aria-hidden="true" [icon]="cartIcon" class="header-icon" />
          <h1 class="header-title">My Cart</h1>
        </div>

        <button type="button" class="icon-button" aria-label="Search cart" (click)="focusSearch()">
          <ion-icon aria-hidden="true" [icon]="searchIcon" />
        </button>
      </div>

      <div class="search-box">
        <ion-icon aria-hidden="true" [icon]="searchIcon" class="search-input-icon" />
        <input
          #searchInput
          type="search"
          class="search-input"
          placeholder="Filter items..."
          [value]="searchQuery()"
          (input)="onSearchInput($event)"
        />
        @if (searchQuery()) {
          <button
            type="button"
            class="search-clear"
            (click)="clearSearch()"
            aria-label="Clear search"
          >
            <ion-icon aria-hidden="true" [icon]="clearIcon" />
          </button>
        }
      </div>

      <div class="control-cluster">
        <nav class="store-tabs" aria-label="Store selector">
          <button
            type="button"
            class="store-tab"
            [class.is-active]="activeStore() === 'german'"
            (click)="selectStore('german')"
          >
            German
          </button>
          <button
            type="button"
            class="store-tab"
            [class.is-active]="activeStore() === 'indian'"
            (click)="selectStore('indian')"
          >
            Indian
          </button>
        </nav>

        <nav class="filter-nav">
          @for (filter of filters; track filter.value) {
            <button
              type="button"
              class="filter-pill"
              [class.is-active]="activeFilter() === filter.value"
              (click)="selectFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          }
        </nav>
      </div>
    </header>

    <ion-content [fullscreen]="true" class="cart-content">
      <main class="cart-page-shell">
        <section class="list-section">
          <div class="list-section-header">
            <h2>Current List ({{ currentListQuantityCount() }})</h2>
            <div class="header-actions">
              @if (filteredCompletedItems().length > 0) {
                <button class="text-action" (click)="clearChecked()">Clear Checked</button>
              }
            </div>
          </div>

          @if (filteredActiveItems().length === 0 && filteredCompletedItems().length === 0) {
            <div class="no-results">
              @if (searchQuery() || activeFilter() !== 'all') {
                <h2>No items match the current view.</h2>
                <p>Try a different search or reset filters.</p>
                <button class="reset-button" (click)="clearFilters()">Reset filters</button>
              } @else {
                <h2>Your shopping list is empty</h2>
                <p>Add some items to get started.</p>
              }
            </div>
          } @else {
            <div class="item-stack">
              @for (item of filteredActiveItems(); track item.id) {
                <app-shopping-item-row
                  [item]="item"
                  (toggle)="toggleCompleted($event)"
                  (remove)="removeItem($event)"
                  (increment)="incrementQuantity($event)"
                  (decrement)="decrementQuantity($event)"
                />
              }

              @for (item of filteredCompletedItems(); track item.id) {
                <app-shopping-item-row
                  [item]="item"
                  (toggle)="toggleCompleted($event)"
                  (remove)="removeItem($event)"
                  (increment)="incrementQuantity($event)"
                  (decrement)="decrementQuantity($event)"
                />
              }
            </div>
          }
        </section>
      </main>
    </ion-content>
    @if (filteredActiveItems().length > 0) {
      <div class="sticky-checkout-bar">
        <div class="total-block">
          <span class="total-label">Items</span>
          <strong>{{ activeItemCount() }}</strong>
          @if (hasEnteredAnyPrice()) {
            <span class="total-subtext">Est. {{ formatMoney(checkoutGrandTotal()) }}</span>
          }
        </div>
        <div class="sticky-actions">
          <button type="button" class="checkout-button" (click)="checkout()">Checkout</button>
          <button type="button" class="share-button" (click)="openShareOptions()" aria-label="Share shopping list">
            <ion-icon aria-hidden="true" [icon]="shareIcon" />
            <span>Share</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        --cart-page-bg: var(--app-surface-muted);
        --cart-surface: #ffffff;
        --cart-muted: #4a5b55;
        --cart-border: var(--app-border-strong);
        --cart-green: #10b981;
        --cart-green-deep: #006c49;
        --cart-tabbar-height: calc(86px + env(safe-area-inset-bottom, 0px));
        --cart-checkout-bar-height: 4rem;
        --cart-checkout-tab-offset: 0px;
        --cart-checkout-stack-height: var(--cart-checkout-bar-height);

        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--cart-page-bg);
      }

      .cart-header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--app-header-background);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--cart-border);
        padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.75rem;
      }

      .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      .icon-button {
        width: 2.5rem;
        height: 2.5rem;
        border: none;
        border-radius: 999px;
        background: #e6e9f1;
        color: var(--cart-green-deep);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .icon-button ion-icon {
        font-size: 1.4rem;
      }

      .title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
      }

      .header-icon {
        color: var(--app-primary);
        font-size: 2rem;
      }

      .header-title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: clamp(1.55rem, 5.2vw, 2rem);
        font-weight: 800;
        letter-spacing: -0.01em;
        line-height: 1.15;
        color: #0a8f5b;
      }

      .eta-label {
        margin: 0;
        color: #9d4300;
        font-size: 0.95rem;
        letter-spacing: 0.06em;
        font-weight: 600;
      }

      .control-cluster {
        display: grid;
        gap: 0.625rem;
        margin-top: 0.75rem;
      }

      .store-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .store-tab {
        min-height: 2.25rem;
        border-radius: 999px;
        border: 1px solid var(--cart-border);
        background: #f5f7fa;
        color: var(--cart-muted);
        font-weight: 700;
      }

      .store-tab.is-active {
        background: var(--cart-green-deep);
        border-color: var(--cart-green-deep);
        color: #fff;
      }

      .filter-nav {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .filter-nav::-webkit-scrollbar {
        display: none;
      }

      .filter-pill {
        flex-shrink: 0;
        min-height: 2rem;
        padding: 0.3rem 0.9rem;
        border: 1px solid #d2dce6;
        border-radius: 999px;
        background: #f8fafc;
        color: #4c5a54;
        font-size: 0.825rem;
        font-weight: 600;
      }

      .filter-pill.is-active {
        border-color: var(--cart-green-deep);
        background: #dbf8ea;
        color: var(--cart-green-deep);
      }

      .search-box {
        margin-top: 0.75rem;
        position: relative;
      }

      .search-input-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        color: #6f7f75;
        font-size: 1.2rem;
      }

      .search-input {
        width: 100%;
        height: 2.8rem;
        border: 1px solid var(--cart-border);
        border-radius: 999px;
        background: #ffffff;
        color: #0c1b2d;
        padding: 0 2.75rem 0 2.45rem;
        font-size: 0.95rem;
      }

      .search-clear {
        border: none;
        background: transparent;
        color: #809087;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        right: 0.4rem;
        top: 50%;
        transform: translateY(-50%);
      }

      .cart-content {
        --background: var(--app-surface-muted);
        --padding-bottom: var(--cart-checkout-stack-height);
      }

      .cart-page-shell {
        width: min(100%, 720px);
        margin: 0 auto;
        padding: 1rem 1rem var(--cart-checkout-stack-height);
        display: grid;
        gap: 1rem;
      }

      .list-section-header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 0.75rem;
      }

      .list-section-header h2 {
        margin: 0;
        color: #0c1b2d;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .header-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
      }

      .text-action {
        border: none;
        background: transparent;
        color: #60726a;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .item-stack {
        display: grid;
        gap: 0.75rem;
      }

      .no-results {
        border: 1px solid var(--cart-border);
        border-radius: 1rem;
        background: var(--cart-surface);
        padding: 1.4rem;
        text-align: center;
      }

      .no-results h2 {
        margin: 0 0 0.4rem;
        font-size: 1.2rem;
      }

      .no-results p {
        margin: 0;
        color: #5b6963;
      }

      .reset-button {
        margin-top: 1rem;
        border: none;
        border-radius: 999px;
        background: var(--cart-green-deep);
        color: white;
        font-weight: 700;
        padding: 0.55rem 1rem;
      }

      .sticky-checkout-bar {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        width: min(720px, calc(100% - 1rem));
        bottom: var(--cart-checkout-tab-offset);
        z-index: 25;
        height: var(--cart-checkout-bar-height);
        border-top-left-radius: 18px;
        border-top-right-radius: 18px;
        background: var(--cart-green-deep);
        color: #fff;
        padding: 0.5rem 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        box-shadow: 0 -8px 22px rgba(11, 59, 41, 0.2);
      }

      .total-block {
        display: grid;
        gap: 0.1rem;
      }

      .total-label {
        font-size: 0.75rem;
        opacity: 0.8;
        letter-spacing: 0.08em;
      }

      .total-block strong {
        font-size: clamp(1.2rem, 4.8vw, 1.45rem);
        line-height: 1.1;
      }

      .total-subtext {
        font-size: 0.75rem;
        opacity: 0.9;
      }

      .checkout-button {
        border: none;
        min-width: clamp(7.25rem, 34vw, 9.5rem);
        border-radius: 999px;
        background: #fff;
        color: var(--cart-green-deep);
        min-height: 2.35rem;
        padding: 0.4rem 1rem;
        font-weight: 800;
      }

      .sticky-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
      }

      .share-button {
        min-height: 2.35rem;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.08));
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        font-weight: 800;
      }

      .share-button ion-icon {
        font-size: 1.05rem;
      }

      .checkout-modal {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem 0.9rem calc(1.1rem + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(180deg, #f7fbf8 0%, #eef5f0 100%);
      }

      .sheet-handle {
        width: 4.25rem;
        height: 0.35rem;
        border-radius: 999px;
        margin: 0.25rem auto 0;
        background: #9ecab4;
      }

      .checkout-header {
        padding: 0 0.9rem;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(7, 61, 39, 0.06);
      }

      .checkout-header h2 {
        margin: 0.95rem 0 0;
        color: #0f2b1d;
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .checkout-header p {
        margin: 0.35rem 0 0.95rem;
        color: #4f6558;
        font-size: 0.95rem;
      }

      .checkout-section-title {
        margin: 0;
        padding: 0 0.2rem;
        color: #113426;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .checkout-body {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 0.75rem;
        overflow: hidden;
      }

      .checkout-list-container {
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding-right: 0.1rem;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
        scrollbar-color: rgba(18, 113, 70, 0.55) rgba(215, 228, 220, 0.8);
      }

      .checkout-list-container::-webkit-scrollbar {
        width: 0.55rem;
      }

      .checkout-list-container::-webkit-scrollbar-track {
        background: rgba(215, 228, 220, 0.8);
        border-radius: 999px;
      }

      .checkout-list-container::-webkit-scrollbar-thumb {
        background: rgba(18, 113, 70, 0.55);
        border-radius: 999px;
        border: 2px solid rgba(215, 228, 220, 0.8);
      }

      .checkout-list {
        overflow: visible;
        min-height: 0;
        padding: 0;
        display: grid;
        gap: 0.7rem;
      }

      .checkout-item {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr) auto;
        gap: 0.75rem;
        align-items: center;
        background: #fff;
        border: 1px solid #dbe7df;
        border-radius: 14px;
        padding: 0.82rem;
      }

      .checkout-item img,
      .item-image-fallback {
        width: 3rem;
        height: 3rem;
        border-radius: 10px;
      }

      .checkout-item img {
        object-fit: cover;
      }

      .item-image-fallback {
        display: grid;
        place-items: center;
        background: #daf4e6;
        color: #0c7c4d;
        font-weight: 800;
      }

      .item-main h3 {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 750;
        color: #122d21;
      }

      .custom-name-input {
        --padding-top: 0;
        --padding-bottom: 0;
        --padding-start: 0;
        --padding-end: 0;
        --background: transparent;
        --border-radius: 0;
        margin: 0;
        min-height: 0;
        color: #122d21;
        font-size: 1.03rem;
        font-weight: 750;
      }

      .item-main p {
        margin: 0.2rem 0 0;
        color: #60766a;
        font-size: 0.95rem;
      }

      .price-field {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .item-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.6rem;
        flex-wrap: nowrap;
      }

      .price-field span {
        font-weight: 700;
        color: #27533d;
      }

      .price-field ion-input,
      .price-field input,
      .checkout-store input {
        min-height: 3rem;
        border: 1px solid #d3dfd8;
        border-radius: 12px;
        padding: 0 0.6rem;
        font-size: 1.12rem;
        background: #fff;
      }

      .price-field ion-input {
        width: 5.25rem;
      }

      .price-field ion-input {
        text-align: center;
      }

      .price-field ion-input::part(native) {
        text-align: center;
      }

      .delete-line-button {
        border: 1px solid #d8e5dd;
        background: #f6faf7;
        color: #a24b42;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .delete-line-button ion-icon {
        font-size: 1.1rem;
      }

      .add-custom-item {
        width: 100%;
        height: 3.1rem;
        min-height: 3.1rem;
        border-radius: 12px;
        border: 1px dashed #c5d8cc;
        background: #f7fbf8;
        color: #127146;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        font-size: 1.05rem;
        font-weight: 700;
        white-space: nowrap;
        flex: 0 0 auto;
      }

      .checkout-summary {
        flex: 0 0 auto;
        background: linear-gradient(135deg, #f1f7f3 0%, #e3efe8 100%);
        border: 1px solid #d2e3d8;
        color: #183026;
        padding: 0.85rem 0.85rem calc(1rem + env(safe-area-inset-bottom, 0px));
        border-radius: 16px;
        box-shadow: 0 -8px 24px rgba(7, 61, 39, 0.06);
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
        margin-bottom: 0.55rem;
      }

      .summary-grid p {
        margin: 0;
        display: grid;
        gap: 0.2rem;
        font-size: 0.86rem;
        color: #496456;
      }

      .summary-grid strong {
        font-size: 1.45rem;
        line-height: 1.05;
        color: #113a2b;
      }

      .summary-date {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 0.85rem;
      }

      .summary-date ion-icon {
        color: #2f4f40;
      }

      .summary-date p {
        margin: 0;
        color: #2f4f40;
        font-size: 0.95rem;
      }

      .summary-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem;
        padding-bottom: 0.1rem;
      }

      .summary-actions button {
        min-height: 3rem;
        border-radius: 999px;
        font-weight: 800;
        font-size: 1rem;
      }

      .cancel-btn {
        border: 1px solid #16784b;
        background: #f7fcf8;
        color: #11693f;
      }

      .confirm-btn {
        border: none;
        color: #fff;
        background: linear-gradient(135deg, #229260 0%, #0b6d43 100%);
      }

      .confirm-btn:disabled {
        opacity: 0.6;
      }

      @media (max-width: 360px) {
        .sticky-checkout-bar {
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }

        .sticky-actions {
          gap: 0.4rem;
        }

        .total-label,
        .total-subtext {
          font-size: 0.7rem;
        }

        .share-button span {
          display: none;
        }

        .share-button {
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }
      }

      @media (min-width: 768px) {
        .sticky-checkout-bar {
          width: min(720px, calc(100% - 2rem));
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingListPage {
  private static readonly shareTitle = 'Grocery Hub Shopping List';
  protected readonly pantryState = inject(PantryStateService);
  protected readonly shoppingState = inject(ShoppingListStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly expenseService = inject(ExpenseService);
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  protected readonly cartIcon = cartOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly clearIcon = closeCircleOutline;
  protected readonly addIcon = addOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly deleteIcon = trashOutline;
  protected readonly shareIcon = shareOutline;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly shareOptions: readonly ShareOption[] = [
    {
      method: 'whatsapp',
      title: 'Share via WhatsApp',
      subtitle: 'Send directly in WhatsApp',
      icon: logoWhatsapp
    },
    {
      method: 'clipboard',
      title: 'Copy to Clipboard',
      subtitle: 'Copy the list as plain text',
      icon: copyOutline
    },
    {
      method: 'pdf',
      title: 'Save as PDF',
      subtitle: 'Generate a PDF to save or share',
      icon: documentOutline
    }
  ];

  protected readonly filters = [
    { value: 'all', label: 'All' },
    ...CATEGORY_FILTER_OPTIONS,
  ] as const satisfies readonly { value: ShoppingCategoryFilter; label: string }[];

  protected searchQuery = signal('');
  protected activeFilter = signal<ShoppingCategoryFilter>('all');
  protected activeStore = signal<'german' | 'indian'>('german');
  protected checkoutModalOpen = signal(false);
  protected shareSheetOpen = signal(false);
  protected previewModalOpen = signal(false);
  private reopenShareSheetOnPreviewClose = false;
  protected checkoutLines = signal<readonly CheckoutLine[]>([]);
  protected checkoutStoreName = signal('');
  protected checkoutDateLabel = signal(new Date().toLocaleDateString());
  protected selectedShareMethod = signal<ShareMethod>('whatsapp');
  protected shareGeneratedAt = signal(new Date());
  protected readonly currentBudgetCurrency = computed(() =>
    this.expenseService.getDisplayCurrency()
  );
  protected readonly shareItems = computed(() =>
    this.shoppingState.activeItems().filter((item) => this.matchesActiveStore(item))
  );
  protected readonly shareTotalItemCount = computed(() =>
    this.shareItems().reduce((sum, item) => sum + item.quantity, 0)
  );
  protected readonly shareGeneratedDateLabel = computed(() =>
    this.shareGeneratedAt().toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  );

  protected readonly currentListQuantityCount = computed(() => {
    const allVisibleItems = [...this.filteredActiveItems(), ...this.filteredCompletedItems()];
    return allVisibleItems.reduce((sum, item) => sum + item.quantity, 0);
  });
  protected readonly checkoutTotalItems = computed(() =>
    this.checkoutLines().reduce((sum, line) => sum + line.quantity, 0)
  );
  protected readonly checkoutGrandTotal = computed(() =>
    this.roundCurrency(
      this.checkoutLines().reduce((sum, line) => sum + this.roundCurrency(this.parsePrice(line.unitPriceInput) * line.quantity), 0)
    )
  );
  protected readonly hasEnteredAnyPrice = computed(() =>
    this.checkoutLines().some((line) => this.parsePrice(line.unitPriceInput) > 0)
  );
  protected readonly activeItemCount = computed(() =>
    this.filteredActiveItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  constructor() {
    void this.expenseService.load();

    const subscription = this.platform.backButton.subscribeWithPriority(200, () => {
      if (this.previewModalOpen()) {
        this.closePreview();
        return;
      }

      if (this.shareSheetOpen()) {
        this.closeShareOptions();
      }
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected selectStore(store: 'german' | 'indian'): void {
    this.activeStore.set(store);
  }

  protected currencySymbol(): string {
    return getCurrencySymbol(this.currentBudgetCurrency());
  }

  protected formatMoney(amount: number): string {
    return formatCurrencyAmount(amount, this.currentBudgetCurrency());
  }

  private matchesActiveStore(item: ShoppingListItem): boolean {
    if (item.linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
      if (pantryItem) {
        return this.activeStore() === 'german' ? pantryItem.germanStore : pantryItem.indianStore;
      }
    }

    return this.activeStore() === 'german' ? item.germanStore : item.indianStore;
  }

  private isVisibleInCart(item: ShoppingListItem): boolean {
    if (!item.linkedPantryItemId) {
      return true;
    }

    const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
    if (!pantryItem) {
      return true;
    }

    return isPantryItemBelowThreshold(pantryItem) || (pantryItem.expiryDate !== null && isExpired(pantryItem.expiryDate));
  }

  private resolveCategory(item: ShoppingListItem): PantryCategory {
    if (item.linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
      if (pantryItem) {
        return pantryItem.category;
      }
    }
    return 'other';
  }

  protected readonly filteredActiveItems = computed(() => {
    let items = this.shoppingState.activeItems();
    const query = this.searchQuery().toLowerCase();
    const filter = this.activeFilter();

    if (query) {
      items = items.filter((i) => i.name.toLowerCase().includes(query));
    }
    if (filter !== 'all') {
      items = items.filter((i) => this.resolveCategory(i) === filter);
    }
    return items.filter((item) => this.matchesActiveStore(item) && this.isVisibleInCart(item));
  });

  protected readonly filteredCompletedItems = computed(() => {
    let items = this.shoppingState.completedItems();
    const query = this.searchQuery().toLowerCase();
    const filter = this.activeFilter();

    if (query) {
      items = items.filter((i) => i.name.toLowerCase().includes(query));
    }
    if (filter !== 'all') {
      items = items.filter((i) => this.resolveCategory(i) === filter);
    }
    return items.filter((item) => this.matchesActiveStore(item));
  });

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected focusSearch(): void {
    const searchInput = document.querySelector<HTMLInputElement>('.search-input');
    searchInput?.focus();
  }

  protected selectFilter(filter: ShoppingCategoryFilter): void {
    this.activeFilter.set(filter);
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.activeFilter.set('all');
  }

  protected async incrementQuantity(itemId: string): Promise<void> {
    await this.shoppingState.incrementQuantity(itemId);
  }

  protected async decrementQuantity(itemId: string): Promise<void> {
    await this.shoppingState.decrementQuantity(itemId);
  }

  protected async toggleCompleted(itemId: string): Promise<void> {
    await this.shoppingState.toggleCompleted(itemId);
  }

  protected async removeItem(itemId: string): Promise<void> {
    await this.shoppingState.remove(itemId);
  }

  protected async clearChecked(): Promise<void> {
    const completedItems = this.shoppingState.completedItems();
    for (const item of completedItems) {
      await this.shoppingState.remove(item.id);
    }
  }

  protected async checkout(): Promise<void> {
    const visibleItems = this.filteredActiveItems();
    if (visibleItems.length <= 0) {
      return;
    }

    await this.router.navigateByUrl('/tabs/shopping-list/checkout', {
      state: {
        activeStore: this.activeStore(),
        checkoutLines: visibleItems.map((item) => {
          const pantryItem = item.linkedPantryItemId
            ? this.pantryState.getById(item.linkedPantryItemId)
            : undefined;
          return {
            itemId: item.id,
            name: item.name,
            quantity: item.quantity,
            category: this.resolveCategory(item),
            imageUrl: pantryItem?.imageUrl ?? null,
            unitPriceInput: '',
            isCustom: false,
            linkedPantryItemId: item.linkedPantryItemId ?? null
          };
        })
      }
    });
  }

  protected async openShareOptions(): Promise<void> {
    if (this.shareItems().length <= 0) {
      await this.presentToast('No items available to export.', 'warning');
      return;
    }

    await this.router.navigateByUrl(`/tabs/shopping-list/share?store=${this.activeStore()}`);
  }

  protected closeShareOptions(): void {
    this.shareSheetOpen.set(false);
  }

  protected selectShareMethod(method: ShareMethod): void {
    this.selectedShareMethod.set(method);
    this.shareGeneratedAt.set(new Date());
    this.reopenShareSheetOnPreviewClose = false;
    this.shareSheetOpen.set(false);
    this.previewModalOpen.set(true);
  }

  protected closePreview(): void {
    this.previewModalOpen.set(false);
    this.reopenShareSheetOnPreviewClose = false;
  }

  protected activeStoreLabel(): string {
    return this.activeStore() === 'german' ? 'German' : 'Indian';
  }

  protected shareMethodLabel(): string {
    return this.shareOptions.find((option) => option.method === this.selectedShareMethod())?.title ?? 'Share';
  }

  protected primaryShareActionLabel(): string {
    switch (this.selectedShareMethod()) {
      case 'whatsapp':
        return 'Send';
      case 'clipboard':
        return 'Copy List';
      case 'pdf':
        return 'Share PDF';
      default:
        return 'Share Now';
    }
  }

  protected async shareNow(): Promise<void> {
    if (this.shareItems().length <= 0) {
      await this.presentToast('Add items to your cart before sharing.', 'warning');
      return;
    }

    try {
      const listText = this.buildShoppingListText();

      switch (this.selectedShareMethod()) {
        case 'whatsapp':
          await this.openWhatsAppShare(listText);
          await this.presentToast('Opening WhatsApp…', 'success');
          break;
        case 'clipboard':
          await this.copyShoppingListToClipboard(listText);
          await this.presentToast('Shopping list copied successfully', 'success');
          break;
        case 'pdf':
          await this.shareShoppingListPdf();
          await this.presentToast('PDF ready to share', 'success');
          break;
        default:
          await this.copyShoppingListToClipboard(listText);
          await this.presentToast('Shopping list copied successfully', 'success');
          break;
      }

      this.reopenShareSheetOnPreviewClose = false;
      this.shareSheetOpen.set(false);
      this.previewModalOpen.set(false);
    } catch {
      await this.presentToast('Unable to share the shopping list right now.', 'danger');
    }
  }

  protected async saveShoppingListAsPdf(): Promise<void> {
    if (this.shareItems().length <= 0) {
      await this.presentToast('Add items to your cart before sharing.', 'warning');
      return;
    }

    try {
      await this.savePdfToDevice();
      await this.presentToast('Shopping list PDF saved successfully', 'success');
      this.shareSheetOpen.set(false);
      this.previewModalOpen.set(false);
    } catch {
      await this.presentToast('PDF generation failed. Please try again.', 'danger');
    }
  }

  protected closeCheckoutModal(): void {
    this.checkoutModalOpen.set(false);
  }

  protected onUnitPriceChange(itemId: string, rawValue: string): void {
    const normalizedValue = this.normalizePriceInput(rawValue);
    this.checkoutLines.set(
      this.checkoutLines().map((line) =>
        line.itemId === itemId
          ? {
              ...line,
              unitPriceInput: normalizedValue
            }
          : line
      )
    );
  }

  protected onUnitPriceBlur(itemId: string): void {
    this.checkoutLines.set(
      this.checkoutLines().map((line) => {
        if (line.itemId !== itemId) {
          return line;
        }
        const amount = this.parsePrice(line.unitPriceInput);
        return {
          ...line,
          unitPriceInput: amount > 0 ? amount.toFixed(2) : ''
        };
      })
    );
  }

  protected addCustomCheckoutItem(): void {
    const itemNumber = this.checkoutLines().length + 1;
    this.checkoutLines.set([
      ...this.checkoutLines(),
      {
        itemId: `custom-${Date.now()}-${itemNumber}`,
        name: '',
        quantity: 1,
        category: 'other',
        imageUrl: null,
        unitPriceInput: '',
        isCustom: true,
        linkedPantryItemId: null
      }
    ]);
  }

  protected onCustomCheckoutItemNameChange(itemId: string, rawValue: string): void {
    const normalizedValue = String(rawValue ?? '').slice(0, 80);
    this.checkoutLines.set(
      this.checkoutLines().map((line) =>
        line.itemId === itemId
          ? {
              ...line,
              name: normalizedValue
            }
          : line
      )
    );
  }

  protected removeCheckoutLine(itemId: string): void {
    this.checkoutLines.set(this.checkoutLines().filter((line) => line.itemId !== itemId));
  }

  protected async confirmPurchase(): Promise<void> {
    if (!this.hasEnteredAnyPrice()) {
      return;
    }

    const purchaseDate = new Date().toISOString();
    const lines = this.checkoutLines().map((line) => {
      const unitPrice = this.parsePrice(line.unitPriceInput);
      return {
        id: line.itemId,
        itemName: line.name.trim() || 'Custom Item',
        quantity: line.quantity,
        unitPrice,
        totalPrice: this.roundCurrency(unitPrice * line.quantity),
        category: line.category,
        purchaseDate,
        store: this.checkoutStoreName().trim() || undefined
      };
    });

    await this.expenseService.addPurchaseRecord({
      store: this.checkoutStoreName().trim() || undefined,
      items: lines
    });

    this.closeCheckoutModal();
    await this.clearVisibleActiveItems();
    const toast = await this.toastController.create({
      message: 'Purchase added to expenses',
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    await this.router.navigateByUrl('/tabs/expenses');
  }

  private async clearVisibleActiveItems(): Promise<void> {
    const itemIds = this.filteredActiveItems().map((item) => item.id);
    for (const itemId of itemIds) {
      await this.shoppingState.remove(itemId);
    }
  }

  private normalizePriceInput(value: string): string {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (normalized === '') {
      return '';
    }
    if (!/^\d*\.?\d*$/.test(normalized)) {
      return '';
    }
    const decimalParts = normalized.split('.');
    if (decimalParts.length > 2) {
      return '';
    }
    return normalized;
  }

  private parsePrice(value: string): number {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (normalized === '' || normalized === '.') {
      return 0;
    }
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return this.roundCurrency(parsed);
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private buildShoppingListText(): string {
    const lines = this.shareItems().map((item) => `□ ${item.name} x ${item.quantity}`);
    return [
      '🛒 Grocery Hub Shopping List',
      '',
      ...lines,
      '',
      `Total Items: ${this.shareTotalItemCount()}`,
      '',
      'Generated from Grocery Hub'
    ].join('\n');
  }

  private async shareShoppingListText(text: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: ShoppingListPage.shareTitle,
        text,
        dialogTitle: 'Share Shopping List'
      });
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: ShoppingListPage.shareTitle,
        text
      });
      return;
    }

    await this.copyShoppingListToClipboard(text);
    await this.presentToast('Shopping list copied successfully', 'success');
  }

  private async copyShoppingListToClipboard(text: string): Promise<void> {
    try {
      await Clipboard.write({ string: text });
      return;
    } catch {
      // Fall through to the browser clipboard API.
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    throw new Error('Clipboard unavailable');
  }

  private async openWhatsAppShare(text: string): Promise<void> {
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const openedWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }
  }

  private async shareShoppingListPdf(): Promise<void> {
    const fileName = this.buildPdfFileName();
    const pdfBlob = this.createPdfBlob();

    if (Capacitor.isNativePlatform()) {
      const uri = await this.writePdfFile(fileName, pdfBlob, Directory.Cache);
      await Share.share({
        title: ShoppingListPage.shareTitle,
        text: 'Shared from Grocery Hub',
        files: [uri],
        dialogTitle: 'Share Shopping List PDF'
      });
      return;
    }

    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      'canShare' in navigator &&
      navigator.canShare?.({ files: [pdfFile] })
    ) {
      await navigator.share({
        title: ShoppingListPage.shareTitle,
        files: [pdfFile]
      });
      return;
    }

    this.downloadBlob(pdfBlob, fileName);
  }

  private async savePdfToDevice(): Promise<void> {
    const fileName = this.buildPdfFileName();
    const pdfBlob = this.createPdfBlob();

    if (Capacitor.isNativePlatform()) {
      await this.writePdfFile(fileName, pdfBlob, Directory.Documents);
      return;
    }

    this.downloadBlob(pdfBlob, fileName);
  }

  private createPdfBlob(): Blob {
    const document = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });
    const title = ShoppingListPage.shareTitle;
    const dateLabel = `Generated Date: ${this.shareGeneratedDateLabel()}`;
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const left = 48;
    const right = pageWidth - 48;
    let y = 58;

    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.text(title, left, y);

    y += 24;
    document.setFont('helvetica', 'normal');
    document.setFontSize(11);
    document.setTextColor(92, 110, 101);
    document.text(dateLabel, left, y);

    y += 22;
    document.setDrawColor(215, 229, 221);
    document.line(left, y, right, y);
    y += 22;

    document.setTextColor(22, 39, 32);
    for (const item of this.shareItems()) {
      const itemLine = `□ ${item.name} x ${item.quantity}`;
      const wrappedLines = document.splitTextToSize(itemLine, right - left);
      const requiredHeight = wrappedLines.length * 18;

      if (y + requiredHeight > pageHeight - 110) {
        document.addPage();
        y = 58;
      }

      document.text(wrappedLines, left, y);
      y += requiredHeight;
    }

    y += 10;
    if (y > pageHeight - 90) {
      document.addPage();
      y = 58;
    }
    document.line(left, y, right, y);
    y += 24;

    document.setFont('helvetica', 'bold');
    document.text(`Total Items: ${this.shareTotalItemCount()}`, left, y);
    y += 28;

    document.setFont('helvetica', 'normal');
    document.setTextColor(92, 110, 101);
    document.text('Generated from Grocery Hub', left, y);

    return document.output('blob');
  }

  private buildPdfFileName(): string {
    const compactDate = this.shareGeneratedAt().toISOString().slice(0, 10);
    return `grocery-hub-shopping-list-${compactDate}.pdf`;
  }

  private async writePdfFile(fileName: string, pdfBlob: Blob, directory: Directory): Promise<string> {
    const base64Data = await this.blobToBase64(pdfBlob);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory,
      recursive: true
    });
    return result.uri;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
