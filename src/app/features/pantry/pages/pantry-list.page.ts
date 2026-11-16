import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertController, IonContent, IonIcon } from '@ionic/angular/standalone';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  addOutline,
  arrowForwardOutline,
  closeCircleOutline,
  nutritionOutline,
  searchOutline
} from 'ionicons/icons';

import {
  CATEGORY_FILTER_OPTIONS,
  CATEGORY_LABELS,
  DASHBOARD_EXPIRY_WINDOW_DAYS
} from '../../../core/constants/app-config';
import { isExpired, isExpiringWithin } from '../../../core/utils/date.utils';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { PantryItemCardComponent } from '../components/pantry-item-card.component';
import { PantryFilterType } from '../models/pantry-filter.model';
import { PantryItem } from '../models/pantry-item.model';
import { PantryAuditSessionService } from '../services/pantry-audit-session.service';
import { PantryStateService } from '../services/pantry-state.service';
import { CATEGORY_EMOJI } from '../utils/pantry-category-style.util';
import { getPantryStockStatus, shouldShowPantryLowStock } from '../utils/pantry-stock-status.util';

/** Emoji shown in each filter pill (decorative; rendered via CSS). */
const FILTER_EMOJI: Partial<Record<PantryFilterType, string>> = { all: '🧺', ...CATEGORY_EMOJI };

/** Headings for the stock/expiry views that can be opened via `?filter=`. */
const STATUS_FILTER_LABELS: Partial<Record<PantryFilterType, string>> = {
  all: 'All items',
  'low-stock': 'Running low',
  expiring: 'Expiring soon',
  expired: 'Expired'
};

