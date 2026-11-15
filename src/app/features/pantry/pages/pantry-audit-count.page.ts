import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { PantryAuditDifferenceComponent } from '../components/pantry-audit-difference.component';
import { PantryAuditFooterComponent } from '../components/pantry-audit-footer.component';
import { PantryAuditHeaderComponent } from '../components/pantry-audit-header.component';
import {
  PantryAuditCountEntry,
  PantryAuditSessionService
} from '../services/pantry-audit-session.service';
import { PantryStateService } from '../services/pantry-state.service';

const AUDIT_SELECTION_ROUTE = '/tabs/pantry/audit/select';
const AUDIT_REVIEW_ROUTE = '/tabs/pantry/audit/review';

const ERROR_MESSAGES = {
  negative: 'Quantity can’t be negative.',
  'not-a-number': 'Enter a number, like 2 or 1.5.'
} as const;

@Component({
  selector: 'app-pantry-audit-count-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    IonContent,
    PantryAuditDifferenceComponent,
    PantryAuditFooterComponent,
    PantryAuditHeaderComponent,
    QuantityLabelPipe
  ],
  template: `
    <ion-content [fullscreen]="true" class="audit-content">
      <div class="audit-shell">
        <app-pantry-audit-header
          title="Count Items"
          subtitle="Enter how much you actually have"
          backLabel="Back to item selection"
          (back)="goBack()"
        />

        <main class="audit-body">
          @if (!pantryState.loaded()) {
            <p class="audit-loading" role="status">Loading your pantry…</p>
          } @else if (session.countEntries().length === 0) {
            <app-empty-state-card
              eyebrow="Nothing to count"
              title="No items selected"
              message="Choose which pantry items to include in your audit before entering counts."
              actionLabel="Select items"
              [actionLink]="['/tabs/pantry/audit/select']"
            />
          } @else {
            <ul class="count-list" aria-label="Items to count">
              @for (entry of session.countEntries(); track entry.item.id) {
                <li class="count-card" data-testid="audit-count-item" [class.has-error]="entry.input.status === 'invalid'">
                  <h2 class="count-card__name">{{ entry.item.name }}</h2>

                  <div class="count-card__fields">
                    <div class="count-field">
                      <span class="count-field__label">Saved</span>
                      <span class="count-field__saved" data-testid="audit-saved-quantity">
                        {{ entry.item.quantity | quantityLabel: entry.item.unit }}
                      </span>
                    </div>

                    <div class="count-field">
                      <label class="count-field__label" [for]="inputId(entry)">Actual</label>
                      <div class="count-input">
                        <input
                          [id]="inputId(entry)"
                          class="count-input__control"
                          data-testid="audit-actual-input"
                          type="text"
                          inputmode="decimal"
                          autocomplete="off"
                          placeholder="Enter"
                          [value]="entry.rawInput"
                          [attr.aria-invalid]="entry.input.status === 'invalid'"
                          [attr.aria-describedby]="entry.input.status === 'invalid' ? errorId(entry) : null"
                          (keydown)="preventNegativeSign($event)"
                          (input)="onCountInput(entry, $event)"
                        />
                        <span class="count-input__unit" aria-hidden="true">{{ entry.item.unit }}</span>
                      </div>
                    </div>
                  </div>

                  @if (entry.input.status === 'invalid') {
                    <p class="count-card__error" [id]="errorId(entry)" role="alert">
                      {{ errorMessages[entry.input.reason] }}
                    </p>
                  }

                  <div class="count-card__difference">
                    <span class="count-field__label">Difference</span>
                    <app-pantry-audit-difference
                      [difference]="entry.difference"
                      [unit]="entry.item.unit"
                      [emptyLabel]="entry.input.status === 'invalid' ? '—' : 'Not counted yet'"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        </main>
      </div>
    </ion-content>

    @if (pantryState.loaded() && session.countEntries().length > 0) {
      <app-pantry-audit-footer
        [count]="session.countedCount()"
        [total]="session.countEntries().length"
        label="counted"
        [hint]="continueHint()"
        [canContinue]="session.allCounted()"
        (continue)="continue()"
      />
    }
  `,
  styles: [
    `
      :host {
        --audit-danger-text: color-mix(in srgb, var(--ion-color-danger) 70%, var(--app-ink));

        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--app-background);
      }

      .audit-content {
        --background: var(--app-background);
        flex: 1;
      }

      .audit-shell {
        width: min(100%, 38rem);
        margin: 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: column;
      }

      .audit-body {
        flex: 1;
        padding: 1rem 1rem 1.5rem;
      }

      .audit-loading {
        margin: 0;
        padding: 2rem 0;
        text-align: center;
        color: var(--app-text-muted);
      }

      .count-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.75rem;
      }

      .count-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        background: var(--app-surface);
      }

      .count-card.has-error {
        border-color: var(--ion-color-danger);
      }

      .count-card__name {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .count-card__fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
        gap: 0.75rem;
        align-items: end;
      }

      .count-field {
        display: grid;
        gap: 0.3rem;
      }

      .count-field__label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--app-text-muted);
      }

      .count-field__saved {
        min-height: 2.75rem;
        display: flex;
        align-items: center;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--app-text-secondary);
      }

      .count-input {
        position: relative;
      }

      .count-input__control {
        width: 100%;
        min-height: 2.75rem;
        padding: 0 3.25rem 0 0.85rem;
        border: 1px solid var(--app-border-strong);
        border-radius: 0.75rem;
        background: var(--app-background);
        color: var(--app-ink);
        font-size: 1.05rem;
        font-weight: 700;
      }

      .count-input__control::placeholder {
        font-weight: 500;
        color: var(--app-text-muted);
        opacity: 0.75;
      }

      .count-card.has-error .count-input__control {
        border-color: var(--ion-color-danger);
      }

      .count-input__unit {
        position: absolute;
        right: 0.85rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--app-text-muted);
        pointer-events: none;
      }

      .count-card__error {
        margin: -0.35rem 0 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--audit-danger-text);
      }

      .count-card__difference {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--app-border);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryAuditCountPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly pantryState = inject(PantryStateService);
  protected readonly session = inject(PantryAuditSessionService);
  protected readonly errorMessages = ERROR_MESSAGES;
  /** Explains why Continue is disabled, e.g. "1 invalid · 2 still to count". */
  protected readonly continueHint = computed(() => {
    const invalid = this.session.invalidCount();
    const missing = this.session.missingCount();

    if (invalid > 0 && missing > 0) {
      return `${invalid} invalid · ${missing} still to count`;
    }
    if (invalid > 0) {
      return `${invalid} invalid ${invalid === 1 ? 'quantity' : 'quantities'}`;
    }
    if (missing > 0) {
      return `${missing} still to count`;
    }
    return null;
  });

  constructor() {
    void this.pantryState.load();
  }

  protected inputId(entry: PantryAuditCountEntry): string {
    return `audit-count-${entry.item.id}`;
  }

  protected errorId(entry: PantryAuditCountEntry): string {
    return `audit-count-error-${entry.item.id}`;
  }

  /** Quantities can't be negative, so don't let a minus sign be typed at all. */
  protected preventNegativeSign(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'Subtract') {
      event.preventDefault();
    }
  }

  protected onCountInput(entry: PantryAuditCountEntry, event: Event): void {
    this.session.setCountInput(entry.item.id, (event.target as HTMLInputElement).value);
  }

  protected continue(): void {
    if (!this.session.allCounted()) {
      return;
    }

    void this.router.navigateByUrl(AUDIT_REVIEW_ROUTE);
  }

  protected goBack(): void {
    void this.navigationHistory.back(AUDIT_SELECTION_ROUTE);
  }
}
