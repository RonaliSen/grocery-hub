import { computed, inject, Injectable, signal } from '@angular/core';
import { LocalNotificationSchema } from '@capacitor/local-notifications';

import { createId } from '../../../core/utils/id.utils';
import {
  addDays,
  differenceInCalendarDays,
  scheduleAtLocalHour,
  toLocalDateOnly
} from '../../../core/utils/date.utils';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ExpenseService } from '../../expenses/services/expense.service';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryConsumptionService } from '../../pantry/services/pantry-consumption.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import {
  getPantryLowStockThreshold,
  isPantryItemBelowThreshold
} from '../../pantry/utils/pantry-stock-status.util';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import {
  CompletedReminderRecord,
  CustomReminderDraft,
  CustomReminderRecord,
  DEFAULT_REMINDER_STORE,
  ReminderAutoSnapshot,
  ReminderCompletionAction,
  ReminderHistoryEntry,
  ReminderHistoryStatus,
  ReminderItem,
  ReminderLifecycleStatus,
  ReminderLifecycleView,
  ReminderRecurrence,
  ReminderStateRecord,
  ReminderStatus,
  ReminderStore,
  ReminderTab,
  ReminderType
} from '../models/reminder.model';
import { ReminderRepositoryService } from './reminder-repository.service';

type InternalReminder = ReminderItem & {
  readonly notificationKey: string;
  readonly notificationTitle: string;
  readonly notificationBody: string;
  readonly immediateNotification: boolean;
};

type LegacyReminderStateRecord = {
  readonly reminderId?: string;
  readonly baseId?: string;
  readonly hidden?: boolean;
  readonly snoozedUntil?: string | null;
  readonly updatedAt?: string;
  readonly status?: ReminderLifecycleStatus;
};

type LegacyReminderStore = Partial<ReminderStore> & {
  readonly states?: readonly LegacyReminderStateRecord[];
};

const CART_INACTIVITY_DAYS = 3;
const DEFAULT_CUSTOM_REMINDER_HOUR = 9;
const MAX_HISTORY_ITEMS = 150;
const COMPLETED_RETENTION_DAYS = 30;
const BUDGET_MILESTONES = [80, 90, 100] as const;

