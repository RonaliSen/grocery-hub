import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/angular/standalone';

@Component({
  selector: 'app-empty-state-card',
  standalone: true,
  imports: [IonCard, IonCardContent, IonCardHeader, IonCardTitle, RouterLink],
  template: `
    <ion-card class="empty-card">
      <ion-card-header class="empty-card__header">
        @if (eyebrow()) {
          <p class="empty-card__eyebrow">{{ eyebrow() }}</p>
        }
        <ion-card-title>{{ title() }}</ion-card-title>
        <p class="empty-card__message">{{ message() }}</p>
      </ion-card-header>
      <ion-card-content class="empty-card__content">
        @if (supportingText()) {
          <p class="empty-card__supporting">{{ supportingText() }}</p>
        }

        @if (actionLink() || secondaryActionLink()) {
          <div class="empty-card__actions">
            @if (actionLink()) {
              <a class="app-button app-button--primary" [routerLink]="actionLink()">
                {{ actionLabel() }}
              </a>
            }

            @if (secondaryActionLink()) {
              <a class="app-button app-button--secondary" [routerLink]="secondaryActionLink()">
                {{ secondaryActionLabel() }}
              </a>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .empty-card {
        margin: 0;
        border-radius: var(--app-radius);
        border: 1px solid var(--app-border);
        background: var(--app-surface);
        box-shadow: var(--app-shadow-strong);
      }

      .empty-card__header,
      .empty-card__content {
        display: grid;
        gap: var(--app-space-3);
      }

      .empty-card__header {
        padding-bottom: 0;
      }

      .empty-card__eyebrow {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      ion-card-title,
      .empty-card__message,
      .empty-card__supporting {
        margin: 0;
      }

      ion-card-title {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 1.5rem;
        font-weight: 500;
        line-height: 1.2;
      }

      .empty-card__message,
      .empty-card__supporting {
        color: var(--app-text-secondary);
        line-height: 1.6;
      }

      .empty-card__supporting {
        font-size: 0.95rem;
      }

      .empty-card__actions {
        display: grid;
        gap: var(--app-space-2);
      }

      @media (min-width: 560px) {
        .empty-card__actions {
          grid-template-columns: repeat(2, minmax(0, max-content));
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateCardComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input('Add item');
  readonly actionLink = input<string | any[] | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly supportingText = input<string | null>(null);
  readonly secondaryActionLabel = input('Review list');
  readonly secondaryActionLink = input<string | any[] | null>(null);
}
