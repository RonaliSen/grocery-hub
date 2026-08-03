import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonCard, IonCardContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-shopping-list-summary',
  standalone: true,
  imports: [IonCard, IonCardContent],
  template: `
    <ion-card class="summary-card">
      <ion-card-content>
        <div class="summary">
          <div class="summary-block">
            <span>To buy</span>
            <strong>{{ activeCount() }}</strong>
            <small>Still open for the next run.</small>
          </div>
          <div class="summary-block">
            <span>Completed</span>
            <strong>{{ completedCount() }}</strong>
            <small>Already checked off.</small>
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .summary-card {
        margin: 0;
        border-radius: var(--app-radius);
        border: 1px solid var(--app-border);
        box-shadow: var(--app-shadow-strong);
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--app-space-3);
      }

      .summary-block {
        display: grid;
        gap: var(--app-space-1);
        padding: var(--app-space-3);
        border-radius: var(--app-radius-sm);
        background: var(--app-surface-muted);
        border: 1px solid var(--app-border);
      }

      span,
      small {
        display: block;
        color: var(--ion-color-medium);
      }

      span {
        font-size: 0.88rem;
      }

      strong {
        font-size: 1.55rem;
      }

      small {
        font-size: 0.82rem;
        line-height: 1.45;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingListSummaryComponent {
  readonly activeCount = input.required<number>();
  readonly completedCount = input.required<number>();
}
