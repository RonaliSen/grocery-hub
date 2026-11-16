import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonToggle } from '@ionic/angular/standalone';
import {
  addOutline,
  arrowBackOutline,
  calendarOutline,
  createOutline,
  qrCodeOutline,
  removeOutline,
  trashOutline,
} from 'ionicons/icons';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

import { CATEGORY_FILTER_OPTIONS, CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { toDateInputValue } from '../../../core/utils/date.utils';
import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryCategory, QuantityUnit } from '../models/pantry-item.model';
import { PantryImagePipe } from '../pipes/pantry-image.pipe';
import { CATEGORY_EMOJI, categoryTileColor } from '../utils/pantry-category-style.util';
import { getPantryStockStatus, PantryStockStatus } from '../utils/pantry-stock-status.util';
import { PantryDuplicateItemNameError, PantryStateService } from '../services/pantry-state.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';

@Component({
  selector: 'app-pantry-form-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [
    ExpiryStatusPipe,
    FallbackImageDirective,
    IonContent,
    IonIcon,
    IonToggle,
    PantryImagePipe,
    QuantityLabelPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <ion-content [fullscreen]="true" class="pantry-form-content">
      <div class="pantry-form-shell">
        <header class="pantry-form-header">
          <button type="button" class="header-btn" (click)="goBack()" aria-label="Go back">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>

          <div class="header-text">
            <h1 class="header-title">{{ itemId() ? 'Edit item' : 'Add item' }}</h1>
            <p class="header-subtitle">
              {{ itemId() ? 'Update what is on your shelf' : 'Create a pantry item' }}
            </p>
          </div>

          <button type="button" class="header-btn" aria-label="Scan item">
            <ion-icon aria-hidden="true" [icon]="scanIcon" />
          </button>
        </header>

        <main class="pantry-form-body">
          @if (missingItem()) {
            <section class="missing-card">
              <span class="missing-emoji" aria-hidden="true">🫙</span>
              <p class="missing-eyebrow">Missing item</p>
              <h2>Item not found</h2>
              <p>This pantry item no longer exists, so there is nothing to edit.</p>
              <p class="missing-supporting">
                Return to the pantry list to choose another item or create a new pantry entry.
              </p>
              <a class="ink-button" [routerLink]="['/tabs/pantry']">Back to pantry</a>
            </section>
          } @else {
            @let name = form.controls.name.value.trim();
            @let category = form.controls.category.value;
            @let stock = previewStockStatus();

            <form [formGroup]="form" class="pantry-form" (ngSubmit)="save()">
              <!-- Live preview: how the item will look in the pantry -->
              <section class="preview-card" aria-label="Item preview">
                <div class="preview-dots" aria-hidden="true"></div>
                <div class="preview-visual" [style.--tile]="tileColor(category)">
                  @if (name) {
                    <img
                      [src]="{ name: name, category: category || null, imageUrl: existingItem()?.imageUrl ?? null } | pantryImage"
                      [appFallbackImage]="{ name: name, category: category || null } | pantryImage: 'fallback'"
                      [alt]="name"
                    />
                  } @else {
                    <span aria-hidden="true">{{ category ? categoryEmoji[category] : '🧺' }}</span>
                  }
                </div>

                <div class="preview-info">
                  <p class="preview-eyebrow">{{ category ? categoryLabels[category] : 'Preview' }}</p>
                  <p class="preview-name">{{ name || 'New item' }}</p>
                  <p class="preview-qty">
                    {{ form.controls.quantity.value | quantityLabel: form.controls.unit.value }}
                  </p>
                  <div class="preview-chips">
                    <span class="chip chip--stock" [class]="'chip chip--stock is-' + stock">
                      {{ stockLabels[stock] }}
                    </span>
                    <span class="chip">
                      {{ form.controls.expiryDate.value | expiryStatus }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- 1. Basics -->
              <section class="form-card">
                <header class="card-head">
                  <span class="card-icon" aria-hidden="true">✏️</span>
                  <div>
                    <h2>The basics</h2>
                    <p>What is it and where does it belong?</p>
                  </div>
                </header>

                <div class="field">
                  <label class="field-label" for="pantry-item-name">Item name</label>
                  <div class="input-wrap">
                    <input
                      id="pantry-item-name"
                      formControlName="name"
                      class="text-input"
                      placeholder="e.g. Organic Avocados"
                      type="text"
                      autocomplete="off"
                    />
                    <ion-icon aria-hidden="true" [icon]="editIcon" />
                  </div>
                  @if (showError('name')) {
                    <p class="field-error">{{ errorMessage('name') }}</p>
                  }
                </div>

                <fieldset class="field">
                  <legend class="field-label">Category</legend>
                  <div class="category-grid" role="radiogroup" aria-label="Category">
                    @for (option of availableCategories(); track option) {
                      <label
                        class="category-chip"
                        [class.is-selected]="category === option"
                        [style.--tile]="tileColor(option)"
                      >
                        <input
                          type="radio"
                          class="visually-hidden"
                          formControlName="category"
                          [value]="option"
                        />
                        <span class="category-chip__emoji" aria-hidden="true">{{ categoryEmoji[option] }}</span>
                        {{ categoryLabels[option] }}
                      </label>
                    }
                  </div>
                  @if (showError('category')) {
                    <p class="field-error">Pick a category for this item.</p>
                  }
                </fieldset>
              </section>

              <!-- 2. Stock -->
              <section class="form-card">
                <header class="card-head">
                  <span class="card-icon" aria-hidden="true">📦</span>
                  <div>
                    <h2>Stock &amp; freshness</h2>
                    <p>How much you have and when it expires.</p>
                  </div>
                </header>

                <div class="field">
                  <span class="field-label" id="pantry-qty-label">Quantity</span>
                  <div class="stepper" role="group" aria-labelledby="pantry-qty-label">
                    <button type="button" (click)="decrementQuantity()" aria-label="Decrease quantity">
                      <ion-icon aria-hidden="true" [icon]="minusIcon" />
                    </button>
                    <p class="stepper__value" aria-live="polite">
                      {{ form.controls.quantity.value }}
                      <span>{{ form.controls.unit.value }}</span>
                    </p>
                    <button type="button" (click)="incrementQuantity()" aria-label="Increase quantity">
                      <ion-icon aria-hidden="true" [icon]="plusIcon" />
                    </button>
                  </div>
                </div>

                <div class="field-row">
                  <div class="field">
                    <label class="field-label" for="pantry-expiry">Expiry date</label>
                    <div class="input-wrap">
                      <input id="pantry-expiry" formControlName="expiryDate" class="text-input" type="date" />
                      <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                    </div>
                  </div>

                  <div class="field">
                    <label class="field-label" for="pantry-min">Low-stock alert at</label>
                    <div class="input-wrap">
                      <input
                        id="pantry-min"
                        formControlName="minQuantity"
                        class="text-input"
                        placeholder="1"
                        type="number"
                        inputmode="decimal"
                      />
                      <span class="input-suffix">{{ form.controls.unit.value }}</span>
                    </div>
                    @if (showError('minQuantity')) {
                      <p class="field-error">{{ errorMessage('minQuantity') }}</p>
                    }
                  </div>
                </div>
              </section>

              <!-- 3. Shopping -->
              <section class="form-card">
                <header class="card-head">
                  <span class="card-icon" aria-hidden="true">🛍️</span>
                  <div>
                    <h2>Where to buy</h2>
                    <p>Choose the shopping tabs this item appears in.</p>
                  </div>
                </header>

                <div class="toggle-list">
                  <div class="toggle-row">
                    <span class="toggle-emoji" aria-hidden="true">🥨</span>
                    <span class="toggle-text">
                      <span class="toggle-label">German Store</span>
                      <span class="toggle-description">Show this item under the German Store shopping tab</span>
                    </span>
                    <ion-toggle formControlName="germanStore" aria-label="German Store"></ion-toggle>
                  </div>

                  <div class="toggle-row">
                    <span class="toggle-emoji" aria-hidden="true">🍛</span>
                    <span class="toggle-text">
                      <span class="toggle-label">Indian Store</span>
                      <span class="toggle-description">Show this item under the Indian Store shopping tab</span>
                    </span>
                    <ion-toggle formControlName="indianStore" aria-label="Indian Store"></ion-toggle>
                  </div>

                  <div class="toggle-row">
                    <span class="toggle-emoji" aria-hidden="true">🔁</span>
                    <span class="toggle-text">
                      <span class="toggle-label">Auto-add to shopping list</span>
                      <span class="toggle-description">When stock falls below threshold</span>
                    </span>
                    <ion-toggle
                      formControlName="autoAddToShoppingList"
                      aria-label="Auto-add to shopping list"
                    ></ion-toggle>
                  </div>
                </div>
              </section>

              <!-- 4. Notes -->
              <section class="form-card">
                <header class="card-head">
                  <span class="card-icon" aria-hidden="true">📝</span>
                  <div>
                    <h2>Notes</h2>
                    <p>Brands, sizes or anything worth remembering.</p>
                  </div>
                </header>

                <div class="field">
                  <label class="visually-hidden" for="pantry-notes">Notes</label>
                  <textarea
                    id="pantry-notes"
                    formControlName="notes"
                    class="text-input text-input--area"
                    placeholder="Add specific brands or preferences..."
                    rows="4"
                  ></textarea>
                  <p class="field-hint" [class.is-over]="form.controls.notes.value.length > 200">
                    {{ form.controls.notes.value.length }}/200
                  </p>
                  @if (showError('notes')) {
                    <p class="field-error">{{ errorMessage('notes') }}</p>
                  }
                </div>
              </section>

              @if (itemId()) {
                <button type="button" (click)="delete()" class="delete-button">
                  <ion-icon aria-hidden="true" [icon]="deleteIcon" />
                  Delete Item
                </button>
              }

              <footer class="action-bar">
                <button type="button" class="action-bar__cancel" (click)="goBack()">Cancel</button>
                <button
                  type="submit"
                  class="action-bar__save"
                  [disabled]="form.invalid || isSaving()"
                >
                  {{ isSaving() ? 'Saving...' : itemId() ? 'Save changes' : 'Add to pantry' }}
                </button>
              </footer>
            </form>
          }
        </main>
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* Add/Edit item — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss), shared with Home and Pantry. */
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--h-canvas);
      }

      .pantry-form-content::part(background) {
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

      ion-icon {
        flex-shrink: 0;
      }

      .pantry-form-shell {
        width: min(100%, 40rem);
        margin: 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* ---------------- Header ---------------- */

      .pantry-form-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        align-items: center;
        gap: 12px;
        padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
      }

      .header-btn {
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

      .header-btn:active {
        transform: scale(0.93);
      }

      .header-text {
        text-align: center;
      }

      .header-title {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .header-subtitle {
        margin: 2px 0 0;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      /* ---------------- Body ---------------- */

      .pantry-form-body {
        flex: 1;
        padding: 4px var(--h-gutter) 0;
      }

      .pantry-form {
        display: grid;
        gap: 16px;
      }

      /* Live preview (ink hero) */
      .preview-card {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        grid-template-columns: 104px minmax(0, 1fr);
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: 28px;
        color: #ffffff;
        background:
          radial-gradient(70% 90% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
          var(--h-hero-bg);
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 24px 40px -24px rgba(22, 20, 29, 0.6);
      }

      .preview-dots {
        position: absolute;
        z-index: -1;
        inset: 0 0 auto auto;
        width: 50%;
        height: 80%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
      }

      .preview-visual {
        width: 104px;
        height: 104px;
        border-radius: 24px;
        overflow: hidden;
        display: grid;
        place-items: center;
        background: var(--tile);
        font-size: 3rem;
        transform: rotate(-4deg);
        box-shadow: 0 12px 24px -12px rgba(0, 0, 0, 0.6);
      }

      .preview-visual img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        color: transparent;
      }

      .preview-info {
        min-width: 0;
        display: grid;
        justify-items: start;
        gap: 2px;
      }

      .preview-eyebrow {
        margin: 0 0 4px;
        padding: 3px 9px;
        border-radius: 8px;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .preview-name {
        max-width: 100%;
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .preview-qty {
        margin: 0;
        font-family: var(--h-display);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--h-sun);
      }

      .preview-chips {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .chip--stock::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dot, #4cc38a);
      }

      .chip--stock.is-low-stock { --dot: #ffb224; }
      .chip--stock.is-out-of-stock { --dot: #ff6369; }

      /* Section cards */
      .form-card {
        display: grid;
        gap: 18px;
        padding: 18px;
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .card-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .card-icon {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-tile-3);
        font-size: 1.25rem;
        transform: rotate(-6deg);
      }

      .card-head h2 {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .card-head p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: var(--h-muted);
      }

      /* Fields */
      .field {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        gap: 8px;
      }

      .field-label {
        padding: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .field-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-wrap > ion-icon,
      .input-suffix {
        position: absolute;
        right: 14px;
        color: var(--h-muted);
        font-size: 18px;
        pointer-events: none;
      }

      .input-suffix {
        font-size: 0.78rem;
        font-weight: 700;
      }

      .text-input {
        width: 100%;
        min-width: 0;
        min-height: 52px;
        padding: 0 44px 0 16px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.95rem;
        font-weight: 600;
      }

      /* Keep the native date picker working, but show our icon in its place. */
      .text-input[type='date'] {
        padding-right: 40px;
        font-size: 0.88rem;
      }

      .text-input::-webkit-calendar-picker-indicator {
        position: absolute;
        right: 0;
        width: 44px;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      .text-input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      .text-input--area {
        min-height: 112px;
        padding: 14px 16px;
        resize: vertical;
      }

      /* Beat the global input:not(…):focus rule (specificity 0,5,1). */
      :host .field .text-input:focus {
        outline: none;
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .field-hint {
        margin: -2px 4px 0 0;
        justify-self: end;
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      .field-hint.is-over,
      .field-error {
        color: var(--h-danger);
      }

      .field-error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
      }

      /* Category chips (radio group) */
      .category-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      legend.field-label {
        margin-bottom: 8px;
      }

      .category-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 0 12px 0 4px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
      }

      .category-chip__emoji {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--tile);
        font-size: 0.9rem;
      }

      .category-chip.is-selected {
        background: var(--h-btn-bg);
        border-color: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .category-chip:has(input:focus-visible) {
        outline: 3px solid var(--h-accent-glow);
        outline-offset: 2px;
      }

      .category-chip:active {
        transform: scale(0.96);
      }

      /* Quantity stepper */
      .stepper {
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr) 52px;
        align-items: center;
        gap: 8px;
        padding: 6px;
        border-radius: 22px;
        background: var(--h-canvas);
        border: 1px solid var(--h-line);
      }

      .stepper button {
        height: 52px;
        border: none;
        border-radius: 17px;
        display: grid;
        place-items: center;
        font-size: 22px;
        background: var(--h-surface);
        color: var(--h-ink);
        box-shadow: var(--h-shadow);
        transition: transform 140ms ease;
      }

      .stepper button:last-child {
        background: var(--h-accent);
        color: #ffffff;
      }

      .stepper button:active {
        transform: scale(0.9);
      }

      .stepper__value {
        margin: 0;
        text-align: center;
        font-family: var(--h-display);
        font-size: 1.7rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .stepper__value span {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      /* Store toggles */
      .toggle-list {
        display: grid;
        gap: 8px;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px 10px 10px;
        border-radius: 20px;
        background: var(--h-canvas);
      }

      .toggle-emoji {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        font-size: 1.2rem;
      }

      .toggle-text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .toggle-label {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--h-ink);
      }

      .toggle-description {
        font-size: 0.76rem;
        line-height: 1.35;
        color: var(--h-muted);
      }

      ion-toggle {
        --track-background: color-mix(in srgb, var(--h-muted) 35%, transparent);
        --track-background-checked: var(--h-accent);
        --handle-background: #ffffff;
        --handle-background-checked: #ffffff;
      }

      /* Delete (edit mode) */
      .delete-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 52px;
        border: 1.5px dashed color-mix(in srgb, var(--h-danger) 45%, transparent);
        border-radius: 999px;
        background: var(--h-danger-surface);
        color: var(--h-danger);
        font-size: 0.92rem;
        font-weight: 800;
      }

      /* Sticky action bar */
      .action-bar {
        position: sticky;
        bottom: 0;
        z-index: 10;
        margin: 0 calc(var(--h-gutter) * -1);
        padding: 12px var(--h-gutter) calc(12px + env(safe-area-inset-bottom, 0px));
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
        gap: 10px;
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
        border-top: 1px solid var(--h-line);
      }

      .action-bar button {
        min-height: 54px;
        border-radius: 999px;
        font-size: 0.95rem;
        font-weight: 800;
        transition: transform 140ms ease, opacity 160ms ease;
      }

      .action-bar button:active:not(:disabled) {
        transform: scale(0.97);
      }

      .action-bar__cancel {
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .action-bar__save {
        border: none;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 12px 24px -12px var(--h-accent-glow);
      }

      .action-bar__save:disabled {
        opacity: 0.45;
        box-shadow: none;
      }

      /* Missing item */
      .missing-card {
        display: grid;
        justify-items: center;
        gap: 8px;
        margin-top: 12px;
        padding: 32px 20px;
        border-radius: 28px;
        background: var(--h-surface);
        border: 2px dashed var(--h-line);
        text-align: center;
      }

      .missing-emoji {
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

      .missing-card .missing-eyebrow {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--h-accent);
      }

      .missing-card h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--h-ink);
      }

      .missing-card p {
        margin: 0;
        color: var(--h-ink-soft);
        font-size: 0.9rem;
      }

      .missing-card .missing-supporting {
        color: var(--h-muted);
        font-size: 0.82rem;
      }

      .ink-button {
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        min-height: 46px;
        padding: 0 20px;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.9rem;
        font-weight: 800;
      }

      @media (max-width: 359px) {
        .field-row {
          grid-template-columns: 1fr;
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
export class PantryFormPage {
  private static readonly POPULAR_CATEGORY_BY_NAME: ReadonlyArray<{
    readonly tokens: readonly string[];
    readonly category: PantryCategory;
  }> = [
    { tokens: ['milk'], category: 'dairy' },
    { tokens: ['yogurt', 'yoghurt'], category: 'dairy' },
    { tokens: ['bread'], category: 'bakery' },
    { tokens: ['onion', 'onions'], category: 'vegetables' },
    { tokens: ['tomato', 'tomatoes'], category: 'vegetables' },
    { tokens: ['potato', 'potatoes'], category: 'vegetables' },
  ];
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly pantryState = inject(PantryStateService);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly settingsService = inject(SettingsService);
  private readonly navigationHistory = inject(NavigationHistoryService);

  protected readonly backIcon = arrowBackOutline;
  protected readonly scanIcon = qrCodeOutline;
  protected readonly editIcon = createOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly plusIcon = addOutline;
  protected readonly minusIcon = removeOutline;
  protected readonly deleteIcon = trashOutline;
  protected readonly categories = CATEGORY_FILTER_OPTIONS.map((option) => option.value);
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categoryEmoji = CATEGORY_EMOJI;
  protected readonly stockLabels: Record<PantryStockStatus, string> = {
    'in-stock': 'In stock',
    'low-stock': 'Low stock',
    'out-of-stock': 'Out of stock',
  };
  protected readonly isSaving = signal(false);
  protected readonly submitted = signal(false);
  private readonly initializedFormKey = signal<string | undefined>(undefined);
  protected readonly itemId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('itemId'))),
    { initialValue: this.route.snapshot.paramMap.get('itemId') },
  );
  protected readonly createPrefill = toSignal(
    (this.route.queryParamMap ?? of(this.route.snapshot.queryParamMap)).pipe(
      map((params) => this.parseCreatePrefill(params)),
    ),
    { initialValue: this.parseCreatePrefill(this.route.snapshot.queryParamMap) },
  );
  private readonly requestedCategory = toSignal(
    (this.route.queryParamMap ?? of(this.route.snapshot.queryParamMap)).pipe(
      map((params) => {
        const category = params?.get('category') as PantryCategory | null;
        return category && this.categories.includes(category) ? category : null;
      }),
    ),
    {
      initialValue: (() => {
        const category = this.route.snapshot.queryParamMap?.get('category') as PantryCategory | null;
        return category && this.categories.includes(category) ? category : null;
      })(),
    },
  );
  protected readonly existingItem = computed(() => this.pantryState.getById(this.itemId()));
  protected readonly missingItem = computed(
    () => !!this.itemId() && this.pantryState.loaded() && !this.existingItem(),
  );
  protected readonly availableCategories = computed<readonly PantryCategory[]>(() => {
    return this.categories;
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    name: this.formBuilder.nonNullable.control('', {
      validators: [Validators.required, Validators.minLength(2), this.duplicateNameValidator()],
    }),
    category: this.formBuilder.nonNullable.control<PantryCategory | ''>('', [
      Validators.required,
    ]),
    unit: this.formBuilder.nonNullable.control<QuantityUnit>('count', [Validators.required]),
    quantity: this.formBuilder.nonNullable.control(1, [Validators.required, Validators.min(0)]),
    minQuantity: this.formBuilder.nonNullable.control(1, [Validators.required, Validators.min(0)]),
    autoAddToShoppingList: this.formBuilder.nonNullable.control(true),
    expiryDate: this.formBuilder.nonNullable.control(''),
    germanStore: this.formBuilder.nonNullable.control(false),
    indianStore: this.formBuilder.nonNullable.control(false),
    notes: this.formBuilder.nonNullable.control('', [Validators.maxLength(200)]),
  });

  constructor() {
    effect(() => {
      const initializedFormKey = this.initializedFormKey();
      const itemId = this.itemId();
      const existingItem = this.existingItem();
      const categoryOverride = this.requestedCategory();
      const prefill = this.createPrefill();

      if (itemId) {
        const editFormKey = `edit:${itemId}:${categoryOverride ?? ''}`;
        if (!existingItem || initializedFormKey === editFormKey) {
          return;
        }

        this.resetForm({
          name: existingItem.name,
          category:
            categoryOverride ??
            this.resolvePopularCategoryOverride(existingItem.name) ??
            existingItem.category,
          unit: existingItem.unit,
          quantity: existingItem.quantity,
          minQuantity: existingItem.minQuantity,
          autoAddToShoppingList: existingItem.autoAddToShoppingList,
          expiryDate: toDateInputValue(existingItem.expiryDate),
          germanStore: existingItem.germanStore ?? false,
          indianStore: existingItem.indianStore ?? false,
          notes: existingItem.notes ?? '',
        });
        this.initializedFormKey.set(editFormKey);
        return;
      }

      const createFormKey = `new:${prefill.name}|${prefill.quantity}|${prefill.category}|${
        prefill.germanStore
      }|${prefill.indianStore}`;
      if (initializedFormKey !== createFormKey) {
        const createFormValue = this.buildCreateFormValue();
        const mappedPrefillCategory = this.resolvePopularCategoryOverride(prefill?.name ?? '');

        this.resetForm({
          ...createFormValue,
          name: prefill?.name || createFormValue.name,
          category:
            prefill?.category && this.categories.includes(prefill.category)
              ? prefill.category
              : mappedPrefillCategory ?? createFormValue.category,
          quantity: prefill?.quantity ?? createFormValue.quantity,
          germanStore: prefill?.germanStore ?? createFormValue.germanStore,
          indianStore: prefill?.indianStore ?? createFormValue.indianStore,
        });
        this.initializedFormKey.set(createFormKey);
        return;
      }

      if (!this.form.pristine) {
        return;
      }

      const createFormValue = this.buildCreateFormValue();
      const mappedPrefillCategory = this.resolvePopularCategoryOverride(prefill?.name ?? '');
      const resolvedPrefillCategory =
        prefill?.category && this.categories.includes(prefill.category)
          ? prefill.category
          : (mappedPrefillCategory ?? createFormValue.category);
      this.form.patchValue(
        {
          category: resolvedPrefillCategory,
          minQuantity: createFormValue.minQuantity,
          autoAddToShoppingList: createFormValue.autoAddToShoppingList,
        },
        { emitEvent: false },
      );
    });

    effect(() => {
      this.itemId();
      this.pantryState.items();
      this.form.controls.name.updateValueAndValidity({ emitEvent: false });
    });

    this.form.controls.name.valueChanges.subscribe((name) => {
      const mappedCategory = this.resolvePopularCategoryOverride(name);
      if (!mappedCategory) {
        return;
      }

      if (this.form.controls.category.value !== mappedCategory) {
        this.form.controls.category.setValue(mappedCategory, { emitEvent: false });
      }
    });
  }

  /** Stock status for the live preview, using the same rule as the pantry cards. */
  protected previewStockStatus(): PantryStockStatus {
    const { quantity, minQuantity, unit, expiryDate } = this.form.getRawValue();
    return getPantryStockStatus(
      {
        quantity: Number(quantity) || 0,
        minQuantity: Number(minQuantity) || 0,
        unit,
        expiryDate: expiryDate || null,
      },
      this.settingsService.settings().defaultLowStockThreshold,
    );
  }

  protected tileColor(category: PantryCategory | ''): string {
    return categoryTileColor(category);
  }

  protected showError(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return !!control.errors && (control.touched || this.submitted());
  }

  protected errorMessage(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];

    if (control.errors?.['required']) {
      return 'This field is required.';
    }

    if (control.errors?.['minlength']) {
      return 'Use at least 2 characters.';
    }

    if (control.errors?.['min']) {
      return 'Use 0 or more.';
    }

    if (control.errors?.['maxlength']) {
      return 'Keep notes within 200 characters.';
    }

    if (control.errors?.['duplicate']) {
      return this.itemId() ? 'Item with this name already exists' : 'Item already exists';
    }

    return 'Check this field and try again.';
  }

  private duplicateNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const name = control.value;
      if (!name || name.length < 2) {
        return null;
      }

      const exists = this.pantryState.existsByName(name, this.itemId());
      return exists ? { duplicate: true } : null;
    };
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid || this.missingItem()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    try {
      const rawValue = this.form.getRawValue();
      const existingItem = this.existingItem();
      const mappedCategory = this.resolvePopularCategoryOverride(rawValue.name);
      if (!rawValue.category) {
        throw new Error('Category is required.');
      }

      const resolvedCategory =
        rawValue.category === 'other' && mappedCategory ? mappedCategory : rawValue.category;

      if (this.itemId()) {
        await this.shoppingState.clearAutoAddDismissal(this.itemId() as string);
      }

      await this.pantryState.save(
        {
          name: rawValue.name.trim(),
          category: resolvedCategory,
          unit: rawValue.unit,
          quantity: Number(rawValue.quantity),
          minQuantity: Number(rawValue.minQuantity),
          avgDailyUsage: existingItem?.avgDailyUsage ?? null,
          autoAddToShoppingList: rawValue.autoAddToShoppingList,
          expiryDate: rawValue.expiryDate || null,
          germanStore: rawValue.germanStore,
          indianStore: rawValue.indianStore,
          notes: rawValue.notes.trim() || null,
        },
        this.itemId(),
      );

      this.resetForm(this.buildCreateFormValue());
      await this.navigationHistory.back('/tabs/pantry');
    } catch (error) {
      if (error instanceof PantryDuplicateItemNameError) {
        this.form.controls.name.setErrors({
          ...(this.form.controls.name.errors ?? {}),
          duplicate: true,
        });
        this.form.controls.name.markAsTouched();
        return;
      }

      throw error;
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async delete(): Promise<void> {
    const id = this.itemId();
    if (!id) return;

    if (confirm('Are you sure you want to delete this item?')) {
      await this.pantryState.remove(id);
      await this.navigationHistory.back('/tabs/pantry');
    }
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/pantry');
  }

  protected incrementQuantity(): void {
    const value = Number(this.form.controls.quantity.value) || 0;
    this.form.controls.quantity.setValue(value + 1);
  }

  protected decrementQuantity(): void {
    const value = Number(this.form.controls.quantity.value) || 0;
    this.form.controls.quantity.setValue(Math.max(0, value - 1));
  }

  private buildCreateFormValue(): {
    name: string;
    category: PantryCategory | '';
    unit: QuantityUnit;
    quantity: number;
    minQuantity: number;
    autoAddToShoppingList: boolean;
    expiryDate: string;
    germanStore: boolean;
    indianStore: boolean;
    notes: string;
  } {
    return {
      name: '',
      category: '',
      unit: 'count' as QuantityUnit,
      quantity: 1,
      minQuantity: this.settingsService.settings().defaultLowStockThreshold,
      autoAddToShoppingList: this.settingsService.settings().defaultAutoAddToShoppingList,
      expiryDate: '',
      germanStore: false,
      indianStore: false,
      notes: '',
    };
  }

  private resetForm(formValue: ReturnType<PantryFormPage['buildCreateFormValue']>): void {
    const mappedCategory = this.resolvePopularCategoryOverride(formValue.name);
    this.form.reset(
      {
        ...formValue,
        category: (mappedCategory ?? formValue.category) as PantryCategory | '',
      },
      { emitEvent: false },
    );
    this.submitted.set(false);
  }

  private parseCreatePrefill(params?: ParamMap | null): {
    name: string;
    quantity: number;
    category: PantryCategory | '';
    germanStore: boolean;
    indianStore: boolean;
  } {
    if (!params) {
      return {
        name: '',
        quantity: 1,
        category: '',
        germanStore: false,
        indianStore: false,
      };
    }

    const quantityParam = Number(params.get('quantity'));
    const quantity = Number.isFinite(quantityParam) && quantityParam > 0 ? quantityParam : 1;

    return {
      name: (params.get('name') ?? '').trim(),
      quantity,
      category: (params.get('category') as PantryCategory | null) ?? '',
      germanStore: params.get('germanStore') === 'true',
      indianStore: params.get('indianStore') === 'true',
    };
  }

  private resolvePopularCategoryOverride(name: string): PantryCategory | null {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      return null;
    }

    const mapping = PantryFormPage.POPULAR_CATEGORY_BY_NAME.find(({ tokens }) =>
      tokens.some((token) => normalizedName.includes(token)),
    );
    return mapping?.category ?? null;
  }
}
