import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { IonContent, IonIcon, IonModal } from '@ionic/angular/standalone';
import {
  addOutline,
  alarmOutline,
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
  imports: [IonContent, IonIcon, IonModal, ReactiveFormsModule],
  template: `
    <ion-content [fullscreen]="true" class="reminders-content">
      <div class="reminders-page">
        <header class="hero">
          <div class="hero__top">
            <div class="hero__title-block">
              <div class="hero__icon-shell">
                <ion-icon aria-hidden="true" [icon]="bellIcon" class="hero__icon" />
              </div>
              <div class="hero__copy">
                <h1>Reminders</h1>
                <p>Manage grocery reminders across active, snoozed, and completed states.</p>
              </div>
            </div>
          </div>

          <section class="stats-panel" aria-label="Reminder overview">
            @for (card of summaryCards(); track card.value) {
              <button
                type="button"
                class="stat-tile"
                [class.stat-tile--active]="activeCategory() === card.value"
                [class]="'theme-' + themeClass(card.value)"
                (click)="activeCategory.set(card.value)"
              >
                <span class="stat-tile__icon-wrap">
                  <ion-icon [icon]="tabIcon(card.value)" />
                </span>
                <strong>{{ card.count }}</strong>
                <span>{{ card.label }}</span>
              </button>
            }
          </section>

          <nav class="state-tabs" aria-label="Reminder status tabs">
            @for (tab of stateTabs; track tab.value) {
              <button
                type="button"
                class="state-tab"
                [class.state-tab--active]="activeState() === tab.value"
                (click)="selectState(tab.value)"
              >
                {{ tab.label }} ({{ stateCount(tab.value) }})
              </button>
            }
          </nav>

          <nav class="filter-row" aria-label="Reminder categories">
            @for (tab of categoryTabs; track tab.value) {
              <button
                type="button"
                class="filter-chip"
                [class.filter-chip--active]="activeCategory() === tab.value"
                (click)="activeCategory.set(tab.value)"
              >
                {{ tab.label }}
              </button>
            }
          </nav>
        </header>

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
                <ion-icon [icon]="chevronDownIcon" />
              </button>
            }
          </div>

          @if (activeState() === 'ACTIVE') {
            @if (activeReminders().length === 0) {
              <section class="empty-state-card empty-state-card--active">
                <h3>{{ emptyStateTitle() }}</h3>
                <p>{{ emptyStateMessage() }}</p>
              </section>
            } @else {
              <section class="card-stack">
                @for (reminder of activeReminders(); track reminder.id) {
                  <article class="reminder-card" [class]="'theme-' + themeClass(reminder.type)">
                    <div class="reminder-card__accent"></div>
                    <div class="reminder-card__body">
                      <div class="reminder-card__top">
                        <div class="reminder-card__identity">
                          <div class="reminder-card__icon-shell">
                            <ion-icon [icon]="typeIcon(reminder.type)" />
                          </div>

                          <div class="reminder-card__copy">
                            <p class="reminder-card__eyebrow">{{ labelForType(reminder.type) }}</p>
                            <h3>{{ reminder.title }}</h3>
                            <p class="reminder-card__description">{{ activeDescription(reminder) }}</p>

                            @if (dueLabel(reminder); as dueInfo) {
                              <p class="reminder-card__meta">
                                <ion-icon [icon]="calendarIcon" />
                                <span>{{ dueInfo }}</span>
                              </p>
                            }
                          </div>
                        </div>

                        <div class="reminder-card__status-col">
                          <span class="status-pill" [class]="'status-pill--' + themeClass(reminder.type)">
                            {{ activeStatusChip(reminder) }}
                          </span>
                        </div>
                      </div>

                      <div class="action-grid">
                        @for (action of activeActions(reminder); track action) {
                          <button
                            type="button"
                            class="action-btn"
                            [class.action-btn--primary]="isPrimaryActiveAction(reminder, action)"
                            (click)="handleActiveAction(reminder, action)"
                          >
                            <ion-icon [icon]="actionIcon(action)" />
                            <span>{{ actionLabel(action) }}</span>
                          </button>
                        }
                      </div>
                    </div>
                  </article>
                }
              </section>
            }
          }

          @if (activeState() === 'SNOOZED') {
            @if (snoozedReminders().length === 0) {
              <section class="empty-state-card empty-state-card--snoozed">
                <h3>No snoozed reminders.</h3>
                <p>Snoozed reminders will appear here until they are reactivated or restored automatically.</p>
              </section>
            } @else {
              <section class="card-stack">
                @for (reminder of snoozedReminders(); track reminder.id) {
                  <article class="reminder-card reminder-card--snoozed" [class]="'theme-' + themeClass(reminder.type)">
                    <div class="reminder-card__accent"></div>
                    <div class="reminder-card__body">
                      <div class="reminder-card__top">
                        <div class="reminder-card__copy">
                          <p class="reminder-card__eyebrow">{{ labelForType(reminder.type) }}</p>
                          <h3>{{ reminder.title }}</h3>
                          <p class="reminder-card__description">Snoozed until {{ formatDateTime(reminder.snoozedUntil) }}</p>
                        </div>

                        <div class="reminder-card__status-col">
                          <span class="status-pill status-pill--snoozed">Snoozed</span>
                        </div>
                      </div>

                      <div class="action-grid action-grid--compact">
                        <button type="button" class="action-btn action-btn--primary" (click)="activateNow(reminder.id)">
                          <ion-icon [icon]="activateIcon" />
                          <span>Activate Now</span>
                        </button>
                        <button type="button" class="action-btn" (click)="openSnoozeSheet(reminder, true)">
                          <ion-icon [icon]="editSnoozeIcon" />
                          <span>Edit Snooze</span>
                        </button>
                        <button type="button" class="action-btn action-btn--danger" (click)="deleteReminder(reminder.id)">
                          <ion-icon [icon]="deleteIcon" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </article>
                }
              </section>
            }
          }

          @if (activeState() === 'COMPLETED') {
            @if (completedGroups().length === 0) {
              <section class="empty-state-card empty-state-card--completed">
                <h3>No completed reminders yet.</h3>
                <p>Completed reminder history will appear here once actions are resolved.</p>
              </section>
            } @else {
              @for (group of completedGroups(); track group.label) {
                <section class="group-section">
                  <h3 class="group-title">{{ group.label }}</h3>
                  <div class="card-stack">
                    @for (entry of group.entries; track entry.id) {
                      <article class="reminder-card reminder-card--completed" [class]="'theme-' + themeClass(entry.type)">
                        <div class="reminder-card__accent"></div>
                        <div class="reminder-card__body">
                          <div class="reminder-card__top">
                            <div class="reminder-card__copy">
                              <p class="reminder-card__eyebrow">{{ labelForType(entry.type) }}</p>
                              <h3>{{ entry.title }}</h3>
                              <p class="reminder-card__description">{{ completionLabel(entry.completedByAction) }}</p>
                              <p class="reminder-card__meta">
                                <ion-icon [icon]="calendarIcon" />
                                <span>{{ formatCompletedMeta(entry.completedAt) }}</span>
                              </p>
                            </div>

                            <div class="reminder-card__status-col">
                              <span class="status-pill status-pill--completed">Completed</span>
                            </div>
                          </div>

                          <div class="action-grid action-grid--compact">
                            <button type="button" class="action-btn" (click)="viewCompleted(entry)">
                              <ion-icon [icon]="viewIcon" />
                              <span>View Details</span>
                            </button>
                            <button type="button" class="action-btn" (click)="restoreCompleted(entry.id)">
                              <ion-icon [icon]="restoreIcon" />
                              <span>Restore</span>
                            </button>
                            <button type="button" class="action-btn action-btn--danger" (click)="deleteCompleted(entry.id)">
                              <ion-icon [icon]="deleteIcon" />
                              <span>Delete</span>
                            </button>
                          </div>
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
        <ion-icon [icon]="addIcon" />
        <span>Create Reminder</span>
      </button>
    </div>

    <ion-modal [isOpen]="customModalOpen()" [initialBreakpoint]="0.94" [breakpoints]="[0, 0.94]" (didDismiss)="closeCreateModal()">
      <ng-template>
        <form class="custom-modal" [formGroup]="customForm" (ngSubmit)="saveCustomReminder()">
          <div class="sheet-handle"></div>
          <div class="custom-modal__body">
            <header class="custom-modal__header">
              <h2>Create Reminder</h2>
              <p>Store one-time or repeating reminders locally on this device.</p>
            </header>

            <div class="custom-modal__fields">
              <label class="field">
                <span>Reminder Name</span>
                <input type="text" formControlName="name" placeholder="e.g. Buy Basmati Rice" />
              </label>

              <label class="field">
                <span>Type</span>
                <select formControlName="recurrence">
                  @for (option of recurrenceOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </label>

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

          <footer class="custom-modal__footer">
            <div class="modal-actions">
              <button type="button" class="ghost-btn" (click)="closeCreateModal()">Cancel</button>
              <button type="submit" class="save-btn" [disabled]="customForm.invalid">Save Reminder</button>
            </div>
          </footer>
        </form>
      </ng-template>
    </ion-modal>

    <ion-modal [isOpen]="snoozeModalOpen()" [initialBreakpoint]="0.72" [breakpoints]="[0, 0.72]" (didDismiss)="closeSnoozeSheet()">
      <ng-template>
        <div class="custom-modal snooze-modal">
          <div class="sheet-handle"></div>
          <div class="custom-modal__body">
            <header class="custom-modal__header">
              <h2>Snooze Reminder</h2>
              <p>Choose when this reminder should return to your active list.</p>
            </header>

            <div class="option-list">
              @for (option of snoozeOptions; track option.value) {
                <button
                  type="button"
                  class="option-card"
                  [class.option-card--active]="selectedSnoozePreset() === option.value"
                  (click)="selectSnoozePreset(option.value)"
                >
                  <div>
                    <strong>{{ option.label }}</strong>
                    <span>{{ snoozeOptionSubtitle(option.value) }}</span>
                  </div>
                  <span class="option-radio"></span>
                </button>
              }
            </div>

            @if (selectedSnoozePreset() === 'custom') {
              <div class="custom-modal__fields">
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
          </div>

          <footer class="custom-modal__footer">
            <div class="modal-actions">
              <button type="button" class="ghost-btn" (click)="closeSnoozeSheet()">Cancel</button>
              <button type="button" class="save-btn" [disabled]="!canConfirmSnooze()" (click)="confirmSnooze()">
                Confirm Snooze
              </button>
            </div>
          </footer>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(174, 231, 206, 0.42), transparent 24%),
          radial-gradient(circle at top right, rgba(255, 221, 221, 0.28), transparent 22%),
          linear-gradient(180deg, #f7fbf7 0%, #f5f7f4 100%);
      }

      .reminders-content {
        --background: transparent;
      }

      .reminders-page {
        min-height: 100%;
        padding: 0 0 5rem;
      }

      .hero {
        display: grid;
        gap: 1rem;
        padding: calc(env(safe-area-inset-top, 0px) + 1rem) 0.9rem 0;
      }

      .hero__top,
      .hero__title-block,
      .section-head,
      .reminder-card__top,
      .reminder-card__identity,
      .reminder-card__status-col,
      .sort-chip,
      .create-btn,
      .state-tabs,
      .action-btn {
        display: flex;
      }

      .hero__top,
      .section-head,
      .reminder-card__top {
        justify-content: space-between;
      }

      .hero__top,
      .reminder-card__top {
        gap: 1rem;
      }

      .hero__title-block,
      .reminder-card__identity {
        align-items: flex-start;
        gap: 0.9rem;
        min-width: 0;
      }

      .hero__icon-shell,
      .stat-tile,
      .state-tab,
      .empty-state-card,
      .reminder-card,
      .sort-chip,
      .option-card {
        backdrop-filter: blur(18px);
      }

      .hero__icon-shell {
        width: auto;
        height: auto;
        background: transparent;
        border: none;
        box-shadow: none;
      }

      .hero__icon,
      .state-tab--active,
      .create-btn,
      .action-btn--primary {
        color: #fff;
      }

      .hero__icon {
        font-size: 2rem;
        margin-top: 0.15rem;
        color: #118452;
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
      .stat-tile strong,
      .create-btn,
      .state-tab {
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
      }

      h1 {
        color: #0f8856;
        font-size: clamp(1.7rem, 6vw, 2.1rem);
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .hero__copy p {
        margin-top: 0.3rem;
        max-width: 24rem;
        color: #607468;
        font-size: 0.92rem;
        line-height: 1.42;
      }

      .stats-panel {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.5rem;
        padding: 0.75rem;
        border: 1px solid rgba(220, 229, 222, 0.95);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.78);
        box-shadow: 0 18px 44px rgba(16, 63, 40, 0.08);
        overflow-x: auto;
        scrollbar-width: none;
      }

      .stats-panel::-webkit-scrollbar {
        display: none;
      }

      .stat-tile {
        min-height: 6rem;
        min-width: 0;
        padding: 0.7rem 0.25rem;
        border: 1px solid #dbe5de;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 251, 249, 0.88));
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 0.35rem;
        color: #203f31;
        text-align: center;
      }

      .stat-tile__icon-wrap {
        width: 2.45rem;
        height: 2.45rem;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(238, 244, 240, 0.9);
        font-size: 1.05rem;
      }

      .stat-tile strong {
        font-size: 1.2rem;
        line-height: 1;
      }

      .stat-tile span:last-child {
        font-size: 0.72rem;
        font-weight: 600;
      }

      .stat-tile--active {
        background: linear-gradient(180deg, #ffffff 0%, #f0f7f3 100%);
        box-shadow: 0 16px 30px rgba(16, 63, 40, 0.08);
      }

      .state-tabs {
        gap: 0.55rem;
        overflow-x: auto;
        padding-bottom: 0.15rem;
        scrollbar-width: none;
      }

      .state-tabs::-webkit-scrollbar,
      .filter-row::-webkit-scrollbar {
        display: none;
      }

      .state-tab,
      .filter-chip {
        flex: 0 0 auto;
        border-radius: 999px;
        font: inherit;
        white-space: nowrap;
      }

      .state-tab {
        min-height: 2.55rem;
        padding: 0 1rem;
        border: 1px solid #d7e5dc;
        background: rgba(255, 255, 255, 0.88);
        color: #325545;
        font-size: 0.86rem;
        font-weight: 800;
      }

      .state-tab--active {
        border-color: #0a8f5b;
        background: #0a8f5b;
      }

      .filter-row {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding-bottom: 0.25rem;
        scrollbar-width: none;
      }

      .filter-chip {
        min-height: 2rem;
        padding: 0.3rem 0.9rem;
        border: 1px solid #d2dce6;
        background: #f8fafc;
        color: #4c5a54;
        font-size: 0.825rem;
        font-weight: 600;
      }

      .filter-chip--active {
        border-color: #006c49;
        background: #dbf8ea;
        color: #006c49;
      }

      .theme-all {
        color: #118452;
      }

      .theme-all .stat-tile__icon-wrap {
        background: #e5f6ec;
      }

      .theme-expiry {
        color: #ff7a00;
      }

      .theme-expiry .stat-tile__icon-wrap {
        background: #fff0e1;
      }

      .theme-low-stock {
        color: #1772ee;
      }

      .theme-low-stock .stat-tile__icon-wrap {
        background: #e9f2ff;
      }

      .theme-budget {
        color: #8f43ff;
      }

      .theme-budget .stat-tile__icon-wrap {
        background: #f1e9ff;
      }

      .theme-cart {
        color: #ef476f;
      }

      .theme-cart .stat-tile__icon-wrap {
        background: #ffe8ef;
      }

      .theme-custom {
        color: #0d9488;
      }

      .theme-custom .stat-tile__icon-wrap {
        background: #e5fbf8;
      }

      .reminders-main {
        padding: 1.35rem 0.9rem 0;
      }

      .section-head {
        align-items: center;
        margin-bottom: 1rem;
      }

      .section-head h2 {
        flex: 1 1 auto;
        min-width: 0;
        color: #173a29;
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .sort-chip {
        flex: 0 0 auto;
        align-items: center;
        min-height: 2.25rem;
        padding: 0 0.8rem;
        border: none;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.55);
        color: #0d8a57;
        font-weight: 700;
        font-size: 0.88rem;
      }

      .card-stack {
        display: grid;
        gap: 0.75rem;
      }

      .group-section + .group-section {
        margin-top: 1.1rem;
      }

      .group-title {
        margin-bottom: 0.75rem;
        color: #0f7a4e;
        font-size: 1rem;
        font-weight: 800;
      }

      .reminder-card,
      .empty-state-card {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(217, 226, 220, 0.96);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 16px 36px rgba(16, 63, 40, 0.08);
      }

      .reminder-card__accent {
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: currentColor;
      }

      .reminder-card__body {
        padding: 0.95rem 0.95rem 1rem 1rem;
      }

      .reminder-card__icon-shell {
        width: 3.45rem;
        height: 3.45rem;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, currentColor 12%, white);
        color: currentColor;
        flex: 0 0 auto;
        font-size: 1.7rem;
      }

      .reminder-card__copy {
        min-width: 0;
      }

      .reminder-card__eyebrow {
        color: currentColor;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .reminder-card h3 {
        margin-top: 0.15rem;
        color: #173727;
        font-size: 1.1rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.15;
      }

      .reminder-card__description {
        margin-top: 0.24rem;
        color: #315443;
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.35;
      }

      .reminder-card__meta {
        display: inline-flex;
        align-items: center;
        gap: 0.38rem;
        margin-top: 0.38rem;
        color: #667a70;
        font-size: 0.82rem;
      }

      .reminder-card__status-col {
        flex-direction: column;
        align-items: flex-end;
        gap: 0.65rem;
        flex: 0 0 auto;
      }

      .status-pill {
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        line-height: 1;
        background: rgba(12, 138, 87, 0.1);
      }

      .status-pill--expiry {
        color: #e64b4b;
        background: #ffecee;
      }

      .status-pill--low-stock {
        color: #1772ee;
        background: #e9f2ff;
      }

      .status-pill--budget {
        color: #8f43ff;
        background: #f1e9ff;
      }

      .status-pill--cart {
        color: #ef476f;
        background: #ffe8ef;
      }

      .status-pill--custom,
      .status-pill--all {
        color: #0d9488;
        background: #e5fbf8;
      }

      .status-pill--snoozed {
        color: #6557ff;
        background: #efecff;
      }

      .status-pill--completed {
        color: #0a8f5b;
        background: #e7f8ed;
      }

      .action-grid {
        display: flex;
        gap: 0.55rem;
        margin-top: 0.85rem;
        overflow-x: auto;
        padding-bottom: 0.15rem;
        scrollbar-width: none;
      }

      .action-grid--compact {
        gap: 0.5rem;
      }

      .action-grid::-webkit-scrollbar {
        display: none;
      }

      .action-btn {
        flex: 0 0 auto;
        min-height: 2.6rem;
        min-width: max-content;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.35rem 0.75rem;
        border-radius: 14px;
        border: 1px solid #d9e2dc;
        background: #fff;
        color: #244636;
        font-size: 0.84rem;
        font-weight: 700;
      }

      .action-btn ion-icon {
        font-size: 0.95rem;
        flex: 0 0 auto;
      }

      .action-btn--primary {
        border-color: transparent;
        background: #0d8a57;
      }

      .action-btn--danger {
        color: #cf3a57;
      }

      .empty-state-card {
        display: grid;
        gap: 0.45rem;
        padding: 1.35rem 1.2rem;
        text-align: center;
        border-color: rgba(215, 227, 220, 0.96);
      }

      .empty-state-card--active {
        background:
          radial-gradient(circle at top left, rgba(200, 244, 220, 0.95), transparent 34%),
          linear-gradient(145deg, #f8fffb 0%, #eef8f2 48%, #f3fbff 100%);
      }

      .empty-state-card--snoozed {
        background:
          radial-gradient(circle at top right, rgba(232, 223, 255, 0.95), transparent 36%),
          linear-gradient(145deg, #fcfbff 0%, #f3efff 52%, #eef7ff 100%);
      }

      .empty-state-card--completed {
        background:
          radial-gradient(circle at top left, rgba(210, 248, 222, 0.98), transparent 34%),
          linear-gradient(145deg, #fbfff9 0%, #effaf0 50%, #fff8ef 100%);
      }

      .empty-state-card h3 {
        color: #173727;
        font-size: 1.25rem;
        font-weight: 800;
      }

      .empty-state-card p {
        color: #60786b;
        line-height: 1.45;
      }

      .sticky-create-bar {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        width: min(720px, calc(100% - 1rem));
        bottom: 0.35rem;
        z-index: 25;
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
        pointer-events: none;
      }

      .create-btn {
        pointer-events: auto;
        min-height: 3.2rem;
        padding: 0 1rem;
        border: none;
        border-radius: 999px;
        align-items: center;
        gap: 0.55rem;
        background: #0d8a57;
        font-size: 0.92rem;
        font-weight: 800;
        box-shadow: 0 16px 30px rgba(13, 138, 87, 0.28);
      }

      .custom-modal {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem 0.9rem calc(1rem + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(180deg, #f7fbf8 0%, #eef5f0 100%);
      }

      .snooze-modal {
        padding-bottom: calc(0.8rem + env(safe-area-inset-bottom, 0px));
      }

      .sheet-handle {
        width: 4rem;
        height: 0.3rem;
        margin: 0 auto 0.2rem;
        border-radius: 999px;
        background: #b1cfbc;
      }

      .custom-modal__body {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        gap: 0.75rem;
        overflow: auto;
      }

      .custom-modal__header,
      .custom-modal__fields,
      .field,
      .option-list {
        display: grid;
        gap: 0.6rem;
      }

      .custom-modal__header,
      .field,
      .option-card {
        padding: 1rem;
        border-radius: 18px;
        background: #fff;
        border: 1px solid #dae7de;
        box-shadow: 0 8px 24px rgba(7, 61, 39, 0.06);
      }

      .custom-modal__header h2 {
        color: #163828;
        font-size: 1.35rem;
        font-weight: 800;
      }

      .custom-modal__header p {
        color: #5d7669;
      }

      .field span {
        color: #315443;
        font-size: 0.8rem;
        font-weight: 800;
      }

      .field input,
      .field select {
        width: 100%;
        border: 1px solid #d7e4dc;
        border-radius: 12px;
        padding: 0.8rem 0.9rem;
        font: inherit;
        color: #173727;
        background: #fff;
      }

      .option-card {
        width: 100%;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        text-align: left;
      }

      .option-card strong {
        color: #173727;
        display: block;
      }

      .option-card span {
        color: #647a6d;
        font-size: 0.84rem;
      }

      .option-card--active {
        border-color: #0a8f5b;
        box-shadow: 0 14px 28px rgba(10, 143, 91, 0.1);
      }

      .option-radio {
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 50%;
        border: 2px solid #c4d3cb;
      }

      .option-card--active .option-radio {
        border-color: #0a8f5b;
        background: radial-gradient(circle, #0a8f5b 0 45%, transparent 46%);
      }

      .custom-modal__footer {
        flex: 0 0 auto;
        background: linear-gradient(135deg, #f1f7f3 0%, #e3efe8 100%);
        border: 1px solid #d2e3d8;
        border-radius: 16px;
        box-shadow: 0 -8px 24px rgba(7, 61, 39, 0.06);
        padding: 0.85rem 0.85rem calc(1rem + env(safe-area-inset-bottom, 0px));
      }

      .modal-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.7rem;
      }

      .ghost-btn,
      .save-btn {
        min-height: 3rem;
        border-radius: 999px;
        font-weight: 800;
      }

      .ghost-btn {
        border: 1px solid #0a8f5b;
        background: #fff;
        color: #0a8f5b;
      }

      .save-btn {
        border: none;
        background: #0a8f5b;
        color: #fff;
      }

      .save-btn:disabled {
        opacity: 0.55;
      }

      @media (max-width: 560px) {
        .hero {
          padding-inline: 0.8rem;
        }

        .stats-panel {
          gap: 0.4rem;
          padding: 0.65rem;
        }

        .stat-tile {
          min-height: 5.6rem;
          padding-inline: 0.2rem;
        }

        .stat-tile__icon-wrap {
          width: 2.2rem;
          height: 2.2rem;
          font-size: 0.95rem;
        }

        .action-btn {
          font-size: 0.8rem;
          padding-inline: 0.7rem;
        }

        .reminder-card__top {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0.8rem;
        }

        .reminder-card__status-col {
          align-items: flex-start;
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

  protected readonly bellIcon = notificationsSharp;
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
      await this.reminderService.markRestocked(reminder.id);
      await this.reminderService.sync();
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
