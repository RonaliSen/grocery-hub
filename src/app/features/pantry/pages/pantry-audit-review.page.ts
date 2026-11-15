import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { checkmarkDoneOutline, createOutline } from 'ionicons/icons';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { PantryAuditDifferenceComponent } from '../components/pantry-audit-difference.component';
import { PantryAuditHeaderComponent } from '../components/pantry-audit-header.component';
import {
  PantryAuditCountEntry,
  PantryAuditSessionService
} from '../services/pantry-audit-session.service';
import { PantryStateService } from '../services/pantry-state.service';

const AUDIT_COUNT_ROUTE = '/tabs/pantry/audit/count';
const PANTRY_ROUTE = '/tabs/pantry';

/** What the review screen displays. */
interface ReviewView {
  readonly entries: readonly PantryAuditCountEntry[];
  readonly adjustments: readonly PantryAuditCountEntry[];
  readonly unchanged: readonly PantryAuditCountEntry[];
  readonly allCounted: boolean;
}

export function auditUpdateMessage(updatedCount: number): string {
  if (updatedCount === 0) {
    return 'Audit complete. Your pantry was already up to date.';
  }

  return `Pantry updated: ${updatedCount} ${updatedCount === 1 ? 'item' : 'items'} adjusted.`;
}

@Component({
  selector: 'app-pantry-audit-review-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    IonContent,
    IonIcon,
    NgTemplateOutlet,
    PantryAuditDifferenceComponent,
    PantryAuditHeaderComponent,
    QuantityLabelPipe
  ],
  template: `
    <ion-content [fullscreen]="true" class="audit-content">
      <div class="audit-shell">
        <app-pantry-audit-header
          title="Review Adjustments"
          subtitle="Check what will change before updating"
          backLabel="Back to counts"
          (back)="goBack()"
        />

        <main class="audit-body">
          @if (!pantryState.loaded()) {
            <p class="audit-loading" role="status">Loading your pantry…</p>
          } @else if (view().entries.length === 0) {
            <app-empty-state-card
              eyebrow="Nothing to review"
              title="No items selected"
              message="Choose which pantry items to include in your audit, then count them."
              actionLabel="Select items"
              [actionLink]="['/tabs/pantry/audit/select']"
            />
          } @else if (!view().allCounted) {
            <app-empty-state-card
              eyebrow="Not ready to review"
              title="Some quantities still need attention"
              message="Enter a valid actual quantity for every selected item before reviewing."
              actionLabel="Back to counts"
              [actionLink]="['/tabs/pantry/audit/count']"
            />
          } @else {
            <section class="review-summary" aria-label="Audit summary">
              <div class="review-summary__stats">
                <div class="summary-stat summary-stat--adjust" data-testid="audit-adjustment-count">
                  <span class="summary-stat__value">{{ view().adjustments.length }}</span>
                  <span class="summary-stat__label">
                    {{ view().adjustments.length === 1 ? 'Needs adjustment' : 'Need adjustment' }}
                  </span>
                </div>
                <div class="summary-stat" data-testid="audit-unchanged-count">
                  <span class="summary-stat__value">{{ view().unchanged.length }}</span>
                  <span class="summary-stat__label">Unchanged</span>
                </div>
              </div>
              <p class="review-summary__caption">
                {{ view().entries.length }} {{ view().entries.length === 1 ? 'item' : 'items' }}
                reviewed. Nothing in your pantry has been changed yet.
              </p>
            </section>

            <section class="review-section" data-testid="audit-adjustments-section" aria-labelledby="adjust-title">
              <h2 id="adjust-title" class="review-section__title">Needs adjustment</h2>
              @if (view().adjustments.length === 0) {
                <p class="review-section__empty">
                  Everything matches what’s saved — no adjustments needed.
                </p>
              } @else {
                <ul class="review-list">
                  @for (entry of view().adjustments; track entry.item.id) {
                    <ng-container *ngTemplateOutlet="row; context: { $implicit: entry }" />
                  }
                </ul>
              }
            </section>

            @if (view().unchanged.length > 0) {
              <section class="review-section" data-testid="audit-unchanged-section" aria-labelledby="unchanged-title">
                <h2 id="unchanged-title" class="review-section__title">Unchanged</h2>
                <ul class="review-list">
                  @for (entry of view().unchanged; track entry.item.id) {
                    <ng-container *ngTemplateOutlet="row; context: { $implicit: entry }" />
                  }
                </ul>
              </section>
            }

            <button
              type="button"
              class="app-button--premium-outline review-edit-button"
              data-testid="audit-edit-quantities"
              (click)="goBack()"
            >
              <ion-icon aria-hidden="true" [icon]="editIcon" />
              Edit quantities
            </button>
          }
        </main>
      </div>
    </ion-content>

    @if (pantryState.loaded() && view().allCounted) {
      <footer class="review-footer">
        <button
          type="button"
          class="app-button--premium-primary review-footer__confirm"
          data-testid="audit-confirm-update"
          [disabled]="isSaving()"
          (click)="confirmAndUpdate()"
        >
          <ion-icon aria-hidden="true" [icon]="confirmIcon" />
          {{ isSaving() ? 'Updating…' : 'Confirm & Update Pantry' }}
        </button>
      </footer>
    }

    <ng-template #row let-entry>
      <li class="review-row" data-testid="audit-review-item">
        <div class="review-row__top">
          <span class="review-row__name">{{ entry.item.name }}</span>
          <app-pantry-audit-difference [difference]="entry.difference" [unit]="entry.item.unit" />
        </div>
        <dl class="review-row__values">
          <div class="review-row__value">
            <dt>Saved</dt>
            <dd data-testid="audit-review-saved">{{ entry.item.quantity | quantityLabel: entry.item.unit }}</dd>
          </div>
          <div class="review-row__value">
            <dt>Actual</dt>
            <dd data-testid="audit-review-actual">{{ actualQuantity(entry) | quantityLabel: entry.item.unit }}</dd>
          </div>
        </dl>
      </li>
    </ng-template>
  `,
  styles: [
    `
      :host {
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
        display: grid;
        align-content: start;
        gap: 1.25rem;
        padding: 1rem 1rem 1.5rem;
      }

      .audit-loading {
        margin: 0;
        padding: 2rem 0;
        text-align: center;
        color: var(--app-text-muted);
      }

      .review-summary {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        background: var(--app-surface);
        box-shadow: var(--app-shadow-strong);
      }

      .review-summary__stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .summary-stat {
        display: grid;
        gap: 0.15rem;
        padding: 0.85rem;
        border-radius: 0.85rem;
        background: var(--app-surface-muted);
        text-align: center;
      }

      .summary-stat--adjust {
        background: var(--app-warning-surface);
      }

      .summary-stat__value {
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: 2rem;
        font-weight: 800;
        line-height: 1.1;
        color: var(--app-ink);
      }

      .summary-stat__label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--app-text-secondary);
      }

      .review-summary__caption {
        margin: 0;
        font-size: 0.9rem;
        text-align: center;
        color: var(--app-text-secondary);
      }

      .review-section {
        display: grid;
        gap: 0.6rem;
      }

      .review-section__title {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--app-text-muted);
      }

      .review-section__empty {
        margin: 0;
        padding: 1rem;
        border: 1px dashed var(--app-border-strong);
        border-radius: var(--app-radius);
        color: var(--app-text-secondary);
      }

      .review-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.6rem;
      }

      .review-row {
        display: grid;
        gap: 0.6rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        background: var(--app-surface);
      }

      .review-row__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .review-row__name {
        font-weight: 700;
        color: var(--app-ink);
        overflow-wrap: anywhere;
      }

      .review-row__values {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .review-row__value dt {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--app-text-muted);
      }

      .review-row__value dd {
        margin: 0.1rem 0 0;
        font-weight: 700;
        color: var(--app-text-secondary);
      }

      .review-footer {
        border-top: 1px solid var(--app-border-strong);
        background: var(--app-header-background);
        backdrop-filter: blur(12px);
        padding: 0.75rem 1rem;
      }

      .review-footer__confirm {
        display: flex;
        width: min(100%, 36rem);
        margin: 0 auto;
        min-height: 3.25rem;
        border-radius: 999px;
        font-weight: 700;
      }

      .review-edit-button {
        min-height: 3.25rem;
        border-radius: 999px;
        font-weight: 700;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryAuditReviewPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly toastController = inject(ToastController);
  private readonly session = inject(PantryAuditSessionService);
  /**
   * Snapshot taken when the user confirms. Saving ends the audit (and makes every difference
   * zero), so without it the page would visibly change while animating away.
   */
  private readonly confirmedView = signal<ReviewView | null>(null);

  protected readonly pantryState = inject(PantryStateService);
  protected readonly isSaving = signal(false);
  protected readonly view = computed<ReviewView>(
    () =>
      this.confirmedView() ?? {
        entries: this.session.countEntries(),
        adjustments: this.session.adjustments(),
        unchanged: this.session.unchanged(),
        allCounted: this.session.allCounted()
      }
  );
  protected readonly editIcon = createOutline;
  protected readonly confirmIcon = checkmarkDoneOutline;

  constructor() {
    void this.pantryState.load();
  }

  protected actualQuantity(entry: PantryAuditCountEntry): number | null {
    return entry.input.status === 'valid' ? entry.input.value : null;
  }

  protected async confirmAndUpdate(): Promise<void> {
    if (this.isSaving() || !this.view().allCounted) {
      return;
    }

    this.isSaving.set(true);
    this.confirmedView.set(this.view());

    let updatedCount: number;
    try {
      updatedCount = await this.session.applyAdjustments();
    } catch {
      this.confirmedView.set(null);
      this.isSaving.set(false);
      await this.showToast('Couldn’t update your pantry. Nothing was changed — please try again.', 'danger');
      return;
    }

    // Stay in the "Updating…" state: this page is about to be closed.
    await this.showToast(auditUpdateMessage(updatedCount), 'success');
    await this.navigationHistory.backTo(PANTRY_ROUTE);
  }

  /** Back to the count screen; counts live in the audit session, so nothing entered is lost. */
  protected goBack(): void {
    void this.navigationHistory.back(AUDIT_COUNT_ROUTE);
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
