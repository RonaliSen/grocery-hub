import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { describeLeadDays, ExpiryTrackerSummary } from '../utils/expiry-tracker.util';

/**
 * Compact warning for Home: how many items have expired or are expiring within
 * the reminder lead time, linking to the Expiry Tracker. The parent decides
 * whether to show it (only when something needs attention), so an empty host
 * never takes up space in its layout.
 */
@Component({
  selector: 'app-expiry-alert',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      class="expiry-alert"
      data-testid="home-expiry-alert"
      [class.expiry-alert--danger]="summary().expired > 0"
      [routerLink]="['/tabs/expiry-tracker']"
      [attr.aria-label]="title() + ': ' + detail() + '. Open the Expiry Tracker'"
    >
      <span class="expiry-alert__icon" aria-hidden="true">⚠️</span>
      <span class="expiry-alert__text">
        <span class="expiry-alert__title">{{ title() }}</span>
        <span class="expiry-alert__detail">{{ detail() }}</span>
      </span>
      <span class="expiry-alert__cta" aria-hidden="true">Review</span>
    </a>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the parent's .theme-citrus host. */
      :host {
        display: block;
      }

      .expiry-alert {
        --alert-tone: var(--h-warn);
        --alert-surface: var(--h-warn-surface);
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 60px;
        margin-top: -6px;
        padding: 8px 8px 8px 10px;
        border-radius: 20px;
        border: 1px solid color-mix(in srgb, var(--alert-tone) 35%, transparent);
        background: var(--alert-surface);
        color: var(--h-ink);
        transition: transform 160ms ease;
      }

      .expiry-alert--danger {
        --alert-tone: var(--h-danger);
        --alert-surface: var(--h-danger-surface);
      }

      .expiry-alert:active {
        transform: scale(0.98);
      }

      .expiry-alert__icon {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        font-size: 1.15rem;
      }

      .expiry-alert__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .expiry-alert__title {
        font-family: var(--h-display);
        font-size: 0.92rem;
        font-weight: 800;
        letter-spacing: -0.01em;
        /* Tone deepened towards the ink colour: ≥4.5:1 on the tinted
           background in both themes (the raw amber is only ~2.2:1). */
        color: color-mix(in srgb, var(--alert-tone) 60%, var(--h-ink));
      }

      .expiry-alert__detail {
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      .expiry-alert__cta {
        flex-shrink: 0;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.8rem;
        font-weight: 800;
      }

      @media (prefers-reduced-motion: reduce) {
        .expiry-alert {
          transition: none;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiryAlertComponent {
  readonly summary = input.required<ExpiryTrackerSummary>();
  /** Expiry reminder lead time from Account settings (1, 3 or 7 days). */
  readonly leadDays = input.required<number>();

  protected readonly title = computed(() => {
    const count = this.summary().expired + this.summary().expiring;
    return `${count} ${count === 1 ? 'item needs' : 'items need'} attention`;
  });

  protected readonly detail = computed(() => {
    const { expired, expiring } = this.summary();
    const parts: string[] = [];
    if (expired > 0) parts.push(`${expired} expired`);
    if (expiring > 0) parts.push(`${expiring} expiring within ${describeLeadDays(this.leadDays())}`);
    return parts.join(' · ');
  });
}
