import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertController, IonContent, IonIcon } from '@ionic/angular/standalone';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { addOutline, closeCircleOutline, nutritionOutline, searchOutline } from 'ionicons/icons';

import { CATEGORY_FILTER_OPTIONS, DASHBOARD_EXPIRY_WINDOW_DAYS } from '../../../core/constants/app-config';
import { isExpired, isExpiringWithin } from '../../../core/utils/date.utils';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { PantryItemCardComponent } from '../components/pantry-item-card.component';
import { PantryFilterType } from '../models/pantry-filter.model';
import { PantryItem } from '../models/pantry-item.model';
import { PantryStateService } from '../services/pantry-state.service';
import { shouldShowPantryLowStock } from '../utils/pantry-stock-status.util';

@Component({
  selector: 'app-pantry-list-page',
  standalone: true,
  imports: [EmptyStateCardComponent, IonContent, IonIcon, PantryItemCardComponent, RouterLink],
  template: `
    <header class="pantry-header">
      <div class="header-top">
        <div class="title-group">
          <ion-icon aria-hidden="true" [icon]="pantryIcon" class="header-icon" />
          <h1 class="header-title">My Pantry</h1>
        </div>
        <button type="button" class="icon-button" aria-label="Search pantry">
          <ion-icon aria-hidden="true" [icon]="searchIcon" />
        </button>
      </div>
      
      <div class="search-box">
        <ion-icon aria-hidden="true" [icon]="searchIcon" class="search-input-icon" />
        <input
          type="search"
          class="search-input"
          placeholder="Filter your inventory..."
          [value]="pantryState.searchQuery()"
          (input)="onSearchInput($event)"
        />
        @if (pantryState.searchQuery()) {
          <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search">
            <ion-icon aria-hidden="true" [icon]="clearIcon" />
          </button>
        }
      </div>

      <nav class="filter-nav">
        @for (filter of filters; track filter.value) {
          <button 
            type="button"
            class="filter-pill" 
            [class.is-active]="pantryState.stockFilter() === filter.value"
            (click)="selectFilter(filter.value)"
          >
            {{ filter.label }}
          </button>
        }
      </nav>
    </header>

    <ion-content [fullscreen]="true" class="pantry-content">
      <main class="pantry-page-shell">
        @if (pantryState.totalCount() === 0) {
          <app-empty-state-card
            eyebrow="No inventory yet"
            title="Your pantry is empty"
            message="Add your first pantry item to start tracking."
            actionLabel="Add pantry item"
            [actionLink]="['/tabs/pantry/new']"
          />
        } @else if (pantryState.filteredItems().length === 0) {
          <div class="no-results">
            <h2>No items match the current view.</h2>
            <p>Try a different search or reset filters.</p>
            <button class="app-button app-button--primary" (click)="clearFilters()">
              Reset filters
            </button>
          </div>
        } @else {
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
      :host {
        --pantry-page-bg: var(--app-surface-muted);
        --pantry-surface: #ffffff;
        --pantry-muted: #4a5b55;
        --pantry-border: var(--app-border-strong);
        --pantry-green-deep: #006c49;

        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--pantry-page-bg);
      }

      .pantry-header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--app-header-background);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--pantry-border);
        padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.75rem;
      }

      .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.875rem;
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

      .icon-button {
        width: 2.5rem;
        height: 2.5rem;
        border: none;
        border-radius: 999px;
        background: #e6e9f1;
        color: var(--pantry-green-deep);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .icon-button ion-icon {
        font-size: 1.4rem;
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
        border: 1px solid var(--pantry-border);
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

      .filter-nav {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
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
        border-color: var(--pantry-green-deep);
        background: #dbf8ea;
        color: var(--pantry-green-deep);
      }

      .pantry-content {
        --background: var(--app-surface-muted);
        --padding-bottom: 8.5rem;
      }

      .pantry-page-shell {
        width: min(100%, 720px);
        margin: 0 auto;
        padding: 1rem 1rem 7.5rem;
      }

      .item-stack {
        display: grid;
        gap: 0.75rem;
      }

      .fab-wrapper {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 10;
      }

      .main-add-fab {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 50%;
        background: linear-gradient(160deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 62%, #43cb95));
        color: var(--ion-color-primary-contrast);
        border: none;
        box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--app-primary) 55%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }

      .main-add-fab:active {
        transform: scale(0.9);
      }

      .no-results {
        border: 1px solid var(--pantry-border);
        border-radius: 1rem;
        background: var(--pantry-surface);
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
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryListPage {
  private readonly alertController = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly shoppingState = inject(ShoppingListStateService);

  protected readonly addIcon = addOutline;
  protected readonly pantryIcon = nutritionOutline;
  protected readonly pantryState = inject(PantryStateService);
  protected readonly searchIcon = searchOutline;
  protected readonly clearIcon = closeCircleOutline;
  protected readonly filters = [
    { value: 'all', label: 'All' },
    ...CATEGORY_FILTER_OPTIONS,
  ] as const satisfies readonly { value: PantryFilterType; label: string }[];

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