@Component({
  selector: 'app-pantry-list-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, PantryItemCardComponent, RouterLink],
  template: `
    <header class="pantry-header">
      <div class="header-top">
        <span class="header-icon" aria-hidden="true">
          <ion-icon [icon]="pantryIcon" />
        </span>
        <div class="title-group">
          <h1 class="header-title">My Pantry</h1>
          <p class="header-subtitle">
            {{ pantryState.totalCount() }}
            {{ pantryState.totalCount() === 1 ? 'item' : 'items' }} on your shelves
          </p>
        </div>
        <button type="button" class="icon-button" aria-label="Search pantry">
          <ion-icon aria-hidden="true" [icon]="searchIcon" />
        </button>
      </div>

      <div class="search-box">
        <span class="search-input-icon" aria-hidden="true">
          <ion-icon [icon]="searchIcon" />
        </span>
        <input
          type="search"
          class="search-input"
          placeholder="Filter your inventory..."
          aria-label="Filter your inventory"
          [value]="pantryState.searchQuery()"
          (input)="onSearchInput($event)"
        />
        @if (pantryState.searchQuery()) {
          <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search">
            <ion-icon aria-hidden="true" [icon]="clearIcon" />
          </button>
        }
      </div>

      <nav class="filter-nav" aria-label="Pantry categories">
        @for (filter of filters; track filter.value) {
          @let count = filterCount(filter.value);
          <button
            type="button"
            class="filter-pill"
            [class.is-active]="pantryState.stockFilter() === filter.value"
            [class.is-empty]="count === 0"
            [attr.aria-pressed]="pantryState.stockFilter() === filter.value"
            [attr.data-emoji]="filterEmoji[filter.value]"
            (click)="selectFilter(filter.value)"
          >
            {{ filter.label }}
            <span class="filter-count">{{ count }}</span>
          </button>
        }
      </nav>
    </header>

    <ion-content [fullscreen]="true" class="pantry-content">
      <main class="pantry-page-shell">
        <section class="pantry-hero">
          <div class="hero-dots" aria-hidden="true"></div>
          <p class="hero-eyebrow">Pantry check-in</p>

          @if (pantryState.totalCount() === 0) {
            <h2 class="hero-title">Let's fill your <span class="hero-highlight">shelves.</span></h2>
          } @else if (summary().needsAttention === 0) {
            <h2 class="hero-title">Everything looks <span class="hero-highlight">fresh.</span></h2>
          } @else {
            <h2 class="hero-title">
              <span class="hero-highlight">{{ summary().needsAttention }}</span>
              {{ summary().needsAttention === 1 ? 'item needs' : 'items need' }} a look.
            </h2>
          }

          @if (summary().needsAttention > 0) {
            <dl class="hero-stats">
              <div class="hero-stat hero-stat--warn">
                <dt>Running low</dt>
                <dd>{{ summary().runningLow }}</dd>
              </div>
              <div class="hero-stat hero-stat--sun">
                <dt>Expiring soon</dt>
                <dd>{{ summary().expiringSoon }}</dd>
              </div>
              <div class="hero-stat hero-stat--danger">
                <dt>Expired</dt>
                <dd>{{ summary().expired }}</dd>
              </div>
            </dl>
          }

          <button
            type="button"
            class="audit-entry"
            data-testid="start-inventory-audit"
            [routerLink]="['/tabs/pantry/audit']"
            (click)="auditSession.reset()"
          >
            <span class="audit-entry__label">Start Inventory Audit</span>
            <span class="audit-entry__icon" aria-hidden="true">
              <ion-icon [icon]="arrowIcon" />
            </span>
          </button>
        </section>

        @if (pantryState.totalCount() === 0) {
          <section class="empty-card">
            <span class="empty-emoji" aria-hidden="true">🫙</span>
            <p class="empty-eyebrow">No inventory yet</p>
            <h2>Your pantry is empty</h2>
            <p>Add your first pantry item to start tracking.</p>
            <a class="empty-action" [routerLink]="['/tabs/pantry/new']">
              <ion-icon aria-hidden="true" [icon]="addIcon" />
              Add pantry item
            </a>
          </section>
        } @else if (pantryState.filteredItems().length === 0) {
          <section class="empty-card no-results">
            <span class="empty-emoji" aria-hidden="true">🔍</span>
            <h2>No items match the current view.</h2>
            <p>Try a different search or reset filters.</p>
            <button type="button" class="empty-action" (click)="clearFilters()">Reset filters</button>
          </section>
        } @else {
          <div class="section-title-row">
            <h3>{{ activeViewLabel() }}</h3>
            <p>
              {{ pantryState.filteredItems().length }}
              {{ pantryState.filteredItems().length === 1 ? 'item' : 'items' }}
            </p>
          </div>

          <div class="item-stack">
            @for (item of pantryState.filteredItems(); track item.id) {
              <app-pantry-item-card
                [item]="item"
                (delete)="confirmDelete($event)"
                (addToShopping)="addToShoppingList($event)"
              />
            }
          </div>
        }
      </main>

      <div class="fab-wrapper">
        <button type="button" class="main-add-fab" [routerLink]="['/tabs/pantry/new']" aria-label="Add pantry item">
          <ion-icon aria-hidden="true" [icon]="addIcon" />
        </button>
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* Pantry — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss), shared with the Home screen. */
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--h-canvas);
      }

      ion-icon {
        flex-shrink: 0;
      }

      /* ---------------- Header ---------------- */

      .pantry-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        gap: 12px;
        padding: calc(env(safe-area-inset-top, 0px) + 14px) var(--h-gutter) 12px;
        padding-inline: max(var(--h-gutter), calc((100% - var(--app-mobile-max-width)) / 2 + var(--h-gutter)));
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
        background: var(--h-sun);
        color: #16141d;
        font-size: 22px;
        transform: rotate(-6deg);
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

      /* Search — same treatment as Home */
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        height: 52px;
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
        left: 7px;
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
        padding: 0 48px 0 56px;
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
        right: 8px;
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

      /* Filter pills: emoji + label + count */
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
        padding: 0 6px 0 10px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-surface);
        color: var(--h-ink-soft);
        font-size: 0.82rem;
        font-weight: 700;
        transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
      }

      .filter-pill::before {
        content: attr(data-emoji);
        content: attr(data-emoji) / '';
        font-size: 1rem;
      }

      .filter-count {
        min-width: 24px;
        height: 24px;
        padding: 0 7px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.72rem;
        font-weight: 800;
      }

      .filter-pill.is-empty {
        opacity: 0.55;
      }

      .filter-pill.is-active {
        background: var(--h-btn-bg);
        border-color: var(--h-btn-bg);
        color: var(--h-btn-fg);
        opacity: 1;
      }

      .filter-pill.is-active .filter-count {
        background: var(--h-accent);
        color: #ffffff;
      }

      .filter-pill:active {
        transform: scale(0.96);
      }

      /* ---------------- Content ---------------- */

      .pantry-content {
        --padding-bottom: 8.5rem;
      }

      .pantry-content::part(background) {
        background: var(--h-canvas);
      }

      .pantry-page-shell {
        width: min(100%, var(--app-mobile-max-width));
        margin: 0 auto;
        padding: 16px var(--h-gutter) 7.5rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
      }

      /* Hero: summary + audit CTA, echoing Home's ink card */
      .pantry-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        justify-items: start;
        gap: 16px;
        padding: 22px;
        border-radius: 30px;
        color: #ffffff;
        background:
          radial-gradient(70% 80% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
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
        height: 70%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
        pointer-events: none;
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
        max-width: 16ch;
        font-size: clamp(1.55rem, 5.4vw, 2.1rem);
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: -0.035em;
        color: #ffffff;
      }

      .hero-highlight {
        color: var(--h-sun);
      }

      .hero-stats {
        width: 100%;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .hero-stat {
        display: flex;
        flex-direction: column-reverse;
        justify-content: flex-end;
        gap: 2px;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .hero-stat dd {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.6rem;
        font-weight: 800;
        line-height: 1;
        color: var(--stat-color);
      }

      .hero-stat dt {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.7);
      }

      .hero-stat--warn { --stat-color: #ffb36b; }
      .hero-stat--sun { --stat-color: var(--h-sun); }
      .hero-stat--danger { --stat-color: #ff8a8e; }

      .audit-entry {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-height: 48px;
        padding: 0 6px 0 20px;
        border: none;
        border-radius: 999px;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 0.92rem;
        font-weight: 800;
        box-shadow: 0 12px 24px -10px var(--h-accent-glow);
        transition: transform 160ms ease;
      }

      .audit-entry:active {
        transform: scale(0.97);
      }

      .audit-entry__icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #ffffff;
        color: var(--h-accent);
        font-size: 18px;
      }

      /* Section heading */
      .section-title-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: -4px;
      }

      .section-title-row h3 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .section-title-row p {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      /* Staggered two-column grid, like Home */
      .item-stack {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
        gap: 14px 12px;
        padding-bottom: var(--h-stagger);
      }

      .item-stack > :nth-child(even) {
        position: relative;
        top: var(--h-stagger);
      }

      /* Empty / no-results */
      .empty-card {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 32px 20px;
        border-radius: 28px;
        background: var(--h-surface);
        border: 2px dashed var(--h-line);
        text-align: center;
      }

      .empty-emoji {
        width: 64px;
        height: 64px;
        margin-bottom: 6px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        font-size: 2rem;
        background: var(--h-tile-3);
        transform: rotate(-6deg);
      }

      .empty-card .empty-eyebrow {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--h-accent);
      }

      .empty-card h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .empty-card p {
        margin: 0;
        color: var(--h-ink-soft);
        font-size: 0.9rem;
      }

      .empty-action {
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 46px;
        padding: 0 20px;
        border: none;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.9rem;
        font-weight: 800;
      }

      .empty-action ion-icon {
        font-size: 18px;
      }

      /* FAB */
      .fab-wrapper {
        position: fixed;
        bottom: 1.5rem;
        right: max(1.25rem, calc((100% - var(--app-mobile-max-width)) / 2 + 1.25rem));
        z-index: 10;
      }

      .main-add-fab {
        width: 60px;
        height: 60px;
        border: 4px solid var(--h-canvas);
        border-radius: 22px;
        background: var(--h-accent);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 28px;
        box-shadow: 0 14px 28px -10px var(--h-accent-glow);
        transform: rotate(-6deg);
        transition: transform 160ms ease;
      }

      .main-add-fab:active {
        transform: rotate(-6deg) scale(0.9);
      }

      /* ---------------- Responsive ---------------- */

      @media (min-width: 600px) {
        .pantry-hero {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          padding: 30px;
        }

        .hero-eyebrow,
        .hero-title {
          grid-column: 1 / -1;
        }

        .hero-stats {
          max-width: 420px;
        }

        .item-stack {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px 16px;
        }

        .item-stack > :nth-child(even) {
          top: 0;
        }

        .item-stack > :nth-child(3n + 2) {
          top: var(--h-stagger);
        }
      }

      @media (min-width: 820px) {
        .item-stack {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .item-stack > :nth-child(3n + 2) {
          top: 0;
        }

        .item-stack > :nth-child(even) {
          top: var(--h-stagger);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryListPage {
  private readonly alertController = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly settingsService = inject(SettingsService);

  protected readonly addIcon = addOutline;
  protected readonly pantryIcon = nutritionOutline;
  protected readonly pantryState = inject(PantryStateService);
  protected readonly auditSession = inject(PantryAuditSessionService);
  protected readonly searchIcon = searchOutline;
  protected readonly clearIcon = closeCircleOutline;
  protected readonly arrowIcon = arrowForwardOutline;
  protected readonly filterEmoji = FILTER_EMOJI;
  protected readonly filters = [
    { value: 'all', label: 'All' },
    ...CATEGORY_FILTER_OPTIONS,
  ] as const satisfies readonly { value: PantryFilterType; label: string }[];

  /**
   * Hero summary. Uses the same rules as the item cards (stock status with the
   * user's low-stock threshold) and the Expiring/Expired filters, so the
   * numbers always agree with what the list shows.
   */
  protected readonly summary = computed(() => {
    const threshold = this.settingsService.settings().defaultLowStockThreshold;
    let runningLow = 0;
    let expiringSoon = 0;
    let expired = 0;
    let needsAttention = 0;

    for (const item of this.pantryState.items()) {
      const isLow = getPantryStockStatus(item, threshold) !== 'in-stock';
      const isExpiring =
        !!item.expiryDate && isExpiringWithin(item.expiryDate, DASHBOARD_EXPIRY_WINDOW_DAYS);
      const hasExpired = !!item.expiryDate && isExpired(item.expiryDate);

      runningLow += isLow ? 1 : 0;
      expiringSoon += isExpiring ? 1 : 0;
      expired += hasExpired ? 1 : 0;
      needsAttention += isLow || isExpiring || hasExpired ? 1 : 0;
    }

    return { runningLow, expiringSoon, expired, needsAttention };
  });

  /** Heading for the list, reflecting the active category or status view. */
  protected readonly activeViewLabel = computed(() => {
    const filter = this.pantryState.stockFilter();
    return (
      STATUS_FILTER_LABELS[filter] ??
      CATEGORY_LABELS[filter as keyof typeof CATEGORY_LABELS] ??
      'All items'
    );
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const requestedFilter = params.get('filter');

      if (this.isPantryFilter(requestedFilter)) {
        this.pantryState.setStockFilter(requestedFilter);
        return;
      }

      this.pantryState.setStockFilter('all');
    });
  }

  protected filterCount(filter: PantryFilterType): number {
    if (filter === 'all') return this.pantryState.totalCount();
    
    return this.pantryState.items().filter(item => {
      if (filter === 'low-stock') return shouldShowPantryLowStock(item);
      if (filter === 'expiring') return !!item.expiryDate && isExpiringWithin(item.expiryDate, DASHBOARD_EXPIRY_WINDOW_DAYS);
      if (filter === 'expired') return !!item.expiryDate && isExpired(item.expiryDate);
      return item.category === filter;
    }).length;
  }

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.pantryState.setSearchQuery(target?.value ?? '');
  }

  protected clearSearch(): void {
    this.pantryState.setSearchQuery('');
  }

  protected selectFilter(filter: PantryFilterType): void {
    this.pantryState.setStockFilter(filter);
  }

  protected clearFilters(): void {
    this.pantryState.resetFilters();
  }

  private isPantryFilter(value: string | null): value is PantryFilterType {
    if (!value) {
      return false;
    }

    return value === 'all' || value === 'low-stock' || value === 'expiring' || value === 'expired' || CATEGORY_FILTER_OPTIONS.some((option) => option.value === value);
  }

  protected async addToShoppingList(item: PantryItem): Promise<void> {
    await this.shoppingState.addFromPantryItem(item);
  }

  protected async confirmDelete(itemId: string): Promise<void> {
    const alert = await this.alertController.create({
      cssClass: 'delete-pantry-alert',
      header: 'Delete pantry item?',
      message: 'This removes the item from your pantry list.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'delete-pantry-alert__cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'delete-pantry-alert__delete',
          handler: () => this.removeItem(itemId)
        }
      ]
    });

    await alert.present();
  }

  private async removeItem(itemId: string): Promise<void> {
    await this.pantryState.remove(itemId);
  }
}
