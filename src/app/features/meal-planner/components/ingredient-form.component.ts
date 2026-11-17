import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  output,
  viewChild
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { trashOutline } from 'ionicons/icons';

import { QUANTITY_UNITS, QuantityUnit } from '../../pantry/models/pantry-item.model';
import { INGREDIENT_NAME_MAX_LENGTH } from '../models/planned-meal.model';
import { IngredientDraft } from '../services/meal-plan-state.service';
import { normalizeIngredientName, parseIngredientAmount } from '../utils/meal-plan.util';

/**
 * Name, amount and unit for an ingredient — used both to add one and to edit
 * one. Purely presentational: it emits the entered ingredient and the page
 * saves it (and passes back `busy` / `error`).
 */
@Component({
  selector: 'app-ingredient-form',
  standalone: true,
  imports: [IonIcon],
  template: `
    <form
      class="ing-form"
      novalidate
      [attr.aria-label]="mode() === 'edit' ? 'Edit ' + initial()?.name : 'Add an ingredient'"
      (submit)="submit($event)"
      (keydown.escape)="cancel()"
    >
      <div class="field">
        <label class="field__label" [for]="idPrefix() + '-name'">Ingredient</label>
        <input
          #nameInput
          class="field__input"
          type="text"
          autocomplete="off"
          enterkeyhint="next"
          placeholder="e.g. Flour"
          [id]="idPrefix() + '-name'"
          [maxLength]="nameMaxLength"
          [value]="name()"
          [readOnly]="busy()"
          (input)="name.set($any($event.target).value)"
          (keydown.enter)="onNameEnter($event)"
        />
      </div>

      <div class="field">
        <label class="field__label" [for]="idPrefix() + '-amount'">Amount</label>
        <div class="amount" [class.is-invalid]="amountError()">
          <input
            #amountInput
            class="amount__input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="e.g. 500"
            [id]="idPrefix() + '-amount'"
            [value]="amountText()"
            [readOnly]="busy()"
            [attr.aria-invalid]="amountError() ? true : null"
            [attr.aria-describedby]="amountError() ? idPrefix() + '-amount-error' : null"
            (input)="amountText.set($any($event.target).value)"
          />
          <span class="amount__unit" aria-hidden="true">{{ unit() }}</span>
        </div>
        @if (amountError()) {
          <p class="form-error" [id]="idPrefix() + '-amount-error'">{{ amountError() }}</p>
        }
      </div>

      <fieldset class="field units" [disabled]="busy()">
        <legend class="field__label">Unit</legend>
        <div class="units__chips">
          @for (option of units; track option) {
            <label class="unit-chip" [class.is-selected]="unit() === option">
              <input
                class="unit-chip__input"
                type="radio"
                [name]="idPrefix() + '-unit'"
                [value]="option"
                [checked]="unit() === option"
                (change)="unit.set(option)"
              />
              <span class="unit-chip__label">{{ option }}</span>
            </label>
          }
        </div>
      </fieldset>

      @if (error()) {
        <p class="form-error" role="alert">{{ error() }}</p>
      }

      <div class="actions">
        @if (mode() === 'edit') {
          <button
            type="button"
            class="remove-btn"
            data-testid="remove-ingredient"
            [disabled]="busy()"
            [attr.aria-label]="'Remove ' + initial()?.name"
            (click)="remove.emit()"
          >
            <ion-icon aria-hidden="true" [icon]="removeIcon" />
            Remove
          </button>
        }
        <span class="actions__spacer"></span>
        <button type="button" class="ghost-btn" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button type="submit" class="save-btn" data-testid="save-ingredient" [disabled]="!canSave()">
          @if (busy()) {
            Saving…
          } @else {
            {{ mode() === 'edit' ? 'Save' : 'Add' }}
          }
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the page's .theme-citrus host. */
      :host {
        display: block;
      }

      .ing-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }

      .field {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        gap: 6px;
      }

      .field__label {
        padding: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      legend.field__label {
        margin-bottom: 6px;
      }

      .field__input,
      .amount {
        width: 100%;
        min-width: 0;
        min-height: 50px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink);
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }

      .field__input {
        padding: 0 16px;
        font-size: 1rem;
        font-weight: 700;
      }

      .field__input::placeholder,
      .amount__input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      /* Beat the global input:not(…):focus ring (specificity 0,5,1). */
      .ing-form .field input.field__input.field__input:focus {
        outline: none;
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      /* Amount with its unit shown inside the field, e.g. "250 g". */
      .amount {
        display: flex;
        align-items: center;
        padding-right: 16px;
      }

      .amount:focus-within {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .amount.is-invalid {
        border-color: var(--h-danger);
      }

      .amount.is-invalid:focus-within {
        box-shadow: 0 0 0 4px var(--h-danger-surface);
      }

      .ing-form .amount input.amount__input.amount__input {
        flex: 1;
        width: 0;
        min-width: 0;
        height: 48px;
        padding: 0 8px 0 16px;
        border: none;
        background: transparent;
        color: var(--h-ink);
        font-family: var(--h-display);
        font-size: 1.1rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        outline: none;
        box-shadow: none;
      }

      .amount__unit {
        font-size: 0.9rem;
        font-weight: 800;
        color: var(--h-ink-soft);
      }

      /* Unit chips (radio buttons). */
      .units__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .unit-chip {
        position: relative;
        cursor: pointer;
      }

      .unit-chip__input {
        position: absolute;
        z-index: 1; /* on top of its label face, so the real control gets the tap */
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      .unit-chip__label {
        min-width: 52px;
        min-height: 40px;
        padding: 0 14px;
        display: grid;
        place-items: center;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.85rem;
        font-weight: 800;
        transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 120ms ease;
      }

      .unit-chip.is-selected .unit-chip__label {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .unit-chip:active .unit-chip__label {
        transform: scale(0.95);
      }

      .unit-chip__input:focus-visible + .unit-chip__label {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      .units:disabled .unit-chip {
        cursor: default;
        opacity: 0.6;
      }

      .form-error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-danger);
      }

      /* Actions: Remove on the left (edit only), Cancel / Save on the right. */
      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      /* Narrow screens: Remove gets its own line, Cancel / Save share the next. */
      @media (max-width: 359px) {
        .actions__spacer {
          display: none;
        }

        .remove-btn {
          flex-basis: 100%;
          justify-content: center;
        }

        .ghost-btn,
        .save-btn {
          flex: 1;
        }
      }

      .actions__spacer {
        flex: 1;
      }

      .ghost-btn,
      .save-btn,
      .remove-btn {
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        font-size: 0.88rem;
        font-weight: 800;
        transition: transform 140ms ease, opacity 140ms ease, background-color 140ms ease;
      }

      .ghost-btn {
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .save-btn {
        min-width: 92px;
        border: none;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 10px 20px -10px var(--h-accent-glow);
      }

      .remove-btn {
        padding: 0 12px 0 8px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: transparent;
        color: var(--h-danger);
      }

      .remove-btn ion-icon {
        font-size: 17px;
      }

      .save-btn:disabled,
      .ghost-btn:disabled,
      .remove-btn:disabled {
        opacity: 0.45;
        box-shadow: none;
      }

      .ghost-btn:active:not(:disabled),
      .save-btn:active:not(:disabled),
      .remove-btn:active:not(:disabled) {
        transform: scale(0.96);
      }

      .ghost-btn:focus-visible,
      .save-btn:focus-visible,
      .remove-btn:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      @media (hover: hover) {
        .remove-btn:hover:not(:disabled) {
          background: var(--h-danger-surface);
        }

        .unit-chip:hover:not(.is-selected) .unit-chip__label {
          border-color: var(--h-ink-soft);
          color: var(--h-ink);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IngredientFormComponent {
  /** Prefix for element ids, unique on the page (e.g. "ingredient", "ingredient-<id>"). */
  readonly idPrefix = input.required<string>();
  readonly mode = input<'add' | 'edit'>('add');
  /** The ingredient being edited; null when adding. */
  readonly initial = input<IngredientDraft | null>(null);
  /** Unit picked when adding (e.g. the last one used). */
  readonly defaultUnit = input<QuantityUnit>('count');
  /** Saving or removing: the form is locked. */
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<IngredientDraft>();
  readonly cancelled = output<void>();
  /** Edit mode only. */
  readonly remove = output<void>();

  protected readonly removeIcon = trashOutline;
  protected readonly units = QUANTITY_UNITS;
  protected readonly nameMaxLength = INGREDIENT_NAME_MAX_LENGTH;

  protected readonly name = linkedSignal(() => this.initial()?.name ?? '');
  protected readonly amountText = linkedSignal(() => {
    const quantity = this.initial()?.quantity;
    return quantity === undefined ? '' : String(quantity);
  });
  protected readonly unit = linkedSignal<QuantityUnit>(() => this.initial()?.unit ?? this.defaultUnit());

  private readonly amount = computed(() => parseIngredientAmount(this.amountText()));
  protected readonly amountError = computed(() => {
    const amount = this.amount();
    return amount.status === 'invalid' ? amount.message : null;
  });
  protected readonly canSave = computed(
    () => !this.busy() && normalizeIngredientName(this.name()).length > 0 && this.amount().status === 'valid'
  );

  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');
  private readonly amountInput = viewChild.required<ElementRef<HTMLInputElement>>('amountInput');

  constructor() {
    // Focus the name once rendered, with the cursor after any existing text.
    afterNextRender(() => this.focusName());
  }

  /** Clears name and amount for the next ingredient (the unit is kept) and focuses the name. */
  reset(): void {
    this.name.set('');
    this.amountText.set('');
    this.focusName();
  }

  /**
   * Enter in the name field moves on to the amount until it's valid.
   * (Handled here: the browser won't submit on Enter while Save is disabled.)
   */
  protected onNameEnter(event: Event): void {
    if (this.amount().status !== 'valid') {
      event.preventDefault();
      this.amountInput().nativeElement.focus();
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const amount = this.amount();

    if (this.canSave() && amount.status === 'valid') {
      this.save.emit({ name: normalizeIngredientName(this.name()), quantity: amount.value, unit: this.unit() });
    }
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }

  private focusName(): void {
    const field = this.nameInput().nativeElement;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
}
