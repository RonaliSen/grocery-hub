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
import { ActivatedRoute, ParamMap } from '@angular/router';
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
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryCategory, QuantityUnit } from '../models/pantry-item.model';
import { PantryDuplicateItemNameError, PantryStateService } from '../services/pantry-state.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';

@Component({
  selector: 'app-pantry-form-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    IonContent,
    IonIcon,
    IonToggle,
    ReactiveFormsModule,
  ],
  template: `
    <ion-content [fullscreen]="true" class="pantry-form-content">
      <div class="pantry-form-shell">
        <header class="pantry-form-header">
          <div class="pantry-form-header__inner">
            <button
              type="button"
              class="pantry-form-header__button pantry-form-header__button--secondary"
              (click)="goBack()"
              aria-label="Go back"
            >
              <ion-icon aria-hidden="true" [icon]="backIcon" />
            </button>

            <div class="pantry-form-header__text">
              <h1 class="pantry-form-header__title">Add/Edit Item</h1>
              <p class="pantry-form-header__subtitle">Create a pantry item</p>
            </div>

            <button
              type="button"
              class="pantry-form-header__button pantry-form-header__button--icon"
              aria-label="Scan item"
            >
              <ion-icon aria-hidden="true" [icon]="scanIcon" />
            </button>
          </div>
        </header>

        <main class="pantry-form-body">
          @if (missingItem()) {
            <app-empty-state-card
              eyebrow="Missing item"
              title="Item not found"
              message="This pantry item no longer exists, so there is nothing to edit."
              supportingText="Return to the pantry list to choose another item or create a new pantry entry."
              actionLabel="Back to pantry"
              [actionLink]="['/tabs/pantry']"
            />
          } @else {
            <form [formGroup]="form" class="pantry-form" (ngSubmit)="save()">
              <section class="pantry-hero">
                <img
                  src="https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=1400"
                  alt="Pantry organization"
                />
                <div class="pantry-hero__overlay"></div>
                <div class="pantry-hero__content">
                  <p class="pantry-hero__title">Essentials</p>
                  <p class="pantry-hero__subtitle">Freshness first</p>
                </div>
              </section>

              <section class="pantry-form-section">
                <div class="app-premium-field">
                  <label class="app-premium-label">Item Name</label>
                  <div class="pantry-input-icon-wrap">
                    <input
                      formControlName="name"
                      class="app-premium-input"
                      placeholder="e.g. Organic Avocados"
                      type="text"
                    />
                    <ion-icon aria-hidden="true" [icon]="editIcon" />
                  </div>
                  @if (showError('name')) {
                    <p class="app-error-text">{{ errorMessage('name') }}</p>
                  }
                </div>

                <div class="app-premium-field">
                  <label class="app-premium-label">Category</label>
                  <select formControlName="category" class="app-premium-select">
                    <option value="" disabled>Select a category</option>
                    @for (category of availableCategories(); track category) {
                      <option [value]="category">{{ categoryLabels[category] }}</option>
                    }
                  </select>
                </div>
              </section>

              <section class="pantry-form-grid">
                <div class="app-premium-field">
                  <label class="app-premium-label">Quantity</label>
                  <div class="pantry-stepper">
                    <button type="button" (click)="decrementQuantity()">
                      <ion-icon aria-hidden="true" [icon]="minusIcon" />
                    </button>
                    <span>{{ form.controls.quantity.value }}</span>
                    <button type="button" (click)="incrementQuantity()">
                      <ion-icon aria-hidden="true" [icon]="plusIcon" />
                    </button>
                  </div>
                </div>
                <div class="app-premium-field">
                  <label class="app-premium-label pantry-form-label-with-icon"> Expiry Date </label>
                  <div class="pantry-input-icon-wrap">
                    <input formControlName="expiryDate" class="app-premium-input" type="date" />
                    <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                  </div>
                </div>
              </section>

              <hr class="pantry-form-divider" />

              <section class="pantry-form-section">
                <div class="app-premium-field">
                  <label class="app-premium-label">Min. Threshold</label>
                  <input
                    formControlName="minQuantity"
                    class="app-premium-input"
                    placeholder="1"
                    type="number"
                  />
                </div>

                <section class="app-premium-toggle">
                  <div class="toggle-info">
                    <span class="toggle-label">German Store</span>
                    <span class="toggle-description"
                      >Show this item under the German Store shopping tab</span
                    >
                  </div>
                  <ion-toggle formControlName="germanStore" color="primary"></ion-toggle>
                </section>

                <section class="app-premium-toggle">
                  <div class="toggle-info">
                    <span class="toggle-label">Indian Store</span>
                    <span class="toggle-description"
                      >Show this item under the Indian Store shopping tab</span
                    >
                  </div>
                  <ion-toggle formControlName="indianStore" color="primary"></ion-toggle>
                </section>

                <section class="app-premium-toggle">
                  <div class="toggle-info">
                    <span class="toggle-label">Auto-add to shopping list</span>
                    <span class="toggle-description">When stock falls below threshold</span>
                  </div>
                  <ion-toggle formControlName="autoAddToShoppingList" color="primary"></ion-toggle>
                </section>

                <section class="app-premium-field">
                  <label class="app-premium-label">Notes</label>
                  <textarea
                    formControlName="notes"
                    class="app-premium-textarea"
                    placeholder="Add specific brands or preferences..."
                    rows="4"
                  ></textarea>
                </section>

                @if (itemId()) {
                  <button type="button" (click)="delete()" class="app-button--premium-outline pantry-delete">
                    <ion-icon aria-hidden="true" [icon]="deleteIcon" />
                    Delete Item
                  </button>
                }
              </section>

              <footer class="pantry-bottom-bar">
                <button
                  type="button"
                  class="app-button--premium-outline pantry-bottom-bar__button pantry-bottom-bar__button--cancel"
                  (click)="goBack()"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="form.invalid || isSaving()"
                  class="app-button--premium-primary pantry-bottom-bar__button pantry-bottom-bar__button--primary"
                >
                  {{ isSaving() ? 'Saving...' : 'Save' }}
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
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--app-background);
      }

      .pantry-form-content {
        --background: var(--app-background);
      }

      .pantry-form-shell {
        width: min(100%, 38rem);
        margin: 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: column;
      }

      .pantry-form-header {
        position: sticky;
        top: 0;
        z-index: 20;
        padding: calc(env(safe-area-inset-top, 0) + 0.75rem) 1rem 0.75rem;
        background: #f8f9ff;
        border-bottom: 1px solid #dce3db;
      }

      .pantry-form-header__inner {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr) 3rem;
        align-items: center;
        gap: 0.75rem;
      }

      .pantry-form-header__text {
        display: grid;
        text-align: left;
      }

      .pantry-form-header__title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: clamp(1.55rem, 5.4vw, 2rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.01em;
        color: #0a8f5b;
      }

      .pantry-form-header__subtitle {
        margin: 0.25rem 0 0;
        font-family: Inter, sans-serif;
        font-size: 0.9rem;
        line-height: 1.25;
        color: #3c4a42;
      }

      .pantry-form-header__button {
        width: 3rem;
        height: 3rem;
        border: none;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease,
          background-color 0.2s ease;
      }

      .pantry-form-header__button ion-icon {
        font-size: 1.35rem;
      }

      .pantry-form-header__button--secondary {
        background: transparent;
        color: #006c49;
      }

      .pantry-form-header__button--icon {
        background: transparent;
        color: #3c4a42;
      }

      .pantry-form-body {
        flex: 1;
        padding: 1rem;
      }

      .pantry-form {
        display: grid;
        gap: var(--app-space-5);
      }

      .pantry-form-section {
        display: grid;
        gap: 1.5rem;
      }

      .pantry-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .pantry-form-divider {
        margin: 0;
        border: 0;
        border-top: 1px solid rgba(60, 74, 66, 0.2);
      }

      .pantry-form-label-with-icon {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .pantry-form-label-with-icon ion-icon {
        font-size: 1rem;
        color: var(--app-text-secondary);
      }

      .app-premium-label {
        margin-left: 0.25rem;
        font-family: Inter, sans-serif;
        font-size: 0.75rem;
        line-height: 1;
        letter-spacing: 0.02em;
        font-weight: 600;
        color: #3c4a42;
      }

      .app-premium-input,
      .app-premium-select,
      .app-premium-textarea {
        width: 100%;
        min-height: 3.5rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(108, 122, 113, 0.3);
        background: #ffffff;
        box-shadow: none;
        color: #0b1c30;
        font-family: Inter, sans-serif;
        font-size: 1rem;
      }

      .app-premium-input::placeholder,
      .app-premium-textarea::placeholder {
        color: rgba(60, 74, 66, 0.5);
      }

      .app-premium-select {
        appearance: none;
        padding-right: 2.5rem;
        background-image:
          linear-gradient(45deg, transparent 50%, #6c7a71 50%),
          linear-gradient(135deg, #6c7a71 50%, transparent 50%);
        background-position:
          calc(100% - 18px) calc(50% - 2px),
          calc(100% - 12px) calc(50% - 2px);
        background-size:
          6px 6px,
          6px 6px;
        background-repeat: no-repeat;
      }

      .app-premium-textarea {
        min-height: 8rem;
        padding-block: 1rem;
      }

      .app-segmented-control {
        padding: 0.35rem;
        border-radius: 0.75rem;
        background: rgba(16, 185, 129, 0.08);
      }

      .app-segmented-control button {
        min-height: 2.75rem;
        border-radius: 0.6rem;
        font-size: 0.9rem;
      }

      .app-premium-toggle {
        gap: var(--app-space-4);
        padding: 1rem;
        border-radius: 0.75rem;
        background: #eff4ff;
        border-color: #d3e4fe;
      }

      .app-premium-toggle .toggle-info {
        gap: 0.25rem;
      }

      .app-premium-toggle .toggle-label {
        font-size: 1rem;
        color: #0b1c30;
      }

      .app-premium-toggle .toggle-description {
        font-size: 0.92rem;
      }

      .app-button--premium-primary,
      .app-button--premium-outline {
        min-height: 3.5rem;
        border-radius: 999px;
        font-size: 1rem;
      }

      .app-button--premium-primary:disabled {
        opacity: 0.6;
      }

      .pantry-hero {
        position: relative;
        border-radius: 1rem;
        overflow: hidden;
        height: clamp(9rem, 34vw, 13rem);
      }

      .pantry-hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pantry-hero__overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.48) 100%);
      }

      .pantry-hero__content {
        position: absolute;
        left: 1rem;
        bottom: 1rem;
      }

      .pantry-hero__title {
        margin: 0;
        color: #ffffff;
        font-family: 'Plus Jakarta Sans', Inter, sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .pantry-hero__subtitle {
        margin: 0.2rem 0 0;
        color: rgba(255, 255, 255, 0.82);
        font-family: Inter, sans-serif;
        font-size: 0.875rem;
      }

      .pantry-input-icon-wrap {
        position: relative;
      }

      .pantry-input-icon-wrap ion-icon {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: #6c7a71;
        font-size: 1.25rem;
        pointer-events: none;
      }

      .pantry-stepper {
        min-height: 3.5rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(108, 122, 113, 0.3);
        background: #ffffff;
        padding: 0.25rem;
        display: grid;
        align-items: center;
        grid-template-columns: 2.2rem minmax(0, 1fr) 2.2rem;
      }

      .pantry-stepper button {
        width: 2.2rem;
        height: 2.2rem;
        border: 0;
        border-radius: 0.7rem;
        background: #f0f2fb;
        color: #006c49;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .pantry-stepper span {
        text-align: center;
        font-family: 'Plus Jakarta Sans', Inter, sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #0b1c30;
      }

      .pantry-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .pantry-bottom-bar {
        background: #ffffff;
        border-top: 1px solid rgba(108, 122, 113, 0.2);
        width: 100%;
        margin-top: 0.25rem;
        padding-top: 0.75rem;
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 0.75rem;
      }

      .pantry-bottom-bar__button {
        width: 100%;
        min-height: 3.25rem;
        font-weight: 700;
      }

      .pantry-bottom-bar__button--primary {
        background: #006c49;
        color: #ffffff;
      }

      .pantry-bottom-bar__button--cancel {
        background: #ffffff;
        border: 1px solid rgba(108, 122, 113, 0.45);
        color: #274139;
      }

      .app-error-text {
        margin: 0;
        padding-inline: 0.125rem;
      }

      @media (max-width: 420px) {
        .pantry-form-body {
          padding-inline: 1rem;
        }

        .pantry-stepper {
          grid-template-columns: 2rem minmax(0, 1fr) 2rem;
        }

        .pantry-stepper button {
          width: 2rem;
          height: 2rem;
        }
      }

      @media (max-width: 360px) {
        .pantry-form-header__inner {
          grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
          gap: 0.625rem;
        }

        .pantry-form-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (min-width: 640px) {
        .pantry-form-body {
          padding-inline: 2rem;
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
