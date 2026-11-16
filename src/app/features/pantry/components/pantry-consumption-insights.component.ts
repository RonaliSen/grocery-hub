import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addOutline, removeOutline, trashOutline } from 'ionicons/icons';

import { toLocalDateOnly } from '../../../core/utils/date.utils';
import { PantryConsumptionService } from '../services/pantry-consumption.service';
import { PantryStateService } from '../services/pantry-state.service';
import { buildPantryActivity, PantryActivityKind } from '../utils/pantry-activity.util';
import {
  PantryConsumptionSummary,
  summarizePantryConsumption
} from '../utils/pantry-consumption-summary.util';
import { rankTopConsumedItems } from '../utils/pantry-top-consumed.util';
import { buildUsageTrend } from '../utils/pantry-usage-trend.util';

type ActivityFilter = 'all' | PantryActivityKind;

/**
 * Consumption analytics cards. Values come from the recorded consumption
 * history (see `summarizePantryConsumption`).
 */
const CONSUMPTION_STATS = [
  { key: 'items-consumed', label: 'Items Consumed', emoji: '🍽️', tile: 'var(--h-tile-1)', field: 'itemsConsumed' },
  { key: 'units-used', label: 'Units Used', emoji: '⚖️', tile: 'var(--h-tile-2)', field: 'unitsUsed' },
  { key: 'items-restocked', label: 'Items Restocked', emoji: '📦', tile: 'var(--h-tile-4)', field: 'itemsRestocked' }
] as const satisfies readonly {
  key: string;
  label: string;
  emoji: string;
  tile: string;
  field: keyof PantryConsumptionSummary;
}[];

/** Values longer than this get a smaller font so they fit the card on phones. */
const LONG_STAT_LENGTH = 6;

/** Recent Activity filter pills; emoji match the analytics cards. */
const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All', emoji: '🧾' },
  { value: 'used', label: 'Used', emoji: '🍽️' },
  { value: 'restocked', label: 'Restocked', emoji: '📦' },
  { value: 'deleted', label: 'Deleted', emoji: '🗑️' }
] as const satisfies readonly { value: ActivityFilter; label: string; emoji: string }[];

const ACTIVITY_FILTER_EMPTY_MESSAGES: Record<ActivityFilter, string> = {
  all: 'No activity yet.',
  used: 'Nothing used yet.',
  restocked: 'Nothing restocked yet.',
  deleted: 'No deleted items yet.'
};

/**
 * The Pantry page's consumption insights, all built from the recorded
 * consumption history (`PantryConsumptionService`):
 *
 * - Consumption Analytics: items consumed, units used, items restocked
 * - Top Items Consumed: top 5 by total quantity used
 * - Usage Trend: units used per day over the last 7 days
 * - Recent Activity: filterable, paged history of uses, restocks and deletions
 *
 * Everything updates as soon as the history changes and is rebuilt from
 * storage on load, so it stays correct after a refresh.
 */
