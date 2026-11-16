import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryImagePipe } from '../../pantry/pipes/pantry-image.pipe';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { ExpiryAlertComponent } from '../../expiry-tracker/components/expiry-alert.component';
import { ExpiryShortcutComponent } from '../../expiry-tracker/components/expiry-shortcut.component';
import { summarizeExpiry, toExpiryEntry } from '../../expiry-tracker/utils/expiry-tracker.util';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';

interface FeaturedProduct {
  readonly id: string;
  readonly name: string;
  readonly pack: string;
  readonly quantity: number;
  readonly category: PantryCategory;
  readonly image: string;
}

const CATEGORY_PILLS = [
  { label: 'All Items', value: 'all', emoji: '🛒' },
  { label: 'Vegetables', value: 'vegetables', emoji: '🥦' },
  { label: 'Fruits', value: 'fruits', emoji: '🍓' },
  { label: 'Dairy & Eggs', value: 'dairy', emoji: '🥛' },
  { label: 'Meat & Fish', value: 'meat', emoji: '🐟' },
  { label: 'Bakery', value: 'bakery', emoji: '🥐' },
] as const;

/** Number of `--h-tile-N` colour tokens defined in the Home styles. */
const HOME_TILE_COUNT = 6;

const POPULAR_PRODUCTS: readonly FeaturedProduct[] = [
  {
    id: 'popular-milk',
    name: 'Milk',
    pack: '1 pack',
    quantity: 1,
    category: 'dairy',
    image:
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'popular-onion',
    name: 'Onion',
    pack: '1 kg',
    quantity: 1,
    category: 'vegetables',
    image:
      'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'popular-tomato',
    name: 'Tomato',
    pack: '1 kg',
    quantity: 1,
    category: 'vegetables',
    image:
      'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'popular-potato',
    name: 'Potato',
    pack: '1 kg',
    quantity: 1,
    category: 'vegetables',
    image:
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'popular-bread',
    name: 'Bread',
    pack: '1 loaf',
    quantity: 1,
    category: 'bakery',
    image:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'popular-yogurt',
    name: 'Yogurt',
    pack: '1 cup',
    quantity: 1,
    category: 'dairy',
    image:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80',
  },
];

