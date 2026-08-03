import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotificationSchema, LocalNotifications } from '@capacitor/local-notifications';

import { STORAGE_KEYS } from '../constants/storage-keys';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly storage = inject(StorageService);
  private readonly browserTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

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
    const previousIds = await this.storage.get<readonly number[]>(STORAGE_KEYS.reminderNotificationIds, []);

    if (this.isNativeSupported() && previousIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: previousIds.map((id) => ({ id }))
      });
    }

    this.clearBrowserTimeouts(previousIds);

    if (!this.isSupported()) {
      await this.storage.set(STORAGE_KEYS.reminderNotificationIds, []);
      return;
    }

    if (this.isNativeSupported() && notifications.length > 0) {
      await LocalNotifications.schedule({
        notifications: [...notifications]
      });
    }

    if (this.isBrowserSupported()) {
      this.scheduleBrowserNotifications(notifications);
    }

    await this.storage.set(
      STORAGE_KEYS.reminderNotificationIds,
      notifications.map((notification) => notification.id)
    );
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
