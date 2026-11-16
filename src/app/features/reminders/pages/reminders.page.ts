import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { IonContent, IonIcon, IonModal } from '@ionic/angular/standalone';
import {
  addOutline,
  alarmOutline,
  arrowBackOutline,
  calendarOutline,
  cartOutline,
  checkmarkCircleOutline,
  chevronDownOutline,
  eyeOutline,
  notificationsSharp,
  playCircleOutline,
  receiptOutline,
  refreshOutline,
  timeOutline,
  trashOutline,
  walletOutline
} from 'ionicons/icons';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import {
  CompletedReminderRecord,
  ReminderItem,
  ReminderLifecycleView,
  ReminderRecurrence,
  ReminderTab,
  ReminderType
} from '../models/reminder.model';
import { ReminderService } from '../services/reminder.service';

type ReminderSortOrder = 'latest' | 'oldest';
type ReminderCategoryFilter = Exclude<ReminderTab, 'custom'>;
type SnoozePreset = 'later-today' | 'tomorrow' | 'three-days' | 'next-week' | 'custom';
type CompletedGroupLabel = 'Today' | 'Yesterday' | 'This Week' | 'Older';
type ReminderActionKey =
  | 'view-item'
  | 'add-to-cart'
  | 'mark-consumed'
  | 'mark-restocked'
  | 'view-budget'
  | 'mark-reviewed'
  | 'view-cart'
  | 'complete-purchase'
  | 'view-details'
  | 'restore'
  | 'activate-now'
  | 'edit-snooze'
  | 'snooze'
  | 'delete'
  | 'mark-done';

