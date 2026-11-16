import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ExpiryTrackerSummary } from '../utils/expiry-tracker.util';

/** Home's always-visible entry point to the Expiry Tracker, with a short summary. */
@Component({
  selector: 'app-expiry-shortcut',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="expiry-shortcut" [routerLink]="['/tabs/expiry-tracker']">
      <span class="expiry-shortcut__icon" aria-hidden="true">⏳</span>
      <span class="expiry-shortcut__text">
        <span class="expiry-shortcut__title">Expiry Tracker</span>
        <span class="expiry-shortcut__subtitle">{{ subtitle() }}</span>
      </span>
      @if (attentionCount() > 0) {
        <span class="expiry-shortcut__count" aria-hidden="true">{{ attentionCount() }}</span>
      }
      <span class="expiry-shortcut__arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the parent's .theme-citrus host. */
      :host {
        display: block;
      }

      .expiry-shortcut {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 72px;
        padding: 12px;
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        color: var(--h-ink);
        transition: transform 160ms ease;
      }

      .expiry-shortcut:active {
        transform: scale(0.98);
      }

      .expiry-shortcut__icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: var(--h-tile-3);
        font-size: 1.4rem;
        transform: rotate(-6deg);
      }

      .expiry-shortcut__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .expiry-shortcut__title {
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .expiry-shortcut__subtitle {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .expiry-shortcut__count {
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        flex-shrink: 0;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--h-danger-surface);
        color: var(--h-danger);
        font-family: var(--h-display);
        font-size: 0.8rem;
        font-weight: 800;
      }

      .expiry-shortcut__arrow {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 18px;
        line-height: 1;
        /* Until the icon font loads, the ligature name renders as text: keep it in the circle. */
        overflow: hidden;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiryShortcutComponent {
  readonly summary = input.required<ExpiryTrackerSummary>();

  protected readonly attentionCount = computed(() => this.summary().expired + this.summary().expiring);

  protected readonly subtitle = computed(() => {
    const { expired, expiring, tracked } = this.summary();

    if (tracked === 0) {
      return 'Keep an eye on use-by dates';
    }

    if (expired === 0 && expiring === 0) {
      return 'Everything is fresh';
    }

    const parts: string[] = [];
    if (expiring > 0) parts.push(`${expiring} expiring soon`);
    if (expired > 0) parts.push(`${expired} expired`);
    return parts.join(' · ');
  });
}
