import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryImagePipe } from '../../pantry/pipes/pantry-image.pipe';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import { ShoppingListItem } from '../models/shopping-list-item.model';

@Component({
  selector: 'app-shopping-item-row',
  standalone: true,
  imports: [FallbackImageDirective, PantryImagePipe],
  template: `
    <article
      class="item-row"
      [class.completed]="item().completed"
      [style.--tile]="tileColor()"
    >
      <button
        type="button"
        class="completion-chip"
        (click)="toggle.emit(item().id)"
        [attr.aria-label]="item().completed ? 'Mark as not completed' : 'Mark as completed'"
        [attr.aria-pressed]="item().completed"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </button>

      <div class="item-visual">
        <img
          [src]="itemImageUrl()"
          [appFallbackImage]="{ name: item().name, category: category() } | pantryImage: 'fallback'"
          [alt]="item().name"
          class="item-image"
          loading="lazy"
        />
      </div>

      <div class="item-info">
        <p class="item-name">{{ item().name }}</p>
        <p class="item-meta">
          {{ quantityLabel() }}
          @if (sourceLabel(); as source) {
            <span class="source-chip" [class.is-expiry]="item().source === 'expiry'">{{ source }}</span>
          }
        </p>
      </div>

      <div class="quantity-stepper" role="group" aria-label="Quantity controls">
        <button type="button" class="stepper-btn" (click)="decrement.emit(item().id)" aria-label="Decrease quantity">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
        <span class="stepper-value">{{ item().quantity }}</span>
        <button type="button" class="stepper-btn stepper-btn--add" (click)="increment.emit(item().id)" aria-label="Increase quantity">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
        </button>
      </div>

      <button type="button" class="delete-button" (click)="remove.emit(item().id)" aria-label="Delete item">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /></svg>
      </button>
    </article>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the Cart page's .theme-citrus host. */
      :host {
        display: block;
      }

      /* Inline stroke icons (no icon-font or Ionic dependency). */
      .icon {
        width: 1em;
        height: 1em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .item-row {
        display: grid;
        grid-template-columns: 40px 64px minmax(0, 1fr) auto;
        grid-template-areas:
          'check visual info    delete'
          'check visual stepper stepper';
        align-items: center;
        column-gap: 12px;
        row-gap: 8px;
        padding: 10px 10px 10px 8px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        transition: opacity 200ms ease, background-color 200ms ease;
      }

      .completion-chip {
        grid-area: check;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 2px solid color-mix(in srgb, var(--h-muted) 55%, transparent);
        border-radius: 50%;
        background: transparent;
        color: transparent;
        display: grid;
        place-items: center;
        font-size: 20px;
        transition: background-color 180ms ease, border-color 180ms ease, transform 140ms ease;
      }

      .completion-chip:active {
        transform: scale(0.88);
      }

      .item-visual {
        grid-area: visual;
        width: 64px;
        height: 64px;
        border-radius: 18px;
        overflow: hidden;
        background: var(--tile);
      }

      .item-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        color: transparent;
        transition: filter 200ms ease;
      }

      .item-info {
        grid-area: info;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .item-name {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: var(--h-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-meta {
        margin: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .source-chip {
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--h-warn-surface);
        color: var(--h-warn);
        font-size: 0.66rem;
        font-weight: 800;
      }

      .source-chip.is-expiry {
        background: var(--h-danger-surface);
        color: var(--h-danger);
      }

      .quantity-stepper {
        grid-area: stepper;
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 999px;
        background: var(--h-btn-bg);
      }

      .stepper-btn {
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 18px;
        background: var(--h-remove-bg);
        color: var(--h-btn-fg);
        transition: transform 140ms ease;
      }

      .stepper-btn--add {
        background: var(--h-accent);
        color: #ffffff;
      }

      .stepper-btn:active {
        transform: scale(0.86);
      }

      .stepper-value {
        min-width: 30px;
        text-align: center;
        font-family: var(--h-display);
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--h-btn-fg);
      }

      .delete-button {
        grid-area: delete;
        align-self: start;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--h-danger-surface);
        color: var(--h-danger);
        display: grid;
        place-items: center;
        font-size: 18px;
      }

      /* Checked off: filled tick, muted card */
      .completed {
        background: color-mix(in srgb, var(--h-surface) 55%, transparent);
        box-shadow: none;
      }

      .completed .completion-chip {
        border-color: var(--h-accent);
        background: var(--h-accent);
        color: #ffffff;
      }

      .completed .item-name {
        color: var(--h-muted);
        text-decoration: line-through;
        text-decoration-thickness: 2px;
      }

      .completed .item-image {
        filter: grayscale(0.8);
        opacity: 0.7;
      }

      .completed .quantity-stepper {
        opacity: 0.45;
      }

      @media (min-width: 560px) {
        .item-row {
          grid-template-columns: 40px 64px minmax(0, 1fr) auto auto;
          grid-template-areas: 'check visual info stepper delete';
          padding: 10px 12px 10px 10px;
        }

        .delete-button {
          align-self: center;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingItemRowComponent {
  private readonly pantryState = inject(PantryStateService);
  private readonly fallbackImageByKeyword: ReadonlyArray<{ keywords: string[]; url: string }> = [
    {
      keywords: ['tomato', 'tamatar'],
      url: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=320&q=80',
    },
    {
      keywords: ['orange', 'citrus'],
      url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=320&q=80',
    },
    {
      keywords: ['banana'],
      url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=320&q=80',
    },
    {
      keywords: ['apple'],
      url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=320&q=80',
    },
    {
      keywords: ['milk', 'dairy', 'curd', 'yogurt', 'cheese'],
      url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=320&q=80',
    },
    {
      keywords: ['bread', 'bakery'],
      url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=320&q=80',
    },
  ];

  readonly item = input.required<ShoppingListItem>();
  readonly toggle = output<string>();
  readonly remove = output<string>();
  readonly increment = output<string>();
  readonly decrement = output<string>();

  /** Category of the linked pantry item, if any (drives tile colour and fallback art). */
  protected category(): PantryCategory | null {
    const linkedPantryItemId = this.item().linkedPantryItemId;
    return linkedPantryItemId ? (this.pantryState.getById(linkedPantryItemId)?.category ?? null) : null;
  }

  protected tileColor(): string {
    return categoryTileColor(this.category());
  }

  /** Why the item is on the list, for auto-added items. */
  protected sourceLabel(): string | null {
    switch (this.item().source) {
      case 'low-stock':
        return 'Running low';
      case 'expiry':
        return 'Expiring';
      default:
        return null;
    }
  }

  protected quantityLabel(): string {
    const item = this.item();
    if (item.unit && item.unit !== 'count') {
      return `${item.quantity} ${item.unit}`;
    }

    if (item.quantity === 1) {
      return '1 item';
    }

    return `${item.quantity} items`;
  }

  protected itemImageUrl(): string {
    const itemName = this.item().name.toLowerCase();
    const linkedPantryItemId = this.item().linkedPantryItemId;
    if (linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(linkedPantryItemId);
      if (pantryItem?.imageUrl) {
        return pantryItem.imageUrl;
      }
    }

    const keywordMatch = this.fallbackImageByKeyword.find((entry) =>
      entry.keywords.some((keyword) => itemName.includes(keyword)),
    );
    if (keywordMatch) {
      return keywordMatch.url;
    }

    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=320&q=80';
  }

}
