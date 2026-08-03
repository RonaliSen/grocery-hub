import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton, IonButtons, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-quantity-stepper',
  standalone: true,
  imports: [IonButton, IonButtons, IonIcon],
  template: `
    <div class="stepper">
      <ion-buttons>
        <ion-button fill="outline" (click)="decrement.emit()">
          <ion-icon name="remove-outline" slot="icon-only" />
        </ion-button>
      </ion-buttons>
      <div class="stepper__value">
        <strong>{{ quantity() }}</strong>
        <small>{{ unit() }}</small>
      </div>
      <ion-buttons>
        <ion-button fill="outline" (click)="increment.emit()">
          <ion-icon name="add-outline" slot="icon-only" />
        </ion-button>
      </ion-buttons>
    </div>
  `,
  styles: [
    `
      .stepper {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .stepper__value {
        min-width: 5.5rem;
        text-align: center;
      }

      small {
        display: block;
        color: var(--ion-color-medium);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuantityStepperComponent {
  readonly quantity = input.required<number>();
  readonly unit = input.required<string>();
  readonly increment = output<void>();
  readonly decrement = output<void>();
}
