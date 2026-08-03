import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
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
  { label: 'All Items', value: 'all' },
  { label: 'Vegetables', value: 'vegetables' },
  { label: 'Fruits', value: 'fruits' },
  { label: 'Dairy & Eggs', value: 'dairy' },
  { label: 'Meat & Fish', value: 'meat' },
  { label: 'Bakery', value: 'bakery' },
] as const;

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
  imports: [IonContent, RouterLink],
  template: `
    <ion-content [fullscreen]="true">
      <header class="top-appbar">
        <div class="brand-wrap">
          <div class="avatar-ring">
            @if (profilePhotoDataUrl()) {
              <img [src]="profilePhotoDataUrl()!" alt="Profile photo" />
            } @else {
              <img src="/brand/my-grocery-logo.svg" alt="My Grocery logo" />
            }
          </div>
          <div>
            <p class="brand-title">Grocery Hub</p>
            <p class="brand-subtitle">{{ greeting() }}</p>
          </div>
        </div>
        <button
          type="button"
          class="appbar-icon"
          [routerLink]="['/tabs/profile']"
          aria-label="Open profile"
        >
          <span class="material-symbols-outlined">person</span>
        </button>
      </header>

      <main class="home-redesign">
        <section class="hero-card">
          <div class="hero-glow hero-glow--top" aria-hidden="true"></div>
          <div class="hero-glow hero-glow--bottom" aria-hidden="true"></div>
          <div class="hero-copy">
            <p class="hero-eyebrow">Fresh grocery picks</p>
            <h2>Add fresh products to your basket.</h2>
            <p>Tap + beside any product to add and increase quantity quickly.</p>
            <div class="hero-actions">
              <button type="button" [routerLink]="['/tabs/pantry']">Shop Now</button>
              <span>Fast add for daily essentials</span>
            </div>
          </div>
          <div class="hero-visual">
            <img
              class="hero-image"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOpsUYa28HDxvM_QiuYpjCxwypoDLvJ5frjZR1DsTsunVTHCuH3IM6kSLWya6g3nz7T6ciZN7gKjtTFK3NFcANIgjSrMG7PgmQz-qVkBejOXRJmwbUxpTwZ2Hzafn4X_iSEW5UcVXfXp-SC7VO850yk8f-7Zi8m5p6EHWoi8ISEWLj0j1XhcZSvqiQQjOrmBMYipZA_e1R6CTsVqQO1KSrT1LmrOrW_U5iv4ftEidJFz-V7-dF_2A1Fq5RKpg7EaA6Cm5yvlA-7JXy"
              alt="Fresh fruits"
            />
          </div>
        </section>

        <nav class="category-pills" aria-label="Product categories">
          @for (pill of categoryPills; track pill.value) {
            <button
              type="button"
              class="category-pill"
              [class.category-pill--active]="activeCategory() === pill.value"
              (click)="setActiveCategory(pill.value)"
            >
              {{ pill.label }}
            </button>
          }
        </nav>

        <div class="search-wrap" role="search">
          <span class="material-symbols-outlined">search</span>
          <input
            type="search"
            [value]="searchText()"
            placeholder="Search fresh products..."
            (input)="onSearchInput($event)"
          />
        </div>

        <section class="products-section">
          <div class="section-title-row">
            <h3>Popular Picks</h3>
            <button type="button" [routerLink]="['/tabs/pantry']">View all</button>
          </div>

          <div class="product-grid">
            @for (product of visibleProducts(); track product.id) {
              <article class="product-card" (click)="openProductDetail(product)">
                <button
                  type="button"
                  class="favorite-btn"
                  aria-label="Favorite item"
                  (click)="$event.stopPropagation()"
                >
                  <span class="material-symbols-outlined">favorite</span>
                </button>

                <div class="product-image-wrap">
                  <img [src]="product.image" [alt]="product.name" />
                </div>

                <div class="product-title-row">
                  <h4>{{ product.name }}</h4>
                  <div class="actions-wrap">
                    @if (getProductCount(product) > 0) {
                      <button
                        type="button"
                        class="remove-btn"
                        (click)="onRemoveClick($event, product)"
                        aria-label="Remove item"
                      >
                        <span class="material-symbols-outlined">remove</span>
                      </button>
                    }
                    <button
                      type="button"
                      class="add-btn"
                      (click)="onAddClick($event, product)"
                      aria-label="Add item"
                    >
                      <span class="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
                <p>{{ product.pack }}</p>
                @if (getProductCount(product) > 0) {
                  <p class="added-count">Added: {{ getProductCount(product) }}</p>
                }
              </article>
            } @empty {
              <p class="empty-products">No products match this filter.</p>
            }
          </div>
        </section>
      </main>
    </ion-content>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .top-appbar {
        position: sticky;
        top: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding:
          calc(env(safe-area-inset-top, 0) + var(--app-header-block-start))
          var(--app-page-gutter)
          var(--app-header-block-end);
        background: rgba(248, 255, 252, 0.8);
        backdrop-filter: blur(12px);
      }

      .brand-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .avatar-ring {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #43c98a;
        background: #ffffff;
      }

      .avatar-ring img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .brand-title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: 1.2rem;
        font-weight: 800;
        color: #0a8f5b;
      }

      .brand-subtitle {
        margin: 2px 0 0;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--app-text-muted);
      }

      .appbar-icon {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        border: none;
        background: var(--app-surface);
        color: #0a8f5b;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .home-redesign {
        width: min(100%, var(--app-mobile-max-width));
        margin: 0 auto;
        padding: 10px var(--app-page-gutter) var(--app-shell-bottom-space);
        display: grid;
        gap: clamp(16px, 3vw, 22px);
      }

      .hero-card {
        position: relative;
        min-height: clamp(168px, 24vw, 210px);
        border-radius: var(--app-card-radius-fluid);
        overflow: hidden;
        background:
          linear-gradient(145deg, #e9fff2 0%, #c6f4d7 38%, #78d6a1 100%);
        border: 1px solid rgba(54, 150, 98, 0.18);
        box-shadow: 0 18px 30px rgba(55, 122, 83, 0.12);
        padding: clamp(16px, 2.6vw, 22px);
        color: #ffffff;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(120px, 0.8fr);
        align-items: center;
        gap: 12px;
      }

      .hero-glow {
        position: absolute;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.4);
        filter: blur(6px);
        pointer-events: none;
      }

      .hero-glow--top {
        top: -34px;
        right: 52px;
        width: 130px;
        height: 130px;
      }

      .hero-glow--bottom {
        bottom: -52px;
        left: 46%;
        width: 170px;
        height: 120px;
        background: rgba(9, 135, 83, 0.16);
      }

      .hero-copy {
        position: relative;
        z-index: 2;
        width: 100%;
        color: #173c2a;
      }

      .hero-eyebrow {
        margin: 0 0 8px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #0c8d59;
      }

      .hero-copy h2 {
        margin: 0;
        font-size: clamp(1rem, 2.3vw, 1.28rem);
        line-height: 1.2;
        font-weight: 800;
        color: #173c2a;
      }

      .hero-copy p {
        margin: 8px 0 0;
        font-size: clamp(0.78rem, 1.9vw, 0.9rem);
        line-height: 1.35;
        color: rgba(23, 60, 42, 0.82);
      }

      .hero-actions {
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .hero-actions button {
        min-height: 36px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid rgba(10, 143, 91, 0.14);
        font-size: 0.74rem;
        font-weight: 700;
        color: #ffffff;
        background: linear-gradient(135deg, #0f9d61, #0a7d4f);
        box-shadow: 0 10px 18px rgba(15, 125, 79, 0.22);
      }

      .hero-actions span {
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(23, 60, 42, 0.7);
      }

      .hero-visual {
        position: relative;
        z-index: 2;
        justify-self: end;
        width: min(100%, 190px);
        display: grid;
      }

      .hero-image {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        object-position: center;
        border-radius: 22px;
        border: 3px solid rgba(244, 255, 249, 0.92);
        box-shadow: 0 16px 28px rgba(12, 86, 54, 0.18);
      }

      .category-pills {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .category-pills::-webkit-scrollbar {
        display: none;
      }

      .category-pill {
        flex-shrink: 0;
        padding: 8px 16px;
        border-radius: 999px;
        border: none;
        font-size: 0.82rem;
        font-weight: 700;
        color: #42584b;
        background: #e8f5ed;
      }

      .category-pill--active {
        color: #ffffff;
        background: #0a8f5b;
      }

      .search-wrap {
        position: relative;
      }

      .search-wrap span {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #6d8577;
      }

      .search-wrap input {
        width: 100%;
        height: 52px;
        border-radius: 14px;
        border: 1px solid #bfdcc4;
        background: rgba(255, 255, 255, 0.88);
        padding: 0 14px 0 44px;
        font-size: 0.92rem;
        color: #223b30;
      }

      .section-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .section-title-row h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 800;
      }

      .section-title-row button {
        border: none;
        background: transparent;
        color: #0a8f5b;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .product-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .product-card {
        position: relative;
        padding: 10px;
        border-radius: 14px;
        border: 1px solid #d5ecd8;
        background: rgba(255, 255, 255, 0.9);
      }

      .favorite-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: none;
        background: rgba(255, 255, 255, 0.96);
        color: #cf2e4a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .favorite-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .product-image-wrap {
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 10px;
        overflow: hidden;
        background: #ecf8f1;
      }

      .product-image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .product-title-row {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .product-card h4 {
        margin: 0;
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.3;
      }

      .product-card p {
        margin: 0;
        font-size: 0.76rem;
        color: #6e8378;
      }

      .actions-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .add-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 999px;
        border: none;
        color: #f5fff9;
        background: #0d2b1e;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .add-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .remove-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 999px;
        border: 1px solid #0d2b1e;
        color: #0d2b1e;
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .remove-btn:active {
        background: rgba(13, 43, 30, 0.08);
      }

      .remove-btn .material-symbols-outlined {
        font-size: 18px;
      }

      .added-count {
        margin-top: 8px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #0a8f5b;
      }

      .empty-products {
        grid-column: 1 / -1;
        margin: 0;
        text-align: center;
        color: var(--app-text-muted);
        padding: 24px 8px;
      }

      @media (max-width: 560px) {
        .top-appbar,
        .home-redesign {
          padding-inline: var(--app-page-gutter-tight);
        }

        .hero-card {
          min-height: 0;
          grid-template-columns: 1fr;
          align-items: start;
          gap: 8px;
          padding: 14px;
        }

        .hero-copy {
          width: 100%;
        }

        .hero-visual {
          justify-self: stretch;
          width: 100%;
          grid-template-columns: minmax(0, 116px);
          justify-content: end;
        }

        .hero-image {
          max-width: 116px;
          border-width: 2px;
          border-radius: 18px;
        }

        .hero-copy h2 {
          max-width: 16ch;
        }

        .hero-copy p {
          max-width: 28ch;
        }

        .hero-actions {
          gap: 8px;
        }

        .hero-actions span {
          font-size: 0.68rem;
        }
      }

      @media (max-width: 420px) {
        .hero-card {
          min-height: 176px;
          padding: 14px 14px 12px;
        }

        .hero-copy {
          max-width: calc(100% - 118px);
        }

        .hero-copy h2 {
          font-size: 1rem;
        }

        .hero-copy p {
          font-size: 0.76rem;
          line-height: 1.3;
        }

        .hero-actions {
          margin-top: 10px;
        }

        .hero-actions button {
          min-height: 32px;
          padding: 0 14px;
          font-size: 0.71rem;
        }

        .hero-actions span {
          display: none;
        }

        .hero-visual {
          position: absolute;
          top: 50%;
          right: 14px;
          width: 104px;
          transform: translateY(-50%);
        }

        .hero-image {
          max-width: 104px;
          justify-self: end;
        }

        .hero-glow--top {
          right: 8px;
          width: 96px;
          height: 96px;
        }

        .hero-glow--bottom {
          left: auto;
          right: -12px;
          bottom: -44px;
          width: 128px;
          height: 92px;
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

  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/^fresh\s+/, '');
  }

}
