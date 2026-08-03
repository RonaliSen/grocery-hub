import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-overview-cards',
  standalone: true,
  imports: [],
  template: `
    <section class="pantry-overview" id="pantry-health">
      <div class="health-card">
        <!-- Abstract shape decoration -->
        <div class="health-card__shape"></div>

        <h2 class="health-card__title">Pantry Health</h2>
        <div class="health-card__main">
          <span class="health-card__percentage">{{ health() }}%</span>
          <span class="health-card__status">{{ healthStatus() }}</span>
        </div>

        <!-- Progress Bar -->
        <div class="health-card__progress-track">
          <div class="health-card__progress-fill" [style.width.%]="health()"></div>
        </div>

        <div class="health-card__stats">
          <div class="stat-box">
            <p class="stat-box__label">STOCKED ITEMS</p>
            <p class="stat-box__value">{{ totalItems() }}</p>
          </div>
          <div class="stat-box">
            <p class="stat-box__label">EXPIRING ITEMS</p>
            <p class="stat-box__value">{{ expiringCount() }}</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .pantry-overview {
        margin: 0;
      }

      .health-card {
        background: var(--app-surface);
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius);
        padding: var(--app-space-5);
        color: var(--app-ink);
        position: relative;
        overflow: hidden;
        box-shadow: var(--app-shadow-strong);
      }

      .health-card__shape {
        position: absolute;
        right: -24px;
        top: -24px;
        width: 128px;
        height: 128px;
        background: rgba(201, 100, 66, 0.12);
        border-radius: 50%;
      }

      .health-card__title {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0 0 4px 0;
      }

      .health-card__main {
        display: flex;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: var(--app-space-2) var(--app-space-3);
        margin-bottom: var(--app-space-5);
      }

      .health-card__percentage {
        font-size: clamp(2.75rem, 10vw, 4rem);
        font-weight: 800;
        letter-spacing: -0.025em;
        line-height: 1;
      }

      .health-card__status {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--app-text-muted);
      }

      .health-card__progress-track {
        width: 100%;
        background: var(--app-surface-muted);
        height: 10px;
        border-radius: 999px;
        margin-bottom: var(--app-space-5);
        overflow: hidden;
      }

      .health-card__progress-fill {
        background: var(--app-primary);
        height: 100%;
        border-radius: 999px;
        transition: width 0.5s ease-out;
      }

      .health-card__stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--app-space-4);
      }

      .stat-box {
        background: var(--app-surface-muted);
        border-radius: var(--app-radius-xs);
        padding: var(--app-space-4);
        border: 1px solid var(--app-border);
        min-width: 0;
      }

      .stat-box__label {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--app-text-muted);
        margin: 0 0 4px 0;
      }

      .stat-box__value {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
      }

      @media (max-width: 420px) {
        .health-card__stats {
          grid-template-columns: 1fr;
        }
      }

      @media (min-width: 768px) {
        .health-card {
          padding: var(--app-space-6);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewCardsComponent {
  readonly totalItems = input.required<number>();
  readonly lowStockCount = input.required<number>();
  readonly expiringCount = input.required<number>();
  readonly shoppingCount = input.required<number>();

  protected readonly health = computed(() => {
    if (this.totalItems() === 0) return 0;
    // Heuristic: expiring count impacts health more than low stock
    const penalty = (this.expiringCount() * 10) + (this.lowStockCount() * 2);
    return Math.max(100 - penalty, 0);
  });

  protected readonly healthStatus = computed(() => {
    const h = this.health();
    if (h > 80) return 'Great condition';
    if (h > 50) return 'Needs attention';
    return 'Critical';
  });
}
