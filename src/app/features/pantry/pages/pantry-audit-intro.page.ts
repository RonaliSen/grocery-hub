import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  arrowForwardOutline,
  clipboardOutline,
  createOutline,
  listOutline,
  sparklesOutline,
} from 'ionicons/icons';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { EmptyStateCardComponent } from '../../../shared/components/empty-state-card/empty-state-card.component';
import { PantryAuditHeaderComponent } from '../components/pantry-audit-header.component';
import { PantryStateService } from '../services/pantry-state.service';

const PANTRY_ROUTE = '/tabs/pantry';
const AUDIT_SELECTION_ROUTE = '/tabs/pantry/audit/select';

@Component({
  selector: 'app-pantry-audit-intro-page',
  standalone: true,
  imports: [EmptyStateCardComponent, IonContent, IonIcon, PantryAuditHeaderComponent],
  template: `
    <ion-content [fullscreen]="true" class="audit-content">
      <div class="audit-shell">
        <app-pantry-audit-header
          title="Inventory Audit"
          subtitle="Check your pantry against your shelves"
          backLabel="Back to My Pantry"
          (back)="goBack()"
        />

        <main class="audit-body">
          @if (!pantryState.loaded()) {
            <p class="audit-loading" role="status">Loading your pantry…</p>
          } @else if (itemCount() === 0) {
            <app-empty-state-card
              eyebrow="Nothing to audit yet"
              title="Your pantry is empty"
              message="Add a few items to your pantry first, then come back here to run an inventory audit."
              actionLabel="Add pantry item"
              [actionLink]="['/tabs/pantry/new']"
            />
          } @else {
            <section class="audit-card audit-intro" aria-labelledby="audit-intro-title">
              <span class="audit-intro__icon" aria-hidden="true">
                <ion-icon [icon]="auditIcon" />
              </span>
              <h2 id="audit-intro-title" class="audit-intro__title">What is an inventory audit?</h2>
              <p class="audit-intro__text">
                Over time, what the app says you have and what is actually in your cupboards can
                drift apart. An audit is a quick check-up that brings them back in sync, so your
                low-stock alerts and shopping list stay accurate.
              </p>
            </section>

            <section class="audit-card audit-count" aria-live="polite">
              <p class="audit-count__label">Items in your pantry</p>
              <p class="audit-count__value" data-testid="audit-item-count">{{ itemCount() }}</p>
              <p class="audit-count__caption">
                You currently have {{ itemCount() }} {{ itemNoun() }} to review.
              </p>
            </section>

            <section class="audit-card audit-steps" aria-labelledby="audit-steps-title">
              <h2 id="audit-steps-title" class="audit-steps__title">How it works</h2>
              <ol class="audit-steps__list">
                @for (step of steps; track step.title) {
                  <li class="audit-step">
                    <span class="audit-step__icon" aria-hidden="true">
                      <ion-icon [icon]="step.icon" />
                    </span>
                    <div class="audit-step__text">
                      <p class="audit-step__title">{{ step.title }}</p>
                      <p class="audit-step__description">{{ step.description }}</p>
                    </div>
                  </li>
                }
              </ol>
            </section>

            <button
              type="button"
              class="app-button--premium-primary audit-action-button"
              data-testid="audit-continue"
              (click)="continueToSelection()"
            >
              Continue
              <ion-icon aria-hidden="true" [icon]="continueIcon" />
            </button>
          }

          <button
            type="button"
            class="app-button--premium-outline audit-action-button"
            (click)="goBack()"
          >
            <ion-icon aria-hidden="true" [icon]="backIcon" />
            Back to My Pantry
          </button>
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

      .audit-content {
        --background: var(--app-background);
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
        gap: 1rem;
        padding: 1rem 1rem 1.5rem;
      }

      .audit-loading {
        margin: 0;
        padding: 2rem 0;
        text-align: center;
        color: var(--app-text-muted);
      }

      .audit-card {
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        background: var(--app-surface);
        box-shadow: var(--app-shadow-strong);
        padding: 1.25rem;
      }

      .audit-intro {
        display: grid;
        gap: 0.6rem;
      }

      .audit-intro__icon,
      .audit-step__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: var(--app-success-surface);
        color: var(--app-primary);
      }

      .audit-intro__icon {
        width: 3rem;
        height: 3rem;
        font-size: 1.5rem;
      }

      .audit-intro__title,
      .audit-steps__title {
        margin: 0;
        font-size: 1.2rem;
        line-height: 1.25;
      }

      .audit-intro__text {
        margin: 0;
        color: var(--app-text-secondary);
        line-height: 1.6;
      }

      .audit-count {
        text-align: center;
        display: grid;
        gap: 0.25rem;
      }

      .audit-count__label {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      .audit-count__value {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: 3rem;
        font-weight: 800;
        line-height: 1.1;
        color: var(--app-ink);
      }

      .audit-count__caption {
        margin: 0;
        color: var(--app-text-secondary);
      }

      .audit-steps {
        display: grid;
        gap: 0.9rem;
      }

      .audit-steps__list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.9rem;
      }

      .audit-step {
        display: grid;
        grid-template-columns: 2.5rem minmax(0, 1fr);
        gap: 0.75rem;
        align-items: start;
      }

      .audit-step__icon {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 1.2rem;
      }

      .audit-step__title {
        margin: 0;
        font-weight: 700;
        color: var(--app-ink);
      }

      .audit-step__description {
        margin: 0.15rem 0 0;
        font-size: 0.92rem;
        line-height: 1.5;
        color: var(--app-text-secondary);
      }

      .audit-action-button {
        min-height: 3.25rem;
        border-radius: 999px;
        font-weight: 700;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PantryAuditIntroPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);

  protected readonly pantryState = inject(PantryStateService);
  protected readonly backIcon = arrowBackOutline;
  protected readonly continueIcon = arrowForwardOutline;
  protected readonly auditIcon = clipboardOutline;
  protected readonly itemCount = computed(() => this.pantryState.totalCount());
  protected readonly itemNoun = computed(() => (this.itemCount() === 1 ? 'item' : 'items'));
  protected readonly steps = [
    {
      icon: listOutline,
      title: 'Go through your items',
      description: 'Look at each pantry item one at a time.',
    },
    {
      icon: createOutline,
      title: 'Confirm or correct the count',
      description: 'Match the quantity in the app to what is actually on the shelf.',
    },
    {
      icon: sparklesOutline,
      title: 'Stay accurate',
      description: 'Up-to-date counts keep low-stock alerts and your shopping list reliable.',
    },
  ] as const;

  constructor() {
    // The app loads pantry data at startup; this is a no-op in that case, but makes
    // the page safe to open directly (e.g. after a browser refresh on this URL).
    void this.pantryState.load();
  }

  protected continueToSelection(): void {
    void this.router.navigateByUrl(AUDIT_SELECTION_ROUTE);
  }

  protected goBack(): void {
    void this.navigationHistory.back(PANTRY_ROUTE);
  }
}