@Component({
  selector: 'app-home-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [
    ExpiryAlertComponent,
    ExpiryShortcutComponent,
    FallbackImageDirective,
    IonContent,
    PantryImagePipe,
    RouterLink,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <header class="top-appbar">
        <div class="brand-chip">
          <img class="brand-logo" src="/brand/my-grocery-logo.svg" alt="My Grocery logo" />
          <p class="brand-title">Grocery Hub</p>
        </div>
        <button
          type="button"
          class="profile-btn"
          [routerLink]="['/tabs/profile']"
          aria-label="Open profile"
        >
          @if (profilePhotoDataUrl()) {
            <img [src]="profilePhotoDataUrl()!" alt="Profile photo" />
          } @else {
            <span class="material-symbols-outlined" aria-hidden="true">person</span>
          }
        </button>
      </header>

      <main class="home-redesign">
        <section class="intro">
          <h1 class="greeting">{{ greeting() }}</h1>
          <p class="intro-sub">What's going in your basket today?</p>
        </section>

        <!-- Right after the greeting so it's seen (and read) early; only shown when needed. -->
        @if (expiryAttentionCount() > 0) {
          <app-expiry-alert [summary]="expirySummary()" [leadDays]="expiryLeadDays()" />
        }

        <div class="search-wrap" role="search">
          <span class="search-icon material-symbols-outlined" aria-hidden="true">search</span>
          <input
            type="search"
            [value]="searchText()"
            placeholder="Search fresh products..."
            aria-label="Search fresh products"
            (input)="onSearchInput($event)"
          />
        </div>

        <section class="hero-card">
          <div class="hero-dots" aria-hidden="true"></div>
          <div class="hero-copy">
            <p class="hero-eyebrow">Fresh grocery picks</p>
            <h2>Add <span class="hero-highlight">fresh</span> products to your basket.</h2>
            <p class="hero-text">Tap + beside any product to add and increase quantity quickly.</p>
            <button type="button" class="hero-cta" [routerLink]="['/tabs/pantry']">
              Shop Now
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </div>
          <div class="hero-visual">
            <img
              class="hero-image"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOpsUYa28HDxvM_QiuYpjCxwypoDLvJ5frjZR1DsTsunVTHCuH3IM6kSLWya6g3nz7T6ciZN7gKjtTFK3NFcANIgjSrMG7PgmQz-qVkBejOXRJmwbUxpTwZ2Hzafn4X_iSEW5UcVXfXp-SC7VO850yk8f-7Zi8m5p6EHWoi8ISEWLj0j1XhcZSvqiQQjOrmBMYipZA_e1R6CTsVqQO1KSrT1LmrOrW_U5iv4ftEidJFz-V7-dF_2A1Fq5RKpg7EaA6Cm5yvlA-7JXy"
              alt="Fresh fruits"
            />
            <span class="hero-note">Fast add for daily essentials</span>
          </div>
        </section>

        <app-expiry-shortcut [summary]="expirySummary()" />

        <section class="categories-section">
          <nav class="category-pills" aria-label="Product categories">
            @for (pill of categoryPills; track pill.value) {
              <button
                type="button"
                class="category-pill"
                [class.category-pill--active]="activeCategory() === pill.value"
                [attr.aria-pressed]="activeCategory() === pill.value"
                [attr.data-emoji]="pill.emoji"
                [style.--tile]="tileColor($index, 4)"
                (click)="setActiveCategory(pill.value)"
              >
                {{ pill.label }}
              </button>
            }
          </nav>
        </section>

        <section class="products-section">
          <div class="section-title-row">
            <div class="section-heading">
              <h3>Popular Picks</h3>
              <p>
                {{ visibleProducts().length }}
                {{ visibleProducts().length === 1 ? 'item' : 'items' }}
              </p>
            </div>
            <button type="button" class="view-all-btn" [routerLink]="['/tabs/pantry']">
              View all
              <span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
            </button>
          </div>

          <div class="product-grid">
            @for (product of visibleProducts(); track product.id) {
              @let count = getProductCount(product);
              <article
                class="product-card"
                [class.product-card--in-cart]="count > 0"
                [style.--tile]="tileColor($index)"
                (click)="openProductDetail(product)"
              >
                <div class="product-image-wrap">
                  <img
                    [src]="product.image"
                    [appFallbackImage]="product | pantryImage: 'fallback'"
                    [alt]="product.name"
                    loading="lazy"
                    decoding="async"
                  />
                  <button
                    type="button"
                    class="favorite-btn"
                    aria-label="Favorite item"
                    (click)="$event.stopPropagation()"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
                  </button>
                </div>

                <div class="product-body">
                  <div class="product-info">
                    <h4>{{ product.name }}</h4>
                    <p class="product-pack">{{ product.pack }}</p>
                  </div>
                  <div class="actions-wrap" [class.actions-wrap--stepper]="count > 0">
                    @if (count > 0) {
                      <button
                        type="button"
                        class="remove-btn"
                        (click)="onRemoveClick($event, product)"
                        aria-label="Remove item"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">remove</span>
                      </button>
                      <span class="added-count" aria-live="polite">
                        <span class="visually-hidden">Added: </span>{{ count }}
                      </span>
                    }
                    <button
                      type="button"
                      class="add-btn"
                      (click)="onAddClick($event, product)"
                      aria-label="Add item"
                    >
                      <span class="material-symbols-outlined" aria-hidden="true">add</span>
                    </button>
                  </div>
                </div>
              </article>
            } @empty {
              <div class="empty-products">
                <span class="empty-emoji" aria-hidden="true">🧺</span>
                <p>No products match this filter.</p>
              </div>
            }
          </div>
        </section>
      </main>
    </ion-content>
  `,
  styles: [
    `
      /* Home — "Citrus & Ink". Design tokens (--h-*) come from the shared
         .theme-citrus class in src/theme/citrus.scss. */
      :host {
        display: block;
      }

      ion-content::part(background) {
        background: var(--h-canvas);
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* overflow: hidden — until the icon font loads, ligature names such as
         "arrow_forward" render as text; keep them inside their circles. */
      .material-symbols-outlined {
        font-size: 20px;
        line-height: 1;
        overflow: hidden;
      }


      /* ---------------- App bar ---------------- */

      .top-appbar {
        position: sticky;
        top: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding:
          calc(env(safe-area-inset-top, 0px) + 12px)
          var(--h-gutter)
          10px;
        padding-inline: max(
          var(--h-gutter),
          calc((100% - var(--app-mobile-max-width)) / 2 + var(--h-gutter))
        );
        background: color-mix(in srgb, var(--h-canvas) 84%, transparent);
        backdrop-filter: blur(18px);
      }

      .brand-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 14px 5px 5px;
        border-radius: 999px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
      }

      .brand-logo {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        object-fit: cover;
      }

      .brand-title {
        margin: 0;
        font-family: var(--h-display);
        font-size: 0.92rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .profile-btn {
        width: 44px;
        height: 44px;
        padding: 0;
        overflow: hidden;
        border-radius: 50%;
        border: 2px solid var(--h-surface);
        outline: 2px solid var(--h-accent);
        outline-offset: 0;
        background: var(--h-sun);
        color: #16141d;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 160ms ease;
      }

      .profile-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .profile-btn:active {
        transform: scale(0.93);
      }

      /* ---------------- Layout ---------------- */

      .home-redesign {
        width: min(100%, var(--app-mobile-max-width));
        margin: 0 auto;
        padding: 8px var(--h-gutter) var(--app-shell-bottom-space);
        display: grid;
        /* minmax(0, …) stops the horizontally scrolling category row from
           stretching the whole page wider than the viewport. */
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        color: var(--h-ink);
      }

      /* ---------------- Greeting ---------------- */

      .intro {
        padding-top: 4px;
      }

      .greeting {
        margin: 0;
        font-size: clamp(1.85rem, 6.4vw, 2.5rem);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.035em;
        color: var(--h-ink);
      }

      .greeting::after {
        content: ' 👋' / '';
      }

      .intro-sub {
        margin: 8px 0 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--h-muted);
      }

      /* ---------------- Search ---------------- */

      .search-wrap {
        position: relative;
        display: flex;
        align-items: center;
        height: 56px;
        border-radius: 999px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .search-wrap:focus-within {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .search-icon {
        position: absolute;
        left: 8px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--h-accent);
        color: #ffffff;
        pointer-events: none;
      }

      .search-wrap input {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: inherit;
        background: transparent;
        padding: 0 20px 0 60px;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--h-ink);
      }

      /* Beat the global input:not(…):focus ring (specificity 0,5,1) so only
         the wrapper's tangerine focus ring shows. */
      :host .search-wrap input[type='search']:focus {
        box-shadow: none;
      }

      .search-wrap input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      /* ---------------- Hero ---------------- */

      .hero-card {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        min-height: 272px;
        padding: 22px;
        border-radius: 32px;
        background:
          radial-gradient(60% 70% at 100% 100%, rgba(255, 106, 61, 0.55), transparent 70%),
          radial-gradient(40% 50% at 0% 0%, rgba(201, 184, 255, 0.22), transparent 70%),
          var(--h-hero-bg);
        color: #ffffff;
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 24px 40px -24px rgba(22, 20, 29, 0.6);
      }

      .hero-dots {
        position: absolute;
        z-index: -1;
        top: 0;
        right: 0;
        width: 55%;
        height: 60%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
        pointer-events: none;
      }

      .hero-copy {
        position: relative;
        z-index: 2;
        display: grid;
        justify-items: start;
      }

      .hero-eyebrow {
        margin: 0 0 14px;
        padding: 6px 12px;
        border-radius: 10px;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(-3deg);
        box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.5);
      }

      .hero-copy h2 {
        margin: 0;
        max-width: 11ch;
        font-size: clamp(1.7rem, 6vw, 2.5rem);
        font-weight: 800;
        line-height: 1.04;
        letter-spacing: -0.035em;
        color: #ffffff;
      }

      .hero-highlight {
        color: var(--h-sun);
        background: linear-gradient(transparent 70%, rgba(255, 209, 92, 0.28) 70%);
      }

      .hero-text {
        margin: 12px 0 0;
        /* Leave room for the photo + sticker in the bottom-right corner. */
        max-width: calc(100% - 144px);
        font-size: 0.84rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.7);
      }

      .hero-cta {
        margin-top: 18px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 46px;
        padding: 0 6px 0 20px;
        border: none;
        border-radius: 999px;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 0.9rem;
        font-weight: 800;
        box-shadow: 0 12px 24px -10px var(--h-accent-glow);
        transition: transform 160ms ease;
      }

      .hero-cta .material-symbols-outlined,
      .view-all-btn .material-symbols-outlined {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        color: var(--h-accent);
        font-size: 18px;
        transition: transform 160ms ease;
      }

      .hero-cta:active {
        transform: scale(0.97);
        filter: brightness(0.94);
      }

      .hero-visual {
        position: absolute;
        z-index: 1;
        right: -34px;
        bottom: -34px;
        width: 164px;
        height: 164px;
      }

      .hero-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        border: 5px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.1);
        color: transparent;
      }

      .hero-note {
        position: absolute;
        top: -6px;
        left: -14px;
        width: 78px;
        height: 78px;
        padding: 10px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        text-align: center;
        background: var(--h-sun);
        color: #16141d;
        font-size: 0.56rem;
        font-weight: 800;
        line-height: 1.15;
        text-transform: uppercase;
        transform: rotate(-12deg);
        box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.45);
      }

      /* ---------------- Categories ---------------- */

      .category-pills {
        display: flex;
        gap: 10px;
        margin: -4px calc(var(--h-gutter) * -1);
        padding: 4px var(--h-gutter);
        scroll-padding-inline: var(--h-gutter);
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
      }

      .category-pills::-webkit-scrollbar {
        display: none;
      }

      .category-pill {
        flex: 0 0 auto;
        scroll-snap-align: start;
        width: 78px;
        padding: 0;
        display: grid;
        justify-items: center;
        gap: 8px;
        border: none;
        background: transparent;
        font-size: 0.74rem;
        font-weight: 700;
        line-height: 1.15;
        text-align: center;
        color: var(--h-ink-soft);
      }

      /* Emoji bubble — generated content keeps the button's text (and its
         accessible name) as just the category label. */
      .category-pill::before {
        content: attr(data-emoji);
        content: attr(data-emoji) / '';
        width: 64px;
        height: 64px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        font-size: 1.85rem;
        background: var(--tile, var(--h-surface));
        border: 1px solid var(--h-line);
        transition:
          transform 180ms ease,
          background-color 180ms ease,
          box-shadow 180ms ease;
      }


      .category-pill--active {
        color: var(--h-ink);
        font-weight: 800;
      }

      .category-pill--active::before {
        background: var(--h-accent);
        border-color: var(--h-accent);
        transform: translateY(-2px) rotate(-4deg);
        box-shadow: 0 12px 20px -10px var(--h-accent-glow);
      }

      .category-pill:active::before {
        transform: scale(0.94);
      }

      /* ---------------- Section heading ---------------- */

      .section-title-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .section-heading h3 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.1;
        color: var(--h-ink);
      }

      .section-heading p {
        margin: 4px 0 0;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .view-all-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 38px;
        padding: 0 6px 0 14px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-surface);
        color: var(--h-ink);
        font-size: 0.8rem;
        font-weight: 800;
      }

      .view-all-btn .material-symbols-outlined {
        width: 28px;
        height: 28px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      /* ---------------- Product grid (staggered) ---------------- */

      .product-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
        gap: 14px 12px;
        padding-bottom: var(--h-stagger);
      }

      /* Offset every other column for a relaxed, editorial rhythm.
         'top' is used (not transform) so hover/press transforms still work. */
      .product-card:nth-child(even) {
        top: var(--h-stagger);
      }

      .product-card {
        position: relative;
        display: flex;
        flex-direction: column;
        padding: 8px;
        border-radius: 28px;
        background: var(--tile, var(--h-tile-1));
        cursor: pointer;
        transition:
          transform 200ms ease,
          box-shadow 200ms ease;
      }


      .product-card:active {
        transform: scale(0.98);
      }

      .product-card--in-cart {
        outline: 2px solid var(--h-ink);
      }

      .product-image-wrap {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 22px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.5);
      }

      .product-image-wrap img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        color: transparent;
        transition: transform 400ms ease;
      }

      .favorite-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        padding: 0;
        overflow: hidden;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.92);
        color: var(--h-accent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.3);
      }

      .favorite-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .product-body {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 6px 6px 8px;
      }

      .product-info {
        min-width: 0;
      }

      .product-card h4 {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: var(--h-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .product-pack {
        margin: 3px 0 0;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      /* When in the cart, the stepper takes a full-width row of its own. */
      .product-card--in-cart .product-body {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .actions-wrap {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 999px;
      }

      .actions-wrap--stepper {
        padding: 4px;
        background: var(--h-btn-bg);
      }

      .add-btn,
      .remove-btn {
        width: 38px;
        height: 38px;
        min-width: 38px;
        padding: 0;
        overflow: hidden;
        border: none;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          transform 140ms ease,
          background-color 160ms ease;
      }

      .add-btn {
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        box-shadow: 0 8px 16px -8px rgba(22, 20, 29, 0.6);
      }

      .actions-wrap--stepper .add-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: none;
      }

      .remove-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        background: var(--h-remove-bg);
        color: var(--h-btn-fg);
      }

      .add-btn:active,
      .remove-btn:active {
        transform: scale(0.86);
      }

      .added-count {
        flex: 1;
        text-align: center;
        font-family: var(--h-display);
        font-size: 0.95rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--h-btn-fg);
      }

      /* ---------------- Empty state ---------------- */

      .empty-products {
        grid-column: 1 / -1;
        display: grid;
        justify-items: center;
        gap: 10px;
        padding: 36px 16px;
        border-radius: 28px;
        background: var(--h-surface);
        border: 2px dashed var(--h-line);
        text-align: center;
      }

      .empty-emoji {
        width: 64px;
        height: 64px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        font-size: 2rem;
        background: var(--h-tile-2);
        transform: rotate(-6deg);
      }

      .empty-products p {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      /* ---------------- Pointer hover ---------------- */

      @media (hover: hover) {
        .product-card:hover {
          transform: translateY(-4px) rotate(-0.6deg);
          box-shadow: 0 18px 30px -18px rgba(22, 20, 29, 0.45);
        }

        .product-card:hover .product-image-wrap img {
          transform: scale(1.05);
        }

        .hero-cta:hover .material-symbols-outlined {
          transform: translateX(3px);
        }
      }

      /* ---------------- Responsive ---------------- */

      @media (min-width: 600px) {
        .home-redesign {
          gap: 26px;
        }

        .hero-card {
          min-height: 300px;
          padding: 34px;
        }

        .hero-visual {
          right: 24px;
          bottom: auto;
          top: 50%;
          width: 220px;
          height: 220px;
          transform: translateY(-50%);
        }

        .hero-copy h2 {
          max-width: 14ch;
        }

        .hero-text {
          max-width: 36ch;
        }

        .hero-note {
          width: 92px;
          height: 92px;
          font-size: 0.62rem;
        }

        .category-pills {
          gap: 14px;
        }

        /* Four columns keeps the even-column stagger intact. */
        .product-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px 14px;
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
export class HomePage {
  protected readonly pantryState = inject(PantryStateService);
  private readonly settingsService = inject(SettingsService);
  protected readonly shoppingState = inject(ShoppingListStateService);
  private readonly router = inject(Router);
  protected readonly activeCategory = signal<(typeof CATEGORY_PILLS)[number]['value']>('all');
  protected readonly searchText = signal('');
  protected readonly categoryPills = CATEGORY_PILLS;

  protected readonly greeting = computed(() => {
    const fullName = this.settingsService.settings().profile.fullName.trim();
    return fullName ? `Welcome back, ${fullName}` : 'Welcome back';
  });
  protected readonly profilePhotoDataUrl = computed(
    () => this.settingsService.settings().profile.photoDataUrl ?? null
  );

  /** Re-read on every visit: Ionic keeps Home alive, and "today" moves on. */
  private readonly today = signal(new Date());
  protected readonly expiryLeadDays = computed(
    () => this.settingsService.settings().reminderSettings.expiryLeadDays,
  );

  /**
   * Expiry warning and Tracker shortcut: same rules and lead time as the
   * Expiry Tracker and My Pantry (see expiry-tracker.util / pantry-expiry.util).
   */
  protected readonly expirySummary = computed(() => {
    const leadDays = this.expiryLeadDays();
    const today = this.today();
    return summarizeExpiry(
      this.pantryState.items().map((item) => toExpiryEntry(item, leadDays, today)),
    );
  });

  protected readonly expiryAttentionCount = computed(
    () => this.expirySummary().expired + this.expirySummary().expiring,
  );

  ionViewWillEnter(): void {
    this.today.set(new Date());
  }

  protected readonly featuredProducts = computed<readonly FeaturedProduct[]>(
    () => POPULAR_PRODUCTS,
  );

  protected readonly visibleProducts = computed(() => {
    const query = this.searchText().trim().toLowerCase();

    return this.featuredProducts().filter((product) => {
      const categoryMatch =
        this.activeCategory() === 'all' || product.category === this.activeCategory();
      const queryMatch = query.length === 0 || product.name.toLowerCase().includes(query);
      return categoryMatch && queryMatch;
    });
  });

  protected setActiveCategory(category: (typeof CATEGORY_PILLS)[number]['value']): void {
    this.activeCategory.set(category);
  }

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchText.set(target?.value ?? '');
  }

  protected async addFeaturedToCart(product: FeaturedProduct): Promise<void> {
    await this.shoppingState.save({
      name: product.name,
      quantity: product.quantity,
      unit: 'count',
      linkedPantryItemId: null,
      source: 'manual',
      germanStore: true,
      indianStore: false,
    });
  }

  protected async openProductDetail(product: FeaturedProduct): Promise<void> {
    const pantryMatch = this.pantryState
      .items()
      .find((item) => this.normalizeName(item.name) === this.normalizeName(product.name));
    const selectedQuantity = this.getProductCount(product) || product.quantity;

    if (pantryMatch) {
      await this.router.navigate(['/tabs/pantry', pantryMatch.id, 'edit'], {
        queryParams: {
          category: product.category,
        },
      });
      return;
    }

    await this.router.navigate(['/tabs/pantry/new'], {
      queryParams: {
        name: product.name,
        quantity: selectedQuantity,
        category: product.category,
        germanStore: 'true',
        indianStore: 'false',
      },
    });
  }

  protected async onAddClick(event: Event, product: FeaturedProduct): Promise<void> {
    event.stopPropagation();
    const existingItem = this.shoppingState.activeItems().find((item) => {
      return this.normalizeName(item.name) === this.normalizeName(product.name);
    });

    if (existingItem) {
      await this.shoppingState.incrementQuantity(existingItem.id);
      return;
    }

    await this.addFeaturedToCart(product);
  }

  protected async onRemoveClick(event: Event, product: FeaturedProduct): Promise<void> {
    event.stopPropagation();
    const existingItem = this.shoppingState.activeItems().find((item) => {
      return this.normalizeName(item.name) === this.normalizeName(product.name);
    });

    if (existingItem) {
      await this.shoppingState.decrementQuantity(existingItem.id);
    }
  }

  protected getProductCount(product: FeaturedProduct): number {
    const item = this.shoppingState.activeItems().find((current) => {
      return this.normalizeName(current.name) === this.normalizeName(product.name);
    });

    return item?.quantity ?? 0;
  }

  /** Pastel tile colour (one of six theme tokens) for the item at `index`. */
  protected tileColor(index: number, offset = 0): string {
    return `var(--h-tile-${((index + offset) % HOME_TILE_COUNT) + 1})`;
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/^fresh\s+/, '');
  }

}
