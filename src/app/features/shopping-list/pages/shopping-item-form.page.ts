import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { QUANTITY_UNITS, QuantityUnit } from '../../pantry/models/pantry-item.model';
import { ShoppingListStateService } from '../services/shopping-list-state.service';

@Component({
  selector: 'app-shopping-item-form-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <app-page-header
      [title]="itemId() ? 'Edit shopping item' : 'New shopping item'"
      [showBackButton]="true"
      backHref="/tabs/shopping-list"
    />

    <ion-content [fullscreen]="true">
      <div class="app-page-shell">
        @if (missingItem()) {
          <app-empty-state-card
            eyebrow="Missing item"
            title="Shopping item not found"
            message="This shopping item no longer exists, so there is nothing to edit."
            supportingText="Return to the list to edit another item or create a new one."
            actionLabel="Back to list"
            [actionLink]="['/tabs/shopping-list']"
          />
        } @else {
          <form class="app-form-card" [formGroup]="form" (ngSubmit)="save()">
            <section class="form-intro">
              <p class="app-eyebrow">{{ itemId() ? 'Update list item' : 'Add shopping item' }}</p>
              <h1 class="app-hero-title">{{ itemId() ? 'Edit shopping details' : 'Capture the next thing to buy' }}</h1>
              <p class="app-body-copy">
                Keep shopping entries short and readable so they are easy to scan one-handed in the store.
              </p>
            </section>

            <div class="app-field-stack">
              <ion-item class="app-item-field">
                <ion-label position="stacked">Name</ion-label>
                <ion-input formControlName="name" placeholder="Eggs, yogurt, rice..." />
              </ion-item>
              @if (showError('name')) {
                <p class="app-error-text">{{ errorMessage('name') }}</p>
              }
            </div>

            <div class="app-form-grid">
              <div class="app-field-stack">
                <ion-item class="app-item-field">
                  <ion-label position="stacked">Quantity</ion-label>
                  <ion-input type="number" inputmode="decimal" formControlName="quantity" />
                </ion-item>
                <p class="app-helper-text">Use a rough amount when you only need a quick reminder.</p>
              </div>

              <div class="app-field-stack">
                <ion-item class="app-item-field">
                  <ion-label position="stacked">Unit</ion-label>
                  <ion-select interface="popover" formControlName="unit">
                    <ion-select-option [value]="null">None</ion-select-option>
                    @for (unit of units; track unit) {
                      <ion-select-option [value]="unit">{{ unit }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              </div>
            </div>

            <div class="app-form-actions">
              <ion-button expand="block" type="submit" [disabled]="form.invalid || isSaving()">
                {{ isSaving() ? 'Saving...' : itemId() ? 'Save changes' : 'Create item' }}
              </ion-button>
              <a class="app-button app-button--ghost" [routerLink]="['/tabs/shopping-list']">Back to list</a>
            </div>
          </form>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .form-intro {
        display: grid;
        gap: var(--app-space-3);
      }

      @media (max-width: 520px) {
        .app-form-actions {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingItemFormPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly navigationHistory = inject(NavigationHistoryService);

  protected readonly units = QUANTITY_UNITS;
  protected readonly submitted = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly itemId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('itemId'))),
    { initialValue: this.route.snapshot.paramMap.get('itemId') }
  );
  protected readonly existingItem = computed(() => this.shoppingState.getById(this.itemId()));
  protected readonly missingItem = computed(() => !!this.itemId() && !this.existingItem());

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    quantity: this.formBuilder.control<number | null>(1, [Validators.required, Validators.min(0)]),
    unit: this.formBuilder.control<QuantityUnit | null>('count')
  });

  constructor() {
    effect(() => {
      const existingItem = this.shoppingState.getById(this.itemId());
      if (!existingItem) {
        return;
      }

      this.form.patchValue(
        {
          name: existingItem.name,
          quantity: existingItem.quantity,
          unit: existingItem.unit
        },
        { emitEvent: false }
      );
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

    return 'Check this field and try again.';
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

      await this.shoppingState.save(
        {
          name: rawValue.name.trim(),
          quantity: Math.max(Number(rawValue.quantity ?? 1), 0),
          unit: rawValue.unit,
          linkedPantryItemId: existingItem?.linkedPantryItemId ?? null,
          source: existingItem?.source ?? 'manual',
          germanStore: existingItem?.germanStore ?? false,
          indianStore: existingItem?.indianStore ?? false
        },
        this.itemId()
      );

      await this.navigationHistory.back('/tabs/shopping-list');
    } finally {
      this.isSaving.set(false);
    }
  }
}
