import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { arrowBackOutline } from 'ionicons/icons';

/** Sticky header shared by the inventory audit screens. */
@Component({
  selector: 'app-pantry-audit-header',
  standalone: true,
  imports: [IonIcon],
  template: `
    <header class="audit-header">
      <div class="audit-header__inner">
        <button
          type="button"
          class="audit-header__back"
          (click)="back.emit()"
          [attr.aria-label]="backLabel()"
        >
          <ion-icon aria-hidden="true" [icon]="backIcon" />
        </button>

        <div class="audit-header__text">
          <h1 class="audit-header__title">{{ title() }}</h1>
          <p class="audit-header__subtitle">{{ subtitle() }}</p>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .audit-header {
        padding: calc(env(safe-area-inset-top, 0px) + 0.75rem) 1rem 0.75rem;
        background: var(--app-header-background);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--app-border-strong);
      }

      .audit-header__inner {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr);
        align-items: center;
        gap: 0.75rem;
      }

      .audit-header__back {
        width: 3rem;
        height: 3rem;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--app-primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .audit-header__back ion-icon {
        font-size: 1.35rem;
      }

      .audit-header__title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: clamp(1.55rem, 5.4vw, 2rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.01em;
        color: var(--app-primary);
      }

      .audit-header__subtitle {
        margin: 0.25rem 0 0;
        font-size: 0.9rem;
        line-height: 1.25;
        color: var(--app-text-secondary);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryAuditHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly backLabel = input('Go back');
  readonly back = output<void>();

  protected readonly backIcon = arrowBackOutline;
}
