import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  viewChild
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { chevronBackOutline, chevronForwardOutline, copyOutline } from 'ionicons/icons';

import { MEAL_SLOTS, MealSlotId } from '../models/meal-slot.model';
import { PlannedMeal } from '../models/planned-meal.model';
import {
  buildPlannerWeek,
  describeWeekOffset,
  formatWeekRange,
  parseDateOnly,
  shiftWeek,
  startOfWeek,
  weekOffsetFromToday
} from '../utils/meal-planner-week.util';

/** Where to copy a meal to. */
export interface MealCopyTarget {
  /** Local `YYYY-MM-DD`. */
  readonly date: string;
  readonly slot: MealSlotId;
}

/**
 * Picks a day (from a week strip, starting on the meal's own week) and a slot
 * to copy a meal to. Purely presentational: it emits the target and the page
 * makes the copy (and passes back `busy` / `error`).
 */
@Component({
  selector: 'app-meal-copy-panel',
  standalone: true,
  imports: [IonIcon],
  template: `
    <form class="copy" novalidate aria-labelledby="copy-title" (submit)="submit($event)" (keydown.escape)="cancel()">
      <div class="copy__head">
        <span class="copy__icon" aria-hidden="true"><ion-icon [icon]="copyIcon" /></span>
        <div>
          <p class="copy__title" id="copy-title" tabindex="-1" #title>Copy to another day</p>
          <p class="copy__hint">Everything comes along, ingredients included.</p>
        </div>
      </div>

      <fieldset class="group" [disabled]="busy()">
        <legend class="group__label">Day</legend>
        <div class="week">
          <button
            type="button"
            class="week__arrow"
            data-testid="copy-previous-week"
            aria-label="Previous week"
            (click)="moveWeek(-1)"
          >
            <ion-icon aria-hidden="true" [icon]="previousIcon" />
          </button>
          <p class="week__label" aria-live="polite">
            <span class="week__relative">{{ weekLabel() }}</span>
            <span class="week__range">{{ weekRange() }}</span>
          </p>
          <button
            type="button"
            class="week__arrow"
            data-testid="copy-next-week"
            aria-label="Next week"
            (click)="moveWeek(1)"
          >
            <ion-icon aria-hidden="true" [icon]="nextIcon" />
          </button>
        </div>

        <div class="days">
          @for (day of days(); track day.date) {
            <label
              class="day"
              [class.is-selected]="selectedDate() === day.date"
              [class.is-original]="day.date === meal().date"
              [class.is-today]="day.isToday"
            >
              <input
                class="choice__input"
                type="radio"
                name="copy-day"
                [value]="day.date"
                [checked]="selectedDate() === day.date"
                [attr.aria-label]="day.weekday + ', ' + day.fullDate + (day.date === meal().date ? ', this meal\\'s day' : '')"
                (change)="selectedDate.set(day.date)"
              />
              <span class="day__face" aria-hidden="true">
                <small>{{ day.weekdayShort }}</small>
                <strong>{{ day.dayOfMonth }}</strong>
              </span>
            </label>
          }
        </div>
      </fieldset>

      <fieldset class="group" [disabled]="busy()">
        <legend class="group__label">Meal</legend>
        <div class="slots">
          @for (option of slots; track option.id) {
            <label class="slot" [class.is-selected]="slot() === option.id">
              <input
                class="choice__input"
                type="radio"
                name="copy-slot"
                [value]="option.id"
                [checked]="slot() === option.id"
                (change)="slot.set(option.id)"
              />
              <span class="slot__face"><span aria-hidden="true">{{ option.emoji }}</span> {{ option.label }}</span>
            </label>
          }
        </div>
      </fieldset>

      @if (error()) {
        <p class="copy__error" role="alert">{{ error() }}</p>
      }

      <div class="actions">
        <button type="button" class="ghost-btn" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button type="submit" class="save-btn" data-testid="confirm-copy" [disabled]="!canCopy()">
          {{ busy() ? 'Copying…' : 'Copy meal' }}
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

      .copy {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }

      .copy__head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .copy__icon {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 20px;
        transform: rotate(-6deg);
      }

      .copy__title {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
        outline: none;
      }

      .copy__hint {
        margin: 2px 0 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .group {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        gap: 8px;
      }

      .group__label {
        margin-bottom: 8px;
        padding: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      /* Visually hidden radios; the label faces show the choice. */
      .choice__input {
        position: absolute;
        z-index: 1; /* on top of its face, so the real control gets the tap */
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      /* ---- Week strip ---- */
      .week {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .week__arrow {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        padding: 0;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        color: var(--h-ink);
        font-size: 16px;
      }

      .week__label {
        flex: 1;
        min-width: 0;
        margin: 0;
        display: grid;
        text-align: center;
      }

      .week__relative {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-accent);
      }

      .week__range {
        font-size: 0.86rem;
        font-weight: 800;
        color: var(--h-ink);
        font-variant-numeric: tabular-nums;
      }

      .days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }

      .day,
      .slot {
        position: relative;
        cursor: pointer;
      }

      .day__face {
        min-height: 56px;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 2px;
        border: 1px solid var(--h-line);
        border-radius: 14px;
        background: var(--h-canvas);
        color: var(--h-ink);
        transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
      }

      .day__face small {
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      .day__face strong {
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }

      /* The original meal's day: a small dot under the number. */
      .day.is-original .day__face strong::after {
        content: '';
        display: block;
        width: 5px;
        height: 5px;
        margin: 2px auto 0;
        border-radius: 50%;
        background: var(--h-accent);
      }

      .day.is-today .day__face {
        border-color: var(--h-accent);
      }

      .day.is-selected .day__face,
      .slot.is-selected .slot__face {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .day.is-selected .day__face small {
        color: inherit;
        opacity: 0.75;
      }

      .day:active .day__face,
      .slot:active .slot__face {
        transform: scale(0.95);
      }

      /* ---- Slots ---- */
      .slots {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }

      .slot__face {
        min-height: 44px;
        padding: 0 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.8rem;
        font-weight: 800;
        white-space: nowrap;
        transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
      }

      .choice__input:focus-visible + .day__face,
      .choice__input:focus-visible + .slot__face,
      .week__arrow:focus-visible,
      .ghost-btn:focus-visible,
      .save-btn:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      .group:disabled .day,
      .group:disabled .slot {
        cursor: default;
        opacity: 0.6;
      }

      .copy__error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-danger);
      }

      .actions {
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
        box-shadow: 0 10px 20px -10px var(--h-accent-glow);
      }

      .save-btn:disabled,
      .ghost-btn:disabled {
        opacity: 0.45;
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
export class MealCopyPanelComponent {
  readonly meal = input.required<PlannedMeal>();
  /** Copying: the panel is locked. */
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly copy = output<MealCopyTarget>();
  readonly cancelled = output<void>();

  protected readonly copyIcon = copyOutline;
  protected readonly previousIcon = chevronBackOutline;
  protected readonly nextIcon = chevronForwardOutline;
  protected readonly slots = MEAL_SLOTS;

  private readonly today = signal(new Date());

  /** Starts on the meal's own week. */
  protected readonly weekStart = linkedSignal(() => startOfWeek(parseDateOnly(this.meal().date) ?? this.today()));
  protected readonly weekLabel = computed(() => describeWeekOffset(weekOffsetFromToday(this.weekStart(), this.today())));
  protected readonly weekRange = computed(() => formatWeekRange(this.weekStart()));
  protected readonly days = computed(() => buildPlannerWeek(this.weekStart(), this.today()));

  /** No day is picked up front: copying is always a deliberate choice. */
  protected readonly selectedDate = signal<string | null>(null);
  /** Same slot as the original unless changed. */
  protected readonly slot = linkedSignal<MealSlotId>(() => this.meal().slot);

  protected readonly canCopy = computed(() => !this.busy() && this.selectedDate() !== null);

  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  constructor() {
    // Move focus into the panel so keyboard and screen reader users land on it.
    afterNextRender(() => this.title().nativeElement.focus());
  }

  protected moveWeek(weeks: number): void {
    this.weekStart.update((start) => shiftWeek(start, weeks));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const date = this.selectedDate();

    if (this.canCopy() && date) {
      this.copy.emit({ date, slot: this.slot() });
    }
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
