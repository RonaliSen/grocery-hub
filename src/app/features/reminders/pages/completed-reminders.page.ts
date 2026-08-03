import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  calendarOutline,
  checkmarkDoneOutline,
  leafOutline,
  refreshOutline,
  timeOutline,
  trashOutline
} from 'ionicons/icons';

import { CompletedReminderRecord, ReminderCompletionAction, ReminderTab } from '../models/reminder.model';
import { ReminderService } from '../services/reminder.service';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';

type CompletedGroupLabel = 'Today' | 'Yesterday' | 'Earlier This Week' | 'Older';

@Component({
  selector: 'app-completed-reminders-page',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content [fullscreen]="true" class="completed-content">
      <div class="completed-page">
        <header class="completed-header">
          <button type="button" class="round-btn" (click)="goBack()" aria-label="Go back">
            <ion-icon [icon]="backIcon" />
          </button>

          <div class="completed-copy">
            <h1>Completed Reminders</h1>
            <p>View reminders you have completed</p>
          </div>

          @if (entries().length > 0) {
            <button type="button" class="ghost-btn" (click)="clearAll()">Clear All</button>
          }
        </header>

        <main class="completed-main">
          <section class="summary-grid" aria-label="Completed reminder summary">
            @for (card of summaryCards(); track card.label) {
              <article class="summary-card">
                <ion-icon [icon]="card.icon" />
                <strong>{{ card.value }}</strong>
                <span>{{ card.label }}</span>
              </article>
            }
          </section>

          <nav class="filter-row" aria-label="Completed reminder filters">
            @for (tab of tabs; track tab.value) {
              <button
                type="button"
                class="filter-chip"
                [class.filter-chip--active]="activeTab() === tab.value"
                (click)="activeTab.set(tab.value)"
              >
                {{ tab.label }}
              </button>
            }
          </nav>

          @if (entries().length === 0) {
            <section class="empty-card">
              <h2>No completed reminders yet.</h2>
              <p>Resolved reminders will appear here with completion history and restore actions.</p>
            </section>
          } @else {
            <section class="analytics-card">
              <h2>Analytics</h2>
              <div class="analytics-list">
                @for (item of analytics(); track item.label) {
                  <div class="analytics-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                }
              </div>
            </section>

            @for (group of groupedEntries(); track group.label) {
              <section class="group-section">
                <h2 class="group-title">{{ group.label }}</h2>
                <div class="card-stack">
                  @for (entry of group.entries; track entry.id) {
                    <article class="completed-card" [class]="'theme-' + entry.type">
                      <div class="completed-card__head">
                        <div>
                          <p class="eyebrow">{{ labelForType(entry.type) }}</p>
                          <h3>{{ entry.title }}</h3>
                        </div>
                        <span class="status-pill">Completed</span>
                      </div>

                      <p class="action-copy">{{ actionLabel(entry.completedByAction) }}</p>
                      <div class="meta-row">
                        <span><ion-icon [icon]="calendarIcon" /> Completed on {{ formatDate(entry.completedAt) }}</span>
                        <span><ion-icon [icon]="timeIcon" /> {{ formatTime(entry.completedAt) }}</span>
                      </div>

                      <div class="action-row">
                        <button type="button" class="card-btn" (click)="viewDetails(entry)">View Details</button>
                        <button type="button" class="card-btn" (click)="restore(entry.id)">Restore Reminder</button>
                        <button type="button" class="card-btn card-btn--danger" (click)="delete(entry.id)">
                          Delete
                        </button>
                      </div>
                    </article>
                  }
                </div>
              </section>
            }
          }
        </main>
      </div>
    </ion-content>
  `,
  styles: [
    `
      :host,
      .completed-content {
        --background:
          radial-gradient(circle at top left, rgba(198, 239, 220, 0.55), transparent 22%),
          radial-gradient(circle at top right, rgba(231, 245, 255, 0.6), transparent 22%),
          linear-gradient(180deg, #f7fbf7 0%, #f2f6f3 100%);
      }

      .completed-page {
        min-height: 100%;
        padding-bottom: 2rem;
      }

      .completed-header,
      .completed-card__head,
      .meta-row,
      .analytics-row {
        display: flex;
      }

      .completed-header,
      .completed-card__head,
      .analytics-row {
        justify-content: space-between;
      }

      .completed-header {
        align-items: center;
        gap: 0.8rem;
        padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 1rem;
      }

      .completed-copy {
        flex: 1 1 auto;
        min-width: 0;
      }

      .round-btn,
      .ghost-btn,
      .filter-chip,
      .card-btn {
        border-radius: 999px;
        font: inherit;
      }

      .round-btn {
        width: 2.75rem;
        height: 2.75rem;
        border: 1px solid #d7e5dc;
        background: rgba(255, 255, 255, 0.86);
        color: #0a8f5b;
      }

      .ghost-btn {
        min-height: 2.5rem;
        padding: 0 0.95rem;
        border: 1px solid #d7e5dc;
        background: rgba(255, 255, 255, 0.86);
        color: #254637;
        font-weight: 700;
      }

      h1,
      h2,
      h3,
      p,
      strong,
      span {
        margin: 0;
      }

      h1,
      h2,
      h3,
      strong {
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
      }

      h1 {
        color: #0a8f5b;
        font-size: clamp(1.55rem, 5vw, 2rem);
        font-weight: 800;
      }

      .completed-copy p {
        margin-top: 0.2rem;
        color: #647a6d;
      }

      .completed-main {
        width: min(100%, 820px);
        margin: 0 auto;
        padding: 0 1rem 1rem;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .summary-card,
      .analytics-card,
      .completed-card,
      .empty-card {
        border: 1px solid rgba(216, 228, 220, 0.95);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 18px 36px rgba(16, 63, 40, 0.08);
      }

      .summary-card {
        padding: 1rem;
        display: grid;
        gap: 0.3rem;
        justify-items: start;
      }

      .summary-card ion-icon {
        color: #35b56a;
        font-size: 1.25rem;
      }

      .summary-card strong {
        color: #173727;
        font-size: 1.45rem;
      }

      .summary-card span {
        color: #657b6f;
        font-size: 0.84rem;
        font-weight: 600;
      }

      .filter-row {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .filter-row::-webkit-scrollbar {
        display: none;
      }

      .filter-chip {
        min-height: 2.2rem;
        padding: 0 0.95rem;
        border: 1px solid #d7e5dc;
        background: rgba(255, 255, 255, 0.88);
        color: #44574d;
        white-space: nowrap;
      }

      .filter-chip--active {
        border-color: #0a8f5b;
        background: #0a8f5b;
        color: #fff;
      }

      .analytics-card,
      .empty-card {
        padding: 1rem;
      }

      .analytics-card {
        margin-bottom: 1rem;
      }

      .analytics-card h2 {
        color: #173727;
        font-size: 1rem;
        font-weight: 800;
      }

      .analytics-list {
        display: grid;
        gap: 0.65rem;
        margin-top: 0.8rem;
      }

      .analytics-row {
        align-items: center;
        gap: 1rem;
        color: #5d7468;
      }

      .analytics-row strong {
        color: #173727;
      }

      .group-section + .group-section {
        margin-top: 1.25rem;
      }

      .group-title {
        margin-bottom: 0.7rem;
        color: #0f7a4e;
        font-size: 1rem;
        font-weight: 800;
      }

      .card-stack {
        display: grid;
        gap: 0.75rem;
      }

      .completed-card {
        padding: 1rem;
        color: #173727;
      }

      .completed-card__head {
        align-items: flex-start;
        gap: 0.8rem;
      }

      .eyebrow {
        color: currentColor;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .completed-card h3 {
        margin-top: 0.2rem;
        font-size: 1.1rem;
        font-weight: 800;
      }

      .status-pill {
        flex: 0 0 auto;
        padding: 0.45rem 0.75rem;
        border-radius: 999px;
        background: #e7f8ed;
        color: #0a8f5b;
        font-size: 0.78rem;
        font-weight: 800;
      }

      .action-copy {
        margin-top: 0.45rem;
        color: #335545;
        font-weight: 700;
      }

      .meta-row {
        flex-wrap: wrap;
        gap: 0.8rem;
        margin-top: 0.7rem;
        color: #6a7d72;
        font-size: 0.84rem;
      }

      .meta-row span {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .action-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.55rem;
        margin-top: 0.9rem;
      }

      .card-btn {
        min-height: 2.45rem;
        border: 1px solid #d7e5dc;
        background: #fff;
        color: #244636;
        font-weight: 700;
      }

      .card-btn--danger {
        color: #cf3a57;
      }

      .theme-expiry .eyebrow {
        color: #ff6b57;
      }

      .theme-low-stock .eyebrow {
        color: #1772ee;
      }

      .theme-budget .eyebrow {
        color: #8f43ff;
      }

      .theme-cart .eyebrow {
        color: #f08b24;
      }

      .theme-custom .eyebrow {
        color: #0d9488;
      }

      .empty-card {
        text-align: center;
      }

      @media (min-width: 768px) {
        .summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .completed-header {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: start;
        }

        .ghost-btn {
          grid-column: 1 / -1;
          justify-self: end;
        }

        .action-row {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompletedRemindersPage {
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);
  private readonly reminderService = inject(ReminderService);
  protected readonly backIcon = arrowBackOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly timeIcon = timeOutline;
  protected readonly activeTab = signal<ReminderTab>('all');
  protected readonly tabs = [
    { label: 'All', value: 'all' },
    { label: 'Expiry', value: 'expiry' },
    { label: 'Low Stock', value: 'low-stock' },
    { label: 'Budget', value: 'budget' },
    { label: 'Cart', value: 'cart' },
    { label: 'Custom', value: 'custom' }
  ] as const;
  protected readonly entries = computed(() => this.reminderService.getCompletedReminders(this.activeTab()));
  protected readonly summaryCards = computed(() => {
    const summary = this.reminderService.getCompletedSummary();
    return [
      { label: 'Total Completed', value: summary.totalCompleted, icon: checkmarkDoneOutline },
      { label: 'Completed This Month', value: summary.completedThisMonth, icon: calendarOutline },
      { label: 'Items Saved', value: summary.itemsSaved, icon: leafOutline },
      { label: 'Auto Resolved', value: summary.autoResolved, icon: refreshOutline }
    ];
  });
  protected readonly analytics = computed(() => this.reminderService.getCompletedAnalytics());
  protected readonly groupedEntries = computed(() => {
    const groups: Array<{ label: CompletedGroupLabel; entries: CompletedReminderRecord[] }> = [
      { label: 'Today', entries: [] },
      { label: 'Yesterday', entries: [] },
      { label: 'Earlier This Week', entries: [] },
      { label: 'Older', entries: [] }
    ];

    for (const entry of this.entries()) {
      groups.find((group) => group.label === this.groupLabel(entry.completedAt))?.entries.push(entry);
    }

    return groups.filter((group) => group.entries.length > 0);
  });

  constructor() {
    void this.reminderService.load().then(() => this.reminderService.sync());
  }

  protected labelForType(type: ReminderTab): string {
    return this.tabs.find((tab) => tab.value === type)?.label ?? 'Reminder';
  }

  protected actionLabel(action: ReminderCompletionAction): string {
    switch (action) {
      case 'MARK_CONSUMED':
        return 'Marked as Consumed';
      case 'RESTOCKED':
        return 'Stock Replenished';
      case 'PURCHASE_COMPLETED':
        return 'Purchase Completed';
      case 'BUDGET_REVIEWED':
        return 'Reviewed';
      case 'ADDED_TO_CART':
        return 'Added to Cart';
      default:
        return 'Marked Done';
    }
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected async viewDetails(entry: CompletedReminderRecord): Promise<void> {
    await this.router.navigateByUrl(entry.relatedRoute);
  }

  protected async restore(completedId: string): Promise<void> {
    await this.reminderService.restoreCompletedReminder(completedId);
    await this.reminderService.sync();
  }

  protected async delete(completedId: string): Promise<void> {
    await this.reminderService.deleteCompletedReminder(completedId);
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/settings/reminders');
  }

  protected async clearAll(): Promise<void> {
    await this.reminderService.clearCompletedReminders();
  }

  private groupLabel(value: string): CompletedGroupLabel {
    const target = new Date(value);
    const now = new Date();
    const diffDays = Math.floor((this.startOfDay(now).getTime() - this.startOfDay(target).getTime()) / 86400000);

    if (diffDays <= 0) {
      return 'Today';
    }

    if (diffDays === 1) {
      return 'Yesterday';
    }

    if (diffDays <= 6) {
      return 'Earlier This Week';
    }

    return 'Older';
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
