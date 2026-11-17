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
  arrowForwardOutline,
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
import { isExpired, toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { CATEGORY_EMOJI } from '../../pantry/utils/pantry-category-style.util';
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

/** Emoji shown in each category pill (decorative; rendered via CSS). */
const FILTER_EMOJI: Partial<Record<ShoppingCategoryFilter, string>> = { all: '🧺', ...CATEGORY_EMOJI };

type ShareOption = {
  readonly method: ShareMethod;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
};
@Component({
  selector: 'app-shopping-list-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, FormsModule, ShoppingItemRowComponent],
  template: `
    <header class="cart-header">
      <div class="header-top">
        <span class="header-icon" aria-hidden="true">
          <ion-icon [icon]="cartIcon" />
        </span>
        <div class="title-group">
          <h1 class="header-title">My Cart</h1>
          <p class="header-subtitle">
            {{ activeStoreLabel() }} store · {{ filteredActiveItems().length }} to buy
          </p>
        </div>

        <button type="button" class="icon-button" aria-label="Search cart" (click)="focusSearch()">
          <ion-icon aria-hidden="true" [icon]="searchIcon" />
        </button>
      </div>

      <div class="search-box">
        <span class="search-input-icon" aria-hidden="true">
          <ion-icon [icon]="searchIcon" />
        </span>
        <input
          #searchInput
          type="search"
          class="search-input"
          placeholder="Filter items..."
          aria-label="Filter items"
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

      <nav class="store-tabs" aria-label="Store selector">
        <button
          type="button"
          class="store-tab"
          [class.is-active]="activeStore() === 'german'"
          [attr.aria-pressed]="activeStore() === 'german'"
          (click)="selectStore('german')"
        >
          <span aria-hidden="true">🥨</span> German
        </button>
        <button
          type="button"
          class="store-tab"
          [class.is-active]="activeStore() === 'indian'"
          [attr.aria-pressed]="activeStore() === 'indian'"
          (click)="selectStore('indian')"
        >
          <span aria-hidden="true">🍛</span> Indian
        </button>
      </nav>
    </header>

    <ion-content [fullscreen]="true" class="cart-content">
      <main class="cart-page-shell">
        @let toBuy = filteredActiveItems().length;
        @let picked = filteredCompletedItems().length;

        @if (toBuy + picked > 0) {
          <section class="cart-hero" aria-label="Shopping progress">
            <div class="hero-dots" aria-hidden="true"></div>
            <p class="hero-eyebrow">{{ activeStoreLabel() }} store run</p>
            <h2 class="hero-title">
              @if (toBuy > 0) {
                <span class="hero-highlight">{{ toBuy }}</span>
                {{ toBuy === 1 ? 'item' : 'items' }} left to grab.
              } @else {
                All picked up. <span class="hero-highlight">Nice!</span>
              }
            </h2>
            <div
              class="progress"
              role="progressbar"
              aria-label="Items picked"
              aria-valuemin="0"
              [attr.aria-valuemax]="toBuy + picked"
              [attr.aria-valuenow]="picked"
            >
              <span [style.width.%]="(picked / (toBuy + picked)) * 100"></span>
            </div>
            <p class="progress-label">{{ picked }} of {{ toBuy + picked }} picked</p>
          </section>
        }

        <nav class="filter-nav" aria-label="Categories">
          @for (filter of filters; track filter.value) {
            <button
              type="button"
              class="filter-pill"
              [class.is-active]="activeFilter() === filter.value"
              [attr.aria-pressed]="activeFilter() === filter.value"
              [attr.data-emoji]="filterEmoji[filter.value]"
              (click)="selectFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          }
        </nav>

        <section class="list-section">
          <div class="list-section-header">
            <h2>Current List <span class="list-count">({{ currentListQuantityCount() }})</span></h2>
            <div class="header-actions">
              @if (filteredCompletedItems().length > 0) {
                <button class="text-action" (click)="clearChecked()">Clear Checked</button>
              }
            </div>
          </div>

          @if (filteredActiveItems().length === 0 && filteredCompletedItems().length === 0) {
            <div class="no-results">
              @if (searchQuery() || activeFilter() !== 'all') {
                <span class="no-results__emoji" aria-hidden="true">🔍</span>
                <h2>No items match the current view.</h2>
                <p>Try a different search or reset filters.</p>
                <button class="reset-button" (click)="clearFilters()">Reset filters</button>
              } @else {
                <span class="no-results__emoji" aria-hidden="true">🛒</span>
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

              @if (filteredCompletedItems().length > 0) {
                <p class="group-label">
                  <span aria-hidden="true">🧺</span> In the basket · {{ filteredCompletedItems().length }}
                </p>
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
          <button type="button" class="share-button" (click)="openShareOptions()" aria-label="Share shopping list">
            <ion-icon aria-hidden="true" [icon]="shareIcon" />
            <span>Share</span>
          </button>
          <button type="button" class="checkout-button" (click)="checkout()">
            Checkout
            <span class="checkout-button__icon" aria-hidden="true">
              <ion-icon [icon]="arrowIcon" />
            </span>
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Cart — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss), shared with Home and Pantry. */
      :host {
        --cart-checkout-bar-height: 4.5rem;
        --cart-checkout-tab-offset: 10px;
        --cart-checkout-stack-height: calc(var(--cart-checkout-bar-height) + 28px);

        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--h-canvas);
      }

      ion-icon {
        flex-shrink: 0;
      }

      /* ---------------- Header ---------------- */

      .cart-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        gap: 12px;
        padding: calc(env(safe-area-inset-top, 0px) + 14px) var(--h-gutter) 12px;
        padding-inline: max(var(--h-gutter), calc((100% - 720px) / 2 + var(--h-gutter)));
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
        border-bottom: 1px solid var(--h-line);
      }

      .header-top {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 22px;
        transform: rotate(-6deg);
        box-shadow: 0 8px 16px -8px var(--h-accent-glow);
      }

      .title-group {
        flex: 1;
        min-width: 0;
      }

      .header-title {
        margin: 0;
        font-size: clamp(1.6rem, 5.6vw, 2.1rem);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.035em;
        color: var(--h-ink);
      }

      .header-subtitle {
        margin: 2px 0 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .icon-button {
        width: 44px;
        height: 44px;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        background: var(--h-surface);
        color: var(--h-ink);
        display: grid;
        place-items: center;
        font-size: 20px;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        height: 50px;
        border-radius: 999px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .search-box:focus-within {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .search-input-icon {
        position: absolute;
        left: 6px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 18px;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: inherit;
        background: transparent;
        padding: 0 48px 0 54px;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--h-ink);
      }

      .search-input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      /* Beat the global input:not(…):focus ring (specificity 0,5,1). */
      :host .search-box input.search-input:focus {
        box-shadow: none;
      }

      .search-clear {
        position: absolute;
        right: 7px;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--h-muted);
        display: grid;
        place-items: center;
        font-size: 22px;
      }

      /* Store switch: segmented control */
      .store-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
      }

      .store-tab {
        min-height: 40px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--h-ink-soft);
        font-size: 0.88rem;
        font-weight: 800;
        transition: background-color 180ms ease, color 180ms ease;
      }

      .store-tab.is-active {
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        box-shadow: 0 6px 14px -8px rgba(22, 20, 29, 0.6);
      }

      /* ---------------- Content ---------------- */

      .cart-content {
        --padding-bottom: var(--cart-checkout-stack-height);
      }

      .cart-content::part(background) {
        background: var(--h-canvas);
      }

      .cart-page-shell {
        width: min(100%, 720px);
        margin: 0 auto;
        padding: 16px var(--h-gutter) 24px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
      }

      /* Progress hero */
      .cart-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        justify-items: start;
        gap: 12px;
        padding: 20px 22px 22px;
        border-radius: 28px;
        color: #ffffff;
        background:
          radial-gradient(70% 90% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
          radial-gradient(45% 55% at 0% 0%, rgba(201, 184, 255, 0.22), transparent 70%),
          var(--h-hero-bg);
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 24px 40px -24px rgba(22, 20, 29, 0.6);
      }

      .hero-dots {
        position: absolute;
        z-index: -1;
        inset: 0 0 auto auto;
        width: 55%;
        height: 80%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
      }

      .hero-eyebrow {
        margin: 0;
        padding: 6px 12px;
        border-radius: 10px;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(-3deg);
      }

      .hero-title {
        margin: 0;
        font-size: clamp(1.5rem, 5.4vw, 2rem);
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: -0.035em;
        color: #ffffff;
      }

      .hero-highlight {
        color: var(--h-sun);
      }

      .progress {
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        overflow: hidden;
      }

      .progress span {
        display: block;
        height: 100%;
        min-width: 10px;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--h-sun), var(--h-accent));
        transition: width 300ms ease;
      }

      .progress-label {
        margin: -4px 0 0;
        font-size: 0.76rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.72);
      }

      /* Category pills */
      .filter-nav {
        display: flex;
        gap: 8px;
        margin: -4px calc(var(--h-gutter) * -1);
        padding: 4px var(--h-gutter);
        scroll-padding-inline: var(--h-gutter);
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
      }

      .filter-nav::-webkit-scrollbar {
        display: none;
      }

      .filter-pill {
        flex-shrink: 0;
        scroll-snap-align: start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        padding: 0 14px 0 11px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-surface);
        color: var(--h-ink-soft);
        font-size: 0.82rem;
        font-weight: 700;
        transition: background-color 160ms ease, color 160ms ease;
      }

      .filter-pill::before {
        content: attr(data-emoji);
        content: attr(data-emoji) / '';
        font-size: 1rem;
      }

      .filter-pill.is-active {
        background: var(--h-btn-bg);
        border-color: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      /* List */
      .list-section-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .list-section-header h2 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .list-count {
        font-size: 1rem;
        color: var(--h-muted);
      }

      .text-action {
        min-height: 34px;
        padding: 0 14px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-surface);
        color: var(--h-danger);
        font-size: 0.78rem;
        font-weight: 800;
      }

      .item-stack {
        display: grid;
        gap: 10px;
      }

      .group-label {
        margin: 10px 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      .group-label::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--h-line);
      }

      /* Empty / no results */
      .no-results {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 32px 20px;
        border-radius: 28px;
        background: var(--h-surface);
        border: 2px dashed var(--h-line);
        text-align: center;
      }

      .no-results__emoji {
        width: 64px;
        height: 64px;
        margin-bottom: 6px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        font-size: 2rem;
        background: var(--h-tile-1);
        transform: rotate(-6deg);
      }

      .no-results h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .no-results p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--h-ink-soft);
      }

      .reset-button {
        margin-top: 10px;
        min-height: 46px;
        padding: 0 20px;
        border: none;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.9rem;
        font-weight: 800;
      }

      /* ---------------- Floating checkout bar ---------------- */

      .sticky-checkout-bar {
        position: fixed;
        left: 50%;
        bottom: var(--cart-checkout-tab-offset);
        z-index: 25;
        transform: translateX(-50%);
        width: min(696px, calc(100% - 2 * var(--h-gutter)));
        height: var(--cart-checkout-bar-height);
        padding: 0 8px 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--h-hero-bg);
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 18px 36px -14px rgba(22, 20, 29, 0.7);
      }

      .total-block {
        display: grid;
        line-height: 1.1;
      }

      .total-label {
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.6);
      }

      .total-block strong {
        font-family: var(--h-display);
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--h-sun);
      }

      .total-subtext {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.75);
      }

      .sticky-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .share-button,
      .checkout-button {
        min-height: 52px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 800;
        transition: transform 140ms ease;
      }

      .share-button:active,
      .checkout-button:active {
        transform: scale(0.96);
      }

      .share-button {
        padding: 0 16px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }

      .share-button ion-icon {
        font-size: 18px;
      }

      .checkout-button {
        padding: 0 6px 0 20px;
        border: none;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 10px 20px -10px var(--h-accent-glow);
      }

      .checkout-button__icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #ffffff;
        color: var(--h-accent);
        font-size: 18px;
      }

      @media (max-width: 374px) {
        .share-button span {
          display: none;
        }

        .share-button {
          padding: 0 15px;
        }

        .checkout-button {
          padding-left: 16px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
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
  protected readonly arrowIcon = arrowForwardOutline;
  protected readonly filterEmoji = FILTER_EMOJI;
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
    const compactDate = toLocalDateOnly(this.shareGeneratedAt());
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
