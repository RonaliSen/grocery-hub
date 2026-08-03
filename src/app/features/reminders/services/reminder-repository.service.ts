import { inject, Injectable } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { DEFAULT_REMINDER_STORE, ReminderStore } from '../models/reminder.model';

@Injectable({
  providedIn: 'root'
})
export class ReminderRepositoryService {
  private readonly storage = inject(StorageService);

  getStore(): Promise<ReminderStore> {
    return this.storage.get<ReminderStore>(STORAGE_KEYS.reminderStore, DEFAULT_REMINDER_STORE);
  }

  saveStore(store: ReminderStore): Promise<void> {
    return this.storage.set(STORAGE_KEYS.reminderStore, store);
  }
}
