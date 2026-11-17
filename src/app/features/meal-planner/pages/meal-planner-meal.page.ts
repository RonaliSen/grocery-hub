import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  viewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addOutline, arrowBackOutline, chevronForwardOutline, copyOutline } from 'ionicons/icons';
import { map } from 'rxjs';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatQuantity } from '../../../core/utils/quantity.utils';
import { QuantityUnit } from '../../pantry/models/pantry-item.model';
import { IngredientFormComponent } from '../components/ingredient-form.component';
import { MealCopyPanelComponent, MealCopyTarget } from '../components/meal-copy-panel.component';
import { MEAL_SLOTS } from '../models/meal-slot.model';
import { MealIngredient, PlannedMeal } from '../models/planned-meal.model';
import { IngredientDraft, MealPlanStateService } from '../services/meal-plan-state.service';
import { describeRelativeDay, formatPlannerDate, parseDateOnly } from '../utils/meal-planner-week.util';

/** Same colour per slot as on the day page. */
const SLOT_TILES = { breakfast: 'var(--h-tile-3)', lunch: 'var(--h-tile-4)', dinner: 'var(--h-tile-1)' } as const;

/** One planned meal: its ingredients and how much of each is needed — add, edit and remove them. */
@Component({
  selector: 'app-meal-planner-meal-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IngredientFormComponent, IonContent, IonIcon, MealCopyPanelComponent, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="planner-content">
      <div class="planner-page">
        <header class="page-header">
          <button type="button" class="icon-btn" aria-label="Go back" (click)="goBack()">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>
          <div class="page-header__text">
            <h1>{{ meal()?.name ?? 'Meal Planner' }}</h1>
            <p>{{ subtitle() }}</p>
          </div>
          <span aria-hidden="true"></span>
        </header>

        @if (meal(); as meal) {
          <section class="ingredients" aria-labelledby="ingredients-title">
            <div class="section-title">
              <h2 id="ingredients-title">Ingredients</h2>
              @if (meal.ingredients.length > 0) {
                <p data-testid="ingredient-count">{{ countLabel() }}</p>
              }
            </div>

            @if (meal.ingredients.length > 0) {
              <ul class="ingredient-list" aria-labelledby="ingredients-title">
                @for (ingredient of meal.ingredients; track ingredient.id; let index = $index) {
                  @if (editingId() === ingredient.id) {
                    <li class="ingredient ingredient--editing" [attr.data-ingredient-id]="ingredient.id">
                      <app-ingredient-form
                        mode="edit"
                        [idPrefix]="'edit-' + ingredient.id"
                        [initial]="ingredient"
                        [busy]="busy()"
                        [error]="formError()"
                        (save)="saveEdit(ingredient, $event)"
                        (remove)="removeIngredient(ingredient)"
                        (cancelled)="closeEditor()"
                      />
                    </li>
                  } @else {
                    <li class="ingredient" [attr.data-ingredient-id]="ingredient.id">
                      <button
                        type="button"
                        class="ingredient__row"
                        data-testid="edit-ingredient"
                        [attr.aria-label]="'Edit ' + ingredient.name + ', ' + amountLabel(ingredient)"
                        (click)="openEdit(ingredient)"
                      >
                        <span class="ingredient__badge" [style.--tile]="tileColor(index)" aria-hidden="true">
                          {{ initialOf(ingredient) }}
                        </span>
                        <span class="ingredient__name">{{ ingredient.name }}</span>
                        <span class="ingredient__amount">
                          <strong>{{ ingredient.quantity }}</strong>
                          <small>{{ ingredient.unit }}</small>
                        </span>
                        <ion-icon class="ingredient__chevron" aria-hidden="true" [icon]="editIcon" />
                      </button>
                    </li>
                  }
                }
              </ul>
            }

            @if (isAdding()) {
              <div class="add-card">
                <p class="add-card__title">New ingredient</p>
                <app-ingredient-form
                  #addForm
                  idPrefix="ingredient"
                  [defaultUnit]="lastUnit()"
                  [busy]="busy()"
                  [error]="formError()"
                  (save)="saveNew($event)"
                  (cancelled)="closeEditor()"
                />
              </div>
            } @else if (meal.ingredients.length === 0) {
              <div class="empty-ingredients" data-testid="no-ingredients">
                <span class="empty-ingredients__emoji" [style.--tile]="slotTile()" aria-hidden="true">🧺</span>
                <p class="empty-ingredients__title">No ingredients yet</p>
                <p class="empty-ingredients__text">List what you need for this meal, and how much.</p>
                <button type="button" class="add-btn" data-testid="open-add-ingredient" (click)="openAdd()">
                  <ion-icon aria-hidden="true" [icon]="addIcon" />
                  Add ingredient
                </button>
              </div>
            } @else {
              <button type="button" class="add-row" data-testid="open-add-ingredient" (click)="openAdd()">
                <span class="add-row__icon" aria-hidden="true"><ion-icon [icon]="addIcon" /></span>
                Add ingredient
              </button>
            }

          </section>

          <section class="copy-section" aria-label="Copy this meal">
            @if (copying()) {
              <div class="copy-card">
                <app-meal-copy-panel
                  [meal]="meal"
                  [busy]="busy()"
                  [error]="copyError()"
                  (copy)="copyMeal($event)"
                  (cancelled)="closeCopy()"
                />
              </div>
            } @else {
              <button type="button" class="copy-row" data-testid="open-copy" (click)="openCopy()">
                <span class="copy-row__icon" aria-hidden="true"><ion-icon [icon]="copyIcon" /></span>
                <span class="copy-row__text">
                  <span class="copy-row__title">Copy to another day</span>
                  <span class="copy-row__hint">With all {{ meal.ingredients.length === 1 ? '1 ingredient' : meal.ingredients.length + ' ingredients' }}</span>
                </span>
                <ion-icon class="copy-row__chevron" aria-hidden="true" [icon]="editIcon" />
              </button>
            }

            @if (copied(); as copied) {
              <div class="copied" role="status" data-testid="copied">
                <span class="copied__check" aria-hidden="true">✓</span>
                <span class="copied__text">Copied to <strong>{{ copiedLabel() }}</strong></span>
                <a
                  class="copied__open"
                  data-testid="open-copied-meal"
                  [routerLink]="['/tabs/meal-planner', copied.date, 'meals', copied.id]"
                >
                  Open copy
                </a>
              </div>
            }
          </section>

          <p class="visually-hidden" aria-live="polite">{{ announcement() }}</p>
        } @else {
          <section class="empty-card" data-testid="meal-not-found">
            <span class="empty-emoji" aria-hidden="true">🍽️</span>
            <h2>This meal isn't in your plan</h2>
            <p>It may have been removed. Pick a meal from the day instead.</p>
            <a class="empty-action" [routerLink]="dayLink()">Back to {{ dayLinkLabel() }}</a>
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      @use '../styles/meal-planner-shared' as shared;

      /* Meal Planner meal — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss); fields follow the Expiry restock sheet. */
      @include shared.page-layout;
      @include shared.page-header;
      @include shared.empty-card;

      /* The meal name is this page's title: wrap to two lines rather than cut it short. */
      .page-header__text h1 {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        white-space: normal;
        overflow-wrap: anywhere;
        font-size: 1.15rem;
        line-height: 1.2;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* ---------------- Section title ---------------- */

      /* minmax(0, …): never let a wide child (e.g. the editor's buttons) widen the page. */
      .ingredients {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }

      .section-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 4px 0;
      }

      .section-title h2 {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .section-title p {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      /* ---------------- Ingredient list: one card, hairline rows ---------------- */

      .ingredient-list {
        margin: 0;
        padding: 6px;
        list-style: none;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .ingredient {
        position: relative;
      }

      /* Hairline between rows, inset past the badge. */
      .ingredient + .ingredient::before {
        content: '';
        position: absolute;
        top: 0;
        left: 62px;
        right: 14px;
        height: 1px;
        background: var(--h-line);
      }

      .ingredient__row {
        width: 100%;
        min-height: 60px;
        padding: 8px 10px 8px 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        border: none;
        border-radius: 20px;
        background: transparent;
        color: var(--h-ink);
        text-align: left;
        transition: background-color 160ms ease, transform 120ms ease;
      }

      .ingredient__row:active {
        background: var(--h-canvas);
        transform: scale(0.99);
      }

      .ingredient__row:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: -3px;
      }

      .ingredient__badge {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--tile, var(--h-tile-5));
        color: var(--h-ink);
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .ingredient__name {
        flex: 1;
        min-width: 0;
        font-size: 0.98rem;
        font-weight: 700;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .ingredient__amount {
        flex-shrink: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 3px;
        white-space: nowrap;
      }

      .ingredient__amount strong {
        font-family: var(--h-display);
        font-size: 1.05rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--h-ink);
      }

      .ingredient__amount small {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      .ingredient__chevron {
        font-size: 16px;
        color: var(--h-muted);
        opacity: 0.7;
      }

      /* The row being edited opens up into the form. */
      .ingredient--editing {
        margin: 4px 0;
        padding: 14px;
        border-radius: 20px;
        background: var(--h-canvas);
        box-shadow: inset 0 0 0 1.5px var(--h-accent);
      }

      .ingredient--editing::before,
      .ingredient--editing + .ingredient::before {
        display: none;
      }

      /* ---------------- Adding ---------------- */

      .add-row {
        min-height: 56px;
        padding: 0 16px 0 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1.5px dashed color-mix(in srgb, var(--h-muted) 45%, transparent);
        border-radius: 22px;
        background: transparent;
        color: var(--h-ink-soft);
        font-size: 0.92rem;
        font-weight: 800;
        transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease;
      }

      .add-row__icon {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 18px;
      }

      .add-row:active {
        background: var(--h-surface);
      }

      .add-card {
        display: grid;
        gap: 14px;
        padding: 16px;
        border-radius: 26px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
        box-shadow: var(--h-shadow), inset 0 0 0 1.5px var(--h-accent);
      }

      .add-card__title {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .empty-ingredients {
        display: grid;
        justify-items: center;
        gap: 6px;
        padding: 28px 20px 22px;
        border-radius: 26px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
        box-shadow: var(--h-shadow);
        text-align: center;
      }

      .empty-ingredients__emoji {
        width: 60px;
        height: 60px;
        margin-bottom: 6px;
        border-radius: 20px;
        display: grid;
        place-items: center;
        background: var(--tile, var(--h-tile-3));
        font-size: 1.8rem;
        transform: rotate(-6deg);
      }

      .empty-ingredients__title {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--h-ink);
      }

      .empty-ingredients__text {
        max-width: 30ch;
        margin: 0 0 10px;
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      .add-btn {
        min-height: 46px;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: none;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.9rem;
        font-weight: 800;
        transition: transform 140ms ease;
      }

      .add-btn ion-icon {
        font-size: 18px;
      }

      .add-btn:active {
        transform: scale(0.97);
      }

      .add-row:focus-visible,
      .add-btn:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      @media (hover: hover) {
        .ingredient__row:hover {
          background: var(--h-canvas);
        }

        .ingredient__row:hover .ingredient__chevron {
          color: var(--h-accent);
          opacity: 1;
        }

        .add-row:hover {
          border-color: var(--h-accent);
          color: var(--h-ink);
        }
      }

      /* ---------------- Copy ---------------- */

      .copy-section {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        margin-top: 6px;
      }

      .copy-row {
        min-height: 64px;
        padding: 10px 14px 10px 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid var(--h-line);
        border-radius: 22px;
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        color: var(--h-ink);
        text-align: left;
        transition: transform 140ms ease;
      }

      .copy-row:active {
        transform: scale(0.99);
      }

      .copy-row:focus-visible,
      .copied__open:focus-visible {
        outline: 3px solid var(--h-accent);
        outline-offset: 2px;
      }

      .copy-row__icon {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 19px;
      }

      .copy-row__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .copy-row__title {
        font-family: var(--h-display);
        font-size: 0.98rem;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .copy-row__hint {
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .copy-row__chevron {
        font-size: 16px;
        color: var(--h-muted);
      }

      .copy-card {
        padding: 16px;
        border-radius: 26px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
        box-shadow: var(--h-shadow), inset 0 0 0 1.5px var(--h-lilac);
      }

      .copied {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 10px 10px 12px;
        border-radius: 18px;
        background: color-mix(in srgb, var(--h-ok) 14%, var(--h-surface));
        color: var(--h-ink);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .copied__check {
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-ok);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 800;
      }

      .copied__text {
        flex: 1;
        min-width: 0;
      }

      .copied__open {
        flex-shrink: 0;
        min-height: 36px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.8rem;
        font-weight: 800;
      }

      @media (hover: hover) {
        .copy-row:hover .copy-row__chevron {
          color: var(--h-accent);
        }
      }

      @include shared.reduced-motion;
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MealPlannerMealPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly mealPlan = inject(MealPlanStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly addIcon = addOutline;
  protected readonly backIcon = arrowBackOutline;
  protected readonly editIcon = chevronForwardOutline;
  protected readonly copyIcon = copyOutline;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly routeDate = computed(() => this.params().get('date'));
  private readonly mealId = computed(() => this.params().get('mealId'));

  /** Re-read on every visit: Ionic keeps this page alive, and "today" moves on. */
  private readonly today = signal(new Date());

  protected readonly meal = computed(() => this.mealPlan.getMeal(this.mealId()));

  /** The meal's own day (or the route's, if the meal is gone and that date is valid). */
  private readonly date = computed(() => {
    const date = this.meal()?.date ?? this.routeDate();
    return parseDateOnly(date) ? date : null;
  });

  protected readonly dayLink = computed(() => {
    const date = this.date();
    return date ? ['/tabs/meal-planner', date] : ['/tabs/meal-planner'];
  });

  protected readonly dayLinkLabel = computed(() => {
    const day = parseDateOnly(this.date());
    return day ? day.toLocaleDateString(undefined, { weekday: 'long' }) : 'Meal Planner';
  });

  protected readonly slotTile = computed(() => SLOT_TILES[this.meal()?.slot ?? 'dinner']);

  protected readonly subtitle = computed(() => {
    const meal = this.meal();
    const day = parseDateOnly(meal?.date);
    if (!meal || !day) return 'Meal not found';

    const slot = MEAL_SLOTS.find((candidate) => candidate.id === meal.slot)?.label ?? '';
    const when = describeRelativeDay(day, this.today()) ?? day.toLocaleDateString(undefined, { weekday: 'long' });
    return `${slot} · ${when}, ${formatPlannerDate(day)}`;
  });

  // ---- Editor: adding (ingredientId null) or editing one ingredient; one at a time ----
  private readonly editor = linkedSignal<string | null, { ingredientId: string | null } | null>({
    source: this.mealId,
    computation: () => null
  });

  /** The open editor — dropped if the ingredient being edited no longer exists. */
  protected readonly activeEditor = computed(() => {
    const editor = this.editor();
    const meal = this.meal();
    if (!editor || !meal) return null;
    if (editor.ingredientId && !meal.ingredients.some((ingredient) => ingredient.id === editor.ingredientId)) {
      return null;
    }
    return editor;
  });

  /**
   * Explicit flags for the template. (In Angular templates `a()?.b` is null —
   * not undefined — when `a()` is null, so "ingredientId === null" can't tell
   * "adding" apart from "nothing open" there.)
   */
  protected readonly isAdding = computed(() => {
    const editor = this.activeEditor();
    return editor !== null && editor.ingredientId === null;
  });
  protected readonly editingId = computed(() => this.activeEditor()?.ingredientId ?? null);

  /** Unit for the next new ingredient: the one used last. */
  protected readonly lastUnit = signal<QuantityUnit>('count');
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** Read out by screen readers after adding, changing or removing. */
  protected readonly announcement = signal('');

  protected readonly countLabel = computed(() => {
    const count = this.meal()?.ingredients.length ?? 0;
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  });

  private readonly addForm = viewChild<IngredientFormComponent>('addForm');

  // ---- Copy to another day ----
  protected readonly copying = linkedSignal<string | null, boolean>({ source: this.mealId, computation: () => false });
  protected readonly copyError = signal<string | null>(null);
  /** The last copy made from this page, for the confirmation. */
  protected readonly copied = linkedSignal<string | null, PlannedMeal | null>({
    source: this.mealId,
    computation: () => null
  });
  protected readonly copiedLabel = computed(() => {
    const copied = this.copied();
    const day = parseDateOnly(copied?.date);
    if (!copied || !day) return '';

    const slot = MEAL_SLOTS.find((candidate) => candidate.id === copied.slot)?.label ?? '';
    return `${day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} · ${slot}`;
  });

  ionViewWillEnter(): void {
    this.today.set(new Date());
  }

  protected openAdd(): void {
    this.openEditor(null);
  }

  protected openEdit(ingredient: MealIngredient): void {
    this.openEditor(ingredient.id);
  }

  protected closeEditor(): void {
    const editor = this.activeEditor();
    if (this.busy()) return;

    this.editor.set(null);
    this.formError.set(null);
    this.restoreFocus(
      editor?.ingredientId
        ? `[data-ingredient-id="${editor.ingredientId}"] [data-testid="edit-ingredient"]`
        : '[data-testid="open-add-ingredient"]'
    );
  }

  protected openCopy(): void {
    if (this.busy()) return;

    // One panel at a time.
    this.editor.set(null);
    this.formError.set(null);
    this.copyError.set(null);
    this.copied.set(null);
    this.copying.set(true);
  }

  protected closeCopy(): void {
    if (this.busy()) return;

    this.copying.set(false);
    this.copyError.set(null);
    this.restoreFocus('[data-testid="open-copy"]');
  }

  /** Copies this meal (with its ingredients) to the chosen day and slot; this meal is unchanged. */
  protected async copyMeal(target: MealCopyTarget): Promise<void> {
    const meal = this.meal();
    if (!meal || this.busy()) return;

    this.busy.set(true);
    this.copyError.set(null);

    try {
      const copy = await this.mealPlan.copyMeal(meal.id, target.date, target.slot);
      this.busy.set(false);

      if (copy) {
        this.copying.set(false);
        this.copied.set(copy);
        this.announcement.set(`Copied ${copy.name} to ${this.copiedLabel()}`);
        this.restoreFocus('[data-testid="open-copied-meal"]');
      }
    } catch {
      this.busy.set(false);
      this.copyError.set("Couldn't copy this meal. Please try again.");
    }
  }

  /** Adds the new ingredient and keeps the form open, cleared, for the next one. */
  protected async saveNew(draft: IngredientDraft): Promise<void> {
    const meal = this.meal();
    if (!meal || this.busy()) return;

    this.busy.set(true);
    this.formError.set(null);

    try {
      const added = await this.mealPlan.addIngredient(meal.id, draft);
      if (added) {
        this.lastUnit.set(added.unit);
        this.announcement.set(`Added ${formatQuantity(added.quantity, added.unit)} ${added.name}`);
        this.busy.set(false);
        this.addForm()?.reset();
      }
    } catch {
      this.formError.set("Couldn't add this ingredient. Please try again.");
    } finally {
      this.busy.set(false);
    }
  }

  /** Saves changes to one ingredient; the others are untouched. */
  protected async saveEdit(ingredient: MealIngredient, draft: IngredientDraft): Promise<void> {
    const meal = this.meal();
    if (!meal || this.busy()) return;

    this.busy.set(true);
    this.formError.set(null);

    try {
      const updated = await this.mealPlan.updateIngredient(meal.id, ingredient.id, draft);
      this.busy.set(false);
      if (updated) {
        this.announcement.set(`Updated ${updated.name}, ${formatQuantity(updated.quantity, updated.unit)}`);
      }
      this.closeEditor();
    } catch {
      this.busy.set(false);
      this.formError.set("Couldn't save your changes. Please try again.");
    }
  }

  protected async removeIngredient(ingredient: MealIngredient): Promise<void> {
    const meal = this.meal();
    if (!meal || this.busy()) return;

    const index = meal.ingredients.findIndex((candidate) => candidate.id === ingredient.id);
    const neighbour = meal.ingredients[index + 1] ?? meal.ingredients[index - 1] ?? null;

    this.busy.set(true);
    this.formError.set(null);

    try {
      await this.mealPlan.removeIngredient(meal.id, ingredient.id);
      this.busy.set(false);
      this.editor.set(null);
      this.announcement.set(`Removed ${ingredient.name}`);
      // Focus moves to the next row (or the add button), not the top of the page.
      this.restoreFocus(
        neighbour
          ? `[data-ingredient-id="${neighbour.id}"] [data-testid="edit-ingredient"]`
          : '[data-testid="open-add-ingredient"]'
      );
    } catch {
      this.busy.set(false);
      this.formError.set(`Couldn't remove ${ingredient.name}. Please try again.`);
    }
  }

  /** e.g. "200 g". */
  protected amountLabel(ingredient: MealIngredient): string {
    return formatQuantity(ingredient.quantity, ingredient.unit);
  }

  protected initialOf(ingredient: MealIngredient): string {
    return Array.from(ingredient.name)[0] ?? '';
  }

  /** Pastel tile colour (one of six theme tokens) for the row at `index`. */
  protected tileColor(index: number): string {
    return `var(--h-tile-${(index % 6) + 1})`;
  }

  protected goBack(): void {
    const date = this.date();
    void this.navigationHistory.back(date ? `/tabs/meal-planner/${date}` : '/tabs/meal-planner');
  }

  private openEditor(ingredientId: string | null): void {
    if (this.busy()) return;

    this.copying.set(false);
    this.copyError.set(null);
    this.formError.set(null);
    this.editor.set({ ingredientId });
  }

  private restoreFocus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector
    });
  }
}
