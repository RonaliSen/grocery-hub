import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { RouterLink } from '@angular/router';

import { PantryItem } from '../../pantry/models/pantry-item.model';
import { getPantryLowStockThreshold } from '../../pantry/utils/pantry-stock-status.util';

@Component({
  selector: 'app-low-stock-list',
  standalone: true,
  imports: [QuantityLabelPipe, RouterLink],
  template: `
    <section class="low-stock-section" id="low-stock">
      <div class="section-header">
        <h2 class="section-title">Low Stock</h2>
        <span class="section-caption">Alert only</span>
      </div>

      <div class="low-stock-list">
        @for (item of items(); track item.id) {
          <div class="stock-item" [routerLink]="['/tabs/pantry', item.id, 'edit']">
            <div class="stock-item__content">
              <div class="stock-item__title-row">
                <span class="stock-item__status-dot" aria-hidden="true"></span>
                <h3 class="stock-item__name">{{ item.name }}</h3>
              </div>
              <p class="stock-item__meta">
                Current:
                <strong>{{ item.quantity | quantityLabel: item.unit }}</strong>
                <span class="stock-item__divider" aria-hidden="true">|</span>
                Threshold:
                <strong>{{ getThreshold(item) | quantityLabel: item.unit }}</strong>
              </p>
            </div>

            <div class="stock-actions" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="stock-btn"
                [disabled]="getAddedCount(item.id) === 0"
                [attr.aria-label]="'Reduce ' + item.name + ' count in shopping list'"
                (click)="handleRemoveClick($event, item)"
              >
                <span aria-hidden="true">-</span>
              </button>
              <span class="stock-count" aria-label="Added count">{{ getAddedCount(item.id) }}</span>
              <button
                type="button"
                class="stock-btn"
                [attr.aria-label]="'Add ' + item.name + ' to shopping list'"
                (click)="handleAddClick($event, item)"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .low-stock-section {
        margin: 0;
        display: grid;
        gap: var(--app-space-4);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--app-space-3);
      }

      .section-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--app-ink);
        margin: 0;
        letter-spacing: -0.01em;
      }

      .section-caption {
        font-size: 0.75rem;
        color: var(--app-text-muted);
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .low-stock-list {
        display: grid;
        gap: 10px;
      }

      .stock-item {
        background: var(--app-surface);
        padding: var(--app-space-3) var(--app-space-4);
        border-radius: var(--app-radius-sm);
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--app-space-3);
        border: 1px solid var(--app-surface-muted);
        transition:
          transform 0.2s ease,
          border-color 0.2s ease;

        &:active {
          transform: scale(0.98);
        }
        &:hover {
          border-color: color-mix(in srgb, var(--accent-orange) 40%, var(--app-border));
        }
      }

      .stock-item__content {
        min-width: 0;
        display: grid;
        gap: var(--app-space-2);
      }

      .stock-item__title-row {
        display: flex;
        align-items: center;
        gap: var(--app-space-2);
      }

      .stock-item__status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--accent-orange);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-orange) 18%, transparent);
        flex-shrink: 0;
      }

      .stock-item__name {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--app-ink);
        margin: 0;
        line-height: 1.4;
        word-break: break-word;
      }

      .stock-item__meta {
        font-size: 0.75rem;
        color: var(--app-text-muted);
        font-weight: 600;
        margin: 0;
        line-height: 1.4;
      }

      .stock-item__meta strong {
        color: var(--app-ink);
        font-weight: 700;
      }

      .stock-item__divider {
        margin: 0 var(--app-space-2);
        color: var(--app-border-strong);
      }

      .stock-btn {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid var(--app-surface-muted);
        color: var(--app-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        transition:
          background-color 0.2s,
          border-color 0.2s;
        flex-shrink: 0;

        &:hover {
          border-color: color-mix(in srgb, var(--app-primary) 50%, var(--app-border));
          background: color-mix(in srgb, var(--app-primary) 8%, transparent);
        }

        &:active {
          background: color-mix(in srgb, var(--app-primary) 14%, transparent);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .stock-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .stock-count {
        min-width: 18px;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--app-ink);
      }

      @media (max-width: 479px) {
        .stock-item {
          padding: var(--app-space-3);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LowStockListComponent {
  readonly items = input.required<readonly PantryItem[]>();
  readonly addedCountByPantryItemId = input.required<Readonly<Record<string, number>>>();
  readonly addToShopping = output<PantryItem>();
  readonly removeFromShopping = output<PantryItem>();

  protected getThreshold(item: PantryItem): number {
    return getPantryLowStockThreshold(item);
  }

  protected handleAddClick(event: Event, item: PantryItem): void {
    event.stopPropagation();
    this.addToShopping.emit(item);
  }

  protected handleRemoveClick(event: Event, item: PantryItem): void {
    event.stopPropagation();
    this.removeFromShopping.emit(item);
  }

  protected getAddedCount(itemId: string): number {
    return this.addedCountByPantryItemId()[itemId] ?? 0;
  }
}
