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

import { MEAL_NAME_MAX_LENGTH } from '../models/planned-meal.model';
import { normalizeMealName } from '../utils/meal-plan.util';

/**
 * Inline "meal name" field with Cancel / Save, used to add a meal and to
 * rename one. Purely presentational: it emits the tidied name and the page
 * saves it (and passes back `saving` / `error`).
 */
@Component({
  selector: 'app-meal-name-form',
  standalone: true,
  template: `
    <form class="meal-form" novalidate (submit)="submit($event)" (keydown.escape)="cancel()">
      <label class="visually-hidden" [for]="inputId()">{{ label() }}</label>
      <input
        #nameInput
        class="meal-form__input"
        type="text"
        autocomplete="off"
        enterkeyhint="done"
        [id]="inputId()"
        [maxLength]="maxLength"
        [placeholder]="placeholder()"
        [value]="draft()"
        [readOnly]="saving()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? errorId() : null"
        (input)="draft.set($any($event.target).value)"
      />
      @if (error()) {
        <p class="meal-form__error" role="alert" [id]="errorId()">{{ error() }}</p>
      }
      <div class="meal-form__actions">
        <button type="button" class="ghost-btn" [disabled]="saving()" (click)="cancel()">Cancel</button>
        <button type="submit" class="save-btn" data-testid="save-meal" [disabled]="!canSave()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the page's .theme-citrus host;
         controls follow the Expiry restock sheet. */
      :host {
        display: block;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .meal-form {
        display: grid;
        gap: 10px;
      }

      .meal-form__input {
        width: 100%;
        min-width: 0;
        min-height: 52px;
        padding: 0 16px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.95rem;
        font-weight: 600;
      }

      .meal-form__input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      /* Beat the global input:not(…):focus ring (specificity 0,5,1). */
      .meal-form input.meal-form__input.meal-form__input:focus {
        outline: none;
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .meal-form__input[aria-invalid='true'] {
        border-color: var(--h-danger);
      }

      .meal-form__error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-danger);
      }

      .meal-form__actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .ghost-btn,
      .save-btn {
        min-height: 46px;
        border-radius: 999px;
        font-size: 0.9rem;
        font-weight: 800;
        transition: transform 140ms ease, opacity 140ms ease;
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

      .save-btn:disabled,
      .ghost-btn:disabled {
        opacity: 0.5;
        box-shadow: none;
      }

      .ghost-btn:active:not(:disabled),
      .save-btn:active:not(:disabled) {
        transform: scale(0.97);
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
export class MealNameFormComponent {
  readonly inputId = input.required<string>();
  /** Accessible name of the field, e.g. "Lunch meal name". */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  /** Starting text: empty to add a meal, the current name to rename one. */
  readonly initialName = input('');
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  /** The tidied name (never empty). */
  readonly save = output<string>();
  readonly cancelled = output<void>();

  protected readonly maxLength = MEAL_NAME_MAX_LENGTH;
  protected readonly draft = linkedSignal(() => this.initialName());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly canSave = computed(() => !this.saving() && normalizeMealName(this.draft()).length > 0);

  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    // Focus the field once it's rendered. When renaming, select the current
    // name so typing replaces it. (After render: the [value] binding must have
    // filled the field before there's anything to select.)
    afterNextRender(() => {
      const field = this.nameInput().nativeElement;
      field.focus();
      if (field.value) field.select();
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSave()) {
      this.save.emit(normalizeMealName(this.draft()));
    }
  }

  protected cancel(): void {
    if (!this.saving()) {
      this.cancelled.emit();
    }
  }
}
