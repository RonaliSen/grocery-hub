export interface ReminderSettings {
  readonly expiryRemindersEnabled: boolean;
  readonly expiryLeadDays: number;
  readonly lowStockDigestEnabled: boolean;
  readonly reminderHour: number;
}
