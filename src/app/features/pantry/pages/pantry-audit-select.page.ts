import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { PantryAuditFooterComponent } from '../components/pantry-audit-footer.component';
import { PantryAuditHeaderComponent } from '../components/pantry-audit-header.component';
import { PantryAuditSessionService } from '../services/pantry-audit-session.service';
import { PantryStateService } from '../services/pantry-state.service';

const AUDIT_INTRO_ROUTE = '/tabs/pantry/audit';
const AUDIT_COUNT_ROUTE = '/tabs/pantry/audit/count';

@Component({
  selector: 'app-pantry-audit-select-page',
  standalone: true,
  imports: [
    EmptyStateCardComponent,
    IonContent,
    PantryAuditFooterComponent,
    PantryAuditHeaderComponent,
    QuantityLabelPipe,
  ],
  template: `
    <ion-content [fullscreen]="true" class="audit-content">
      <div class="audit-shell">
        <app-pantry-audit-header
          title="Select Items"
          subtitle="Choose what to include in this audit"
          backLabel="Back to audit introduction"
          (back)="goBack()"
        />

        <main class="audit-body">
          @if (!pantryState.loaded()) {
            <p class="audit-loading" role="status">Loading your pantry…</p>
          } @else if (items().length === 0) {
            <app-empty-state-card
              eyebrow="Nothing to audit yet"
              title="Your pantry is empty"
              message="Add a few items to your pantry first, then come back here to run an inventory audit."
              actionLabel="Add pantry item"
              [actionLink]="['/tabs/pantry/new']"
            />
          } @else {
            <label class="select-all" [class.is-selected]="session.allSelected()">
              <input
                type="checkbox"
                class="audit-checkbox"
                data-testid="audit-select-all"
                [checked]="session.allSelected()"
                [indeterminate]="session.partiallySelected()"
                (change)="onSelectAllChange($event)"
              />
              <span class="select-all__label">Select all</span>
              <span class="select-all__total">{{ items().length }} {{ items().length === 1 ? 'item' : 'items' }}</span>
            </label>

            <ul class="audit-item-list" aria-label="Pantry items">
              @for (item of items(); track item.id) {
                <li>
                  <label class="audit-item" [class.is-selected]="session.isSelected(item.id)">
                    <input
                      type="checkbox"
                      class="audit-checkbox"
                      data-testid="audit-item-checkbox"
                      [checked]="session.isSelected(item.id)"
                      (change)="onItemChange(item.id, $event)"
                    />
                    <span class="audit-item__text">
                      <span class="audit-item__name">{{ item.name }}</span>
                      <span class="audit-item__category">{{ categoryLabels[item.category] ?? item.category }}</span>
                    </span>
                    <span class="audit-item__quantity" data-testid="audit-item-quantity">
                      {{ item.quantity | quantityLabel: item.unit }}
                    </span>
                  </label>
                </li>
              }
            </ul>
          }
        </main>
      </div>
    </ion-content>

    @if (pantryState.loaded() && items().length > 0) {
      <app-pantry-audit-footer
        [count]="session.selectedCount()"
        [total]="items().length"
        label="selected"
        [hint]="session.hasSelection() ? null : 'Select at least one item to continue'"
        [canContinue]="session.hasSelection()"
        (continue)="continue()"
      />
    }
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
        gap: 0.75rem;
        padding: 1rem 1rem 1.5rem;
      }

      .audit-loading {
        margin: 0;
        padding: 2rem 0;
        text-align: center;
        color: var(--app-text-muted);
      }

      .select-all,
      .audit-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.85rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        background: var(--app-surface);
        cursor: pointer;
        transition:
          border-color 0.2s ease,
          background-color 0.2s ease;
      }

      .select-all.is-selected,
      .audit-item.is-selected {
        border-color: var(--app-primary);
        background: var(--app-success-surface);
      }

      .select-all__label {
        font-weight: 700;
        color: var(--app-ink);
      }

      .select-all__total {
        font-size: 0.85rem;
        color: var(--app-text-muted);
      }

      .audit-checkbox {
        width: 1.3rem;
        height: 1.3rem;
        margin: 0;
        accent-color: var(--app-primary);
        cursor: pointer;
      }

      .audit-item-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.6rem;
      }

      .audit-item__text {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }

      .audit-item__name {
        font-weight: 700;
        color: var(--app-ink);
        overflow-wrap: anywhere;
      }

      .audit-item__category {
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      .audit-item__quantity {
        font-weight: 700;
        color: var(--app-text-secondary);
        white-space: nowrap;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PantryAuditSelectPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly pantryState = inject(PantryStateService);
  protected readonly session = inject(PantryAuditSessionService);
  protected readonly items = computed(() => this.session.availableItems());
  protected readonly categoryLabels: Partial<Record<string, string>> = CATEGORY_LABELS;

  constructor() {
    void this.pantryState.load();
  }

  protected onSelectAllChange(event: Event): void {
    if ((event.target as HTMLInputElement).checked) {
      this.session.selectAll();
    } else {
      this.session.clearSelection();
    }
  }

  protected onItemChange(itemId: string, event: Event): void {
    this.session.setSelected(itemId, (event.target as HTMLInputElement).checked);
  }

  protected continue(): void {
    if (!this.session.hasSelection()) {
      return;
    }

    void this.router.navigateByUrl(AUDIT_COUNT_ROUTE);
  }

  protected goBack(): void {
    void this.navigationHistory.back(AUDIT_INTRO_ROUTE);
  }
}
