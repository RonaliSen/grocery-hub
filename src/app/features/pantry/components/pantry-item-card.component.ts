import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { trashOutline } from 'ionicons/icons';

import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryImagePipe } from '../pipes/pantry-image.pipe';
import { getPantryStockStatus } from '../utils/pantry-stock-status.util';

@Component({
  selector: 'app-pantry-item-card',
  standalone: true,
  imports: [ExpiryStatusPipe, FallbackImageDirective, IonIcon, PantryImagePipe, QuantityLabelPipe, RouterLink],
  template: `
    <div class="item-card" [routerLink]="['/tabs/pantry', item().id, 'edit']">
      <div class="item-visual">
        <img
          [src]="item() | pantryImage"
          [appFallbackImage]="item() | pantryImage: 'fallback'"
          [alt]="item().name"
          class="item-image"
          loading="lazy"
        />
      </div>

      <div class="item-info">
        <div class="item-row item-row--top">
          <span class="category">{{ categoryLabels[item().category] }}</span>
          <div class="top-actions">
            <p class="expiry-date" [class.is-expired]="expiryTone() === 'danger'" [class.is-expiring]="expiryTone() === 'warning'">
              {{ item().expiryDate ? (item().expiryDate | expiryStatus) : 'No expiry date' }}
            </p>
            <button
              type="button"
              class="delete-button"
              aria-label="Delete pantry item"
              (click)="onDelete($event)"
            >
              <ion-icon aria-hidden="true" [icon]="trashIcon" />
            </button>
          </div>
        </div>

        <h3 class="item-name">{{ item().name }}</h3>
        <p class="quantity-line">{{ item().quantity | quantityLabel: item().unit }}</p>

        <div class="item-row item-row--bottom">
          <div class="stock-pill" [class]="'stock-pill stock--' + stockLabel().toLowerCase().replace(' ', '-')">
            {{ stockLabel() }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .item-card {
        display: flex;
        align-items: stretch;
        gap: 1rem;
        padding: 0.78rem;
        background: var(--app-surface);
        border-radius: 1.2rem;
        border: 1px solid color-mix(in srgb, var(--app-border) 78%, #dce2db);
        box-shadow: 0 1px 0 color-mix(in srgb, #ffffff 50%, transparent);
        transition: transform 0.1s;
        cursor: pointer;
      }

      .item-card:active {
        transform: scale(0.98);
      }

      .item-visual {
        flex-shrink: 0;
        width: 4.8rem;
        height: 4.8rem;
        border-radius: 0.85rem;
        overflow: hidden;
        background: var(--app-surface-container, var(--app-surface-muted));
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .item-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .item-info {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 0.12rem;
      }

      .item-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .item-row--top {
        margin-top: 0.05rem;
      }

      .top-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .item-name {
        margin: 0.1rem 0 0;
        font-size: 1.04rem;
        line-height: 1.1;
        font-weight: 700;
        color: var(--app-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @media (max-width: 520px) {
        .item-name {
          font-size: 1rem;
        }
      }

      .expiry-date {
        margin: 0;
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--app-text-muted) 80%, #4b515f);
        white-space: nowrap;
        padding: 0.1rem 0.35rem;
        border-radius: 999px;
      }

      .expiry-date.is-expired {
        color: #b3281d;
        background: #f9d7d2;
        font-weight: 700;
      }

      .expiry-date.is-expiring {
        color: #713717;
        background: #f6dcc9;
        font-weight: 700;
      }

      .quantity-line {
        margin: 0.1rem 0 0;
        font-size: 0.88rem;
        font-weight: 500;
        color: #24342f;
      }

      .category {
        margin: 0;
        font-size: 0.82rem;
        color: #006c49;
        text-transform: uppercase;
        letter-spacing: 0.01em;
        font-weight: 700;
      }

      .item-row--bottom {
        justify-content: flex-start;
        margin-top: 0.4rem;
      }

      .stock-pill {
        display: inline-flex;
        align-items: center;
        height: 1.65rem;
        padding: 0 0.68rem;
        border-radius: 0.7rem;
        background: #d5e0f4;
        color: #11233b;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .stock--in-stock {
        color: #005a3b;
      }

      .stock--low-stock {
        color: #915415;
      }

      .stock--out-of-stock, .stock--expired {
        color: #9f2222;
      }

      .delete-button {
        width: 1.8rem;
        height: 1.8rem;
        border: 1px solid color-mix(in srgb, var(--ion-color-danger) 24%, #ffffff);
        border-radius: 999px;
        background: color-mix(in srgb, var(--ion-color-danger) 9%, #ffffff);
        color: var(--ion-color-danger);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .delete-button ion-icon {
        font-size: 1rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryItemCardComponent {
  private readonly settingsService = inject(SettingsService);
  readonly item = input.required<PantryItem>();
  readonly delete = output<string>();
  readonly addToShopping = output<PantryItem>();
  protected readonly trashIcon = trashOutline;
  protected readonly categoryLabels = CATEGORY_LABELS;

  protected onDelete(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.delete.emit(this.item().id);
  }

  protected stockLabel(): string {
    switch (getPantryStockStatus(this.item(), this.settingsService.settings().defaultLowStockThreshold)) {
      case 'out-of-stock':
        return 'Out of stock';
      case 'low-stock':
        return 'Low stock';
      default:
        return 'In stock';
    }
  }

  protected stockTone(): 'danger' | 'warning' | 'success' {
    switch (getPantryStockStatus(this.item(), this.settingsService.settings().defaultLowStockThreshold)) {
      case 'out-of-stock':
        return 'danger';
      case 'low-stock':
        return 'warning';
      default:
        return 'success';
    }
  }

  protected expiryTone(): 'danger' | 'warning' | 'muted' {
    const expiryDate = this.item().expiryDate;
    if (!expiryDate) {
      return 'muted';
    }

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffInDays = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);

    if (diffInDays < 0) {
      return 'danger';
    }

    if (diffInDays <= 3) {
      return 'warning';
    }

    return 'muted';
  }
}
