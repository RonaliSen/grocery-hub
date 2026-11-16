import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addOutline, removeOutline, trashOutline } from 'ionicons/icons';

import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { formatQuantity } from '../../../core/utils/quantity.utils';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryItem } from '../models/pantry-item.model';
import { PantryImagePipe } from '../pipes/pantry-image.pipe';
import { categoryTileColor } from '../utils/pantry-category-style.util';
import { getPantryStockStatus } from '../utils/pantry-stock-status.util';

@Component({
  selector: 'app-pantry-item-card',
  standalone: true,
  imports: [ExpiryStatusPipe, FallbackImageDirective, IonIcon, PantryImagePipe, QuantityLabelPipe, RouterLink],
  template: `
    <div
      class="item-card"
      [class.is-out]="stockTone() === 'danger'"
      [style.--tile]="tileColor()"
      [routerLink]="['/tabs/pantry', item().id, 'edit']"
    >
      <div class="item-visual">
        <img
          [src]="item() | pantryImage"
          [appFallbackImage]="item() | pantryImage: 'fallback'"
          [alt]="item().name"
          class="item-image"
          loading="lazy"
        />
        <span class="category">{{ categoryLabels[item().category] }}</span>
        <button
          type="button"
          class="delete-button"
          aria-label="Delete pantry item"
          (click)="onDelete($event)"
        >
          <ion-icon aria-hidden="true" [icon]="trashIcon" />
        </button>
      </div>

      <div class="item-info">
        <h3 class="item-name">{{ item().name }}</h3>
        <p class="quantity-line" aria-live="polite">{{ item().quantity | quantityLabel: item().unit }}</p>

        <div class="chips">
          <span class="stock-pill" [class]="'stock-pill stock--' + stockTone()">
            {{ stockLabel() }}
          </span>
          <p
            class="expiry-date"
            [class.is-expired]="expiryTone() === 'danger'"
            [class.is-expiring]="expiryTone() === 'warning'"
          >
            {{ item().expiryDate ? (item().expiryDate | expiryStatus) : 'No expiry date' }}
          </p>
        </div>

        <!-- Clicks here must never reach the card's edit link (incl. taps on a disabled button). -->
        <div class="item-actions" (click)="stopCardNavigation($event)">
          <button
            type="button"
            class="action-button action-button--use"
            data-testid="pantry-item-use"
            [disabled]="item().quantity <= 0"
            [attr.aria-label]="'Use ' + stepLabel() + ' of ' + item().name"
            (click)="use.emit(item())"
          >
            <ion-icon aria-hidden="true" [icon]="useIcon" />
            Use
          </button>
          <button
            type="button"
            class="action-button action-button--restock"
            data-testid="pantry-item-restock"
            [attr.aria-label]="'Restock ' + stepLabel() + ' of ' + item().name"
            (click)="restock.emit(item())"
          >
            <ion-icon aria-hidden="true" [icon]="restockIcon" />
            Restock
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the Pantry page's .theme-citrus host. */
      :host {
        display: block;
      }

      .item-card {
        display: flex;
        flex-direction: column;
        padding: 8px;
        border-radius: 26px;
        background: var(--tile, var(--h-surface));
        cursor: pointer;
        transition: transform 180ms ease, box-shadow 180ms ease;
      }

      .item-card:active {
        transform: scale(0.98);
      }

      .item-visual {
        position: relative;
        aspect-ratio: 1 / 1;
        border-radius: 20px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.5);
      }

      .item-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        color: transparent;
        transition: transform 400ms ease, filter 200ms ease;
      }

      .is-out .item-image {
        filter: grayscale(0.85);
        opacity: 0.7;
      }

      .category {
        position: absolute;
        top: 12px;
        left: 8px;
        max-width: calc(100% - 58px);
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        color: #16141d;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .delete-button {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        color: var(--h-danger);
        display: grid;
        place-items: center;
        font-size: 17px;
        box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.3);
      }

      .item-info {
        display: grid;
        gap: 2px;
        padding: 12px 6px 6px;
        min-width: 0;
      }

      .item-name {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: var(--h-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .quantity-line {
        margin: 0;
        font-family: var(--h-display);
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .chips {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .stock-pill,
      .expiry-date {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .stock-pill {
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .stock-pill::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dot, var(--h-ok));
      }

      .stock--warning { --dot: var(--h-warn); }
      .stock--danger { --dot: var(--h-danger); }

      .expiry-date {
        color: var(--h-ink-soft);
        background: color-mix(in srgb, var(--h-surface) 55%, transparent);
      }

      .expiry-date.is-expiring {
        background: var(--h-warn-surface);
        color: var(--h-warn);
      }

      .expiry-date.is-expired {
        background: var(--h-danger-surface);
        color: var(--h-danger);
      }

      :host-context([data-theme='light']) .expiry-date.is-expiring,
      :host-context([data-theme='system']) .expiry-date.is-expiring {
        color: #9a5200;
      }

      /* Use / Restock */
      .item-actions {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        cursor: default;
      }

      .action-button {
        min-width: 0;
        min-height: 40px;
        padding: 0 8px;
        border: none;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 800;
        white-space: nowrap;
        transition: transform 160ms ease, opacity 160ms ease;
      }

      .action-button ion-icon {
        font-size: 15px;
      }

      .action-button--use {
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .action-button--restock {
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .action-button:active:not(:disabled) {
        transform: scale(0.94);
      }

      .action-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      /* Very narrow cards: drop the icons so both labels fit. */
      @media (max-width: 359px) {
        .action-button ion-icon {
          display: none;
        }
      }

      @media (hover: hover) {
        .item-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 30px -18px rgba(22, 20, 29, 0.45);
        }

        .item-card:hover .item-image {
          transform: scale(1.05);
        }
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
  /** Use one unit of the item. Disabled when nothing is left. */
  readonly use = output<PantryItem>();
  /** Restock one unit of the item. */
  readonly restock = output<PantryItem>();
  protected readonly trashIcon = trashOutline;
  protected readonly useIcon = removeOutline;
  protected readonly restockIcon = addOutline;
  protected readonly categoryLabels = CATEGORY_LABELS;

  protected tileColor(): string {
    return categoryTileColor(this.item().category);
  }

  /** Each Use / Restock tap changes the quantity by one unit, e.g. "1 kg". */
  protected stepLabel(): string {
    return formatQuantity(1, this.item().unit);
  }

  protected stopCardNavigation(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

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
