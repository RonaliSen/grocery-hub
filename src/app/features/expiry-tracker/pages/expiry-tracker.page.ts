import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal, ToastController } from '@ionic/angular/standalone';
import {
  addOutline,
  arrowBackOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  refreshOutline
} from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatQuantity } from '../../../core/utils/quantity.utils';
import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { QuantityLabelPipe } from '../../../shared/pipes/quantity-label.pipe';
import { PantryConsumptionLog } from '../../pantry/models/pantry-consumption.model';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryImagePipe } from '../../pantry/pipes/pantry-image.pipe';
import { PantryConsumptionService } from '../../pantry/services/pantry-consumption.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { categoryTileColor } from '../../pantry/utils/pantry-category-style.util';
import {
  countForFilter,
  describeDaysLeft,
  describeLeadDays,
  ExpiryTrackerEntry,
  ExpiryTrackerFilter,
  formatExpiryDate,
  getExpiryTone,
  groupExpiryEntries,
  summarizeExpiry,
  toExpiryEntry
} from '../utils/expiry-tracker.util';
import { ExpiryRestockFormComponent, ExpiryRestockRequest } from '../components/expiry-restock-form.component';

const FILTERS: ReadonlyArray<{ value: ExpiryTrackerFilter; label: string; emoji: string }> = [
  { value: 'all', label: 'All', emoji: '🧺' },
  { value: 'expired', label: 'Expired', emoji: '🚫' },
  { value: 'expiring', label: 'Expiring soon', emoji: '⏳' },
  { value: 'fresh', label: 'Fresh', emoji: '🌿' },
  { value: 'no-date', label: 'No date', emoji: '🗓️' },
  { value: 'used-up', label: 'Used up', emoji: '🫙' }
];

/** How long the "Mark as used" confirmation (and its Undo) stays up. */
const UNDO_TOAST_DURATION_MS = 5000;
const TOAST_DURATION_MS = 2200;

/** Rounds away float noise from quantity maths (e.g. 2.3 - 1). */
function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

