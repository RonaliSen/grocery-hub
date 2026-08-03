import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonHeader } from '@ionic/angular/standalone';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, RouterLink],
  template: `
    <ion-header class="page-header" [class.page-header--has-subtitle]="subtitle()">
      <div class="header-content">
        @if (showBackButton()) {
          <button
            type="button"
            class="back-btn"
            (click)="goBack()"
            aria-label="Go back"
          >
            <i class="fa-solid fa-arrow-left"></i>
          </button>
        }

        <div class="header-text">
          <div class="header-title-row">
            @if (logoSrc()) {
              <img class="header-logo" [src]="logoSrc()!" [alt]="logoAlt()" />
            }
            <h1 class="header-title">{{ title() }}</h1>
          </div>
          @if (subtitle()) {
            <p class="header-subtitle">{{ subtitle() }}</p>
          }
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="user-btn"
            [routerLink]="actionLink() ?? '/tabs/profile'"
            [attr.aria-label]="actionAriaLabel()"
          >
            <i class="fa-solid fa-circle-user"></i>
          </button>
        </div>
      </div>
    </ion-header>
  `,
  styles: [
    `
      .page-header {
        padding:
          calc(max(env(safe-area-inset-top, 0), var(--app-space-3)) + var(--app-space-2))
          var(--app-space-4)
          var(--app-space-3);
        background: var(--app-header-background);
        border-bottom: 1px solid var(--app-border);
        position: sticky;
        top: 0;
        z-index: 40;
        backdrop-filter: blur(18px);
      }

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--app-space-4);
        width: min(100%, var(--app-content-max-width));
        margin: 0 auto;
        padding: var(--app-space-4) var(--app-space-5);
        border-radius: calc(var(--app-radius) + 4px);
        border: 1px solid var(--app-border);
        background: linear-gradient(140deg, rgba(255, 255, 255, 0.92), rgba(232, 249, 239, 0.88));
        box-shadow: var(--app-shadow-strong);
      }

      .back-btn {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        border: 1px solid var(--app-border-strong);
        background: rgba(255, 255, 255, 0.95);
        color: var(--app-primary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        flex-shrink: 0;
      }

      .header-text {
        display: grid;
        gap: var(--app-space-1);
        min-width: 0;
      }

      .header-title-row {
        display: flex;
        align-items: center;
        gap: var(--app-space-2);
        min-width: 0;
      }

      .header-logo {
        width: clamp(28px, 5vw, 34px);
        height: clamp(28px, 5vw, 34px);
        border-radius: 10px;
        border: 1px solid var(--app-border);
        background: var(--app-surface-muted);
        flex-shrink: 0;
      }

      .header-title {
        font-size: clamp(1.65rem, 4vw, 2.2rem);
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-weight: 800;
        color: var(--app-ink);
        margin: 0;
        letter-spacing: -0.01em;
        line-height: 1.15;
      }

      .header-subtitle {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--app-text-muted);
        margin: 0;
        line-height: 1.45;
        word-break: break-word;
      }

      .user-btn {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--app-border-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--app-primary);
        font-size: 22px;
        padding: 0;
        cursor: pointer;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease,
          background-color 0.2s ease,
          border-color 0.2s ease;
        flex-shrink: 0;
        box-shadow: 0 8px 20px rgba(10, 143, 91, 0.12);
      }

      .user-btn:hover {
        transform: translateY(-1px);
        border-color: var(--app-border-strong);
        background: var(--app-surface-muted);
      }

      .user-btn:focus-visible {
        outline: 3px solid var(--app-focus-ring);
        outline-offset: 3px;
      }

      .user-btn:active {
        transform: scale(0.96);
        box-shadow: var(--app-pill-shadow);
      }

      .page-header:not(.page-header--has-subtitle) .header-content {
        padding-block: var(--app-space-3);
      }

      @media (max-width: 479px) {
        .page-header {
          padding-inline: var(--app-space-3);
        }

        .header-content {
          padding: var(--app-space-4);
          align-items: flex-start;
        }

        .header-title {
          font-size: clamp(1.5rem, 8vw, 1.9rem);
        }

        .header-subtitle {
          font-size: 0.84rem;
        }

        .user-btn {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          font-size: 20px;
        }
      }

      @media (min-width: 768px) {
        .page-header {
          padding-inline: var(--app-space-5);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  private readonly navigationHistory = inject(NavigationHistoryService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly logoSrc = input<string | null>(null);
  readonly logoAlt = input('App logo');
  readonly backHref = input('/tabs/home');
  readonly actionLink = input<string | any[] | null>(null);
  readonly actionAriaLabel = input('Open profile details');
  readonly actionLabel = input('Add');
  readonly showBackButton = input(false);

  protected goBack(): void {
    void this.navigationHistory.back(this.backHref());
  }
}
