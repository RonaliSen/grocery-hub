import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotificationSchema, LocalNotifications } from '@capacitor/local-notifications';

import { STORAGE_KEYS } from '../constants/storage-keys';
import { StorageService } from './storage.service';

interface StoredNotificationEntry {
  readonly id: number;
  readonly title: string | null;
  readonly body: string | null;
  readonly at: string | null;
  readonly channelId: string;
}

const REMINDER_CHANNEL_ID = 'reminders_v2';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly storage = inject(StorageService);
  private readonly browserTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private channelReady = false;

  isSupported(): boolean {
    return this.isNativeSupported() || this.isBrowserSupported();
  }

  async hasPermission(): Promise<boolean> {
    if (this.isNativeSupported()) {
      const currentPermissions = await LocalNotifications.checkPermissions();
      return currentPermissions.display === 'granted';
    }

    if (!this.isBrowserSupported()) {
      return false;
    }

    return Notification.permission === 'granted';
  }

  async ensurePermissions(): Promise<boolean> {
    if (this.isNativeSupported()) {
      if (await this.hasPermission()) {
        return true;
      }

      const requestedPermissions = await LocalNotifications.requestPermissions();
      return requestedPermissions.display === 'granted';
    }

    if (!this.isBrowserSupported()) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    return (await Notification.requestPermission()) === 'granted';
  }

  async replaceScheduledReminders(notifications: readonly LocalNotificationSchema[]): Promise<void> {
    const previousEntries = await this.storage.get<readonly StoredNotificationEntry[]>(
      STORAGE_KEYS.reminderNotificationIds,
      []
    );
    const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
    const nextEntries = notifications.map((notification) => this.toStoredEntry(notification));

    const idsToCancel = previousEntries
      .filter((previous) => {
        const next = nextEntries.find((entry) => entry.id === previous.id);
        return !next || !this.entriesMatch(previous, next);
      })
      .map((entry) => entry.id);

    const notificationsToSchedule = notifications
      .filter((notification) => {
        const previous = previousById.get(notification.id);
        return !previous || !this.entriesMatch(previous, this.toStoredEntry(notification));
      })
      .map((notification) => ({ ...notification, channelId: REMINDER_CHANNEL_ID }));

    this.clearBrowserTimeouts(idsToCancel);

    if (!this.isSupported()) {
      await this.storage.set(STORAGE_KEYS.reminderNotificationIds, []);
      return;
    }

    if (this.isNativeSupported() && idsToCancel.length > 0) {
      await LocalNotifications.cancel({
        notifications: idsToCancel.map((id) => ({ id }))
      });
    }

    if (this.isNativeSupported() && notificationsToSchedule.length > 0) {
      await this.ensureChannel();
      await LocalNotifications.schedule({
        notifications: [...notificationsToSchedule]
      });
    }

    if (this.isBrowserSupported()) {
      this.scheduleBrowserNotifications(notificationsToSchedule);
    }

    await this.storage.set(STORAGE_KEYS.reminderNotificationIds, nextEntries);
  }

  private toStoredEntry(notification: LocalNotificationSchema): StoredNotificationEntry {
    const scheduledAt = notification.schedule?.at;
    const isValidDate = scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime());
    return {
      id: notification.id,
      title: notification.title ?? null,
      body: notification.body ?? null,
      at: isValidDate ? scheduledAt.toISOString() : null,
      channelId: REMINDER_CHANNEL_ID
    };
  }

  private entriesMatch(left: StoredNotificationEntry, right: StoredNotificationEntry): boolean {
    return (
      left.title === right.title &&
      left.body === right.body &&
      left.at === right.at &&
      left.channelId === right.channelId
    );
  }

  private async ensureChannel(): Promise<void> {
    if (this.channelReady) {
      return;
    }

    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Reminders',
      description: 'Low stock, expiry, budget and cart reminders',
      importance: 5,
      visibility: 1,
      vibration: true
    });
    this.channelReady = true;
  }

  private isNativeSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  private isBrowserSupported(): boolean {
    return typeof Notification !== 'undefined';
  }

  private clearBrowserTimeouts(notificationIds: readonly number[]): void {
    for (const id of notificationIds) {
      const timeout = this.browserTimeouts.get(id);
      if (!timeout) {
        continue;
      }

      clearTimeout(timeout);
      this.browserTimeouts.delete(id);
    }
  }

  private scheduleBrowserNotifications(notifications: readonly LocalNotificationSchema[]): void {
    if (Notification.permission !== 'granted') {
      return;
    }

    const now = Date.now();

    for (const notification of notifications) {
      const scheduledAt = notification.schedule?.at;
      if (!(scheduledAt instanceof Date)) {
        continue;
      }

      const delayMs = scheduledAt.getTime() - now;
      if (delayMs <= 0) {
        continue;
      }

      const timeout = setTimeout(() => {
        new Notification(notification.title ?? 'Reminder', {
          body: notification.body ?? '',
        });
        this.browserTimeouts.delete(notification.id);
      }, delayMs);

      this.browserTimeouts.set(notification.id, timeout);
    }
  }
}