@Component({
  selector: 'app-expiry-tracker-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [
    ExpiryRestockFormComponent,
    FallbackImageDirective,
    IonContent,
    IonIcon,
    IonModal,
    PantryImagePipe,
    QuantityLabelPipe,
    RouterLink
  ],
  template: `
    <ion-content [fullscreen]="true" class="expiry-content">
      <div class="expiry-page">
        <header class="page-header">
          <button type="button" class="icon-btn" aria-label="Go back" (click)="goBack()">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>
          <div class="page-header__text">
            <h1>Expiry Tracker</h1>
            <p>{{ headerSubtitle() }}</p>
          </div>
          <a class="icon-btn icon-btn--accent" aria-label="Add pantry item" [routerLink]="['/tabs/pantry/new']">
            <ion-icon aria-hidden="true" [icon]="addIcon" />
          </a>
        </header>

        <section class="hero" aria-label="Freshness overview">
          <div class="hero-dots" aria-hidden="true"></div>
          <p class="hero__eyebrow">Freshness check</p>

          <h2 class="hero__title">
            @if (summary().total === 0) {
              Start tracking what's in your <span class="hero__highlight">kitchen.</span>
            } @else if (summary().inStock === 0) {
              Time for a <span class="hero__highlight">restock.</span>
            } @else if (summary().tracked === 0) {
              Add dates to start <span class="hero__highlight">tracking.</span>
            } @else if (needsAttention() > 0) {
              <span class="hero__highlight">{{ needsAttention() }}</span>
              {{ needsAttention() === 1 ? 'item needs' : 'items need' }} your attention.
            } @else {
              Everything is <span class="hero__highlight">fresh.</span>
            }
          </h2>

          @if (summary().tracked > 0) {
            <div class="freshness-bar" role="img" [attr.aria-label]="freshnessLabel()">
              @if (summary().expired > 0) {
                <span class="freshness-bar__segment tone-danger" [style.flex-grow]="summary().expired"></span>
              }
              @if (summary().expiring > 0) {
                <span class="freshness-bar__segment tone-warn" [style.flex-grow]="summary().expiring"></span>
              }
              @if (summary().fresh > 0) {
                <span class="freshness-bar__segment tone-ok" [style.flex-grow]="summary().fresh"></span>
              }
            </div>

            <a
              class="hero__window"
              data-testid="expiry-window-link"
              [routerLink]="['/tabs/settings']"
              [attr.aria-label]="'Expiring soon means within ' + leadDaysLabel() + '. Change in Account settings'"
            >
              <span aria-hidden="true">⏰</span>
              <span>Expiring soon = within {{ leadDaysLabel() }}</span>
              <span class="hero__window-cta" aria-hidden="true">Change</span>
            </a>

            <dl class="hero-stats">
              <div class="hero-stat hero-stat--danger">
                <dt>Expired</dt>
                <dd>{{ summary().expired }}</dd>
              </div>
              <div class="hero-stat hero-stat--warn">
                <dt>Expiring soon</dt>
                <dd>{{ summary().expiring }}</dd>
              </div>
              <div class="hero-stat hero-stat--ok">
                <dt>Fresh</dt>
                <dd>{{ summary().fresh }}</dd>
              </div>
            </dl>
          }
        </section>

        @if (summary().total === 0) {
          <section class="empty-card">
            <span class="empty-emoji" aria-hidden="true">🥫</span>
            <p class="empty-eyebrow">Nothing to track yet</p>
            <h2>Your pantry is empty</h2>
            <p>Add items with an expiry date and they'll show up here, soonest first.</p>
            <a class="empty-action" [routerLink]="['/tabs/pantry/new']">
              <ion-icon aria-hidden="true" [icon]="addIcon" />
              Add pantry item
            </a>
          </section>
        } @else {
          <nav class="filter-nav" aria-label="Expiry filters">
            @for (filter of filters; track filter.value) {
              @let count = filterCount(filter.value);
              <button
                type="button"
                class="filter-pill"
                [class.is-active]="activeFilter() === filter.value"
                [class.is-empty]="count === 0"
                [attr.aria-pressed]="activeFilter() === filter.value"
                [attr.data-emoji]="filter.emoji"
                (click)="activeFilter.set(filter.value)"
              >
                {{ filter.label }}
                <span class="filter-count">{{ count }}</span>
              </button>
            }
          </nav>

          @if (groups().length === 0) {
            <section class="empty-card">
              <span class="empty-emoji" aria-hidden="true">🔍</span>
              <h2>Nothing in this view</h2>
              <p>No items match the selected filter.</p>
              <button type="button" class="empty-action" (click)="activeFilter.set('all')">Show all items</button>
            </section>
          } @else {
            <main class="timeline">
              @for (group of groups(); track group.bucket) {
                <section class="timeline-group" [attr.aria-labelledby]="'expiry-group-' + group.bucket">
                  <h3 class="group-title" [class]="'group-title tone-' + tone(group.bucket)" [id]="'expiry-group-' + group.bucket">
                    <span class="group-title__dot" aria-hidden="true"></span>
                    {{ group.label }}
                    <span class="group-title__count">{{ group.entries.length }}</span>
                  </h3>

                  <div class="entry-list">
                    @for (entry of group.entries; track entry.item.id) {
                      @let badge = daysLeft(entry);
                      @let usedUp = entry.bucket === 'used-up';
                      @let pending = isPending(entry.item.id);
                      <article
                        class="entry-card"
                        [class]="'entry-card tone-' + tone(entry.bucket)"
                        [class.is-expired]="entry.bucket === 'expired'"
                        [class.is-used-up]="usedUp"
                        [attr.aria-busy]="pending"
                      >
                        <a
                          class="entry-card__main"
                          [routerLink]="['/tabs/pantry', entry.item.id, 'edit']"
                          [attr.aria-label]="entryLabel(entry)"
                        >
                          <span class="entry-card__thumb" [style.--tile]="tileColor(entry)">
                            <img
                              [src]="entry.item | pantryImage"
                              [appFallbackImage]="entry.item | pantryImage: 'fallback'"
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          </span>

                          <span class="entry-card__body">
                            <span class="entry-card__name">{{ entry.item.name }}</span>
                            <span class="entry-card__meta">
                              {{ categoryLabels[entry.item.category] }} ·
                              {{ entry.item.quantity | quantityLabel: entry.item.unit }}
                            </span>
                            <span class="entry-card__date">
                              <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                              <span class="entry-card__date-text">
                                @if (usedUp) {
                                  Nothing left · restock to track again
                                } @else if (entry.item.expiryDate) {
                                  {{ entry.bucket === 'expired' ? 'Expired' : 'Expires' }}
                                  {{ formatDate(entry.item.expiryDate) }}
                                } @else {
                                  Tap to add an expiry date
                                }
                              </span>
                            </span>
                          </span>

                          @if (!usedUp && entry.daysUntil !== null) {
                            <span class="entry-card__badge" aria-hidden="true">
                              <strong [class.is-word]="entry.daysUntil === 0">{{ badge.value }}</strong>
                              <small>{{ badge.caption }}</small>
                            </span>
                          } @else {
                            <span class="entry-card__chevron" aria-hidden="true">
                              <ion-icon [icon]="chevronIcon" />
                            </span>
                          }
                        </a>

                        <div class="entry-card__actions">
                          @if (!usedUp) {
                            <button
                              type="button"
                              class="action-btn action-btn--primary"
                              data-testid="expiry-mark-used"
                              [disabled]="pending"
                              [attr.aria-label]="'Mark ' + useStepLabel(entry.item) + ' of ' + entry.item.name + ' as used'"
                              (click)="markUsed(entry.item)"
                            >
                              <ion-icon aria-hidden="true" [icon]="usedIcon" />
                              Mark as used
                            </button>
                          }
                          <button
                            type="button"
                            class="action-btn"
                            data-testid="expiry-restock"
                            [class.action-btn--primary]="usedUp"
                            [disabled]="pending"
                            [attr.aria-label]="'Restock ' + entry.item.name"
                            (click)="openRestock(entry.item)"
                          >
                            <ion-icon aria-hidden="true" [icon]="restockIcon" />
                            Restock
                          </button>
                        </div>
                      </article>
                    }
                  </div>
                </section>
              }
            </main>
          }
        }
      </div>
    </ion-content>

    <!-- Ionic moves the sheet out of this host, so it carries .theme-citrus itself. -->
    <ion-modal
      class="expiry-restock-sheet theme-citrus"
      [isOpen]="restockTarget() !== null"
      (didDismiss)="closeRestock()"
    >
      <ng-template>
        @if (restockTarget(); as item) {
          <app-expiry-restock-form
            [item]="item"
            [saving]="restockSaving()"
            (restock)="confirmRestock(item, $event)"
            (cancelled)="closeRestock()"
          />
        }
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      @use '../../pantry/styles/pantry-shared' as shared;

      /* Expiry Tracker — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss); header/hero follow the Reminders screen. */
      :host {
        display: block;
        min-height: 100%;
      }

      ion-icon {
        flex-shrink: 0;
      }

      .expiry-content::part(background) {
        background: var(--h-canvas);
      }

      .expiry-page {
        width: min(100%, var(--app-mobile-max-width));
        min-height: 100%;
        margin: 0 auto;
        padding: 0 var(--h-gutter) calc(env(safe-area-inset-bottom, 0px) + 8rem);
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
        gap: 18px;
        color: var(--h-ink);
      }

      /* Tone tokens shared by group titles, cards and the freshness bar. */
      .tone-danger { --tone: var(--h-danger); --tone-surface: var(--h-danger-surface); }
      .tone-warn { --tone: var(--h-warn); --tone-surface: var(--h-warn-surface); }
      .tone-ok { --tone: var(--h-ok); --tone-surface: color-mix(in srgb, var(--h-ok) 16%, transparent); }
      .tone-muted { --tone: var(--h-muted); --tone-surface: var(--h-canvas); }

      /* ---------------- Header ---------------- */

      .page-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        align-items: center;
        gap: 12px;
        margin: 0 calc(var(--h-gutter) * -1);
        padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
      }

      .icon-btn {
        width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        background: var(--h-surface);
        color: var(--h-ink);
        display: grid;
        place-items: center;
        font-size: 20px;
        transition: transform 140ms ease;
      }

      .icon-btn:active {
        transform: scale(0.92);
      }

      .icon-btn--accent {
        border-color: transparent;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 10px 20px -10px var(--h-accent-glow);
      }

      .page-header__text {
        min-width: 0;
        text-align: center;
      }

      .page-header__text h1 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .page-header__text p {
        margin: 2px 0 0;
        font-size: 0.72rem;
        font-weight: 600;
        line-height: 1.3;
        color: var(--h-muted);
      }

      /* ---------------- Hero ---------------- */

      .hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        justify-items: start;
        gap: 16px;
        padding: 22px;
        border-radius: 30px;
        color: #ffffff;
        background:
          radial-gradient(70% 80% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
          radial-gradient(45% 55% at 0% 0%, rgba(201, 184, 255, 0.22), transparent 70%),
          var(--h-hero-bg);
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 24px 40px -24px rgba(22, 20, 29, 0.6);
      }

      .hero-dots {
        position: absolute;
        z-index: -1;
        inset: 0 0 auto auto;
        width: 55%;
        height: 70%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
        pointer-events: none;
      }

      .hero__eyebrow {
        margin: 0;
        padding: 6px 12px;
        border-radius: 10px;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(-3deg);
      }

      .hero__title {
        margin: 0;
        max-width: 18ch;
        font-size: clamp(1.55rem, 5.4vw, 2.1rem);
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: -0.035em;
        color: #ffffff;
      }

      .hero__highlight {
        color: var(--h-sun);
      }

      /* The hero is always ink, so its status colours are fixed light tints. */
      .freshness-bar {
        width: 100%;
        height: 10px;
        display: flex;
        gap: 4px;
        padding: 0;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.1);
      }

      .freshness-bar__segment {
        flex: 1 1 0;
        min-width: 10px;
        border-radius: 999px;
      }

      .freshness-bar .tone-danger { background: #ff8a8e; }
      .freshness-bar .tone-warn { background: var(--h-sun); }
      .freshness-bar .tone-ok { background: #6fdca5; }

      .hero__window {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 4px 4px 4px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.76rem;
        font-weight: 700;
      }

      .hero__window-cta {
        padding: 5px 10px;
        border-radius: 999px;
        background: #ffffff;
        color: #16141d;
        font-size: 0.72rem;
        font-weight: 800;
      }

      .hero-stats {
        width: 100%;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .hero-stat {
        min-width: 0;
        display: flex;
        flex-direction: column-reverse;
        justify-content: flex-end;
        gap: 2px;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .hero-stat dd {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.6rem;
        font-weight: 800;
        line-height: 1;
        color: var(--stat-color);
      }

      .hero-stat dt {
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1.25;
        color: rgba(255, 255, 255, 0.7);
      }

      .hero-stat--danger { --stat-color: #ff8a8e; }
      .hero-stat--warn { --stat-color: var(--h-sun); }
      .hero-stat--ok { --stat-color: #6fdca5; }

      /* ---------------- Filters ---------------- */

      @include shared.filter-pills;

      /* ---------------- Timeline ---------------- */

      .timeline {
        display: grid;
        gap: 22px;
      }

      .timeline-group {
        display: grid;
        gap: 10px;
      }

      .group-title {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-ink-soft);
      }

      .group-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--h-line);
      }

      .group-title__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--tone);
        box-shadow: 0 0 0 4px var(--tone-surface);
      }

      .group-title__count {
        min-width: 22px;
        height: 22px;
        padding: 0 7px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
        color: var(--h-ink-soft);
        font-size: 0.7rem;
        letter-spacing: 0;
      }

      .entry-list {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .entry-card {
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 10px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        color: var(--h-ink);
        transition: box-shadow 160ms ease, opacity 160ms ease;
      }

      .entry-card[aria-busy='true'] {
        opacity: 0.7;
      }

      /* Tappable summary → opens the pantry edit form. */
      .entry-card__main {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        padding-right: 2px;
        border-radius: 18px;
        color: inherit;
        transition: transform 160ms ease;
      }

      .entry-card__main:active {
        transform: scale(0.98);
      }

      .entry-card__thumb {
        width: 60px;
        height: 60px;
        flex-shrink: 0;
        border-radius: 18px;
        overflow: hidden;
        background: var(--tile, var(--h-tile-5));
      }

      .entry-card__thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        color: transparent;
      }

      .entry-card.is-expired .entry-card__thumb img,
      .entry-card.is-used-up .entry-card__thumb img {
        filter: grayscale(0.8);
        opacity: 0.75;
      }

      .entry-card.is-used-up {
        box-shadow: none;
        background: color-mix(in srgb, var(--h-surface) 70%, var(--h-canvas));
      }

      .entry-card__body {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .entry-card__name {
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entry-card__meta {
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entry-card__date {
        margin-top: 2px;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.76rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .entry-card__date-text {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entry-card__date ion-icon {
        font-size: 14px;
        color: var(--tone);
      }

      .tone-muted .entry-card__date {
        color: var(--h-accent);
      }

      .entry-card__badge {
        width: 64px;
        min-height: 60px;
        flex-shrink: 0;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 1px;
        padding: 6px 4px;
        border-radius: 18px;
        background: var(--tone-surface);
        color: var(--tone);
        text-align: center;
      }

      .entry-card__badge strong {
        font-family: var(--h-display);
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1;
      }

      .entry-card__badge strong.is-word {
        font-size: 0.95rem;
      }

      .entry-card__badge small {
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .entry-card__chevron {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 18px;
      }

      /* Quick actions */
      .entry-card__actions {
        display: grid;
        grid-auto-columns: minmax(0, 1fr);
        grid-auto-flow: column;
        gap: 8px;
        padding-top: 10px;
        border-top: 1px dashed var(--h-line);
      }

      .action-btn {
        min-width: 0;
        min-height: 42px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.8rem;
        font-weight: 800;
        white-space: nowrap;
        transition: transform 140ms ease, opacity 140ms ease;
      }

      .action-btn ion-icon {
        font-size: 17px;
      }

      .action-btn:active:not(:disabled) {
        transform: scale(0.96);
      }

      .action-btn:disabled {
        opacity: 0.5;
      }

      .action-btn--primary {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      /* ---------------- Restock sheet ---------------- */

      /* Auto-height bottom sheet: the form sets the height. */
      ion-modal.expiry-restock-sheet {
        --height: auto;
        --width: min(100%, 560px);
        --max-height: 92vh;
        --border-radius: 30px 30px 0 0;
        --background: var(--h-canvas);
        --box-shadow: 0 -20px 50px -20px rgba(22, 20, 29, 0.45);
        align-items: flex-end;
      }

      /* .ion-page is created by Ionic, outside this component's style scope. */
      ion-modal.expiry-restock-sheet::ng-deep .ion-page {
        position: relative;
        display: block;
        contain: content;
      }

      /* Quick-action toasts (rendered by Ionic at the app root, so unscoped). */
      ::ng-deep ion-toast.expiry-toast {
        --background: var(--h-btn-bg);
        --color: var(--h-btn-fg);
        --border-radius: 18px;
        --box-shadow: 0 16px 30px -14px rgba(22, 20, 29, 0.55);
        --start: 12px;
        --end: 12px;
        --max-width: 520px;
        /* .theme-citrus sets 'color' on this element, which beats Ionic's
           internal :host { color: var(--color) } — so set it explicitly. */
        color: var(--h-btn-fg);
        font-family: 'Manrope', 'Segoe UI', Arial, sans-serif;
        font-weight: 700;
      }

      ::ng-deep ion-toast.expiry-toast--danger {
        --background: var(--h-danger);
        color: #ffffff;
      }

      /* Undo: a sun pill that reads on the ink (light) and cream (dark) toast. */
      ::ng-deep ion-toast.expiry-toast::part(button) {
        min-height: 36px;
        margin-inline-start: 6px;
        padding: 0 16px;
        border-radius: 999px;
        background: var(--h-sun);
        color: #16141d;
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: none;
      }

      /* ---------------- Empty states ---------------- */

      .empty-card {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 32px 20px;
        border-radius: 28px;
        background: var(--h-surface);
        border: 2px dashed var(--h-line);
        text-align: center;
      }

      .empty-emoji {
        width: 64px;
        height: 64px;
        margin-bottom: 6px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        font-size: 2rem;
        background: var(--h-tile-3);
        transform: rotate(-6deg);
      }

      .empty-eyebrow {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--h-accent);
      }

      .empty-card h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .empty-card p:not(.empty-eyebrow) {
        max-width: 34ch;
        margin: 0;
        color: var(--h-ink-soft);
        font-size: 0.9rem;
      }

      .empty-action {
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 46px;
        padding: 0 20px;
        border: none;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.9rem;
        font-weight: 800;
      }

      .empty-action ion-icon {
        font-size: 18px;
      }

      /* ---------------- Pointer hover ---------------- */

      @media (hover: hover) {
        .entry-card:hover {
          box-shadow: 0 16px 28px -18px rgba(22, 20, 29, 0.45);
        }

        .entry-card__main:hover .entry-card__name {
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
        }
      }

      /* ---------------- Responsive ---------------- */

      @media (min-width: 600px) {
        .hero {
          grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
          grid-template-areas:
            'eyebrow eyebrow'
            'title stats'
            'bar bar'
            'window window';
          align-items: end;
          column-gap: 24px;
          row-gap: 18px;
          padding: 30px;
        }

        .hero__eyebrow { grid-area: eyebrow; }
        .hero__title { grid-area: title; }
        .hero-stats { grid-area: stats; }
        .freshness-bar { grid-area: bar; }
        .hero__window { grid-area: window; }
      }

      @media (min-width: 720px) {
        .entry-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiryTrackerPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly pantryState = inject(PantryStateService);
  private readonly settingsService = inject(SettingsService);
  private readonly consumption = inject(PantryConsumptionService);
  private readonly toastController = inject(ToastController);
  private readonly expiryStatus = new ExpiryStatusPipe();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly addIcon = addOutline;
  protected readonly backIcon = arrowBackOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly chevronIcon = chevronForwardOutline;
  protected readonly usedIcon = checkmarkCircleOutline;
  protected readonly restockIcon = refreshOutline;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly filters = FILTERS;

  protected readonly activeFilter = signal<ExpiryTrackerFilter>('all');

  /** Item whose restock sheet is open (null = closed). */
  protected readonly restockTarget = signal<PantryItem | null>(null);
  protected readonly restockSaving = signal(false);

  /** The toast this page is currently showing, if any. */
  private activeToast: HTMLIonToastElement | null = null;

  /** Items with a quick action in flight, so a double tap can't fire it twice. */
  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());

  /** Re-read on every visit: Ionic keeps this page alive, and "today" moves on. */
  private readonly today = signal(new Date());

  /** Expiry reminder lead time chosen in Account settings (1, 3 or 7 days). */
  protected readonly leadDays = computed(() => this.settingsService.settings().reminderSettings.expiryLeadDays);
  protected readonly leadDaysLabel = computed(() => describeLeadDays(this.leadDays()));

  private readonly entries = computed(() => {
    const today = this.today();
    const leadDays = this.leadDays();
    return this.pantryState.items().map((item) => toExpiryEntry(item, leadDays, today));
  });

  protected readonly summary = computed(() => summarizeExpiry(this.entries()));
  protected readonly needsAttention = computed(() => this.summary().expired + this.summary().expiring);
  protected readonly groups = computed(() =>
    groupExpiryEntries(this.entries(), this.leadDays(), this.activeFilter())
  );

  protected readonly headerSubtitle = computed(() => {
    const { total, inStock, tracked } = this.summary();

    if (total === 0) return 'Keep an eye on use-by dates';
    if (inStock === 0) return 'Everything is used up';
    return `${tracked} of ${inStock} ${inStock === 1 ? 'item' : 'items'} dated`;
  });

  protected readonly freshnessLabel = computed(() => {
    const { expired, expiring, fresh } = this.summary();
    return `${expired} expired, ${expiring} expiring soon, ${fresh} fresh`;
  });

  ionViewWillEnter(): void {
    this.today.set(new Date());
  }

  protected filterCount(filter: ExpiryTrackerFilter): number {
    return countForFilter(this.summary(), filter);
  }

  protected tone(bucket: ExpiryTrackerEntry['bucket']): string {
    return getExpiryTone(bucket);
  }

  protected daysLeft(entry: ExpiryTrackerEntry): { value: string; caption: string } {
    return describeDaysLeft(entry.daysUntil);
  }

  protected tileColor(entry: ExpiryTrackerEntry): string {
    return categoryTileColor(entry.item.category);
  }

  protected formatDate(dateOnly: string): string {
    return formatExpiryDate(dateOnly, this.today());
  }

  protected entryLabel(entry: ExpiryTrackerEntry): string {
    const status =
      entry.bucket === 'used-up'
        ? 'used up'
        : this.expiryStatus.transform(entry.item.expiryDate);
    return `${entry.item.name}, ${status}. Edit item`;
  }

  /** What one "Mark as used" tap uses — the same single step as Pantry's "Use". */
  protected useStepLabel(item: PantryItem): string {
    return formatQuantity(Math.min(1, item.quantity), item.unit);
  }

  protected isPending(itemId: string): boolean {
    return this.pendingIds().has(itemId);
  }

  /**
   * Uses one unit through the consumption service (same as Pantry's "Use"), so
   * the change is logged and shows up in Consumption Analytics. The
   * confirmation offers Undo in case of a mis-tap.
   */
  protected async markUsed(item: PantryItem): Promise<void> {
    if (this.isPending(item.id) || item.quantity <= 0) {
      return;
    }

    this.setPending(item.id, true);
    let log: PantryConsumptionLog | null = null;

    try {
      log = await this.consumption.consumeUndoable(item.id, 1);
    } catch {
      await this.notify(`Couldn't update ${item.name}. Please try again.`, 'danger');
    } finally {
      this.setPending(item.id, false);
    }

    if (!log) {
      return;
    }

    const used = roundQuantity(log.amount);
    const left = roundQuantity(log.nextQuantity);
    const usedLog = log;
    await this.notify(
      left > 0
        ? `Used ${formatQuantity(used, item.unit)} of ${item.name} · ${formatQuantity(left, item.unit)} left`
        : `${item.name} is used up`,
      'success',
      { label: 'Undo', handler: () => void this.undoUse(usedLog, item.name) }
    );
  }

  /**
   * Reverts a "Mark as used": the amount goes back to the item and the use is
   * removed from the consumption history (Pantry analytics and Recent Activity).
   */
  protected async undoUse(log: PantryConsumptionLog, itemName: string): Promise<void> {
    if (this.isPending(log.itemId)) {
      return;
    }

    this.setPending(log.itemId, true);

    try {
      const undone = await this.consumption.undoConsumption(log.id);
      const item = this.pantryState.getById(log.itemId);

      if (undone && item) {
        await this.notify(`Restored ${item.name} · ${formatQuantity(roundQuantity(item.quantity), item.unit)}`);
      } else {
        await this.notify(`Couldn't undo — ${itemName} was changed or removed.`, 'danger');
      }
    } catch {
      await this.notify(`Couldn't undo for ${itemName}. Please try again.`, 'danger');
    } finally {
      this.setPending(log.itemId, false);
    }
  }

  protected openRestock(item: PantryItem): void {
    if (this.isPending(item.id)) {
      return;
    }

    this.restockTarget.set(item);
  }

  protected closeRestock(): void {
    if (!this.restockSaving()) {
      this.restockTarget.set(null);
    }
  }

  /**
   * Adds stock through the consumption service (logged as a restock, like
   * Pantry's "Restock") and gives the item its new batch's expiry date.
   */
  protected async confirmRestock(item: PantryItem, request: ExpiryRestockRequest): Promise<void> {
    if (this.restockSaving()) {
      return;
    }

    this.restockSaving.set(true);
    this.setPending(item.id, true);

    try {
      await this.consumption.adjust(item.id, request.amount);

      const current = this.pantryState.getById(item.id);
      if (current && current.expiryDate !== request.expiryDate) {
        await this.pantryState.save({ ...current, expiryDate: request.expiryDate }, item.id);
      }

      this.restockSaving.set(false);
      this.restockTarget.set(null);

      const quantity = formatQuantity(roundQuantity(current?.quantity ?? 0), item.unit);
      await this.notify(
        request.expiryDate
          ? `Restocked ${item.name} · ${quantity}, expires ${this.formatDate(request.expiryDate)}`
          : `Restocked ${item.name} · ${quantity}`
      );
    } catch {
      this.restockSaving.set(false);
      await this.notify(`Couldn't restock ${item.name}. Please try again.`, 'danger');
    } finally {
      this.setPending(item.id, false);
    }
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/home');
  }

  private setPending(itemId: string, pending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  /**
   * Shows a confirmation toast, replacing any toast this page is still
   * showing — so a stale Undo never lingers under a newer message.
   */
  private async notify(
    message: string,
    tone: 'success' | 'danger' = 'success',
    action?: { label: string; handler: () => void }
  ): Promise<void> {
    const previous = this.activeToast;
    this.activeToast = null;
    await previous?.dismiss().catch(() => undefined);

    const toast = await this.toastController.create({
      message,
      duration: action ? UNDO_TOAST_DURATION_MS : TOAST_DURATION_MS,
      position: 'bottom',
      // Sit above the floating tab bar rather than on top of it.
      positionAnchor: (this.host.nativeElement.ownerDocument.querySelector('ion-tab-bar') as HTMLElement | null) ?? undefined,
      cssClass: ['expiry-toast', `expiry-toast--${tone}`, 'theme-citrus'],
      buttons: action ? [{ text: action.label, role: 'undo', handler: action.handler }] : undefined
    });

    this.activeToast = toast;
    void toast.onDidDismiss?.().then(() => {
      if (this.activeToast === toast) {
        this.activeToast = null;
      }
    });
    await toast.present();
  }
}
