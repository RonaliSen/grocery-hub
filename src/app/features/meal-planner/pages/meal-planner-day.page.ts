import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addOutline, arrowBackOutline, chevronForwardOutline, closeOutline, createOutline } from 'ionicons/icons';
import { map } from 'rxjs';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { toLocalDateOnly } from '../../../core/utils/date.utils';
import { MEAL_SLOTS, MealSlotDefinition, MealSlotId } from '../models/meal-slot.model';
import { MealNameFormComponent } from '../components/meal-name-form.component';
import { PlannedMeal } from '../models/planned-meal.model';
import { EMPTY_DAY_PLAN } from '../utils/meal-plan.util';
import { MealPlanStateService } from '../services/meal-plan-state.service';
import { describeRelativeDay, formatPlannerDate, parseDateOnly } from '../utils/meal-planner-week.util';

/** Tile colour per slot, so each meal keeps the same colour everywhere. */
const SLOT_TILES = ['var(--h-tile-3)', 'var(--h-tile-4)', 'var(--h-tile-1)'] as const;

/** Which form is open: adding to a slot (mealId null) or renaming a meal. */
interface MealFormTarget {
  readonly slot: MealSlotId;
  readonly mealId: string | null;
}

/** One day of the planner: add, rename and remove meals for breakfast, lunch and dinner. */
@Component({
  selector: 'app-meal-planner-day-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, MealNameFormComponent, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="planner-content">
      <div class="planner-page">
        <header class="page-header">
          <button type="button" class="icon-btn" aria-label="Go back" (click)="goBack()">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>
          <div class="page-header__text">
            <h1>{{ title() }}</h1>
            <p>{{ subtitle() }}</p>
          </div>
          <span aria-hidden="true"></span>
        </header>

        @if (dateKey()) {
          <ol class="slot-list" aria-label="Meals">
            @for (slot of slots; track slot.id) {
              @let meals = plan()[slot.id];
              <li class="slot-card" [attr.data-slot]="slot.id">
                <div class="slot-card__head">
                  <span class="slot-card__emoji" [style.--tile]="slotTiles[$index]" aria-hidden="true">
                    {{ slot.emoji }}
                  </span>
                  <h2 class="slot-card__label" [id]="'slot-title-' + slot.id">{{ slot.label }}</h2>
                  @if (meals.length > 0) {
                    <span class="slot-card__count" aria-hidden="true">{{ meals.length }}</span>
                  }
                </div>

                @if (meals.length > 0) {
                  <ul class="meal-list" [attr.aria-labelledby]="'slot-title-' + slot.id">
                    @for (meal of meals; track meal.id) {
                      @if (activeForm()?.mealId === meal.id) {
                        <li class="meal-item meal-item--editing" [attr.data-meal-id]="meal.id">
                          <app-meal-name-form
                            [inputId]="'meal-edit-' + meal.id"
                            [label]="'New name for ' + meal.name"
                            [placeholder]="slot.placeholder"
                            [initialName]="meal.name"
                            [saving]="saving()"
                            [error]="formError()"
                            (save)="saveForm($event)"
                            (cancelled)="closeForm()"
                          />
                        </li>
                      } @else {
                        <li class="meal-item" [attr.data-meal-id]="meal.id" [attr.aria-busy]="isRemoving(meal.id)">
                          <a
                            class="meal-item__open"
                            data-testid="open-meal"
                            [routerLink]="['/tabs/meal-planner', meal.date, 'meals', meal.id]"
                            [attr.aria-label]="meal.name + ', ' + ingredientSummary(meal)"
                          >
                            <span class="meal-item__text">
                              <span class="meal-item__name">{{ meal.name }}</span>
                              <span class="meal-item__meta" [class.is-empty]="meal.ingredients.length === 0">
                                {{ ingredientSummary(meal) }}
                              </span>
                            </span>
                            <ion-icon class="meal-item__chevron" aria-hidden="true" [icon]="openIcon" />
                          </a>
                          <button
                            type="button"
                            class="meal-item__icon-btn"
                            data-testid="edit-meal"
                            [disabled]="isRemoving(meal.id)"
                            [attr.aria-label]="'Edit ' + meal.name + ' for ' + slot.label.toLowerCase()"
                            (click)="openRename(slot.id, meal)"
                          >
                            <ion-icon aria-hidden="true" [icon]="editIcon" />
                          </button>
                          <button
                            type="button"
                            class="meal-item__icon-btn meal-item__remove"
                            data-testid="remove-meal"
                            [disabled]="isRemoving(meal.id)"
                            [attr.aria-label]="'Remove ' + meal.name + ' from ' + slot.label.toLowerCase()"
                            (click)="removeMeal(meal, slot)"
                          >
                            <ion-icon aria-hidden="true" [icon]="removeIcon" />
                          </button>
                        </li>
                      }
                    }
                  </ul>
                }

                @if (activeForm(); as form) {
                  @if (form.slot === slot.id && form.mealId === null) {
                    <app-meal-name-form
                      [inputId]="'meal-name-' + slot.id"
                      [label]="slot.label + ' meal name'"
                      [placeholder]="slot.placeholder"
                      [saving]="saving()"
                      [error]="formError()"
                      (save)="saveForm($event)"
                      (cancelled)="closeForm()"
                    />
                  }
                }

                @if (activeForm()?.slot !== slot.id) {
                  <button
                    type="button"
                    class="add-meal"
                    [class.add-meal--compact]="meals.length > 0"
                    data-testid="add-meal"
                    (click)="openAdd(slot.id)"
                  >
                    <ion-icon aria-hidden="true" [icon]="addIcon" />
                    {{ meals.length > 0 ? 'Add another' : 'Add ' + slot.label.toLowerCase() }}
                  </button>
                }

                @if (slotError()?.slot === slot.id) {
                  <p class="slot-card__error" role="alert">{{ slotError()!.message }}</p>
                }
              </li>
            }
          </ol>
        } @else {
          <section class="empty-card" data-testid="invalid-day">
            <span class="empty-emoji" aria-hidden="true">🗓️</span>
            <h2>We couldn't find that day</h2>
            <p>The link may be incomplete. Pick a day from your weekly plan instead.</p>
            <a class="empty-action" [routerLink]="['/tabs/meal-planner']">Back to Meal Planner</a>
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      @use '../styles/meal-planner-shared' as shared;

      /* Meal Planner day — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss); form controls follow the Expiry restock sheet. */
      @include shared.page-layout;
      @include shared.page-header;
      @include shared.empty-card;

      .slot-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: start;
        gap: 12px;
      }

      .slot-card {
        display: grid;
        gap: 12px;
        padding: 12px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .slot-card__head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .slot-card__emoji {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: var(--tile, var(--h-tile-5));
        font-size: 1.4rem;
        transform: rotate(-6deg);
      }

      .slot-card__label {
        flex: 1;
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .slot-card__count {
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--h-canvas);
        border: 1px solid var(--h-line);
        color: var(--h-ink-soft);
        font-family: var(--h-display);
        font-size: 0.8rem;
        font-weight: 800;
      }

      /* ---------------- Planned meals ---------------- */

      .meal-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }

      .meal-item {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 52px;
        padding: 6px;
        border-radius: 18px;
        background: var(--h-canvas);
        border: 1px solid var(--h-line);
        transition: opacity 140ms ease;
      }

      .meal-item[aria-busy='true'] {
        opacity: 0.5;
      }

      /* Renaming: the row becomes the name form. */
      .meal-item--editing {
        display: block;
        padding: 10px;
        background: var(--h-surface);
        border-color: var(--h-accent);
      }

      /* Tap the meal to open it (its ingredients). */
      .meal-item__open {
        flex: 1;
        min-width: 0;
        min-height: 44px;
        padding: 4px 6px 4px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 12px;
        color: var(--h-ink);
        transition: background-color 140ms ease;
      }

      .meal-item__open:active {
        background: var(--h-line);
      }

      .meal-item__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .meal-item__name {
        font-size: 0.95rem;
        font-weight: 700;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .meal-item__meta {
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .meal-item__meta.is-empty {
        color: var(--h-accent);
      }

      .meal-item__chevron {
        font-size: 16px;
        color: var(--h-muted);
      }

      .meal-item__icon-btn {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        padding: 0;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: transparent;
        color: var(--h-muted);
        font-size: 18px;
        transition: transform 140ms ease, background-color 140ms ease, color 140ms ease;
      }

      .meal-item__remove {
        font-size: 20px;
      }

      .meal-item__icon-btn:active:not(:disabled) {
        transform: scale(0.9);
      }

      /* ---------------- Add ---------------- */

      /* Empty slot: the dashed space itself is the button. */
      .add-meal {
        min-height: 56px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 18px;
        border: 2px dashed var(--h-line);
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.88rem;
        font-weight: 800;
        transition: transform 140ms ease, border-color 140ms ease, color 140ms ease;
      }

      .add-meal ion-icon {
        font-size: 18px;
        color: var(--h-accent);
      }

      .add-meal--compact {
        min-height: 44px;
        justify-self: start;
        border-style: solid;
        border-width: 1px;
        border-radius: 999px;
        font-size: 0.8rem;
      }

      .add-meal:active {
        transform: scale(0.97);
      }

      /* Theme-coloured focus ring (the app default is green). */
      .meal-item__open:focus-visible,
      .meal-item__icon-btn:focus-visible,
      .add-meal:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
        box-shadow: none;
      }

      .slot-card__error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-danger);
      }

      /* ---------------- Pointer hover ---------------- */

      @media (hover: hover) {
        .add-meal:hover {
          border-color: var(--h-accent);
          color: var(--h-ink);
        }

        .meal-item__open:hover .meal-item__name {
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
        }

        [data-testid='edit-meal']:hover:not(:disabled) {
          background: var(--h-line);
          color: var(--h-accent);
        }

        .meal-item__remove:hover:not(:disabled) {
          background: var(--h-danger-surface);
          color: var(--h-danger);
        }
      }

      @media (min-width: 720px) {
        .slot-list {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @include shared.reduced-motion;
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MealPlannerDayPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly mealPlan = inject(MealPlanStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly addIcon = addOutline;
  protected readonly backIcon = arrowBackOutline;
  protected readonly editIcon = createOutline;
  protected readonly removeIcon = closeOutline;
  protected readonly openIcon = chevronForwardOutline;
  protected readonly slots = MEAL_SLOTS;
  protected readonly slotTiles = SLOT_TILES;

  /** `YYYY-MM-DD` from the route (`/tabs/meal-planner/:date`). */
  private readonly date = toSignal(this.route.paramMap.pipe(map((params) => params.get('date'))), {
    initialValue: this.route.snapshot.paramMap.get('date')
  });

  /** Re-read on every visit: Ionic keeps this page alive, and "today" moves on. */
  private readonly today = signal(new Date());

  private readonly day = computed(() => parseDateOnly(this.date()));

  /** The valid day's `YYYY-MM-DD`, or null when the route's date is invalid. */
  protected readonly dateKey = computed(() => {
    const day = this.day();
    return day ? toLocalDateOnly(day) : null;
  });

  protected readonly plan = computed(() => {
    const dateKey = this.dateKey();
    return dateKey ? this.mealPlan.mealsFor(dateKey) : EMPTY_DAY_PLAN;
  });

  /** The open name form, if any (only one at a time); closes when the day changes. */
  private readonly formTarget = linkedSignal<string | null, MealFormTarget | null>({
    source: this.dateKey,
    computation: () => null
  });

  /** The open form — dropped if the meal being renamed no longer exists. */
  protected readonly activeForm = computed(() => {
    const target = this.formTarget();
    if (target?.mealId && !this.plan()[target.slot].some((meal) => meal.id === target.mealId)) {
      return null;
    }
    return target;
  });

  protected readonly saving = signal(false);
  /** Save failure, shown inside the open form. */
  protected readonly formError = signal<string | null>(null);
  /** Problems outside a form (a failed remove, a meal that was already gone), shown in the slot. */
  protected readonly slotError = signal<{ slot: MealSlotId; message: string } | null>(null);

  /** Meals with a remove in flight, so a double tap can't fire twice. */
  private readonly removingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly title = computed(() => {
    const day = this.day();
    return day ? day.toLocaleDateString(undefined, { weekday: 'long' }) : 'Meal Planner';
  });

  protected readonly subtitle = computed(() => {
    const day = this.day();
    if (!day) return 'Day not found';

    const relative = describeRelativeDay(day, this.today());
    const date = formatPlannerDate(day);
    return relative ? `${relative} · ${date}` : date;
  });

  ionViewWillEnter(): void {
    this.today.set(new Date());
  }

  protected openAdd(slot: MealSlotId): void {
    this.openForm({ slot, mealId: null });
  }

  protected openRename(slot: MealSlotId, meal: PlannedMeal): void {
    this.openForm({ slot, mealId: meal.id });
  }

  protected closeForm(): void {
    const target = this.activeForm();
    if (this.saving()) return;

    this.formTarget.set(null);
    this.formError.set(null);
    if (target) this.focusAfterForm(target);
  }

  /** Saves the open form: a new meal, or the new name of an existing one. */
  protected async saveForm(name: string): Promise<void> {
    const target = this.activeForm();
    const dateKey = this.dateKey();

    if (!target || !dateKey || this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    try {
      const saved =
        target.mealId === null
          ? await this.mealPlan.addMeal(dateKey, target.slot, name)
          : await this.mealPlan.renameMeal(target.mealId, name);

      this.saving.set(false);
      this.closeForm();

      if (!saved) {
        this.slotError.set({ slot: target.slot, message: 'That meal was already removed.' });
      }
    } catch {
      this.saving.set(false);
      // The form stays open with the text (the field was only read-only) so they can retry.
      this.formError.set(
        target.mealId === null
          ? "Couldn't save this meal. Please try again."
          : "Couldn't save the new name. Please try again."
      );
    }
  }

  /** e.g. "3 ingredients", or a nudge to add some. */
  protected ingredientSummary(meal: PlannedMeal): string {
    const count = meal.ingredients.length;
    if (count === 0) return 'Add ingredients';
    return `${count} ${count === 1 ? 'ingredient' : 'ingredients'}`;
  }

  protected isRemoving(mealId: string): boolean {
    return this.removingIds().has(mealId);
  }

  protected async removeMeal(meal: PlannedMeal, slot: MealSlotDefinition): Promise<void> {
    if (this.isRemoving(meal.id)) return;

    this.setRemoving(meal.id, true);
    if (this.slotError()?.slot === slot.id) this.slotError.set(null);

    try {
      await this.mealPlan.removeMeal(meal.id);
    } catch {
      this.slotError.set({ slot: slot.id, message: `Couldn't remove ${meal.name}. Please try again.` });
    } finally {
      this.setRemoving(meal.id, false);
    }
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/meal-planner');
  }

  private openForm(target: MealFormTarget): void {
    if (this.saving()) return;

    this.formError.set(null);
    this.slotError.set(null);
    this.formTarget.set(target);
  }

  /**
   * Once a form closes, put focus back where the user was: the renamed meal,
   * or the slot's add button — so keyboard and screen reader users aren't
   * dropped at the top of the page.
   */
  private focusAfterForm(target: MealFormTarget): void {
    const slot = `[data-slot="${target.slot}"]`;
    const selector =
      target.mealId === null
        ? `${slot} [data-testid="add-meal"]`
        : `${slot} [data-meal-id="${target.mealId}"] [data-testid="edit-meal"]`;

    afterNextRender(
      () => {
        const element =
          this.host.nativeElement.querySelector<HTMLElement>(selector) ??
          this.host.nativeElement.querySelector<HTMLElement>(`${slot} [data-testid="add-meal"]`);
        element?.focus();
      },
      { injector: this.injector }
    );
  }

  private setRemoving(mealId: string, removing: boolean): void {
    this.removingIds.update((ids) => {
      const next = new Set(ids);
      if (removing) next.add(mealId);
      else next.delete(mealId);
      return next;
    });
  }
}
