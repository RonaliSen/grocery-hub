import { inject, Injectable } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { PantryItem } from '../models/pantry-item.model';

@Injectable({
  providedIn: 'root'
})
export class PantryRepositoryService {
  private readonly storage = inject(StorageService);

  getAll(): Promise<readonly PantryItem[]> {
    return this.storage.get<readonly PantryItem[]>(STORAGE_KEYS.pantryItems, []);
  }

  saveAll(items: readonly PantryItem[]): Promise<void> {
    return this.storage.set(STORAGE_KEYS.pantryItems, [...items]);
  }
}