@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  private readonly repository = inject(ReminderRepositoryService);
  private readonly notifications = inject(NotificationsService);
  private readonly pantryState = inject(PantryStateService);
  private readonly pantryConsumption = inject(PantryConsumptionService);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly settingsService = inject(SettingsService);
  private readonly expenseService = inject(ExpenseService);
  private readonly storeState = signal<ReminderStore>(DEFAULT_REMINDER_STORE);
  private readonly loadedState = signal(false);

  readonly loaded = computed(() => this.loadedState());
  readonly reminders = computed(() => this.getVisibleReminders('all'));
  readonly activeCount = computed(() => this.reminders().length);
  readonly snoozedCount = computed(() => this.getSnoozedReminders('all').length);
  readonly completedCount = computed(() => this.getCompletedReminders('all').length);
  readonly completed = computed(() =>
    [...this.storeState().completed].sort((left, right) => right.completedAt.localeCompare(left.completedAt))
  );

  async load(): Promise<void> {
    if (this.loadedState()) {
      return;
    }

    const store = await this.repository.getStore();
    this.storeState.set(this.normalizeStore(store));
    this.loadedState.set(true);
  }

  getVisibleReminders(tab: ReminderTab): readonly ReminderItem[] {
    const reminders = this.buildActiveReminders();
    return tab === 'all' ? reminders : reminders.filter((reminder) => reminder.type === tab);
  }

  getSnoozedReminders(tab: ReminderTab): readonly ReminderItem[] {
    const reminders = this.buildSnoozedReminders();
    return tab === 'all' ? reminders : reminders.filter((reminder) => reminder.type === tab);
  }

  getCompletedReminders(tab: ReminderTab): readonly CompletedReminderRecord[] {
    const reminders = this.completed();
    return tab === 'all' ? reminders : reminders.filter((reminder) => reminder.type === tab);
  }

  getReminderCount(tab: ReminderTab): number {
    return this.getVisibleReminders(tab).length;
  }

  getReminderCountForState(state: ReminderLifecycleView, tab: ReminderTab): number {
    if (state === 'ACTIVE') {
      return this.getVisibleReminders(tab).length;
    }

    if (state === 'SNOOZED') {
      return this.getSnoozedReminders(tab).length;
    }

    return this.getCompletedReminders(tab).length;
  }

  async sync(): Promise<void> {
    await this.load();

    const store = this.storeState();
    const sourceAutoReminders = this.buildAutoReminders();
    const completed = this.pruneCompletedEntries(
      this.buildAutoCompletedEntries(store.activeAutoSnapshots, sourceAutoReminders, store.completed)
    );
    const notificationPlan = await this.buildNotifications(this.buildActiveReminders());

    const nextStore: ReminderStore = {
      ...store,
      completed,
      history: this.pruneHistory(store.history),
      activeAutoSnapshots: sourceAutoReminders.map((reminder) => ({
        reminderId: reminder.id,
        baseId: reminder.baseId,
        reminderType: reminder.type as ReminderAutoSnapshot['reminderType'],
        title: reminder.title,
        description: reminder.description,
        relatedItemId: reminder.relatedItemId,
        relatedRoute: reminder.relatedRoute,
        capturedAt: new Date().toISOString()
      })),
      states: this.normalizeExpiredSnoozes(store.states),
      notifiedKeys: this.collectNotifiedKeys(store.notifiedKeys, notificationPlan)
    };

    this.storeState.set(nextStore);
    await Promise.all([
      this.repository.saveStore(nextStore),
      this.replaceNotifications(notificationPlan.map((entry) => entry.notification))
    ]);
  }

  async createCustomReminder(draft: CustomReminderDraft): Promise<void> {
    await this.load();
    const timestamp = new Date().toISOString();
    const reminder: CustomReminderRecord = {
      id: createId('custom-reminder'),
      name: draft.name.trim(),
      recurrence: draft.recurrence,
      date: draft.date,
      time: draft.time?.trim() || null,
      notes: draft.notes?.trim() || null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.commitStore({
      ...this.storeState(),
      customReminders: [reminder, ...this.storeState().customReminders]
    });
  }

  async markDone(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    if (reminder.type === 'budget') {
      await this.completeReminder(reminder, 'BUDGET_REVIEWED');
      return;
    }

    if (reminder.type === 'custom') {
      await this.completeCustomReminder(reminder, 'MARK_DONE');
      return;
    }

    await this.completeReminder(reminder, 'MARK_DONE');
  }

  async snooze(reminderId: string, snoozedUntil: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    const states = this.upsertState(reminder.baseId, {
      status: 'SNOOZED',
      snoozedUntil
    });

    await this.commitStore({
      ...this.storeState(),
      states,
      history: this.pushHistoryEntry(this.storeState().history, this.createHistoryEntry(reminder, 'snoozed'))
    });
  }

  async deleteReminder(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    const customReminders =
      reminder.type === 'custom'
        ? this.storeState().customReminders.filter(
            (entry) => this.getCustomReminderBaseId(entry.id) !== reminder.baseId
          )
        : this.storeState().customReminders;

    await this.commitStore({
      ...this.storeState(),
      customReminders,
      states: this.upsertState(reminder.baseId, {
        status: 'DELETED',
        snoozedUntil: null
      }),
      history: this.pushHistoryEntry(this.storeState().history, this.createHistoryEntry(reminder, 'deleted'))
    });
  }

  async markConsumed(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder?.relatedItemId) {
      return;
    }

    await this.pantryConsumption.consume(reminder.relatedItemId, 1);
    await this.completeReminder(reminder, 'MARK_CONSUMED');
    await this.sync();
  }

  async addToCart(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder?.relatedItemId) {
      return;
    }

    const item = this.pantryState.getById(reminder.relatedItemId);
    if (!item) {
      return;
    }

    await this.shoppingState.addFromPantryItem(item);

    if (reminder.type === 'expiry' || reminder.type === 'low-stock') {
      await this.completeReminder(reminder, 'ADDED_TO_CART');
    }

    await this.sync();
  }

  async restoreCompletedReminder(completedId: string): Promise<void> {
    await this.load();
    const completed = this.storeState().completed.find((entry) => entry.id === completedId);
    if (!completed) {
      return;
    }

    let customReminders = this.storeState().customReminders;
    if (
      completed.customReminder &&
      !customReminders.some(
        (entry) => this.getCustomReminderBaseId(entry.id) === completed.baseId
      )
    ) {
      customReminders = [completed.customReminder, ...customReminders];
    }

    await this.commitStore({
      ...this.storeState(),
      customReminders,
      completed: this.storeState().completed.filter((entry) => entry.id !== completedId),
      activeAutoSnapshots: this.storeState().activeAutoSnapshots.filter(
        (entry) => entry.baseId !== completed.baseId
      ),
      states: this.upsertState(completed.baseId, {
        status: 'ACTIVE',
        snoozedUntil: null
      })
    });
  }

  async deleteCompletedReminder(completedId: string): Promise<void> {
    await this.load();
    await this.commitStore({
      ...this.storeState(),
      completed: this.storeState().completed.filter((entry) => entry.id !== completedId)
    });
  }

  async clearCompletedReminders(): Promise<void> {
    await this.load();
    await this.commitStore({
      ...this.storeState(),
      completed: []
    });
  }

  async activateReminder(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    await this.commitStore({
      ...this.storeState(),
      states: this.upsertState(reminder.baseId, {
        status: 'ACTIVE',
        snoozedUntil: null
      })
    });
  }

  async markRestocked(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    await this.completeReminder(reminder, 'RESTOCKED');
  }

  async markReviewed(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    await this.completeReminder(reminder, 'BUDGET_REVIEWED');
  }

  async completePurchase(reminderId: string): Promise<void> {
    await this.load();
    const reminder = this.findCurrentReminderById(reminderId);
    if (!reminder) {
      return;
    }

    await this.completeReminder(reminder, 'PURCHASE_COMPLETED');
  }

  getCompletedSummary(): {
    totalCompleted: number;
    completedThisMonth: number;
    itemsSaved: number;
    autoResolved: number;
  } {
    const completed = this.completed();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return {
      totalCompleted: completed.length,
      completedThisMonth: completed.filter((entry) => {
        const date = new Date(entry.completedAt);
        return date.getMonth() === month && date.getFullYear() === year;
      }).length,
      itemsSaved: completed.filter((entry) => entry.type === 'expiry' || entry.type === 'low-stock').length,
      autoResolved: completed.filter((entry) => entry.isAutoResolved).length
    };
  }

  getCompletedAnalytics(): ReadonlyArray<{ label: string; value: number }> {
    const completed = this.completed();
    return [
      { label: 'Total completed reminders', value: completed.length },
      { label: 'Expiry reminders resolved', value: completed.filter((entry) => entry.type === 'expiry').length },
      { label: 'Low stock reminders resolved', value: completed.filter((entry) => entry.type === 'low-stock').length },
      { label: 'Budget alerts reviewed', value: completed.filter((entry) => entry.type === 'budget').length },
      { label: 'Cart reminders completed', value: completed.filter((entry) => entry.type === 'cart').length }
    ];
  }

  private async completeCustomReminder(
    reminder: InternalReminder,
    action: ReminderCompletionAction
  ): Promise<void> {
    const customReminder = this.storeState().customReminders.find(
      (entry) => this.getCustomReminderBaseId(entry.id) === reminder.baseId
    );
    if (!customReminder) {
      return;
    }

    let customReminders = this.storeState().customReminders;
    if (customReminder.recurrence === 'one-time') {
      customReminders = customReminders.filter((entry) => entry.id !== customReminder.id);
    } else {
      const nextOccurrence = this.addRecurrence(
        this.combineDateTime(customReminder.date, customReminder.time),
        customReminder.recurrence
      );
      const nextDate = toLocalDateOnly(nextOccurrence);
      const nextTime = customReminder.time ?? this.formatTime(nextOccurrence);

      customReminders = customReminders.map((entry) =>
        entry.id === customReminder.id
          ? {
              ...entry,
              date: nextDate,
              time: nextTime,
              updatedAt: new Date().toISOString()
            }
          : entry
      );
    }

    await this.commitStore({
      ...this.storeState(),
      customReminders,
      completed: this.addCompletedEntry(
        this.storeState().completed,
        this.createCompletedEntry(reminder, action, false, customReminder)
      ),
      states: this.upsertState(reminder.baseId, {
        status: customReminder.recurrence === 'one-time' ? 'COMPLETED' : 'ACTIVE',
        snoozedUntil: null
      }),
      history: this.pushHistoryEntry(this.storeState().history, this.createHistoryEntry(reminder, 'completed'))
    });
  }

  private async completeReminder(
    reminder: InternalReminder,
    action: ReminderCompletionAction,
    isAutoResolved = false
  ): Promise<void> {
    await this.commitStore({
      ...this.storeState(),
      completed: this.addCompletedEntry(
        this.storeState().completed,
        this.createCompletedEntry(reminder, action, isAutoResolved)
      ),
      states: this.upsertState(reminder.baseId, {
        status: 'COMPLETED',
        snoozedUntil: null
      }),
      history: this.pushHistoryEntry(this.storeState().history, this.createHistoryEntry(reminder, 'completed'))
    });
  }

  private async commitStore(store: ReminderStore): Promise<void> {
    const normalizedStore = this.normalizeStore(store);
    this.storeState.set(normalizedStore);
    await this.repository.saveStore(normalizedStore);
  }

  private buildActiveReminders(): readonly InternalReminder[] {
    return this.buildCurrentReminders().filter((reminder) => this.getLifecycleStatus(reminder.baseId) === 'ACTIVE');
  }

  private buildSnoozedReminders(): readonly InternalReminder[] {
    return this.buildCurrentReminders().filter((reminder) => this.getLifecycleStatus(reminder.baseId) === 'SNOOZED');
  }

  private buildCurrentReminders(): readonly InternalReminder[] {
    return [...this.buildAutoReminders(), ...this.buildCustomReminders()]
      .map((reminder) => ({
        ...reminder,
        snoozedUntil: this.getReminderSnoozedUntil(reminder.baseId)
      }))
      .filter((reminder) => this.getLifecycleStatus(reminder.baseId) !== 'DELETED')
      .filter((reminder) => this.getLifecycleStatus(reminder.baseId) !== 'COMPLETED')
      .sort((left, right) => this.sortReminder(left, right));
  }

  private buildAutoReminders(): readonly InternalReminder[] {
    return [
      ...this.buildExpiryReminders(this.pantryState.items()),
      ...this.buildLowStockReminders(this.pantryState.items()),
      ...this.buildBudgetReminders(),
      ...this.buildCartReminders()
    ];
  }

  /** Days before expiry to remind, as chosen in Account settings (1, 3 or 7). */
  private expiryLeadDays(): number {
    return this.settingsService.settings().reminderSettings.expiryLeadDays;
  }

  private buildExpiryReminders(items: readonly PantryItem[]): readonly InternalReminder[] {
    const leadDays = this.expiryLeadDays();
    return items
      .filter((item) => item.expiryDate && differenceInCalendarDays(item.expiryDate) <= leadDays)
      .map((item) => {
        const daysLeft = differenceInCalendarDays(item.expiryDate!);
        const status = daysLeft < 0 ? 'overdue' : 'due-soon';
        const description =
          daysLeft < 0
            ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
            : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

        return {
          id: `expiry-${item.id}-${item.expiryDate}`,
          baseId: `expiry-${item.id}`,
          type: 'expiry',
          title: item.name,
          description,
          status,
          dueAt: `${item.expiryDate}T00:00:00`,
          snoozedUntil: null,
          countLabel: item.expiryDate,
          relatedItemId: item.id,
          relatedRoute: '/tabs/pantry',
          actions: ['view-item', 'mark-consumed', 'add-to-cart'],
          canMarkDone: false,
          canDelete: true,
          isAutoGenerated: true,
          notificationKey: `notify-expiry-${item.id}-${item.expiryDate}`,
          notificationTitle: `${item.name} expires soon`,
          notificationBody: `Use or replace ${item.name} before ${item.expiryDate}.`,
          immediateNotification: false
        } satisfies InternalReminder;
      });
  }

  private buildLowStockReminders(items: readonly PantryItem[]): readonly InternalReminder[] {
    return items
      .filter((item) =>
        isPantryItemBelowThreshold(item, this.settingsService.settings().defaultLowStockThreshold)
      )
      .filter((item) => !this.shoppingState.getActiveLinkedPantryItem(item.id))
      .map((item) => {
        const threshold = getPantryLowStockThreshold(
          item,
          this.settingsService.settings().defaultLowStockThreshold
        );

        return {
          id: `low-stock-${item.id}-${threshold}`,
          baseId: `low-stock-${item.id}`,
          type: 'low-stock',
          title: item.name,
          description: `Current Qty: ${item.quantity} · Threshold: ${threshold}`,
          status: item.quantity === 0 ? 'overdue' : 'due-soon',
          dueAt: item.updatedAt,
          snoozedUntil: null,
          countLabel: `Qty ${item.quantity}`,
          relatedItemId: item.id,
          relatedRoute: '/tabs/pantry',
          actions: ['view-item', 'add-to-cart'],
          canMarkDone: true,
          canDelete: true,
          isAutoGenerated: true,
          notificationKey: `notify-low-stock-${item.id}`,
          notificationTitle: `${item.name} is running low`,
          notificationBody: `${item.name} reached the low stock threshold.`,
          immediateNotification: true
        } satisfies InternalReminder;
      });
  }

  private buildBudgetReminders(): readonly InternalReminder[] {
    const activeCycle = this.expenseService.getActiveBudgetCycle();
    if (!activeCycle) {
      return [];
    }

    const overview = this.expenseService.getCycleOverview(activeCycle.id);
    if (!overview || overview.budgetAmount <= 0 || overview.daysLeft <= 7) {
      return [];
    }

    const progressPercent = overview.progressPercent;
    if (progressPercent < BUDGET_MILESTONES[0]) {
      return [];
    }

    const milestone =
      progressPercent > 100 ? 'OVER' : [...BUDGET_MILESTONES].reverse().find((value) => progressPercent >= value) ?? 80;
    const milestoneLabel =
      milestone === 'OVER' ? 'Over Budget' : milestone === 100 ? '100% Used' : `${milestone}% Used`;
    const description =
      milestone === 'OVER'
        ? `You are ${this.formatBudgetAmount(overview.overspent)} over budget for this cycle.`
        : milestone === 100
          ? 'You have used the full budget for this cycle.'
          : `You have used ${milestone}% of this cycle budget.`;

    return [
      {
        id: `budget-${activeCycle.id}-${milestoneLabel.toLowerCase().replace(/\s+/g, '-')}`,
        baseId: `budget-${activeCycle.id}`,
        type: 'budget',
        title: 'Budget Alert',
        description,
        status: overview.remaining <= 0 ? 'overdue' : 'due-soon',
        dueAt: `${activeCycle.endDate}T00:00:00`,
        snoozedUntil: null,
        countLabel: milestoneLabel,
        relatedItemId: null,
        relatedRoute: '/tabs/expenses',
        actions: ['view-expenses'],
        canMarkDone: true,
        canDelete: true,
        isAutoGenerated: true,
        notificationKey: `notify-budget-${activeCycle.id}-${milestoneLabel.toLowerCase().replace(/\s+/g, '-')}`,
        notificationTitle: 'Budget Alert',
        notificationBody:
          milestone === 'OVER'
            ? `You are over budget by ${this.formatBudgetAmount(overview.overspent)}.`
            : `${milestoneLabel} for the current budget cycle.`,
        immediateNotification: true
      }
    ] satisfies readonly InternalReminder[];
  }

  private buildCartReminders(): readonly InternalReminder[] {
    const activeItems = this.shoppingState.activeItems();
    if (activeItems.length === 0) {
      return [];
    }

    const latestCartActivity = activeItems.reduce((latest, item) => {
      const itemTime = new Date(item.updatedAt).getTime();
      return Math.max(latest, itemTime);
    }, 0);
    const latestPurchase = this.expenseService.purchases().at(0)?.createdAt;
    const latestReference = Math.max(
      latestCartActivity,
      latestPurchase ? new Date(latestPurchase).getTime() : 0
    );
    const dueAt = addDays(new Date(latestReference), CART_INACTIVITY_DAYS);

    if (dueAt > new Date()) {
      return [];
    }

    const itemCount = activeItems.reduce((sum, item) => sum + item.quantity, 0);
    return [
      {
        id: `cart-${toLocalDateOnly(dueAt)}-${activeItems.length}`,
        baseId: 'cart-reminder',
        type: 'cart',
        title: 'Cart Reminder',
        description: `${itemCount} item${itemCount === 1 ? '' : 's'} waiting in cart.`,
        status: differenceInCalendarDays(toLocalDateOnly(dueAt)) < 0 ? 'overdue' : 'due-soon',
        dueAt: dueAt.toISOString(),
        snoozedUntil: null,
        countLabel: `${itemCount} items`,
        relatedItemId: null,
        relatedRoute: '/tabs/shopping-list',
        actions: ['open-cart'],
        canMarkDone: true,
        canDelete: true,
        isAutoGenerated: true,
        notificationKey: `notify-cart-${toLocalDateOnly(dueAt)}-${activeItems.length}`,
        notificationTitle: 'Cart Reminder',
        notificationBody: `${itemCount} item${itemCount === 1 ? '' : 's'} waiting in your cart.`,
        immediateNotification: true
      }
    ] satisfies readonly InternalReminder[];
  }

  private buildCustomReminders(): readonly InternalReminder[] {
    return this.storeState().customReminders.map((record) => {
      const occurrence = this.resolveCustomOccurrence(record);
      const dueAt = occurrence.toISOString();

      return {
        id: `custom-${record.id}-${dueAt}`,
        baseId: this.getCustomReminderBaseId(record.id),
        type: 'custom',
        title: record.name,
        description: record.notes?.trim() || this.describeRecurrence(record.recurrence),
        status: this.resolveStatus(dueAt),
        dueAt,
        snoozedUntil: null,
        countLabel: this.formatReminderDateTime(occurrence),
        relatedItemId: null,
        relatedRoute: '/tabs/settings/reminders',
        actions: ['open-related'],
        canMarkDone: true,
        canDelete: true,
        isAutoGenerated: false,
        notificationKey: `notify-custom-${record.id}-${dueAt}`,
        notificationTitle: record.name,
        notificationBody:
          record.notes?.trim() || `Custom ${this.describeRecurrence(record.recurrence).toLowerCase()}`,
        immediateNotification: false
      } satisfies InternalReminder;
    });
  }

  private findCurrentReminderById(reminderId: string): InternalReminder | undefined {
    return this.buildCurrentReminders().find((reminder) => reminder.id === reminderId);
  }

  private buildAutoCompletedEntries(
    previous: readonly ReminderAutoSnapshot[],
    next: readonly InternalReminder[],
    completed: readonly CompletedReminderRecord[]
  ): readonly CompletedReminderRecord[] {
    const nextIds = new Set(next.map((reminder) => reminder.id));
    let nextCompleted: readonly CompletedReminderRecord[] = completed;

    for (const snapshot of previous) {
      if (nextIds.has(snapshot.reminderId)) {
        continue;
      }

      const lifecycle = this.getLifecycleStatus(snapshot.baseId);
      if (lifecycle === 'COMPLETED' || lifecycle === 'DELETED') {
        continue;
      }

      if (nextCompleted.some((entry) => entry.baseId === snapshot.baseId)) {
        continue;
      }

      const inferred = this.inferAutoCompletion(snapshot);
      if (!inferred) {
        continue;
      }

      nextCompleted = this.addCompletedEntry(
        nextCompleted,
        this.createCompletedEntry(
          {
            id: snapshot.reminderId,
            baseId: snapshot.baseId,
            type: snapshot.reminderType,
            title: snapshot.title,
            description: snapshot.description,
            relatedItemId: snapshot.relatedItemId,
            relatedRoute: snapshot.relatedRoute
          },
          inferred,
          true
        )
      );
    }

    return nextCompleted;
  }

  private inferAutoCompletion(snapshot: ReminderAutoSnapshot): ReminderCompletionAction | null {
    if (snapshot.reminderType === 'low-stock' && snapshot.relatedItemId) {
      const item = this.pantryState.getById(snapshot.relatedItemId);
      if (
        item &&
        !isPantryItemBelowThreshold(item, this.settingsService.settings().defaultLowStockThreshold)
      ) {
        return 'RESTOCKED';
      }
    }

    if (snapshot.reminderType === 'cart') {
      const latestPurchase = this.expenseService.purchases().at(0)?.createdAt;
      if (latestPurchase && new Date(latestPurchase) >= new Date(snapshot.capturedAt)) {
        return 'PURCHASE_COMPLETED';
      }
    }

    return null;
  }

  private async buildNotifications(
    reminders: readonly InternalReminder[]
  ): Promise<readonly { notification: LocalNotificationSchema; key: string; recordAsSent: boolean }[]> {
    if (!this.settingsService.settings().notificationsEnabled) {
      return [];
    }

    const hasPermissions = await this.notifications.hasPermission();
    if (!hasPermissions) {
      return [];
    }

    const scheduled: Array<{
      notification: LocalNotificationSchema;
      key: string;
      recordAsSent: boolean;
    }> = [];
    const notifiedKeys = new Set(this.storeState().notifiedKeys);
    const now = new Date();

    for (const reminder of reminders) {
      const schedule = this.getNotificationSchedule(
        reminder,
        now,
        notifiedKeys.has(reminder.notificationKey)
      );
      if (!schedule) {
        continue;
      }
      const { scheduleAt, recordAsSent } = schedule;

      scheduled.push({
        key: reminder.notificationKey,
        recordAsSent,
        notification: {
          id: this.hashId(reminder.notificationKey),
          title: reminder.notificationTitle,
          body: reminder.notificationBody,
          schedule: {
            at: scheduleAt
          },
          extra: {
            reminderId: reminder.id,
            type: reminder.type
          }
        }
      });
    }

    return scheduled;
  }

  private async replaceNotifications(notifications: readonly LocalNotificationSchema[]): Promise<void> {
    await this.notifications.replaceScheduledReminders(notifications);
  }

  private getNotificationSchedule(
    reminder: InternalReminder,
    now: Date,
    alreadyNotified: boolean
  ): { scheduleAt: Date; recordAsSent: boolean } | null {
    const scheduleAt = this.getNotificationDate(reminder);
    if (!scheduleAt) {
      return null;
    }

    if (reminder.immediateNotification) {
      if (alreadyNotified) {
        return null;
      }

      return {
        scheduleAt: new Date(now.getTime() + 1_000),
        recordAsSent: true
      };
    }

    if (reminder.type === 'custom' && scheduleAt <= now) {
      if (alreadyNotified) {
        return null;
      }

      return {
        scheduleAt: new Date(now.getTime() + 1_000),
        recordAsSent: true
      };
    }

    if (scheduleAt <= now) {
      return null;
    }

    return {
      scheduleAt,
      recordAsSent: false
    };
  }

  private getNotificationDate(reminder: InternalReminder): Date | null {
    if (reminder.type === 'expiry') {
      // The id ends with the expiry date: `expiry-<itemId>-YYYY-MM-DD`. (Splitting
      // on '-' would only return the day, giving an invalid notification date.)
      const expiryDate = /(\d{4}-\d{2}-\d{2})$/.exec(reminder.id)?.[1];
      if (!expiryDate) {
        return null;
      }

      const notificationDate = addDays(new Date(`${expiryDate}T00:00:00`), -this.expiryLeadDays());
      return scheduleAtLocalHour(
        toLocalDateOnly(notificationDate),
        this.settingsService.settings().reminderSettings.reminderHour
      );
    }

    if (reminder.type === 'custom') {
      return new Date(reminder.dueAt ?? new Date().toISOString());
    }

    return new Date(Date.now() + 1_000);
  }

  private collectNotifiedKeys(
    previous: readonly string[],
    notifications: readonly {
      notification: LocalNotificationSchema;
      key: string;
      recordAsSent: boolean;
    }[]
  ): readonly string[] {
    const keys = new Set(previous);
    for (const notification of notifications) {
      if (notification.recordAsSent) {
        keys.add(notification.key);
      }
    }

    return [...keys];
  }

  private createHistoryEntry(
    reminder: InternalReminder,
    status: ReminderHistoryStatus
  ): ReminderHistoryEntry {
    return {
      id: createId('reminder-history'),
      reminderId: reminder.id,
      reminderType: reminder.type,
      title: reminder.title,
      description: reminder.description,
      status,
      occurredAt: new Date().toISOString()
    };
  }

  private createCompletedEntry(
    reminder: Pick<InternalReminder, 'id' | 'baseId' | 'type' | 'title' | 'description' | 'relatedItemId' | 'relatedRoute'>,
    action: ReminderCompletionAction,
    isAutoResolved: boolean,
    customReminder: CustomReminderRecord | null = null
  ): CompletedReminderRecord {
    return {
      id: createId('completed-reminder'),
      reminderId: reminder.id,
      baseId: reminder.baseId,
      type: reminder.type,
      title: reminder.title,
      description: reminder.description,
      relatedItemId: reminder.relatedItemId,
      relatedRoute: reminder.relatedRoute,
      completedAt: new Date().toISOString(),
      completedByAction: action,
      completedType: reminder.type,
      isAutoResolved,
      customReminder
    };
  }

  private addCompletedEntry(
    completed: readonly CompletedReminderRecord[],
    entry: CompletedReminderRecord
  ): readonly CompletedReminderRecord[] {
    return [entry, ...completed.filter((current) => current.baseId !== entry.baseId)];
  }

  private pushHistoryEntry(
    history: readonly ReminderHistoryEntry[],
    entry: ReminderHistoryEntry
  ): readonly ReminderHistoryEntry[] {
    return [entry, ...history].slice(0, MAX_HISTORY_ITEMS);
  }

  private upsertState(
    baseId: string,
    patch: Pick<ReminderStateRecord, 'status' | 'snoozedUntil'>
  ): readonly ReminderStateRecord[] {
    const nextState: ReminderStateRecord = {
      baseId,
      status: patch.status,
      snoozedUntil: patch.snoozedUntil,
      updatedAt: new Date().toISOString()
    };
    const existing = this.storeState().states.find((state) => state.baseId === baseId);
    return existing
      ? this.storeState().states.map((state) => (state.baseId === baseId ? nextState : state))
      : [nextState, ...this.storeState().states];
  }

  private getLifecycleStatus(baseId: string): ReminderLifecycleStatus {
    const state = this.storeState().states.find((entry) => entry.baseId === baseId);
    if (!state) {
      return 'ACTIVE';
    }

    if (state.status === 'SNOOZED') {
      if (state.snoozedUntil && new Date(state.snoozedUntil) > new Date()) {
        return 'SNOOZED';
      }

      return 'ACTIVE';
    }

    return state.status;
  }

  private getReminderSnoozedUntil(baseId: string): string | null {
    return this.storeState().states.find((entry) => entry.baseId === baseId)?.snoozedUntil ?? null;
  }

  private normalizeExpiredSnoozes(states: readonly ReminderStateRecord[]): readonly ReminderStateRecord[] {
    const now = new Date();
    return states.map((state) =>
      state.status === 'SNOOZED' && state.snoozedUntil && new Date(state.snoozedUntil) <= now
        ? {
            ...state,
            status: 'ACTIVE',
            snoozedUntil: null,
            updatedAt: now.toISOString()
          }
        : state
    );
  }

  private pruneCompletedEntries(entries: readonly CompletedReminderRecord[]): readonly CompletedReminderRecord[] {
    const cutoff = addDays(new Date(), -COMPLETED_RETENTION_DAYS);
    return entries.filter((entry) => new Date(entry.completedAt) >= cutoff);
  }

  private pruneHistory(entries: readonly ReminderHistoryEntry[]): readonly ReminderHistoryEntry[] {
    return [...entries].slice(0, MAX_HISTORY_ITEMS);
  }

  private normalizeStore(store: LegacyReminderStore): ReminderStore {
    const states = ((store.states ?? []) as readonly LegacyReminderStateRecord[])
      .map((state) => {
        const baseId = state.baseId ?? state.reminderId;
        if (!baseId) {
          return null;
        }

        const status: ReminderLifecycleStatus =
          state.status ??
          (state.hidden ? 'COMPLETED' : state.snoozedUntil ? 'SNOOZED' : 'ACTIVE');

        return {
          baseId,
          status,
          snoozedUntil: state.snoozedUntil ?? null,
          updatedAt: state.updatedAt ?? new Date().toISOString()
        } satisfies ReminderStateRecord;
      })
      .filter((state): state is ReminderStateRecord => !!state);

    return {
      customReminders: [...(store.customReminders ?? [])].filter((reminder) => !!reminder?.id && !!reminder?.name),
      completed: [...(store.completed ?? [])].filter((entry) => !!entry?.id && !!entry?.baseId),
      history: [...(store.history ?? [])].filter((entry) => !!entry?.id && !!entry?.reminderId),
      states,
      activeAutoSnapshots: [...(store.activeAutoSnapshots ?? [])].filter(
        (entry) => !!entry?.reminderId && !!entry?.baseId
      ),
      notifiedKeys: [...(store.notifiedKeys ?? [])].filter((key) => typeof key === 'string')
    };
  }

  private resolveCustomOccurrence(reminder: CustomReminderRecord): Date {
    const now = new Date();
    let occurrence = this.combineDateTime(reminder.date, reminder.time);

    if (reminder.recurrence === 'one-time' || occurrence > now) {
      return occurrence;
    }

    let next = this.addRecurrence(occurrence, reminder.recurrence);
    while (next <= now) {
      occurrence = next;
      next = this.addRecurrence(next, reminder.recurrence);
    }

    return occurrence;
  }

  private addRecurrence(date: Date, recurrence: ReminderRecurrence): Date {
    if (recurrence === 'daily') {
      return addDays(date, 1);
    }

    if (recurrence === 'weekly') {
      return addDays(date, 7);
    }

    if (recurrence === 'monthly') {
      return new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        0,
        0
      );
    }

    return date;
  }

  private combineDateTime(dateOnly: string, time: string | null): Date {
    const [hours, minutes] = (time ?? `${String(DEFAULT_CUSTOM_REMINDER_HOUR).padStart(2, '0')}:00`)
      .split(':')
      .map((value) => Number(value));
    const date = new Date(`${dateOnly}T00:00:00`);
    date.setHours(hours || DEFAULT_CUSTOM_REMINDER_HOUR, minutes || 0, 0, 0);
    return date;
  }

  private resolveStatus(dueAt: string | null): ReminderStatus {
    if (!dueAt) {
      return 'upcoming';
    }

    const diff = new Date(dueAt).getTime() - Date.now();
    if (diff < 0) {
      return 'overdue';
    }

    const diffDays = differenceInCalendarDays(toLocalDateOnly(new Date(dueAt)));
    return diffDays <= 3 ? 'due-soon' : 'upcoming';
  }

  private sortReminder(left: ReminderItem, right: ReminderItem): number {
    const rank: Record<ReminderStatus, number> = {
      overdue: 0,
      'due-soon': 1,
      upcoming: 2,
      completed: 3
    };

    const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

    return rank[left.status] - rank[right.status] || leftTime - rightTime || left.title.localeCompare(right.title);
  }

  private formatReminderDateTime(date: Date): string {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private describeRecurrence(recurrence: ReminderRecurrence): string {
    if (recurrence === 'daily') {
      return 'Daily reminder';
    }
    if (recurrence === 'weekly') {
      return 'Weekly reminder';
    }
    if (recurrence === 'monthly') {
      return 'Monthly reminder';
    }
    return 'One-time reminder';
  }

  private formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private formatBudgetAmount(value: number): string {
    const currency = this.expenseService.getDisplayCurrency();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);
  }

  private getCustomReminderBaseId(id: string): string {
    return `custom-${id}`;
  }

  private hashId(value: string): number {
    let hash = 0;
    for (const character of value) {
      hash = (hash << 5) - hash + character.charCodeAt(0);
      hash |= 0;
    }

    return Math.abs(hash);
  }
}