@Component({
  selector: 'app-reminders-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, IonModal, ReactiveFormsModule],
  template: `
    <ion-content [fullscreen]="true" class="reminders-content">
      <div class="reminders-page">
        <header class="page-header">
          <button type="button" class="icon-btn" (click)="goBack()" aria-label="Back">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>
          <div class="page-header__text">
            <h1>Reminders</h1>
            <p>Expiry, stock, budget &amp; cart alerts</p>
          </div>
          <span class="icon-btn icon-btn--ghost" aria-hidden="true"></span>
        </header>

        <section class="hero" aria-label="Reminder overview">
          <div class="hero-dots" aria-hidden="true"></div>
          <p class="hero__eyebrow">Reminder centre</p>
          <h2 class="hero__title">
            @if (stateCount('ACTIVE') > 0) {
              <span class="hero__highlight">{{ stateCount('ACTIVE') }}</span>
              {{ stateCount('ACTIVE') === 1 ? 'reminder needs' : 'reminders need' }} you.
            } @else {
              You're all <span class="hero__highlight">caught up.</span>
            }
          </h2>

          <nav class="state-tabs" aria-label="Reminder status tabs">
            @for (tab of stateTabs; track tab.value) {
              <button
                type="button"
                class="state-tab"
                [class.state-tab--active]="activeState() === tab.value"
                [attr.aria-pressed]="activeState() === tab.value"
                (click)="selectState(tab.value)"
              >
                {{ tab.label }} ({{ stateCount(tab.value) }})
              </button>
            }
          </nav>
        </section>

        <nav class="stats-panel" aria-label="Reminder categories">
          @for (card of summaryCards(); track card.value) {
            <button
              type="button"
              class="stat-tile"
              [class]="'stat-tile theme-' + themeClass(card.value)"
              [class.stat-tile--active]="activeCategory() === card.value"
              [attr.aria-pressed]="activeCategory() === card.value"
              (click)="activeCategory.set(card.value)"
            >
              <span class="stat-tile__emoji" aria-hidden="true">{{ typeEmoji(card.value) }}</span>
              <strong>{{ card.count }}</strong>
              <span class="stat-tile__label">{{ card.label }}</span>
            </button>
          }
        </nav>

        <main class="reminders-main">
          <div class="section-head">
            <h2>{{ sectionTitle() }}</h2>
            @if (activeState() !== 'COMPLETED') {
              <button
                type="button"
                class="sort-chip"
                [attr.aria-label]="'Sort reminders by ' + sortOrderLabel()"
                (click)="toggleSortOrder()"
              >
                <span>Sort by: {{ sortOrderLabel() }}</span>
                <ion-icon aria-hidden="true" [icon]="chevronDownIcon" />
              </button>
            }
          </div>

          @if (activeState() === 'ACTIVE') {
            @if (activeReminders().length === 0) {
              <section class="empty-state-card">
                <span class="empty-state-card__emoji" aria-hidden="true">🎉</span>
                <h3>{{ emptyStateTitle() }}</h3>
                <p>{{ emptyStateMessage() }}</p>
              </section>
            } @else {
              <section class="card-stack">
                @for (reminder of activeReminders(); track reminder.id) {
                  <article class="reminder-card" [class]="'reminder-card theme-' + themeClass(reminder.type)">
                    <div class="reminder-card__top">
                      <span class="reminder-card__emoji" aria-hidden="true">{{ typeEmoji(reminder.type) }}</span>
                      <div class="reminder-card__copy">
                        <p class="reminder-card__eyebrow">{{ labelForType(reminder.type) }}</p>
                        <h3>{{ reminder.title }}</h3>
                        <p class="reminder-card__description">{{ activeDescription(reminder) }}</p>
                        @if (dueLabel(reminder); as dueInfo) {
                          @if (dueInfo !== activeDescription(reminder)) {
                          <p class="reminder-card__meta">
                            <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                            <span>{{ dueInfo }}</span>
                          </p>
                          }
                        }
                      </div>
                      <span
                        class="status-pill"
                        [class.status-pill--overdue]="reminder.status === 'overdue'"
                        [class.status-pill--soon]="reminder.status === 'due-soon'"
                      >
                        {{ activeStatusChip(reminder) }}
                      </span>
                    </div>

                    <div class="action-grid">
                      @for (action of activeActions(reminder); track action) {
                        <button
                          type="button"
                          class="action-btn"
                          [class.action-btn--primary]="isPrimaryActiveAction(reminder, action)"
                          (click)="handleActiveAction(reminder, action)"
                        >
                          <ion-icon aria-hidden="true" [icon]="actionIcon(action)" />
                          <span>{{ actionLabel(action) }}</span>
                        </button>
                      }
                    </div>
                  </article>
                }
              </section>
            }
          }

          @if (activeState() === 'SNOOZED') {
            @if (snoozedReminders().length === 0) {
              <section class="empty-state-card">
                <span class="empty-state-card__emoji" aria-hidden="true">😴</span>
                <h3>No snoozed reminders.</h3>
                <p>Snoozed reminders will appear here until they are reactivated or restored automatically.</p>
              </section>
            } @else {
              <section class="card-stack">
                @for (reminder of snoozedReminders(); track reminder.id) {
                  <article class="reminder-card reminder-card--snoozed" [class]="'reminder-card reminder-card--snoozed theme-' + themeClass(reminder.type)">
                    <div class="reminder-card__top">
                      <span class="reminder-card__emoji" aria-hidden="true">{{ typeEmoji(reminder.type) }}</span>
                      <div class="reminder-card__copy">
                        <p class="reminder-card__eyebrow">{{ labelForType(reminder.type) }}</p>
                        <h3>{{ reminder.title }}</h3>
                        <p class="reminder-card__description">Snoozed until {{ formatDateTime(reminder.snoozedUntil) }}</p>
                      </div>
                      <span class="status-pill status-pill--snoozed">Snoozed</span>
                    </div>

                    <div class="action-grid">
                      <button type="button" class="action-btn action-btn--primary" (click)="activateNow(reminder.id)">
                        <ion-icon aria-hidden="true" [icon]="activateIcon" />
                        <span>Activate Now</span>
                      </button>
                      <button type="button" class="action-btn" (click)="openSnoozeSheet(reminder, true)">
                        <ion-icon aria-hidden="true" [icon]="editSnoozeIcon" />
                        <span>Edit Snooze</span>
                      </button>
                      <button type="button" class="action-btn action-btn--danger" (click)="deleteReminder(reminder.id)">
                        <ion-icon aria-hidden="true" [icon]="deleteIcon" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </article>
                }
              </section>
            }
          }

          @if (activeState() === 'COMPLETED') {
            @if (completedGroups().length === 0) {
              <section class="empty-state-card">
                <span class="empty-state-card__emoji" aria-hidden="true">✅</span>
                <h3>No completed reminders yet.</h3>
                <p>Completed reminder history will appear here once actions are resolved.</p>
              </section>
            } @else {
              @for (group of completedGroups(); track group.label) {
                <section class="group-section">
                  <h3 class="group-title">{{ group.label }}</h3>
                  <div class="card-stack">
                    @for (entry of group.entries; track entry.id) {
                      <article class="reminder-card reminder-card--completed" [class]="'reminder-card reminder-card--completed theme-' + themeClass(entry.type)">
                        <div class="reminder-card__top">
                          <span class="reminder-card__emoji" aria-hidden="true">{{ typeEmoji(entry.type) }}</span>
                          <div class="reminder-card__copy">
                            <p class="reminder-card__eyebrow">{{ labelForType(entry.type) }}</p>
                            <h3>{{ entry.title }}</h3>
                            <p class="reminder-card__description">{{ completionLabel(entry.completedByAction) }}</p>
                            <p class="reminder-card__meta">
                              <ion-icon aria-hidden="true" [icon]="calendarIcon" />
                              <span>{{ formatCompletedMeta(entry.completedAt) }}</span>
                            </p>
                          </div>
                          <span class="status-pill status-pill--completed">Completed</span>
                        </div>

                        <div class="action-grid">
                          <button type="button" class="action-btn" (click)="viewCompleted(entry)">
                            <ion-icon aria-hidden="true" [icon]="viewIcon" />
                            <span>View Details</span>
                          </button>
                          <button type="button" class="action-btn" (click)="restoreCompleted(entry.id)">
                            <ion-icon aria-hidden="true" [icon]="restoreIcon" />
                            <span>Restore</span>
                          </button>
                          <button type="button" class="action-btn action-btn--danger" (click)="deleteCompleted(entry.id)">
                            <ion-icon aria-hidden="true" [icon]="deleteIcon" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </article>
                    }
                  </div>
                </section>
              }
            }
          }
        </main>
      </div>
    </ion-content>

    <div class="sticky-create-bar">
      <button type="button" class="create-btn" (click)="openCreateReminderModal()">
        <span class="create-btn__icon" aria-hidden="true"><ion-icon [icon]="addIcon" /></span>
        <span>Create Reminder</span>
      </button>
    </div>

    <ion-modal
      class="reminder-sheet theme-citrus"
      [isOpen]="customModalOpen()"
      [initialBreakpoint]="0.94"
      [breakpoints]="[0, 0.94]"
      (didDismiss)="closeCreateModal()"
    >
      <ng-template>
        <form class="custom-modal" [formGroup]="customForm" (ngSubmit)="saveCustomReminder()">
          <header class="custom-modal__header">
            <span class="custom-modal__emoji" aria-hidden="true">🔔</span>
            <div>
              <h2>Create Reminder</h2>
              <p>Store one-time or repeating reminders locally on this device.</p>
            </div>
          </header>

          <div class="custom-modal__card">
            <label class="field">
              <span>Reminder Name</span>
              <input type="text" formControlName="name" placeholder="e.g. Buy Basmati Rice" />
            </label>

            <fieldset class="field">
              <legend>Repeat</legend>
              <div class="repeat-chips" role="radiogroup" aria-label="Type">
                @for (option of recurrenceOptions; track option.value) {
                  <label class="repeat-chip" [class.repeat-chip--active]="customForm.controls.recurrence.value === option.value">
                    <input type="radio" class="visually-hidden" formControlName="recurrence" [value]="option.value" />
                    <span aria-hidden="true">{{ recurrenceEmoji(option.value) }}</span>
                    {{ option.label }}
                  </label>
                }
              </div>
            </fieldset>

            <div class="field-row">
              <label class="field">
                <span>Date</span>
                <input type="date" formControlName="date" />
              </label>

              <label class="field">
                <span>Time</span>
                <input type="time" formControlName="time" />
              </label>
            </div>
          </div>

          <p class="custom-modal__summary">
            <span aria-hidden="true">⏰</span>
            {{ customReminderSummary() }}
          </p>

          <footer class="modal-actions">
            <button type="button" class="ghost-btn" (click)="closeCreateModal()">Cancel</button>
            <button type="submit" class="save-btn" [disabled]="customForm.invalid">Save Reminder</button>
          </footer>
        </form>
      </ng-template>
    </ion-modal>

    <ion-modal
      class="reminder-sheet theme-citrus"
      [isOpen]="snoozeModalOpen()"
      [initialBreakpoint]="0.72"
      [breakpoints]="[0, 0.72]"
      (didDismiss)="closeSnoozeSheet()"
    >
      <ng-template>
        <div class="custom-modal snooze-modal">
          <header class="custom-modal__header">
            <span class="custom-modal__emoji" aria-hidden="true">😴</span>
            <div>
              <h2>Snooze Reminder</h2>
              <p>Choose when this reminder should return to your active list.</p>
            </div>
          </header>

          <div class="option-list">
            @for (option of snoozeOptions; track option.value) {
              <button
                type="button"
                class="option-card"
                [class.option-card--active]="selectedSnoozePreset() === option.value"
                [attr.aria-pressed]="selectedSnoozePreset() === option.value"
                (click)="selectSnoozePreset(option.value)"
              >
                <div>
                  <strong>{{ option.label }}</strong>
                  <span>{{ snoozeOptionSubtitle(option.value) }}</span>
                </div>
                <span class="option-radio" aria-hidden="true"></span>
              </button>
            }
          </div>

          @if (selectedSnoozePreset() === 'custom') {
            <div class="custom-modal__card field-row">
              <label class="field">
                <span>Custom Date</span>
                <input type="date" [value]="customSnoozeDate()" (input)="updateCustomSnoozeDate($event)" />
              </label>

              <label class="field">
                <span>Custom Time</span>
                <input type="time" [value]="customSnoozeTime()" (input)="updateCustomSnoozeTime($event)" />
              </label>
            </div>
          }

          <footer class="modal-actions">
            <button type="button" class="ghost-btn" (click)="closeSnoozeSheet()">Cancel</button>
            <button type="button" class="save-btn" [disabled]="!canConfirmSnooze()" (click)="confirmSnooze()">
              Confirm Snooze
            </button>
          </footer>
        </div>
      </ng-template>
    </ion-modal>

    <ion-modal
      class="reminder-sheet theme-citrus"
      [isOpen]="restockModalOpen()"
      [initialBreakpoint]="0.64"
      [breakpoints]="[0, 0.64]"
      (didDismiss)="closeRestockSheet()"
    >
      <ng-template>
        <div class="custom-modal restock-modal">
          <header class="custom-modal__header">
            <span class="custom-modal__emoji" aria-hidden="true">📦</span>
            <div>
              <h2>Mark Restocked</h2>
              <p>How many {{ restockItemName() }} do you have now?</p>
            </div>
          </header>

          <div class="custom-modal__card">
            <label class="field">
              <span>New Quantity</span>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                [value]="restockQuantityInput()"
                (input)="updateRestockQuantity($event)"
              />
            </label>

            <label class="field">
              <span>Expiry Date (optional)</span>
              <input
                type="date"
                [value]="restockExpiryDateInput()"
                (input)="updateRestockExpiryDate($event)"
              />
            </label>
          </div>

          <footer class="modal-actions">
            <button type="button" class="ghost-btn" (click)="closeRestockSheet()">Cancel</button>
            <button type="button" class="save-btn" [disabled]="!canConfirmRestock()" (click)="confirmRestock()">
              Save
            </button>
          </footer>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      /* Reminders — "Citrus & Ink". Tokens (--h-*) come from .theme-citrus
         (src/theme/citrus.scss). The sheets carry .theme-citrus themselves
         because Ionic moves inline modals out of this component's host. */
      :host {
        display: block;
        min-height: 100%;
      }

      ion-icon {
        flex-shrink: 0;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .reminders-content::part(background) {
        background: var(--h-canvas);
      }

      .reminders-page {
        width: min(100%, 720px);
        min-height: 100%;
        margin: 0 auto;
        padding: 0 var(--h-gutter) 9rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
        gap: 16px;
      }

      /* Header */
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
      }

      .icon-btn--ghost {
        visibility: hidden;
      }

      .page-header__text {
        text-align: center;
        min-width: 0;
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

      /* Hero */
      .hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        justify-items: start;
        gap: 14px;
        padding: 20px 18px 18px;
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
      }

      .hero__eyebrow {
        margin: 0 0 0 4px;
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
        margin: 0 4px;
        font-size: clamp(1.5rem, 5.6vw, 2rem);
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: -0.035em;
        color: #ffffff;
      }

      .hero__highlight {
        color: var(--h-sun);
      }

      .state-tabs {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      .state-tab {
        min-height: 40px;
        padding: 0 6px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.8rem;
        font-weight: 800;
        white-space: nowrap;
        transition: background-color 180ms ease, color 180ms ease;
      }

      .state-tab--active {
        background: #ffffff;
        color: #16141d;
      }

      /* Category tiles (filter) */
      .stats-panel {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }

      .stat-tile {
        --tile: var(--h-surface);
        min-width: 0;
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 10px 4px;
        border: 1px solid var(--h-line);
        border-radius: 20px;
        background: var(--tile);
        color: var(--h-ink);
        transition: transform 160ms ease, background-color 160ms ease;
      }

      .stat-tile__emoji {
        font-size: 1.2rem;
      }

      .stat-tile strong {
        font-family: var(--h-display);
        font-size: 1.2rem;
        font-weight: 800;
        line-height: 1.1;
      }

      .stat-tile__label {
        max-width: 100%;
        font-size: 0.64rem;
        font-weight: 700;
        color: var(--h-ink-soft);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Doubled class so it wins over the later .theme-* tile colours. */
      .stat-tile.stat-tile--active {
        --tile: var(--h-btn-bg);
        border-color: var(--h-btn-bg);
        color: var(--h-btn-fg);
        transform: translateY(-2px);
        box-shadow: 0 10px 18px -12px rgba(22, 20, 29, 0.7);
      }

      .stat-tile--active .stat-tile__label {
        color: inherit;
        opacity: 0.8;
      }

      /* Section head */
      .reminders-main {
        display: grid;
        gap: 12px;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .sort-chip {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-surface);
        color: var(--h-ink);
        font-size: 0.76rem;
        font-weight: 800;
      }

      /* Cards */
      .card-stack {
        display: grid;
        gap: 12px;
      }

      .group-section {
        display: grid;
        gap: 10px;
      }

      .group-title {
        margin: 6px 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      .group-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--h-line);
      }

      .reminder-card {
        --tile: var(--h-tile-2);
        display: grid;
        gap: 14px;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .theme-expiry { --tile: var(--h-tile-1); }
      .theme-low-stock { --tile: var(--h-tile-3); }
      .theme-budget { --tile: var(--h-tile-4); }
      .theme-cart { --tile: var(--h-tile-6); }
      .theme-custom { --tile: var(--h-tile-2); }

      .reminder-card__top {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .reminder-card__emoji {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: var(--tile);
        font-size: 1.4rem;
        transform: rotate(-5deg);
      }

      .reminder-card__copy {
        flex: 1;
        min-width: 0;
      }

      .reminder-card__eyebrow {
        margin: 0;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      .reminder-card h3 {
        margin: 2px 0 0;
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.2;
        color: var(--h-ink);
      }

      .reminder-card__description {
        margin: 3px 0 0;
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--h-ink-soft);
      }

      .reminder-card__meta {
        margin: 6px 0 0;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .status-pill {
        flex-shrink: 0;
        padding: 5px 10px;
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.68rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .status-pill--soon { background: var(--h-warn-surface); color: var(--h-warn); }
      .status-pill--overdue { background: var(--h-danger-surface); color: var(--h-danger); }
      .status-pill--snoozed { background: var(--h-tile-2); color: var(--h-ink); }
      .status-pill--completed { background: color-mix(in srgb, var(--h-ok) 16%, transparent); color: var(--h-ok); }

      .reminder-card--snoozed,
      .reminder-card--completed {
        box-shadow: none;
      }

      .reminder-card--completed .reminder-card__emoji {
        filter: grayscale(0.6);
      }

      /* Actions wrap instead of being clipped */
      .action-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid var(--h-line);
        border-radius: 999px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.8rem;
        font-weight: 800;
        transition: transform 140ms ease;
      }

      .action-btn:active {
        transform: scale(0.96);
      }

      .action-btn--primary {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .action-btn--danger {
        border-color: transparent;
        background: var(--h-danger-surface);
        color: var(--h-danger);
      }

      /* Empty state */
      .empty-state-card {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 32px 20px;
        border-radius: 28px;
        border: 2px dashed var(--h-line);
        background: var(--h-surface);
        text-align: center;
      }

      .empty-state-card__emoji {
        width: 64px;
        height: 64px;
        margin-bottom: 4px;
        border-radius: 22px;
        display: grid;
        place-items: center;
        background: var(--h-tile-3);
        font-size: 2rem;
        transform: rotate(-6deg);
      }

      .empty-state-card h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--h-ink);
      }

      .empty-state-card p {
        margin: 0;
        font-size: 0.86rem;
        color: var(--h-ink-soft);
      }

      /* Create button */
      .sticky-create-bar {
        position: fixed;
        right: max(var(--h-gutter), calc((100% - 720px) / 2 + var(--h-gutter)));
        bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
        z-index: 30;
      }

      .create-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 0 22px 0 8px;
        border: none;
        border-radius: 999px;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 0.95rem;
        font-weight: 800;
        box-shadow: 0 14px 28px -10px var(--h-accent-glow);
        transition: transform 140ms ease;
      }

      .create-btn:active {
        transform: scale(0.96);
      }

      .create-btn__icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #ffffff;
        color: var(--h-accent);
        font-size: 22px;
      }

      /* ---------------- Bottom sheets ---------------- */

      ion-modal.reminder-sheet {
        --background: var(--h-canvas);
        --border-radius: 30px;
        --box-shadow: 0 -20px 50px -20px rgba(22, 20, 29, 0.45);
      }

      .custom-modal {
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 28px var(--h-gutter) calc(8vh + 24px + env(safe-area-inset-bottom, 0px));
        color: var(--h-ink);
      }

      /* Sheets open at a partial breakpoint; keep their actions reachable. */
      .snooze-modal { padding-bottom: calc(30vh + 16px); }
      .restock-modal { padding-bottom: calc(38vh + 16px); }

      ion-modal.reminder-sheet::part(handle) {
        width: 44px;
        background: color-mix(in srgb, var(--h-muted) 45%, transparent);
      }

      .custom-modal__header {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .custom-modal__emoji {
        width: 52px;
        height: 52px;
        flex-shrink: 0;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: var(--h-sun);
        font-size: 1.5rem;
        transform: rotate(-6deg);
      }

      .custom-modal__header h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .custom-modal__header p {
        margin: 3px 0 0;
        font-size: 0.8rem;
        line-height: 1.4;
        color: var(--h-muted);
      }

      .custom-modal__card {
        display: grid;
        gap: 16px;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .field {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        display: grid;
        gap: 8px;
      }

      .field > span,
      .field > legend {
        padding: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .field > legend {
        margin-bottom: 8px;
      }

      .field input {
        width: 100%;
        min-width: 0;
        min-height: 50px;
        padding: 0 14px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink);
        font-size: 0.92rem;
        font-weight: 600;
      }

      .field input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      /* Beat the global input:not(…):focus ring (0,5,1). No :host here — the
         sheet is rendered outside the host; the scoping attributes give 0,6,1. */
      .custom-modal .field input:focus {
        outline: none;
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .field-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .repeat-chips {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .repeat-chip {
        display: grid;
        justify-items: center;
        gap: 2px;
        padding: 10px 4px;
        border: 1px solid var(--h-line);
        border-radius: 16px;
        background: var(--h-canvas);
        color: var(--h-ink-soft);
        font-size: 0.74rem;
        font-weight: 800;
        text-align: center;
        cursor: pointer;
      }

      .repeat-chip > span {
        font-size: 1.15rem;
      }

      .repeat-chip--active {
        border-color: var(--h-btn-bg);
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
      }

      .repeat-chip:has(input:focus-visible) {
        outline: 3px solid var(--h-accent-glow);
        outline-offset: 2px;
      }

      .custom-modal__summary {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--h-tile-3);
        color: var(--h-ink);
        font-size: 0.84rem;
        font-weight: 700;
      }

      .modal-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
        gap: 10px;
      }

      .ghost-btn,
      .save-btn {
        min-height: 52px;
        border-radius: 999px;
        font-size: 0.95rem;
        font-weight: 800;
      }

      .ghost-btn {
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .save-btn {
        border: none;
        background: var(--h-accent);
        color: #ffffff;
        box-shadow: 0 12px 24px -12px var(--h-accent-glow);
      }

      .save-btn:disabled {
        opacity: 0.45;
        box-shadow: none;
      }

      /* Snooze options */
      .option-list {
        display: grid;
        gap: 8px;
      }

      .option-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--h-line);
        border-radius: 18px;
        background: var(--h-surface);
        color: var(--h-ink);
        text-align: left;
      }

      .option-card > div {
        display: grid;
        gap: 2px;
      }

      .option-card strong {
        font-size: 0.92rem;
        font-weight: 800;
      }

      .option-card span {
        font-size: 0.74rem;
        color: var(--h-muted);
      }

      .option-radio {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 2px solid color-mix(in srgb, var(--h-muted) 60%, transparent);
      }

      .option-card--active {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 3px var(--h-accent-glow);
      }

      .option-card--active .option-radio {
        border: 6px solid var(--h-accent);
      }

      @media (max-width: 370px) {
        .stats-panel {
          gap: 6px;
        }

        .stat-tile__label {
          font-size: 0.58rem;
        }

        .state-tab {
          font-size: 0.72rem;
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
export class RemindersPage {
  private modalHistoryActive = false;
  private suppressNextPopstateClose = false;
  private readonly destroyRef = inject(DestroyRef);
  protected readonly reminderService = inject(ReminderService);
  private readonly pantryState = inject(PantryStateService);
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly navigationHistory = inject(NavigationHistoryService);

  protected readonly bellIcon = notificationsSharp;
  protected readonly backIcon = arrowBackOutline;
  protected readonly addIcon = addOutline;
  protected readonly chevronDownIcon = chevronDownOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly activateIcon = playCircleOutline;
  protected readonly editSnoozeIcon = alarmOutline;
  protected readonly restoreIcon = refreshOutline;
  protected readonly deleteIcon = trashOutline;
  protected readonly viewIcon = eyeOutline;

  protected readonly activeState = signal<ReminderLifecycleView>('ACTIVE');
  protected readonly activeCategory = signal<ReminderCategoryFilter>('all');
  protected readonly sortOrder = signal<ReminderSortOrder>('latest');
  protected readonly customModalOpen = signal(false);
  protected readonly snoozeModalOpen = signal(false);
  protected readonly editingExistingSnooze = signal(false);
  protected readonly snoozeReminderId = signal<string | null>(null);
  protected readonly selectedSnoozePreset = signal<SnoozePreset>('later-today');
  protected readonly customSnoozeDate = signal(this.getTodayDate());
  protected readonly customSnoozeTime = signal('18:00');
  protected readonly restockModalOpen = signal(false);
  protected readonly restockReminderId = signal<string | null>(null);
  protected readonly restockItemName = signal('');
  protected readonly restockQuantityInput = signal('');
  protected readonly restockExpiryDateInput = signal('');

  protected readonly categoryTabs = [
    { label: 'All', value: 'all' },
    { label: 'Expiry', value: 'expiry' },
    { label: 'Low Stock', value: 'low-stock' },
    { label: 'Budget', value: 'budget' },
    { label: 'Cart', value: 'cart' }
  ] as const satisfies readonly { label: string; value: ReminderCategoryFilter }[];
  protected readonly stateTabs = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Snoozed', value: 'SNOOZED' },
    { label: 'Completed', value: 'COMPLETED' }
  ] as const satisfies readonly { label: string; value: ReminderLifecycleView }[];
  protected readonly recurrenceOptions = [
    { label: 'One Time', value: 'one-time' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
  ] as const satisfies readonly { label: string; value: ReminderRecurrence }[];
  protected readonly snoozeOptions = [
    { label: 'Later Today', value: 'later-today' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: 'In 3 Days', value: 'three-days' },
    { label: 'Next Week', value: 'next-week' },
    { label: 'Custom Date & Time', value: 'custom' }
  ] as const satisfies readonly { label: string; value: SnoozePreset }[];
  protected readonly summaryCards = computed(() =>
    this.categoryTabs.map((tab) => ({
      ...tab,
      count: this.stateCountForCategory(tab.value)
    }))
  );
  protected readonly activeReminders = computed(() =>
    [...this.reminderService.getVisibleReminders(this.activeCategory())].sort((left, right) =>
      this.compareReminders(left, right, this.sortOrder())
    )
  );
  protected readonly snoozedReminders = computed(() =>
    [...this.reminderService.getSnoozedReminders(this.activeCategory())].sort((left, right) =>
      this.compareReminders(left, right, this.sortOrder())
    )
  );
  protected readonly completedEntries = computed(() => this.reminderService.getCompletedReminders(this.activeCategory()));
  protected readonly completedGroups = computed(() => {
    const groups: Array<{ label: CompletedGroupLabel; entries: CompletedReminderRecord[] }> = [
      { label: 'Today', entries: [] },
      { label: 'Yesterday', entries: [] },
      { label: 'This Week', entries: [] },
      { label: 'Older', entries: [] }
    ];

    for (const entry of this.completedEntries()) {
      groups.find((group) => group.label === this.groupLabel(entry.completedAt))?.entries.push(entry);
    }

    return groups.filter((group) => group.entries.length > 0);
  });
  protected readonly customForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    recurrence: this.formBuilder.nonNullable.control<ReminderRecurrence>('one-time'),
    date: [this.getTodayDate(), Validators.required],
    time: ['09:00']
  });

  constructor() {
    void this.reminderService.load().then(() => this.reminderService.sync());

    const subscription = this.platform.backButton.subscribeWithPriority(10, () => {
      if (this.snoozeModalOpen()) {
        this.closeSnoozeSheet();
        return;
      }

      if (this.customModalOpen()) {
        this.closeCreateModal();
      }
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/settings');
  }

  /** Decorative emoji for each reminder type / category tile. */
  protected typeEmoji(type: ReminderTab): string {
    switch (type) {
      case 'expiry':
        return '⏳';
      case 'low-stock':
        return '📉';
      case 'budget':
        return '💰';
      case 'cart':
        return '🛒';
      case 'custom':
        return '🔔';
      default:
        return '🗂️';
    }
  }

  protected recurrenceEmoji(recurrence: ReminderRecurrence): string {
    switch (recurrence) {
      case 'daily':
        return '☀️';
      case 'weekly':
        return '🗓️';
      case 'monthly':
        return '📆';
      default:
        return '1️⃣';
    }
  }

  /** Human summary of the reminder being created, e.g. "Mon, 16 Nov at 09:00 · Weekly". */
  protected customReminderSummary(): string {
    const { date, time, recurrence } = this.customForm.getRawValue();
    const label = this.recurrenceOptions.find((option) => option.value === recurrence)?.label ?? 'One Time';
    if (!date) {
      return 'Pick a date for this reminder.';
    }
    const when = new Date(`${date}T${time || '09:00'}:00`);
    if (Number.isNaN(when.getTime())) {
      return label;
    }
    const day = when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `Reminds you ${day}${time ? ' at ' + time : ''} · ${label}`;
  }

  protected selectState(state: ReminderLifecycleView): void {
    this.activeState.set(state);
  }

  protected stateCount(state: ReminderLifecycleView): number {
    return this.reminderService.getReminderCountForState(state, 'all');
  }

  protected stateCountForCategory(tab: ReminderCategoryFilter): number {
    return this.reminderService.getReminderCountForState(this.activeState(), tab);
  }

  protected sectionTitle(): string {
    if (this.activeState() === 'ACTIVE') {
      return 'Active Reminders';
    }

    if (this.activeState() === 'SNOOZED') {
      return 'Snoozed Reminders';
    }

    return 'Completed Reminder History';
  }

  protected tabIcon(tab: ReminderCategoryFilter) {
    if (tab === 'all') {
      return notificationsSharp;
    }

    return this.typeIcon(tab);
  }

  protected typeIcon(type: ReminderType) {
    switch (type) {
      case 'expiry':
        return calendarOutline;
      case 'low-stock':
        return receiptOutline;
      case 'budget':
        return walletOutline;
      case 'cart':
        return cartOutline;
      default:
        return timeOutline;
    }
  }

  protected labelForType(type: ReminderTab): string {
    return this.categoryTabs.find((tab) => tab.value === type)?.label ?? 'Custom';
  }

  protected themeClass(type: ReminderTab): string {
    return type;
  }

  protected sortOrderLabel(): string {
    return this.sortOrder() === 'latest' ? 'Latest' : 'Oldest';
  }

  protected toggleSortOrder(): void {
    this.sortOrder.set(this.sortOrder() === 'latest' ? 'oldest' : 'latest');
  }

  protected emptyStateTitle(): string {
    if (this.activeCategory() === 'low-stock') {
      return 'Everything is stocked.';
    }

    if (this.activeCategory() === 'budget') {
      return 'Budget is on track.';
    }

    return `You're all caught up.`;
  }

  protected emptyStateMessage(): string {
    if (this.activeCategory() === 'low-stock') {
      return 'No active low stock reminders right now.';
    }

    if (this.activeCategory() === 'budget') {
      return 'No budget milestones need attention.';
    }

    return 'No active reminders in this view.';
  }

  protected activeDescription(reminder: ReminderItem): string {
    if (reminder.type === 'low-stock') {
      const quantity = this.extractNumber(reminder.description);
      return quantity === 1 ? 'Only 1 left in stock' : `Only ${quantity} left in stock`;
    }

    if (reminder.type === 'cart') {
      return reminder.description;
    }

    return reminder.description;
  }

  protected dueLabel(reminder: ReminderItem): string | null {
    if (!reminder.dueAt && !reminder.countLabel) {
      return null;
    }

    if (reminder.type === 'expiry') {
      return reminder.description;
    }

    if (reminder.type === 'budget') {
      return reminder.countLabel ? `${reminder.countLabel} budget milestone` : null;
    }

    if (reminder.type === 'cart') {
      return `Due since ${this.formatDateTime(reminder.dueAt)}`;
    }

    if (reminder.type === 'custom') {
      return this.formatDateTime(reminder.dueAt);
    }

    return reminder.countLabel ?? this.formatDateTime(reminder.dueAt);
  }

  protected activeStatusChip(reminder: ReminderItem): string {
    if (reminder.type === 'budget') {
      return reminder.countLabel ?? 'Budget';
    }

    if (reminder.type === 'cart') {
      return 'Pending';
    }

    if (reminder.type === 'low-stock') {
      return 'Low Stock';
    }

    if (reminder.status === 'overdue') {
      return 'Overdue';
    }

    if (reminder.status === 'due-soon') {
      return 'Due Soon';
    }

    return 'Active';
  }

  protected activeActions(reminder: ReminderItem): readonly ReminderActionKey[] {
    switch (reminder.type) {
      case 'expiry':
        return ['view-item', 'add-to-cart', 'mark-consumed', 'snooze'];
      case 'low-stock':
        return ['view-item', 'add-to-cart', 'mark-restocked', 'snooze'];
      case 'budget':
        return ['view-budget', 'mark-reviewed', 'snooze'];
      case 'cart':
        return ['view-cart', 'complete-purchase', 'snooze'];
      default:
        return ['view-details', 'mark-done', 'snooze'];
    }
  }

  protected isPrimaryActiveAction(reminder: ReminderItem, action: ReminderActionKey): boolean {
    return this.activeActions(reminder)[0] === action;
  }

  protected actionLabel(action: ReminderActionKey): string {
    switch (action) {
      case 'view-item':
        return 'View Item';
      case 'add-to-cart':
        return 'Add To Cart';
      case 'mark-consumed':
        return 'Mark Consumed';
      case 'mark-restocked':
        return 'Mark Restocked';
      case 'view-budget':
        return 'View Budget';
      case 'mark-reviewed':
        return 'Mark Reviewed';
      case 'view-cart':
        return 'View Cart';
      case 'complete-purchase':
        return 'Complete Purchase';
      case 'view-details':
        return 'View Details';
      case 'restore':
        return 'Restore';
      case 'activate-now':
        return 'Activate Now';
      case 'edit-snooze':
        return 'Edit Snooze';
      case 'snooze':
        return 'Snooze';
      case 'delete':
        return 'Delete';
      default:
        return 'Mark Done';
    }
  }

  protected actionIcon(action: ReminderActionKey) {
    switch (action) {
      case 'view-item':
      case 'view-budget':
      case 'view-cart':
      case 'view-details':
        return eyeOutline;
      case 'add-to-cart':
        return cartOutline;
      case 'mark-consumed':
      case 'mark-restocked':
      case 'mark-reviewed':
      case 'mark-done':
      case 'complete-purchase':
        return checkmarkCircleOutline;
      case 'activate-now':
        return playCircleOutline;
      case 'edit-snooze':
      case 'snooze':
        return alarmOutline;
      case 'restore':
        return refreshOutline;
      default:
        return trashOutline;
    }
  }

  protected async handleActiveAction(reminder: ReminderItem, action: ReminderActionKey): Promise<void> {
    if (action === 'snooze') {
      this.openSnoozeSheet(reminder, false);
      return;
    }

    if (action === 'view-item') {
      this.pantryState.setSearchQuery(reminder.title);
      await this.router.navigateByUrl('/tabs/pantry');
      return;
    }

    if (action === 'add-to-cart') {
      await this.reminderService.addToCart(reminder.id);
      return;
    }

    if (action === 'mark-consumed') {
      await this.reminderService.markConsumed(reminder.id);
      return;
    }

    if (action === 'mark-restocked') {
      this.openRestockSheet(reminder);
      return;
    }

    if (action === 'view-budget') {
      await this.router.navigateByUrl('/tabs/expenses');
      return;
    }

    if (action === 'mark-reviewed') {
      await this.reminderService.markReviewed(reminder.id);
      await this.reminderService.sync();
      return;
    }

    if (action === 'view-cart') {
      await this.router.navigateByUrl('/tabs/shopping-list');
      return;
    }

    if (action === 'complete-purchase') {
      await this.reminderService.completePurchase(reminder.id);
      await this.reminderService.sync();
      return;
    }

    if (action === 'mark-done') {
      await this.reminderService.markDone(reminder.id);
      await this.reminderService.sync();
      return;
    }

    await this.router.navigateByUrl(reminder.relatedRoute);
  }

  protected async activateNow(reminderId: string): Promise<void> {
    await this.reminderService.activateReminder(reminderId);
    await this.reminderService.sync();
  }

  protected async deleteReminder(reminderId: string): Promise<void> {
    await this.reminderService.deleteReminder(reminderId);
    await this.reminderService.sync();
  }

  protected async restoreCompleted(completedId: string): Promise<void> {
    await this.reminderService.restoreCompletedReminder(completedId);
    await this.reminderService.sync();
  }

  protected async deleteCompleted(completedId: string): Promise<void> {
    await this.reminderService.deleteCompletedReminder(completedId);
  }

  protected async viewCompleted(entry: CompletedReminderRecord): Promise<void> {
    await this.router.navigateByUrl(entry.relatedRoute);
  }

  protected openCreateReminderModal(): void {
    if (this.customModalOpen()) {
      return;
    }

    this.customModalOpen.set(true);

    if (typeof window === 'undefined' || this.modalHistoryActive) {
      return;
    }

    window.history.pushState({ reminderCreateModal: true }, '');
    this.modalHistoryActive = true;
  }

  protected closeCreateModal(): void {
    if (!this.customModalOpen()) {
      return;
    }

    this.customModalOpen.set(false);
    this.customForm.reset({
      name: '',
      recurrence: 'one-time',
      date: this.getTodayDate(),
      time: '09:00'
    });

    if (!this.modalHistoryActive || typeof window === 'undefined') {
      return;
    }

    this.suppressNextPopstateClose = true;
    this.modalHistoryActive = false;
    window.history.back();
  }

  protected openRestockSheet(reminder: ReminderItem): void {
    const pantryItem = reminder.relatedItemId ? this.pantryState.getById(reminder.relatedItemId) : undefined;
    this.restockReminderId.set(reminder.id);
    this.restockItemName.set(reminder.title);
    this.restockQuantityInput.set(String(pantryItem ? pantryItem.minQuantity + 1 : 1));
    this.restockExpiryDateInput.set(pantryItem?.expiryDate ?? '');
    this.restockModalOpen.set(true);
  }

  protected closeRestockSheet(): void {
    this.restockModalOpen.set(false);
    this.restockReminderId.set(null);
    this.restockItemName.set('');
    this.restockQuantityInput.set('');
    this.restockExpiryDateInput.set('');
  }

  protected updateRestockQuantity(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.restockQuantityInput.set(value);
  }

  protected updateRestockExpiryDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.restockExpiryDateInput.set(value);
  }

  protected canConfirmRestock(): boolean {
    const quantity = Number(this.restockQuantityInput());
    return Number.isFinite(quantity) && quantity > 0;
  }

  protected async confirmRestock(): Promise<void> {
    const reminderId = this.restockReminderId();
    if (!reminderId || !this.canConfirmRestock()) {
      return;
    }

    const reminder = this.reminderService
      .getVisibleReminders('all')
      .find((current) => current.id === reminderId);
    const quantity = Number(this.restockQuantityInput());
    const expiryDate = this.restockExpiryDateInput() || null;

    if (reminder?.relatedItemId) {
      const pantryItem = this.pantryState.getById(reminder.relatedItemId);
      if (pantryItem) {
        await this.pantryState.save({ ...pantryItem, quantity, expiryDate }, reminder.relatedItemId);
      }
    }

    await this.reminderService.markRestocked(reminderId);
    await this.reminderService.sync();
    this.closeRestockSheet();
  }

  protected openSnoozeSheet(reminder: ReminderItem, editMode: boolean): void {
    this.editingExistingSnooze.set(editMode);
    this.snoozeReminderId.set(reminder.id);
    this.snoozeModalOpen.set(true);

    const preset = editMode ? 'custom' : 'later-today';
    this.selectedSnoozePreset.set(preset);

    const baseDate = reminder.snoozedUntil ? new Date(reminder.snoozedUntil) : this.resolveSnoozeDate(preset);
    this.customSnoozeDate.set(this.toDateInputValue(baseDate));
    this.customSnoozeTime.set(this.toTimeInputValue(baseDate));
  }

  protected closeSnoozeSheet(): void {
    this.snoozeModalOpen.set(false);
    this.editingExistingSnooze.set(false);
    this.snoozeReminderId.set(null);
    this.selectedSnoozePreset.set('later-today');
    this.customSnoozeDate.set(this.getTodayDate());
    this.customSnoozeTime.set('18:00');
  }

  protected selectSnoozePreset(value: SnoozePreset): void {
    this.selectedSnoozePreset.set(value);
    const date = this.resolveSnoozeDate(value);
    this.customSnoozeDate.set(this.toDateInputValue(date));
    this.customSnoozeTime.set(this.toTimeInputValue(date));
  }

  protected snoozeOptionSubtitle(value: SnoozePreset): string {
    return this.resolveSnoozeDate(value).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected updateCustomSnoozeDate(event: Event): void {
    this.customSnoozeDate.set((event.target as HTMLInputElement).value);
  }

  protected updateCustomSnoozeTime(event: Event): void {
    this.customSnoozeTime.set((event.target as HTMLInputElement).value);
  }

  protected canConfirmSnooze(): boolean {
    const scheduledAt = this.selectedSnoozeDate();
    return !!scheduledAt && scheduledAt.getTime() > Date.now();
  }

  protected async confirmSnooze(): Promise<void> {
    const reminderId = this.snoozeReminderId();
    const scheduledAt = this.selectedSnoozeDate();
    if (!reminderId || !scheduledAt) {
      return;
    }

    await this.reminderService.snooze(reminderId, scheduledAt.toISOString());
    await this.reminderService.sync();
    this.closeSnoozeSheet();
    this.activeState.set('SNOOZED');
  }

  protected async saveCustomReminder(): Promise<void> {
    if (this.customForm.invalid) {
      return;
    }

    const value = this.customForm.getRawValue();
    await this.reminderService.createCustomReminder({
      name: value.name,
      recurrence: value.recurrence,
      date: value.date,
      time: value.time || null,
      notes: null
    });
    await this.reminderService.sync();
    this.closeCreateModal();
  }

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return 'No date set';
    }

    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected formatCompletedMeta(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected completionLabel(action: CompletedReminderRecord['completedByAction']): string {
    switch (action) {
      case 'MARK_CONSUMED':
        return 'Marked Consumed';
      case 'RESTOCKED':
        return 'Marked Restocked';
      case 'PURCHASE_COMPLETED':
        return 'Purchase Completed';
      case 'BUDGET_REVIEWED':
        return 'Budget Reviewed';
      case 'ADDED_TO_CART':
        return 'Added To Cart';
      default:
        return 'Marked Done';
    }
  }

  @HostListener('window:popstate')
  protected handlePopState(): void {
    if (this.suppressNextPopstateClose) {
      this.suppressNextPopstateClose = false;
      return;
    }

    if (!this.customModalOpen()) {
      return;
    }

    this.modalHistoryActive = false;
    this.customModalOpen.set(false);
  }

  private selectedSnoozeDate(): Date | null {
    if (this.selectedSnoozePreset() !== 'custom') {
      return this.resolveSnoozeDate(this.selectedSnoozePreset());
    }

    if (!this.customSnoozeDate() || !this.customSnoozeTime()) {
      return null;
    }

    return new Date(`${this.customSnoozeDate()}T${this.customSnoozeTime()}:00`);
  }

  private resolveSnoozeDate(preset: SnoozePreset): Date {
    const now = new Date();

    if (preset === 'later-today') {
      const date = new Date(now);
      date.setHours(Math.max(now.getHours() + 3, 18), 0, 0, 0);
      return date > now ? date : new Date(now.getTime() + 3 * 60 * 60 * 1000);
    }

    if (preset === 'tomorrow') {
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    }

    if (preset === 'three-days') {
      const date = new Date(now);
      date.setDate(date.getDate() + 3);
      date.setHours(9, 0, 0, 0);
      return date;
    }

    if (preset === 'next-week') {
      const date = new Date(now);
      date.setDate(date.getDate() + 7);
      date.setHours(9, 0, 0, 0);
      return date;
    }

    return new Date(`${this.customSnoozeDate()}T${this.customSnoozeTime()}:00`);
  }

  private compareReminders(left: ReminderItem, right: ReminderItem, sortOrder: ReminderSortOrder): number {
    const leftTime = new Date(left.snoozedUntil ?? left.dueAt ?? 0).getTime();
    const rightTime = new Date(right.snoozedUntil ?? right.dueAt ?? 0).getTime();

    if (leftTime !== rightTime) {
      return sortOrder === 'latest' ? rightTime - leftTime : leftTime - rightTime;
    }

    return left.title.localeCompare(right.title);
  }

  private extractNumber(label: string): number {
    const match = label.match(/\d+/);
    return Number(match?.[0] ?? 0);
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
      return 'This Week';
    }

    return 'Older';
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getTodayDate(): string {
    return this.toDateInputValue(new Date());
  }

  private toDateInputValue(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  private toTimeInputValue(value: Date): string {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
}
