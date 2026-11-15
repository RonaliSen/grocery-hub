import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { QuantityUnit } from '../models/pantry-item.model';
import { formatAuditDifference } from '../utils/pantry-audit.util';

/** Colour-coded difference between saved and actual quantity: "+2 kg", "−1 l" or "No change". */
@Component({
  selector: 'app-pantry-audit-difference',
  standalone: true,
  template: `
    <span
      class="difference-value"
      data-testid="audit-difference"
      [class.is-more]="difference() !== null && difference()! > 0"
      [class.is-less]="difference() !== null && difference()! < 0"
      [class.is-same]="difference() === 0"
    >
      {{ text() }}
    </span>
  `,
  styles: [
    `
      :host {
        /* Mixing towards the theme's ink colour keeps these readable on light and dark cards. */
        --audit-danger-text: color-mix(in srgb, var(--ion-color-danger) 70%, var(--app-ink));
        --audit-success-text: color-mix(in srgb, var(--ion-color-success) 70%, var(--app-ink));

        display: inline-flex;
      }

      .difference-value {
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--app-text-muted);
        white-space: nowrap;
      }

      .difference-value.is-more {
        background: var(--app-success-surface);
        color: var(--audit-success-text);
      }

      .difference-value.is-less {
        background: var(--app-danger-surface);
        color: var(--audit-danger-text);
      }

      .difference-value.is-same {
        background: var(--app-surface-muted);
        color: var(--app-text-secondary);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryAuditDifferenceComponent {
  /** Actual minus saved, or null when there is no valid count yet. */
  readonly difference = input.required<number | null>();
  readonly unit = input.required<QuantityUnit>();
  /** Shown when `difference` is null. */
  readonly emptyLabel = input('Not counted yet');

  protected readonly text = computed(() => {
    const difference = this.difference();
    return difference === null ? this.emptyLabel() : formatAuditDifference(difference, this.unit());
  });
}
