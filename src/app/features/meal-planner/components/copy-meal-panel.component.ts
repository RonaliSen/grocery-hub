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
import {
  buildPlannerWeek,
  formatWeekRange,
  parseDateOnly,
  shiftWeek,
  startOfWeek
} from '../utils/meal-planner-week.util';

/** Where to copy a meal to. */
export interface MealCopyTarget {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly slot: MealSlotId;
}

/**
 * Picks a day (from a week strip, with arrows for other weeks) and a meal slot
 * to copy a meal to. Purely presentational: it emits the target and the page
 * does the copying (and passes back `busy` / `error`).
 */
@Component({
  selector: 'app-copy-meal-panel',
  standalone: true,
  imports: [IonIcon],
  template: `
    <form class="copy" novalidate aria-labelledby="copy-title" (submit)="submit($event)" (keydown.escape)="cancel()">
      <div class="copy__head">
        <span class="copy__icon" aria-hidden="true"><ion-icon [icon]="copyIcon" /></span>
        <div>
          <h3 class="copy__title" id="copy-title" tabindex="-1" #title>Copy {{ mealName() }}</h3>
          <p class="copy__hint">With all its ingredients. The original stays as it is.</p>
        </div>
      </div>

      <fieldset class="group" [disabled]="busy()">
        <legend class="group__label">Day</legend>

        <div class="week-nav">
          <button type="button" class="week-nav__btn" aria-label="Previous week" (click)="moveWeek(-1)">
            <ion-icon aria-hidden="true" [icon]="previousIcon" />
          </button>
          <span class="week-nav__range" aria-live="polite" data-testid="copy-week-range">{{ weekRange() }}</span>
          <button type="button" class="week-nav__btn" aria-label="Next week" (click)="moveWeek(1)">
            <ion-icon aria-hidden="true" [icon]="nextIcon" />
          </button>
        </div>

        <div class="days">
          @for (day of days(); track day.date) {
            <label
              class="day"
              [class.is-selected]="selectedDate() === day.date"
              [class.is-original]="day.date === mealDate()"
              [class.is-today]="day.isToday"
            >
              <input
                class="chip-input"
                type="radio"
                name="copy-day"
                [value]="day.date"
                [checked]="selectedDate() === day.date"
                [attr.aria-label]="dayLabel(day.weekday, day.fullDate, day.date, day.isToday)"
                (change)="selectedDate.set(day.date)"
              />
              <span class="day__face" aria-hidden="true">
                <small>{{ day.weekdayShort }}</small>
                <strong>{{ day.dayOfMonth }}</strong>
                <i class="day__dot"></i>
              </span>
            </label>
          }
        </div>
      </fieldset>

      <fieldset class="group" [disabled]="busy()">
        <legend class="group__label">Meal</legend>
        <div class="slots">
          @for (slot of slots; track slot.id) {
            <label class="slot" [class.is-selected]="selectedSlot() === slot.id">
              <input
                class="chip-input"
                type="radio"
                name="copy-slot"
                [value]="slot.id"
                [checked]="selectedSlot() === slot.id"
                (change)="selectedSlot.set(slot.id)"
              />
              <span class="slot__face"><span aria-hidden="true">{{ slot.emoji }}</span> {{ slot.label }}</span>
            </label>
          }
        </div>
      </fieldset>

      @if (isSameSpot()) {
        <p class="copy__note" data-testid="copy-same-spot">That's where this meal already is. Pick another day or meal.</p>
      }
      @if (error()) {
        <p class="copy__error" role="alert">{{ error() }}</p>
      }

      <div class="actions">
        <button type="button" class="ghost-btn" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button type="submit" class="save-btn" data-testid="confirm-copy" [disabled]="!canCopy()">
          {{ busy() ? 'Copying…' : copyLabel() }}
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
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-tile-2);
        color: var(--h-ink);
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
        overflow-wrap: anywhere;
        outline: none;
      }

      .copy__hint {
        margin: 2px 0 0;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .group {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        gap: 10px;
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

      /* Radio inputs sit invisibly over their chip, so they stay focusable. */
      .day,
      .slot {
        position: relative;
        cursor: pointer;
      }

      .chip-input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      .chip-input:focus-visible + span {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      .group:disabled .day,
      .group:disabled .slot {
        cursor: default;
        opacity: 0.6;
      }

      /* Week navigation */
      .week-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .week-nav__range {
        font-size: 0.85rem;
        font-weight: 800;
        color: var(--h-ink);
        text-align: center;
      }

      .week-nav__btn {
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        color: var(--h-ink);
        font-size: 16px;
        transition: transform 120ms ease;
      }

      .week-nav__btn:active {
        transform: scale(0.9);
      }

      .week-nav__btn:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      /* Week strip */
      .days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }

      .day__face {
        min-height: 62px;
        padding: 6px 0;
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 2px;
        border-radius: 16px;
        border: 1px solid var(--h-line);
        background: var(--h-canvas);
        color: var(--h-ink);
        transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 120ms ease;
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
        font-size: 1.05rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      /* Marks the original meal's day. */
      .day__dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: transparent;
      }

      .day.is-original .day__dot {
        background: var(--h-accent);
      }

      .day.is-today .day__face {
        border-color: var(--h-ink-soft);
      }

      .day.is-selected .day__face {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        transform: translateY(-2px);
      }

      .day.is-selected .day__face small {
        color: inherit;
        opacity: 0.75;
      }

      .day:active .day__face {
        transform: scale(0.95);
      }

      /* Slots */
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
        gap: 4px;
        border-radius: 999px;
        border: 1px solid var(--h-line);
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.8rem;
        font-weight: 800;
        white-space: nowrap;
        transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
      }

      .slot.is-selected .slot__face {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .copy__note,
      .copy__error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .copy__note {
        color: var(--h-ink-soft);
      }

      .copy__error {
        color: var(--h-danger);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .ghost-btn,
      .save-btn {
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        font-size: 0.88rem;
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
        transform: scale(0.96);
      }

      .ghost-btn:focus-visible,
      .save-btn:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      /* Narrow screens: full-width buttons, Copy first, so its label fits on one line. */
      @media (max-width: 359px) {
        .ghost-btn,
        .save-btn {
          flex-basis: 100%;
        }

        .save-btn {
          order: -1;
        }

        .slot__face span {
          display: none;
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
export class CopyMealPanelComponent {
  readonly mealName = input.required<string>();
  /** The original meal's day (`YYYY-MM-DD`): the strip opens on its week. */
  readonly mealDate = input.required<string>();
  readonly mealSlot = input.required<MealSlotId>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly copy = output<MealCopyTarget>();
  readonly cancelled = output<void>();

  protected readonly copyIcon = copyOutline;
  protected readonly previousIcon = chevronBackOutline;
  protected readonly nextIcon = chevronForwardOutline;
  protected readonly slots = MEAL_SLOTS;

  private readonly today = signal(new Date());
  protected readonly weekStart = linkedSignal(() => startOfWeek(parseDateOnly(this.mealDate()) ?? this.today()));
  protected readonly days = computed(() => buildPlannerWeek(this.weekStart(), this.today()));
  protected readonly weekRange = computed(() => formatWeekRange(this.weekStart()));

  /** No day is picked up front: copying is a deliberate choice. */
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly selectedSlot = linkedSignal<MealSlotId>(() => this.mealSlot());

  /** Copying onto the meal's own day and slot would only duplicate it in place. */
  protected readonly isSameSpot = computed(
    () => this.selectedDate() === this.mealDate() && this.selectedSlot() === this.mealSlot()
  );
  protected readonly canCopy = computed(() => !this.busy() && this.selectedDate() !== null && !this.isSameSpot());

  /** e.g. "Copy to Wed 18 · Dinner". */
  protected readonly copyLabel = computed(() => {
    const date = parseDateOnly(this.selectedDate());
    if (!date) return 'Copy';

    // Built by hand: some locales put the day first ("18 Wed").
    const day = `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getDate()}`;
    const slot = MEAL_SLOTS.find((candidate) => candidate.id === this.selectedSlot())?.label ?? '';
    return `Copy to ${day} · ${slot}`;
  });

  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  constructor() {
    // Move focus into the panel so keyboard and screen reader users land on it.
    afterNextRender(() => this.title().nativeElement.focus());
  }

  protected moveWeek(weeks: number): void {
    this.weekStart.update((start) => shiftWeek(start, weeks));
  }

  protected dayLabel(weekday: string, fullDate: string, date: string, isToday: boolean): string {
    const notes = [isToday ? 'today' : null, date === this.mealDate() ? "this meal's day" : null].filter(Boolean);
    return [`${weekday}, ${fullDate}`, ...notes].join(', ');
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const date = this.selectedDate();

    if (this.canCopy() && date) {
      this.copy.emit({ date, slot: this.selectedSlot() });
    }
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
