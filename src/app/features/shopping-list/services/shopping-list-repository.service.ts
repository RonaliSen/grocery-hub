import { inject, Injectable } from '@angular/core';

import { STORAGE_KEYS } from '../../../core/constants/storage-keys';
import { StorageService } from '../../../core/services/storage.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';

@Injectable({
  providedIn: 'root'
})
export class ShoppingListRepositoryService {
  private readonly storage = inject(StorageService);

  getAll(): Promise<readonly ShoppingListItem[]> {
    return this.storage.get<readonly ShoppingListItem[]>(STORAGE_KEYS.shoppingListItems, []);
  }

  saveAll(items: readonly ShoppingListItem[]): Promise<void> {
    return this.storage.set(STORAGE_KEYS.shoppingListItems, [...items]);
  }

  getDismissedAutoAddPantryItemIds(): Promise<readonly string[]> {
    return this.storage.get<readonly string[]>(
      STORAGE_KEYS.shoppingListDismissedAutoAddPantryItemIds,
      []
    );
  }

  saveDismissedAutoAddPantryItemIds(itemIds: readonly string[]): Promise<void> {
    return this.storage.set(STORAGE_KEYS.shoppingListDismissedAutoAddPantryItemIds, [...itemIds]);
  }
}
