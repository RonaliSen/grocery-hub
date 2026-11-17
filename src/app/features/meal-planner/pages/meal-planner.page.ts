import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { MEAL_SLOTS } from '../models/meal-slot.model';
import { MealPlanStateService } from '../services/meal-plan-state.service';
import { DayPlanSummary, summarizeDayPlan } from '../utils/meal-plan.util';
import {
  buildPlannerWeek,
  PlannerDay,
  describeWeekOffset,
  formatWeekRange,
  shiftWeek,
  startOfWeek,
  weekOffsetFromToday
} from '../utils/meal-planner-week.util';

/** Number of `--h-tile-N` colour tokens defined by .theme-citrus. */
const TILE_COUNT = 6;

/** e.g. "Monday, 17 November 2026, today. Breakfast: Porridge. Dinner: Curry, Rice". */
function describeDayForScreenReader(day: PlannerDay, summary: DayPlanSummary): string {
  const heading = `${day.weekday}, ${day.fullDate}${day.isToday ? ', today' : ''}`;
  if (summary.mealCount === 0) {
    return `${heading}. Nothing planned yet`;
  }

  const slots = MEAL_SLOTS.filter((slot) => summary.plannedSlots.includes(slot.id));
  return [heading, ...slots.map((slot) => `${slot.label}: ${summary.mealNamesBySlot[slot.id].join(', ')}`)].join('. ');
}

