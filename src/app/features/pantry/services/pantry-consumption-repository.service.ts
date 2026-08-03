import { inject, Injectable } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { PantryConsumptionLog } from '../models/pantry-consumption.model';

@Injectable({
  providedIn: 'root'
})
export class PantryConsumptionRepositoryService {
  private readonly storage = inject(StorageService);

  getAll(): Promise<readonly PantryConsumptionLog[]> {
    return this.storage.get<readonly PantryConsumptionLog[]>(STORAGE_KEYS.pantryConsumptionLogs, []);
  }

  saveAll(logs: readonly PantryConsumptionLog[]): Promise<void> {
    return this.storage.set(STORAGE_KEYS.pantryConsumptionLogs, [...logs]);
  }
}
