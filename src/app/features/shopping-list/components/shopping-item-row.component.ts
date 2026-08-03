import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';

@Component({
  selector: 'app-shopping-item-row',
  standalone: true,
  template: `
    <article class="item-row" [class.completed]="item().completed">
      <button
        type="button"
        class="completion-chip"
        (click)="toggle.emit(item().id)"
        [attr.aria-label]="item().completed ? 'Mark as not completed' : 'Mark as completed'"
      >
        <span class="material-symbols-outlined">{{ item().completed ? 'check_circle' : 'radio_button_unchecked' }}</span>
      </button>

      <div class="item-visual">
        <img [src]="itemImageUrl()" [alt]="item().name" class="item-image" loading="lazy" />
      </div>

      <div class="item-info">
        <p class="item-name">{{ item().name }}</p>
        <p class="item-meta">{{ quantityLabel() }}</p>
      </div>

      <div class="actions-column">
        <div class="quantity-stepper" aria-label="Quantity controls">
          <button type="button" class="stepper-btn" (click)="decrement.emit(item().id)" aria-label="Decrease quantity">
            <span class="material-symbols-outlined">remove</span>
          </button>
          <span class="stepper-value">{{ item().quantity }}</span>
          <button type="button" class="stepper-btn" (click)="increment.emit(item().id)" aria-label="Increase quantity">
            <span class="material-symbols-outlined">add</span>
          </button>
        </div>

        <button type="button" class="delete-button" (click)="remove.emit(item().id)" aria-label="Delete item">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </article>
  `,
  styles: [
    `
      .item-row {
        --cart-green: #10b981;
        --cart-green-deep: #006c49;
        --cart-border: #dde3e8;
        --cart-surface: #ffffff;
        --cart-text-main: #0c1b2d;
        --cart-text-muted: #3f4b43;

        display: grid;
        grid-template-columns: auto 84px minmax(0, 1fr) auto;
        gap: 0.75rem;
        align-items: center;
        padding: 1rem;
        border-radius: 1rem;
        background: var(--cart-surface);
        border: 1px solid var(--cart-border);
      }

      .item-row.completed {
        opacity: 0.82;

        .item-name {
          text-decoration: line-through;
        }
      }

      .completion-chip {
        border: none;
        background: transparent;
        color: #8da09a;
        padding: 0;
        width: 1.5rem;
        height: 1.5rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .completion-chip .material-symbols-outlined {
        font-size: 1.15rem;
      }

      .item-visual {
        width: 84px;
        height: 84px;
        border-radius: 0.75rem;
        overflow: hidden;
        background: #f3f6f9;
      }

      .item-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .item-info {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
      }

      .item-name {
        margin: 0;
        color: var(--cart-text-main);
        font-size: 1rem;
        line-height: 1.2;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-meta {
        margin: 0;
        color: var(--cart-text-muted);
        font-size: 0.82rem;
      }

      .actions-column {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }

      .quantity-stepper {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--cart-green);
        color: #063a2a;
        padding: 0.2rem;
        flex-shrink: 0;
      }

      .stepper-btn {
        border: none;
        background: transparent;
        width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #00422b;
      }

      .stepper-btn .material-symbols-outlined {
        font-size: 1.25rem;
      }

      .stepper-value {
        min-width: 1.4rem;
        text-align: center;
        color: #063a2a;
        font-weight: 700;
        font-size: 0.9rem;
      }

      .delete-button {
        flex-shrink: 0;
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

      .delete-button .material-symbols-outlined {
        font-size: 1rem;
      }

      @media (max-width: 420px) {
        .item-row {
          grid-template-columns: auto 66px minmax(0, 1fr) auto;
          gap: 0.5rem;
        }

        .item-visual {
          width: 66px;
          height: 66px;
        }

        .actions-column {
          gap: 0.4rem;
        }

        .quantity-stepper {
          padding: 0.12rem;
        }

        .stepper-btn {
          width: 1.75rem;
          height: 1.75rem;
        }

        .stepper-value {
          min-width: 1.2rem;
          font-size: 0.84rem;
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
