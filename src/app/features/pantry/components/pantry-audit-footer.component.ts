import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { arrowForwardOutline } from 'ionicons/icons';

/**
 * Bottom action bar for the inventory audit steps: a progress tally ("2 of 5 selected"),
 * an optional hint explaining why the user can't continue yet, and the Continue button.
 */
@Component({
  selector: 'app-pantry-audit-footer',
  standalone: true,
  imports: [IonIcon],
  template: `
    <footer class="audit-footer">
      <div class="audit-footer__inner">
        <p class="audit-footer__status" data-testid="audit-footer-status" aria-live="polite">
          <span class="audit-footer__tally">
            <strong>{{ count() }}</strong> of {{ total() }} {{ label() }}
          </span>
          @if (hint()) {
            <span class="audit-footer__hint" data-testid="audit-footer-hint">{{ hint() }}</span>
          }
        </p>
        <button
          type="button"
          class="app-button--premium-primary audit-footer__continue"
          data-testid="audit-footer-continue"
          [disabled]="!canContinue()"
          (click)="continue.emit()"
        >
          Continue
          <ion-icon aria-hidden="true" [icon]="continueIcon" />
        </button>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .audit-footer {
        border-top: 1px solid var(--app-border-strong);
        background: var(--app-header-background);
        backdrop-filter: blur(12px);
        padding: 0.75rem 1rem;
      }

      .audit-footer__inner {
        width: min(100%, 36rem);
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .audit-footer__status {
        margin: 0;
        display: grid;
        color: var(--app-text-secondary);
      }

      .audit-footer__status strong {
        color: var(--app-ink);
      }

      .audit-footer__hint {
        font-size: 0.8rem;
        color: var(--app-text-muted);
      }

      .audit-footer__continue {
        width: auto;
        min-width: 8.5rem;
        min-height: 3rem;
        border-radius: 999px;
        font-weight: 700;
        flex-shrink: 0;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryAuditFooterComponent {
  readonly count = input.required<number>();
  readonly total = input.required<number>();
  /** Completes the tally, e.g. "selected" or "counted". */
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly canContinue = input.required<boolean>();
  readonly continue = output<void>();

  protected readonly continueIcon = arrowForwardOutline;
}