/** Weekly overview: Monday to Sunday, with arrows to move between weeks. */
@Component({
  selector: 'app-meal-planner-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="planner-content">
      <div class="planner-page">
        <header class="page-header">
          <button type="button" class="icon-btn" aria-label="Go back" (click)="goBack()">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>
          <div class="page-header__text">
            <h1>Meal Planner</h1>
            <p>Plan your meals for the week</p>
          </div>
          <span aria-hidden="true"></span>
        </header>

        <section class="hero week-switcher" aria-label="Selected week">
          <div class="hero-dots" aria-hidden="true"></div>
          <p class="hero__eyebrow" data-testid="week-label">{{ weekLabel() }}</p>

          <div class="week-switcher__row">
            <h2 class="hero__title week-switcher__range" data-testid="week-range" aria-live="polite">
              {{ weekRange() }}
            </h2>
            <div class="week-switcher__arrows">
              <button
                type="button"
                class="week-arrow"
                data-testid="previous-week"
                aria-label="Previous week"
                (click)="moveWeek(-1)"
              >
                <ion-icon aria-hidden="true" [icon]="previousIcon" />
              </button>
              <button
                type="button"
                class="week-arrow"
                data-testid="next-week"
                aria-label="Next week"
                (click)="moveWeek(1)"
              >
                <ion-icon aria-hidden="true" [icon]="nextIcon" />
              </button>
            </div>
          </div>

          @if (weekOffset() !== 0) {
            <button
              type="button"
              class="week-switcher__today"
              data-testid="current-week"
              (click)="goToCurrentWeek()"
            >
              <span aria-hidden="true">📅</span>
              Back to this week
            </button>
          }
        </section>

        <ol class="day-list" aria-label="Days of the week">
          @for (entry of days(); track entry.day.date) {
            @let day = entry.day;
            @let summary = entry.summary;
            <li>
              <a
                class="day-card"
                [class.is-today]="day.isToday"
                [class.has-meals]="summary.mealCount > 0"
                [routerLink]="['/tabs/meal-planner', day.date]"
                [attr.aria-current]="day.isToday ? 'date' : null"
                [attr.aria-label]="entry.label"
              >
                <span class="day-card__date" [style.--tile]="tileColor($index)" aria-hidden="true">
                  <small>{{ day.weekdayShort }}</small>
                  <strong>{{ day.dayOfMonth }}</strong>
                </span>

                <span class="day-card__body">
                  <span class="day-card__name">
                    {{ day.weekday }}
                    @if (day.isToday) {
                      <span class="today-badge">Today</span>
                    }
                  </span>
                  <span class="day-card__meta">
                    <span class="day-card__slots" aria-hidden="true">
                      @for (slot of slots; track slot.id) {
                        @let planned = summary.plannedSlots.includes(slot.id);
                        <span
                          class="slot-dot"
                          [class.is-planned]="planned"
                          [attr.data-slot]="slot.id"
                          [title]="slot.label + (planned ? ' planned' : ' not planned')"
                        >{{ slot.emoji }}</span>
                      }
                    </span>
                    <span class="day-card__status">
                      @if (summary.mealCount > 0) {
                        {{ summary.mealNames.join(' · ') }}
                      } @else {
                        Nothing planned yet
                      }
                    </span>
                  </span>
                </span>

                <span class="day-card__chevron" aria-hidden="true">
                  <ion-icon [icon]="nextIcon" />
                </span>
              </a>
            </li>
          }
        </ol>
      </div>
    </ion-content>
  `,
  styles: [
    `
      @use '../styles/meal-planner-shared' as shared;

      /* Meal Planner — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss); header/hero follow the Expiry Tracker. */
      @include shared.page-layout;
      @include shared.page-header;
      @include shared.hero;

      /* ---------------- Week switcher ---------------- */

      .week-switcher__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .week-switcher__range {
        min-width: 0;
        font-variant-numeric: tabular-nums;
      }

      .week-switcher__arrows {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .week-arrow {
        width: 46px;
        height: 46px;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        font-size: 20px;
        transition: transform 140ms ease, background-color 140ms ease;
      }

      .week-arrow:last-child {
        border-color: transparent;
        background: #ffffff;
        color: #16141d;
      }

      .week-arrow:active {
        transform: scale(0.9);
      }

      .week-arrow:focus-visible,
      .week-switcher__today:focus-visible {
        outline: 3px solid var(--h-sun);
        outline-offset: 2px;
      }

      .week-switcher__today {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 4px 14px 4px 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.76rem;
        font-weight: 700;
      }

      /* ---------------- Days ---------------- */

      .day-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .day-card {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 76px;
        padding: 10px 12px 10px 10px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        color: var(--h-ink);
        transition: transform 160ms ease, box-shadow 160ms ease;
      }

      .day-card:active {
        transform: scale(0.98);
      }

      .day-card.is-today {
        outline: 2px solid var(--h-accent);
        outline-offset: -1px;
      }

      .day-card__date {
        width: 56px;
        height: 56px;
        flex-shrink: 0;
        border-radius: 18px;
        display: grid;
        place-content: center;
        justify-items: center;
        background: var(--tile, var(--h-tile-5));
        color: var(--h-ink);
        text-align: center;
      }

      .day-card__date small {
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        line-height: 1;
        text-transform: uppercase;
        color: var(--h-ink-soft);
      }

      .day-card__date strong {
        margin-top: 3px;
        font-family: var(--h-display);
        font-size: 1.4rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      .is-today .day-card__date {
        background: var(--h-accent);
        color: #ffffff;
        transform: rotate(-4deg);
        box-shadow: 0 10px 18px -10px var(--h-accent-glow);
      }

      .is-today .day-card__date small {
        color: rgba(255, 255, 255, 0.85);
      }

      .day-card__body {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .day-card__name {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      .today-badge {
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--h-sun);
        color: #16141d;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .day-card__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-muted);
        white-space: nowrap;
      }

      .day-card__slots {
        display: inline-flex;
        flex-shrink: 0;
      }

      .day-card__status {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Empty slot markers: dashed, faded emoji — one per meal slot. */
      .slot-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 1px dashed color-mix(in srgb, var(--h-muted) 55%, transparent);
        background: var(--h-canvas);
        font-size: 0.7rem;
        filter: grayscale(1);
        opacity: 0.45;
      }

      .slot-dot + .slot-dot {
        margin-left: -5px;
      }

      /* Planned slot: solid, full-colour marker in that slot's tile colour. */
      .slot-dot.is-planned {
        position: relative;
        border: 2px solid var(--h-surface);
        background: var(--slot-tile);
        filter: none;
        opacity: 1;
        font-size: 0.78rem;
      }

      .slot-dot[data-slot='breakfast'] { --slot-tile: var(--h-tile-3); }
      .slot-dot[data-slot='lunch'] { --slot-tile: var(--h-tile-4); }
      .slot-dot[data-slot='dinner'] { --slot-tile: var(--h-tile-1); }

      .has-meals .day-card__status {
        color: var(--h-ink-soft);
        font-weight: 700;
      }

      .day-card__chevron {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 18px;
      }

      /* ---------------- Pointer hover ---------------- */

      @media (hover: hover) {
        .day-card:hover {
          box-shadow: 0 16px 28px -18px rgba(22, 20, 29, 0.45);
        }

        .week-arrow:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .week-arrow:last-child:hover {
          background: var(--h-sun);
        }
      }

      /* ---------------- Responsive ---------------- */

      /* Small phones: the slot markers are decorative, the status text is not. */
      @media (max-width: 359px) {
        .day-card__slots {
          display: none;
        }
      }

      @media (min-width: 600px) {
        .hero {
          padding: 30px;
        }
      }

      @media (min-width: 720px) {
        .day-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
      }

      @include shared.reduced-motion;
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MealPlannerPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly mealPlan = inject(MealPlanStateService);

  protected readonly backIcon = arrowBackOutline;
  protected readonly previousIcon = chevronBackOutline;
  protected readonly nextIcon = chevronForwardOutline;
  protected readonly slots = MEAL_SLOTS;

  /** Re-read on every visit: Ionic keeps this page alive, and "today" moves on. */
  private readonly today = signal(new Date());

  /** Monday of the week on screen; starts on the current week. */
  protected readonly weekStart = signal(startOfWeek(this.today()));

  protected readonly weekOffset = computed(() => weekOffsetFromToday(this.weekStart(), this.today()));
  protected readonly weekLabel = computed(() => describeWeekOffset(this.weekOffset()));
  protected readonly weekRange = computed(() => formatWeekRange(this.weekStart()));
  /** The week's days, each with what's planned so far. */
  protected readonly days = computed(() =>
    buildPlannerWeek(this.weekStart(), this.today()).map((day) => {
      const summary = summarizeDayPlan(this.mealPlan.mealsFor(day.date));
      return { day, summary, label: describeDayForScreenReader(day, summary) };
    })
  );

  ionViewWillEnter(): void {
    this.today.set(new Date());
  }

  protected moveWeek(weeks: number): void {
    this.weekStart.update((start) => shiftWeek(start, weeks));
  }

  protected goToCurrentWeek(): void {
    this.weekStart.set(startOfWeek(this.today()));
  }

  /** Pastel tile colour (one of six theme tokens) for the day at `index`. */
  protected tileColor(index: number): string {
    return `var(--h-tile-${(index % TILE_COUNT) + 1})`;
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/home');
  }
}
