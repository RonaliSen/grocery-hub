import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon
} from '@ionic/angular/standalone';

import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { ExpiringSoonListComponent } from '../components/expiring-soon-list.component';
import { LowStockListComponent } from '../components/low-stock-list.component';
import { OverviewCardsComponent } from '../components/overview-cards.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    ExpiringSoonListComponent,
    IonContent,
    LowStockListComponent,
    OverviewCardsComponent,
    PageHeaderComponent,
    RouterLink
  ],
  template: `
    <app-page-header title="Dashboard" subtitle="Overview" />

    <ion-content [fullscreen]="true">
      <div class="dashboard-container">
        <!-- Pantry Health Section -->
        <app-overview-cards
          [totalItems]="pantryState.totalCount()"
          [lowStockCount]="lowStockReminderItems().length"
          [expiringCount]="expiringReminderItems().length"
          [shoppingCount]="shoppingState.totalCount()"
        />

        @if (hasInventorySignals()) {
          <!-- Expiring Soon Section -->
          @if (expiringReminderItems().length > 0) {
            <app-expiring-soon-list [items]="expiringReminderItems()" />
          }

          <!-- Low Stock Section -->
          @if (lowStockReminderItems().length > 0) {
            <app-low-stock-list
              [items]="lowStockReminderItems()"
              [addedCountByPantryItemId]="addedCountByPantryItemId()"
              (addToShopping)="addLowStockItemToShopping($event)"
              (removeFromShopping)="removeLowStockItemFromShopping($event)"
            />
          }

          <!-- To Buy Section (Shopping List) -->
          <section class="shopping-section">
            <div class="section-header">
              <h2 class="section-header__title">To Buy</h2>
              <button class="section-header__action" [routerLink]="['/tabs/shopping-list']">View All</button>
            </div>

            <div class="shopping-list-card">
              @if (shoppingState.activeItems().length > 0) {
                <div class="shopping-items">
                  @for (item of shoppingState.activeItems().slice(0, 3); track item.id) {
                    <div class="shopping-item" (click)="shoppingState.toggleCompleted(item.id)">
                      <div class="shopping-item__checkbox">
                        @if (item.completed) {
                          <i class="fa-solid fa-check text-xs"></i>
                        }
                      </div>
                      <span class="shopping-item__name">{{ item.name }}</span>
                      <span class="shopping-item__quantity">Added: {{ item.quantity }}</span>
                    </div>
                  }
                </div>
                
                <button class="shopping-list-card__footer-btn" [routerLink]="['/tabs/shopping-list']">
                  Open Full Shopping List
                </button>
              } @else {
                <div class="shopping-empty">
                  <i class="fa-solid fa-cart-shopping text-slate-200 text-3xl mb-2"></i>
                  <p>Your shopping list is empty</p>
                  <button class="shopping-list-card__footer-btn mt-2" [routerLink]="['/tabs/shopping-list/new']">
                    Add Items
                  </button>
                </div>
              }
            </div>
          </section>
        } @else {
          <app-empty-state-card
            eyebrow="Build your pantry"
            title="Start your pantry"
            message="Add your first pantry item to track stock, expiry dates, and shopping needs."
            supportingText="Once inventory exists, this screen highlights the most urgent items instead of showing an empty dashboard."
            actionLabel="Add pantry item"
            [actionLink]="['/tabs/pantry/new']"
            secondaryActionLabel="Open shopping list"
            [secondaryActionLink]="['/tabs/shopping-list']"
          />
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .dashboard-container {
        padding: var(--app-space-4);
        display: grid;
        gap: var(--app-space-4);
        width: min(100%, var(--app-content-max-width));
        margin: 0 auto;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: var(--app-space-4);
        padding: 0 var(--app-space-1);
      }

      .section-header__title {
        font-size: 1.25rem;
        font-weight: 500;
        color: var(--app-ink);
        margin: 0;
      }

      .section-header__action {
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--app-primary);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
      }

      .shopping-section {
        margin-bottom: var(--app-space-8);
      }

      .shopping-list-card {
        background: var(--app-surface);
        border-radius: var(--app-radius-sm);
        box-shadow: var(--app-shadow-strong);
        overflow: hidden;
        border: 1px solid var(--app-border);
      }

      .shopping-items {
        padding: var(--app-space-2) var(--app-space-4);
      }

      .shopping-item {
        display: flex;
        align-items: center;
        gap: var(--app-space-3);
        padding: var(--app-space-4) 0;
        border-bottom: 1px solid var(--app-surface-muted);
        cursor: pointer;
      }

      .shopping-item:last-child {
        border-bottom: none;
      }

      .shopping-item__checkbox {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid var(--app-border-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: all 0.2s ease;
      }

      .shopping-item.completed .shopping-item__checkbox {
        background: var(--app-primary);
        border-color: var(--app-primary);
      }

      .shopping-item__name {
        flex-grow: 1;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--app-text-secondary);
      }

      .shopping-item__quantity {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--app-text-muted);
        background: var(--app-surface-muted);
        padding: 2px 8px;
        border-radius: 4px;
      }

      .shopping-list-card__footer-btn {
        width: 100%;
        padding: var(--app-space-4);
        background: rgba(201, 100, 66, 0.08);
        color: var(--app-primary);
        font-weight: 700;
        font-size: 0.9rem;
        border: none;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .shopping-list-card__footer-btn:hover {
        background: rgba(201, 100, 66, 0.12);
      }

      .shopping-empty {
        padding: var(--app-space-8) var(--app-space-4);
        display: flex;
        flex-direction: column;
        align-items: center;
        color: var(--app-text-muted);
        font-size: 0.9rem;
      }

      @media (min-width: 768px) {
        .dashboard-container {
          max-width: 800px;
          margin: 0 auto;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  protected readonly pantryState = inject(PantryStateService);
  private readonly settingsService = inject(SettingsService);
  protected readonly shoppingState = inject(ShoppingListStateService);
  protected readonly lowStockReminderItems = computed(() =>
    this.settingsService.settings().reminderSettings.lowStockDigestEnabled
      ? this.pantryState.lowStockSignalItems()
      : []
  );
  protected readonly expiringReminderItems = computed(() =>
    this.settingsService.settings().reminderSettings.expiryRemindersEnabled
      ? this.pantryState.expiringSoonItems()
      : []
  );
  protected readonly hasInventorySignals = computed(() => this.pantryState.totalCount() > 0);
  protected readonly addedCountByPantryItemId = computed<Readonly<Record<string, number>>>(() => {
    const counts: Record<string, number> = {};
    for (const item of this.shoppingState.activeItems()) {
      if (item.linkedPantryItemId) {
        counts[item.linkedPantryItemId] = item.quantity;
      }
    }
    return counts;
  });

  protected async addLowStockItemToShopping(
    item: Parameters<ShoppingListStateService['addFromPantryItem']>[0]
  ): Promise<void> {
    const existing = this.shoppingState.getActiveLinkedPantryItem(item.id);
    if (existing) {
      await this.shoppingState.incrementQuantity(existing.id);
      return;
    }

    await this.shoppingState.addFromPantryItem(item);
  }

  protected async removeLowStockItemFromShopping(
    item: Parameters<ShoppingListStateService['addFromPantryItem']>[0]
  ): Promise<void> {
    const existing = this.shoppingState.getActiveLinkedPantryItem(item.id);
    if (!existing) {
      return;
    }

    await this.shoppingState.decrementQuantity(existing.id);
  }
}
