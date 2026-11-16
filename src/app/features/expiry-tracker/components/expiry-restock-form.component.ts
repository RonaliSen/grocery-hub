import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addOutline, removeOutline } from 'ionicons/icons';

import { formatQuantity } from '../../../core/utils/quantity.utils';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import {
  dateInDays,
  formatExpiryDate,
  isValidRestockDate,
  RESTOCK_DATE_PRESETS,
  suggestedRestockDate
} from '../utils/expiry-tracker.util';

export interface ExpiryRestockRequest {
  /** Amount added to the current quantity (always > 0). */
  readonly amount: number;
  /** New expiry date for the item (`YYYY-MM-DD`), or null for no date. */
  readonly expiryDate: string | null;
}

/**
 * Restock form shown in the Expiry Tracker's bottom sheet: how much is being
 * added and the new batch's expiry date. Purely presentational — the page
 * applies the change.
 */
@Component({
  selector: 'app-expiry-restock-form',
  standalone: true,
  imports: [IonIcon],
  template: `
    <form class="sheet" aria-labelledby="restock-title" novalidate (submit)="onSubmit($event)">
      <header class="sheet__header">
        <span class="sheet__emoji" aria-hidden="true">📦</span>
        <div class="sheet__title">
          <h2 id="restock-title">Restock {{ item().name }}</h2>
          <p>You have {{ formatAmount(item().quantity) }} right now.</p>
        </div>
      </header>

      <div class="sheet__card">
        <div class="field">
          <label class="field__label" for="restock-amount">How much are you adding?</label>
          <div class="stepper" [class.is-invalid]="!amountValid()">
            <button
              type="button"
              class="stepper__btn"
              aria-label="Decrease amount"
              [disabled]="amount() <= 1"
              (click)="stepAmount(-1)"
            >
              <ion-icon aria-hidden="true" [icon]="minusIcon" />
            </button>
            <input
              id="restock-amount"
              class="stepper__input"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              [value]="amountInput()"
              [attr.aria-invalid]="!amountValid()"
              [attr.aria-describedby]="amountValid() ? null : 'restock-amount-error'"
              (input)="amountInput.set($any($event.target).value)"
            />
            <span class="stepper__unit" aria-hidden="true">{{ item().unit }}</span>
            <button type="button" class="stepper__btn" aria-label="Increase amount" (click)="stepAmount(1)">
              <ion-icon aria-hidden="true" [icon]="plusIcon" />
            </button>
          </div>
          @if (!amountValid()) {
            <p class="field__error" id="restock-amount-error">Enter an amount above 0.</p>
          }
        </div>

        <fieldset class="field">
          <legend class="field__label">New expiry date</legend>
          <div class="date-chips">
            @for (preset of presets; track preset.days) {
              @let presetDate = presetValue(preset.days);
              <button
                type="button"
                class="date-chip"
                [class.is-active]="dateInput() === presetDate"
                [attr.aria-pressed]="dateInput() === presetDate"
                (click)="dateInput.set(presetDate)"
              >
                {{ preset.label }}
              </button>
            }
          </div>
          <input
            id="restock-date"
            class="date-input"
            type="date"
            aria-label="New expiry date"
            [min]="todayValue()"
            [value]="dateInput()"
            [attr.aria-invalid]="!dateValid()"
            [attr.aria-describedby]="dateValid() ? 'restock-date-hint' : 'restock-date-error'"
            (input)="dateInput.set($any($event.target).value)"
          />
          @if (!dateValid()) {
            <p class="field__error" id="restock-date-error">Pick today or a later date.</p>
          } @else {
            <p class="field__hint" id="restock-date-hint">{{ dateHint() }}</p>
          }
        </fieldset>
      </div>

      @if (canSave()) {
        <p class="sheet__summary" aria-live="polite">
          <span aria-hidden="true">✨</span>
          <span>
            After restock: <strong>{{ formatAmount(item().quantity + amount()) }}</strong>
            · {{ dateInput() ? 'expires ' + formatDate(dateInput()) : 'no expiry date' }}
          </span>
        </p>
      }

      <footer class="sheet__actions">
        <button type="button" class="ghost-btn" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="save-btn" [disabled]="!canSave()">
          {{ saving() ? 'Saving…' : 'Restock' }}
        </button>
      </footer>
    </form>
  `,
  styles: [
    `
      /* Rendered inside an ion-modal carrying .theme-citrus, so --h-* tokens apply. */
      :host {
        display: block;
      }

      .sheet {
        max-height: min(88vh, 720px);
        overflow-y: auto;
        display: grid;
        gap: 16px;
        padding: 24px var(--h-gutter, 16px) calc(env(safe-area-inset-bottom, 0px) + 20px);
        color: var(--h-ink);
      }

      .sheet__header {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .sheet__emoji {
        width: 52px;
        height: 52px;
        flex-shrink: 0;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: var(--h-sun);
        font-size: 1.5rem;
        transform: rotate(-6deg);
      }

      .sheet__title {
        min-width: 0;
      }

      .sheet__title h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.03em;
        color: var(--h-ink);
        overflow-wrap: anywhere;
      }

      .sheet__title p {
        margin: 3px 0 0;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .sheet__card {
        display: grid;
        gap: 18px;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .field {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        /* minmax(0, …): don't let inputs' intrinsic widths widen the column. */
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }

      .field__label {
        padding: 0;
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--h-ink-soft);
      }

      legend.field__label {
        margin-bottom: 8px;
      }

      .field__hint,
      .field__error {
        margin: 0;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .field__error {
        color: var(--h-danger);
      }

      /* Amount stepper */
      .stepper {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
      }

      .stepper:focus-within {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .stepper.is-invalid {
        border-color: var(--h-danger);
      }

      .stepper__btn {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        padding: 0;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 18px;
        transition: transform 140ms ease, opacity 140ms ease;
      }

      .stepper__btn:active:not(:disabled) {
        transform: scale(0.9);
      }

      .stepper__btn:disabled {
        opacity: 0.35;
      }

      .stepper__input {
        flex: 1;
        width: 0;
        min-width: 0;
        height: 42px;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--h-ink);
        font-family: var(--h-display);
        font-size: 1.25rem;
        font-weight: 800;
        text-align: right;
        -moz-appearance: textfield;
      }

      .stepper__input::-webkit-outer-spin-button,
      .stepper__input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .stepper__unit {
        flex: 1;
        width: 0;
        min-width: 0;
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      /* Quick date picks */
      .date-chips {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .date-chip {
        min-height: 40px;
        padding: 0 4px;
        border: 1px solid var(--h-line);
        border-radius: 14px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.76rem;
        font-weight: 800;
        white-space: nowrap;
        transition: background-color 160ms ease, color 160ms ease, transform 140ms ease;
      }

      .date-chip:active {
        transform: scale(0.95);
      }

      .date-chip.is-active {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .date-input {
        width: 100%;
        min-width: 0;
        min-height: 50px;
        padding: 0 14px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.92rem;
        font-weight: 600;
      }

      .date-input[aria-invalid='true'] {
        border-color: var(--h-danger);
      }

      /* Beat the global input:not(…):focus ring (specificity 0,5,1). */
      .sheet .stepper input.stepper__input:focus {
        outline: none;
        box-shadow: none;
      }

      .sheet .field input.date-input:focus {
        outline: none;
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .sheet__summary {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--h-tile-3);
        color: var(--h-ink);
        font-size: 0.84rem;
        font-weight: 700;
      }

      .sheet__actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
        gap: 10px;
      }

      .ghost-btn,
      .save-btn {
        min-height: 52px;
        border-radius: 999px;
        font-size: 0.95rem;
        font-weight: 800;
      }

      .ghost-btn {
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .save-btn {
        border: none;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 12px 24px -10px var(--h-accent-glow);
      }

      .save-btn:disabled {
        opacity: 0.5;
        box-shadow: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiryRestockFormComponent {
  readonly item = input.required<PantryItem>();
  readonly saving = input(false);

  readonly restock = output<ExpiryRestockRequest>();
  readonly cancelled = output<void>();

  protected readonly minusIcon = removeOutline;
  protected readonly plusIcon = addOutline;
  protected readonly presets = RESTOCK_DATE_PRESETS;

  /** Form values reset whenever a different item is being restocked. */
  protected readonly amountInput = linkedSignal({ source: this.item, computation: () => '1' });
  protected readonly dateInput = linkedSignal({
    source: this.item,
    computation: (item) => suggestedRestockDate(item)
  });

  protected readonly todayValue = computed(() => dateInDays(0));
  protected readonly amount = computed(() => Number(this.amountInput()));
  protected readonly amountValid = computed(() => {
    const amount = this.amount();
    return this.amountInput().trim() !== '' && Number.isFinite(amount) && amount > 0;
  });
  protected readonly dateValid = computed(() => isValidRestockDate(this.dateInput()));
  protected readonly dateHint = computed(() => {
    const previous = this.item().expiryDate;

    if (this.dateInput()) {
      if (!previous) return 'Adds an expiry date to this item.';
      return previous === this.dateInput()
        ? 'Keeps the current expiry date.'
        : `Replaces the current date (${formatExpiryDate(previous)}).`;
    }

    return previous && !suggestedRestockDate(this.item())
      ? `The old date (${formatExpiryDate(previous)}) has passed — pick the new batch's date, or leave empty if it doesn't expire.`
      : "Leave empty if it doesn't expire.";
  });
  protected readonly canSave = computed(() => this.amountValid() && this.dateValid() && !this.saving());

  protected presetValue(days: number): string {
    return dateInDays(days);
  }

  protected stepAmount(delta: number): void {
    const current = this.amountValid() ? this.amount() : 0;
    const next = Math.max(1, Math.round((current + delta) * 1000) / 1000);
    this.amountInput.set(String(next));
  }

  protected formatAmount(quantity: number): string {
    return formatQuantity(Math.round(quantity * 1000) / 1000, this.item().unit);
  }

  protected formatDate(dateOnly: string): string {
    return formatExpiryDate(dateOnly);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.canSave()) {
      return;
    }

    this.restock.emit({ amount: this.amount(), expiryDate: this.dateInput() || null });
  }
}