@Component({
  selector: 'app-pantry-consumption-insights',
  standalone: true,
  imports: [IonIcon],
  template: `
    <section
      class="insight-section"
      aria-labelledby="consumption-analytics-title"
      data-testid="consumption-analytics"
    >
      <div class="section-title-row">
        <h3 id="consumption-analytics-title">Consumption Analytics</h3>
      </div>

      <dl class="consumption-stats" [attr.aria-busy]="!consumption.loaded()">
        @for (stat of consumptionStats(); track stat.key) {
          <div
            class="consumption-stat"
            [attr.data-testid]="'consumption-stat-' + stat.key"
            [attr.data-emoji]="stat.emoji"
            [style.--tile]="stat.tile"
          >
            <dt>{{ stat.label }}</dt>
            <dd [class.is-long]="stat.isLong">{{ stat.value ?? '–' }}</dd>
          </div>
        }
      </dl>
    </section>

    <section class="insight-section" aria-labelledby="top-consumed-title" data-testid="top-consumed">
      <div class="section-title-row">
        <h3 id="top-consumed-title">Top Items Consumed</h3>
        @if (topConsumed().length > 0) {
          <p>By quantity used</p>
        }
      </div>

      @if (!consumption.loaded()) {
        <p class="activity-status" role="status">Loading top items…</p>
      } @else if (topConsumed().length === 0) {
        <div class="empty-box activity-empty" data-testid="top-consumed-empty">
          <span class="activity-empty__emoji" aria-hidden="true">🏆</span>
          <p class="activity-empty__title">Nothing consumed yet</p>
          <p>Use an item and your most-used items will show up here.</p>
        </div>
      } @else {
        <ol class="insight-card activity-list">
          @for (entry of topConsumed(); track entry.itemId + entry.unit; let rank = $index) {
            <li class="activity-row top-row" data-testid="top-consumed-entry">
              <span class="top-rank" [class.top-rank--first]="rank === 0" aria-hidden="true">
                {{ rank + 1 }}
              </span>
              <div class="activity-main">
                <p class="activity-name" [class.is-deleted]="!entry.itemName">
                  <span class="visually-hidden">Rank {{ rank + 1 }}: </span>
                  {{ entry.itemName ?? 'Deleted item' }}
                </p>
                @if (entry.isDeleted) {
                  <p class="activity-meta">
                    <span class="top-deleted">Deleted</span>
                  </p>
                }
              </div>
              <span class="activity-amount" data-testid="top-consumed-amount">{{ entry.quantityLabel }}</span>
            </li>
          }
        </ol>
      }
    </section>

    <section class="insight-section" aria-labelledby="usage-trend-title" data-testid="usage-trend">
      <div class="section-title-row">
        <h3 id="usage-trend-title">Usage Trend</h3>
        @if (consumption.loaded()) {
          <p data-testid="usage-trend-total">
            {{ usageTrend().total }} {{ usageTrend().total === 1 ? 'unit' : 'units' }} · last 7 days
          </p>
        }
      </div>

      @if (!consumption.loaded()) {
        <p class="activity-status" role="status">Loading usage trend…</p>
      } @else {
        <div class="insight-card trend-card">
          <ol class="trend-chart" aria-label="Units used per day over the last 7 days">
            @for (day of usageTrend().days; track day.date) {
              <li
                class="trend-day"
                [class.is-today]="day.isToday"
                [class.is-zero]="day.units === 0"
                data-testid="usage-trend-day"
                [attr.data-date]="day.date"
              >
                <span class="visually-hidden">
                  {{ day.isToday ? 'Today, ' : '' }}{{ day.fullLabel }}: {{ day.units }}
                  {{ day.units === 1 ? 'unit' : 'units' }} used
                </span>
                <span class="trend-value" aria-hidden="true">{{ day.valueLabel }}</span>
                <span class="trend-track" aria-hidden="true">
                  <span class="trend-bar" [style.height.%]="trendBarHeight(day.units)"></span>
                </span>
                <span class="trend-label" aria-hidden="true">
                  <span class="trend-weekday">{{ day.isToday ? 'Today' : day.weekday }}</span>
                  <span class="trend-date">{{ day.dayOfMonth }}</span>
                </span>
              </li>
            }
          </ol>
          @if (usageTrend().total === 0) {
            <p class="trend-empty" data-testid="usage-trend-empty">Nothing used in the last 7 days.</p>
          }
        </div>
      }
    </section>

    <section class="insight-section" aria-labelledby="recent-activity-title" data-testid="recent-activity">
      <div class="section-title-row">
        <h3 id="recent-activity-title">Recent Activity</h3>
        @if (activity().length > 0) {
          <p>
            {{ activity().length }}
            {{ activity().length === 1 ? 'entry' : 'entries' }}
          </p>
        }
      </div>

      @if (!consumption.loaded()) {
        <p class="activity-status" role="status">Loading activity…</p>
      } @else if (activity().length === 0) {
        <div class="empty-box activity-empty" data-testid="recent-activity-empty">
          <span class="activity-empty__emoji" aria-hidden="true">🕒</span>
          <p class="activity-empty__title">No activity yet</p>
          <p>Use or restock an item and it will show up here.</p>
        </div>
      } @else {
        <div class="filter-nav activity-filters" role="group" aria-label="Filter activity">
          @for (filter of activityFilters; track filter.value) {
            @let count = activityCounts()[filter.value];
            <button
              type="button"
              class="filter-pill"
              data-testid="recent-activity-filter"
              [attr.data-filter]="filter.value"
              [class.is-active]="activityFilter() === filter.value"
              [class.is-empty]="count === 0"
              [attr.aria-pressed]="activityFilter() === filter.value"
              [attr.data-emoji]="filter.emoji"
              (click)="selectActivityFilter(filter.value)"
            >
              {{ filter.label }}
              <span class="filter-count">{{ count }}</span>
            </button>
          }
        </div>

        @if (filteredActivity().length === 0) {
          <p class="empty-box activity-filter-empty" data-testid="recent-activity-filter-empty">
            {{ activityFilterEmptyMessages[activityFilter()] }}
          </p>
        } @else {
          <ol class="insight-card activity-list" id="recent-activity-list">
            @for (entry of visibleActivity(); track entry.id) {
              <li
                class="activity-row"
                [class.activity-row--restocked]="entry.kind === 'restocked'"
                [class.activity-row--deleted]="entry.kind === 'deleted'"
                data-testid="recent-activity-entry"
              >
                <span class="activity-icon" aria-hidden="true">
                  <ion-icon [icon]="activityIcons[entry.kind]" />
                </span>
                <div class="activity-main">
                  <p class="activity-name" [class.is-deleted]="!entry.itemName">
                    {{ entry.itemName ?? 'Deleted item' }}
                  </p>
                  <p class="activity-meta">
                    <span class="activity-kind">{{ activityLabels[entry.kind] }}</span>
                    <time [attr.datetime]="entry.createdAt">{{ entry.dateTimeLabel }}</time>
                  </p>
                </div>
                @if (entry.quantityLabel) {
                  <span class="activity-amount">{{ entry.quantityLabel }}</span>
                }
              </li>
            }
          </ol>

          @if (filteredActivity().length > activityPageSize) {
            <div class="activity-paging">
              <p class="activity-paging__status" aria-live="polite" data-testid="recent-activity-showing">
                Showing {{ visibleActivity().length }} of {{ filteredActivity().length }}
              </p>
              <div class="activity-paging__actions">
                @if (visibleActivity().length < filteredActivity().length) {
                  <button
                    type="button"
                    class="activity-toggle"
                    data-testid="recent-activity-show-more"
                    aria-controls="recent-activity-list"
                    (click)="showMoreActivity()"
                  >
                    Show More
                  </button>
                }
                @if (visibleActivity().length > activityPageSize) {
                  <button
                    type="button"
                    class="activity-toggle activity-toggle--secondary"
                    data-testid="recent-activity-show-less"
                    aria-controls="recent-activity-list"
                    (click)="showLessActivity()"
                  >
                    Show Less
                  </button>
                }
              </div>
            </div>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      @use '../styles/pantry-shared' as shared;

      @include shared.section-title-row;
      @include shared.filter-pills;
      @include shared.visually-hidden;

      /* Tokens (--h-*) are inherited from the Pantry page's .theme-citrus host.
         The host sits in the page's grid, so it repeats the page's 20px gap. */
      :host {
        display: grid;
        gap: 20px;
        min-width: 0;
      }

      ion-icon {
        flex-shrink: 0;
      }

      .insight-section {
        display: grid;
        gap: 14px;
      }

      /* Shared surfaces */
      .insight-card {
        border-radius: 24px;
        background: var(--h-surface);
        border: 1px solid var(--h-line);
        box-shadow: var(--h-shadow);
      }

      .empty-box {
        border-radius: 24px;
        border: 2px dashed var(--h-line);
        background: var(--h-surface);
        text-align: center;
      }

      .activity-status {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      /* ---------------- Consumption analytics ---------------- */

      .consumption-stats {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .consumption-stat {
        display: flex;
        flex-direction: column-reverse;
        justify-content: flex-end;
        gap: 4px;
        padding: 14px 12px;
        border-radius: 22px;
        background: var(--tile, var(--h-tile-1));
        border: 1px solid var(--h-line);
      }

      /* Decorative emoji chip, rendered via CSS like the filter pills.
         Last in DOM order so column-reverse places it on top. */
      .consumption-stat::after {
        content: attr(data-emoji);
        content: attr(data-emoji) / '';
        width: 34px;
        height: 34px;
        margin-bottom: 6px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        font-size: 1.05rem;
        transform: rotate(-6deg);
      }

      .consumption-stat dd {
        margin: 0;
        font-family: var(--h-display);
        font-size: 1.6rem;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--h-ink);
      }

      /* Very long totals (e.g. thousands of grams) would break across three
         lines on narrow phones; shrink them instead. */
      .consumption-stat dd.is-long {
        font-size: 1.05rem;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }

      .consumption-stat dt {
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1.25;
        color: var(--h-ink-soft);
      }

      /* ---------------- Lists: top items and recent activity ---------------- */

      .activity-list {
        margin: 0;
        padding: 4px 14px;
        list-style: none;
      }

      .activity-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
      }

      .activity-row + .activity-row {
        border-top: 1px solid var(--h-line);
      }

      /* Icon / rank tile. Same tile colours as the Items Consumed / Items
         Restocked cards. */
      .activity-icon,
      .top-rank {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-tile-1);
        color: var(--h-ink);
        transform: rotate(-6deg);
      }

      .activity-icon {
        font-size: 18px;
      }

      .activity-row--restocked .activity-icon {
        background: var(--h-tile-4);
      }

      .activity-row--deleted .activity-icon {
        background: var(--h-danger-surface);
        color: var(--h-danger);
      }

      .top-rank {
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
      }

      .top-rank--first {
        background: var(--h-sun);
        color: #16141d;
      }

      .activity-main {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .activity-name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .activity-name.is-deleted {
        font-style: italic;
        color: var(--h-muted);
      }

      /* On narrow screens the date/time wraps onto its own line, kept whole. */
      .activity-meta {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .activity-kind {
        font-weight: 800;
        color: var(--h-ink-soft);
      }

      .activity-kind::after {
        content: '·';
        margin-left: 6px;
        color: var(--h-muted);
      }

      .activity-amount {
        flex-shrink: 0;
        font-family: var(--h-display);
        font-size: 0.92rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--h-ink);
        white-space: nowrap;
      }

      .activity-row--restocked .activity-amount {
        color: var(--h-ok);
      }

      .top-deleted {
        padding: 0 7px;
        border-radius: 999px;
        background: var(--h-danger-surface);
        color: var(--h-danger);
        font-size: 0.68rem;
        font-weight: 800;
      }

      .activity-empty {
        display: grid;
        justify-items: center;
        gap: 4px;
        padding: 22px 20px;
      }

      .activity-empty__emoji {
        width: 46px;
        height: 46px;
        margin-bottom: 6px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        font-size: 1.4rem;
        background: var(--h-tile-2);
        transform: rotate(-6deg);
      }

      .activity-empty p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--h-ink-soft);
      }

      .activity-empty .activity-empty__title {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      /* ---------------- Usage trend: 7-day bar chart ---------------- */

      .trend-card {
        display: grid;
        gap: 10px;
        padding: 18px 14px 14px;
      }

      .trend-chart {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
        align-items: end;
      }

      .trend-day {
        display: grid;
        grid-template-rows: auto 120px auto;
        justify-items: center;
        gap: 6px;
        min-width: 0;
      }

      .trend-value {
        font-family: var(--h-display);
        font-size: 0.78rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--h-ink);
        white-space: nowrap;
      }

      .trend-day.is-zero .trend-value {
        color: var(--h-muted);
        font-weight: 700;
      }

      .trend-track {
        position: relative;
        width: 100%;
        max-width: 34px;
        height: 100%;
        border-radius: 12px;
        background: var(--h-canvas);
        overflow: hidden;
      }

      .trend-bar {
        position: absolute;
        inset: auto 0 0;
        border-radius: 12px;
        background: var(--h-lilac);
        transition: height 240ms ease;
      }

      .trend-day.is-today .trend-bar {
        background: var(--h-accent);
      }

      .trend-label {
        display: grid;
        justify-items: center;
        line-height: 1.15;
      }

      .trend-weekday {
        font-size: 0.66rem;
        font-weight: 700;
        color: var(--h-muted);
        white-space: nowrap;
      }

      .trend-date {
        font-size: 0.78rem;
        font-weight: 800;
        color: var(--h-ink-soft);
      }

      .trend-day.is-today .trend-weekday,
      .trend-day.is-today .trend-date {
        color: var(--h-accent);
      }

      .trend-empty {
        margin: 0;
        text-align: center;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      /* ---------------- Recent activity: filters and paging ---------------- */

      .activity-filters {
        margin-top: -4px;
        margin-bottom: -4px;
      }

      .activity-filter-empty {
        margin: 0;
        padding: 18px 20px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      .activity-paging {
        display: grid;
        justify-items: center;
        gap: 8px;
      }

      .activity-paging__status {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-muted);
      }

      .activity-paging__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }

      .activity-toggle {
        min-height: 40px;
        padding: 0 18px;
        border: 1px solid var(--h-btn-bg);
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.82rem;
        font-weight: 800;
        transition: transform 160ms ease;
      }

      .activity-toggle--secondary {
        border-color: var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .activity-toggle:active {
        transform: scale(0.96);
      }

      @media (min-width: 600px) {
        .consumption-stats {
          gap: 14px;
        }

        .consumption-stat {
          padding: 18px 16px;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PantryConsumptionInsightsComponent {
  protected readonly consumption = inject(PantryConsumptionService);
  private readonly pantryState = inject(PantryStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Recent Activity shows this many entries at first, and "Show More" adds this many. */
  protected readonly activityPageSize = 10;
  protected readonly activityFilters = ACTIVITY_FILTERS;
  protected readonly activityFilterEmptyMessages = ACTIVITY_FILTER_EMPTY_MESSAGES;
  protected readonly activityFilter = signal<ActivityFilter>('all');
  private readonly activityLimit = signal(this.activityPageSize);
  protected readonly activityIcons = {
    used: removeOutline,
    restocked: addOutline,
    deleted: trashOutline
  } as const satisfies Record<PantryActivityKind, string>;
  protected readonly activityLabels = {
    used: 'Used',
    restocked: 'Restocked',
    deleted: 'Deleted'
  } as const satisfies Record<PantryActivityKind, string>;

  /**
   * Consumption analytics. Values are null until the saved history has
   * loaded, so the cards never briefly show a misleading 0.
   */
  protected readonly consumptionStats = computed(() => {
    const summary = this.consumption.loaded()
      ? summarizePantryConsumption(this.consumption.logs())
      : null;

    return CONSUMPTION_STATS.map((stat) => {
      const value = summary ? summary[stat.field] : null;
      return { ...stat, value, isLong: value !== null && String(value).length > LONG_STAT_LENGTH };
    });
  });

  /** Top 5 items by total quantity used. */
  protected readonly topConsumed = computed(() =>
    rankTopConsumedItems(this.consumption.logs(), this.pantryState.items())
  );

  /**
   * The current day, re-checked every minute, when the app comes back to the
   * foreground and when the Pantry tab is shown again (see `refreshToday`), so
   * the chart moves on at midnight even if the app stays open.
   */
  private readonly today = signal(new Date());

  /** Units used per day over the last 7 days. */
  protected readonly usageTrend = computed(() => buildUsageTrend(this.consumption.logs(), this.today()));

  /** Recent Activity, newest first. */
  protected readonly activity = computed(() =>
    buildPantryActivity(this.consumption.logs(), this.pantryState.items())
  );

  protected readonly activityCounts = computed(() => {
    const counts: Record<ActivityFilter, number> = { all: 0, used: 0, restocked: 0, deleted: 0 };
    for (const entry of this.activity()) {
      counts.all++;
      counts[entry.kind]++;
    }
    return counts;
  });

  protected readonly filteredActivity = computed(() => {
    const filter = this.activityFilter();
    return filter === 'all' ? this.activity() : this.activity().filter((entry) => entry.kind === filter);
  });

  protected readonly visibleActivity = computed(() =>
    this.filteredActivity().slice(0, this.activityLimit())
  );

  constructor() {
    // Saved history is otherwise only loaded on the first Use / Restock.
    void this.consumption.load();

    const dayCheck = setInterval(() => this.refreshToday(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(dayCheck));
  }

  /** Moves the Usage Trend on if the calendar day has changed. */
  @HostListener('document:visibilitychange')
  refreshToday(): void {
    const now = new Date();
    if (toLocalDateOnly(now) !== toLocalDateOnly(this.today())) {
      this.today.set(now);
    }
  }

  /** Bar height as a % of the busiest day; small non-zero values stay visible. */
  protected trendBarHeight(units: number): number {
    const max = this.usageTrend().max;
    if (units <= 0 || max <= 0) {
      return 0;
    }
    return Math.max(6, Math.round((units / max) * 1000) / 10);
  }

  /** Switching filter starts again from the latest entries. */
  protected selectActivityFilter(filter: ActivityFilter): void {
    this.activityFilter.set(filter);
    this.activityLimit.set(this.activityPageSize);
  }

  protected showMoreActivity(): void {
    this.activityLimit.update((limit) => limit + this.activityPageSize);
  }

  protected async showLessActivity(): Promise<void> {
    this.activityLimit.set(this.activityPageSize);
    await this.revealActivityHeading();
  }

  /**
   * Collapsing a long list can leave you scrolled past the section. If the
   * heading is above the visible part of the page (under the sticky header),
   * scroll it back into view just below.
   */
  private async revealActivityHeading(): Promise<void> {
    const host = this.host.nativeElement;
    const content = host.closest('ion-content') as
      | (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> })
      | null;
    const scrollElement = await content?.getScrollElement?.();
    const heading = host.querySelector<HTMLElement>('#recent-activity-title');
    if (!content || !scrollElement || !heading) {
      return;
    }

    const visibleTop = content.getBoundingClientRect().top;
    const offset = heading.getBoundingClientRect().top - visibleTop - 12;
    if (offset < 0) {
      scrollElement.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }
}
