import { computed, inject, Injectable, signal } from '@angular/core';

import { createId } from '../../../core/utils/id.utils';
import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import {
  getPantryLowStockThreshold,
  isPantryItemBelowThreshold
} from '../../pantry/utils/pantry-stock-status.util';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListItem, ShoppingListItemDraft } from '../models/shopping-list-item.model';
import { ShoppingListRepositoryService } from './shopping-list-repository.service';

@Injectable({
  providedIn: 'root'
})
export class ShoppingListStateService {
  private readonly pantryState = inject(PantryStateService);
  private readonly repository = inject(ShoppingListRepositoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly itemsState = signal<readonly ShoppingListItem[]>([]);
  private readonly dismissedAutoAddPantryItemIdsState = signal<readonly string[]>([]);

  readonly items = computed(() => this.itemsState());
  readonly activeItems = computed(() => this.itemsState().filter((item) => !item.completed));
  readonly completedItems = computed(() => this.itemsState().filter((item) => item.completed));
  readonly totalCount = computed(() => this.activeItems().length);

  async load(): Promise<void> {
    const [storedItems, dismissedAutoAddPantryItemIds] = await Promise.all([
      this.repository.getAll(),
      this.repository.getDismissedAutoAddPantryItemIds()
    ]);
    const normalizedItems = storedItems.map((item) => this.normalizeItem(item));

    if (storedItems.some((item, index) => item.quantity !== normalizedItems[index].quantity)) {
      await this.repository.saveAll(normalizedItems);
    }

    this.itemsState.set(normalizedItems);
    this.dismissedAutoAddPantryItemIdsState.set(dismissedAutoAddPantryItemIds);
  }

  getById(itemId: string | null): ShoppingListItem | undefined {
    return this.itemsState().find((item) => item.id === itemId);
  }

  async save(draft: ShoppingListItemDraft, itemId?: string | null): Promise<ShoppingListItem> {
    const { nextItem, nextItems } = this.upsertItem(this.itemsState(), draft, itemId);
    await this.persistItems(nextItems);
    return nextItem;
  }

  async toggleCompleted(itemId: string): Promise<void> {
    const item = this.getById(itemId);
    if (!item) {
      return;
    }

    const nextCompleted = !item.completed;
    await this.syncLinkedPantryQuantity(item, nextCompleted);

    const nextItem: ShoppingListItem = {
      ...item,
      completed: nextCompleted,
      updatedAt: new Date().toISOString()
    };

    const nextItems = this.itemsState().map((current) => (current.id === itemId ? nextItem : current));
    await this.persistItems(nextItems);
  }

  async incrementQuantity(itemId: string): Promise<void> {
    await this.adjustQuantity(itemId, 1);
  }

  async decrementQuantity(itemId: string): Promise<void> {
    await this.adjustQuantity(itemId, -1);
  }

  async addFromPantryItem(item: PantryItem): Promise<void> {
    await this.clearDismissedAutoAddPantryItemIds([item.id]);
    await this.addLowStockItems([item]);
  }

  getActiveLinkedPantryItem(pantryItemId: string): ShoppingListItem | undefined {
    return this.itemsState().find(
      (item) => item.linkedPantryItemId === pantryItemId && !item.completed
    );
  }

  async addLowStockItems(items: readonly PantryItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    let nextItems = this.itemsState();

    for (const item of items) {
      nextItems = this.upsertLinkedPantryItem(nextItems, item);
    }

    await this.persistItems(nextItems);
  }

  async syncAutoAddLowStockItems(items: readonly PantryItem[], enabled: boolean): Promise<void> {
    if (!enabled) {
      return;
    }

    const autoAddCandidates = items.filter(
      (item) =>
        item.autoAddToShoppingList &&
        isPantryItemBelowThreshold(item, this.settingsService.settings().defaultLowStockThreshold)
    );

    if (autoAddCandidates.length === 0) {
      if (this.dismissedAutoAddPantryItemIdsState().length > 0) {
        await this.clearDismissedAutoAddPantryItemIds(this.dismissedAutoAddPantryItemIdsState());
      }
      return;
    }

    const currentCandidateIds = new Set(autoAddCandidates.map((item) => item.id));
    const staleDismissedIds = this.dismissedAutoAddPantryItemIdsState().filter(
      (itemId) => !currentCandidateIds.has(itemId)
    );
    if (staleDismissedIds.length > 0) {
      await this.clearDismissedAutoAddPantryItemIds(staleDismissedIds);
    }

    const dismissedIds = new Set(this.dismissedAutoAddPantryItemIdsState());
    const eligibleCandidates = autoAddCandidates.filter((item) => !dismissedIds.has(item.id));

    if (eligibleCandidates.length === 0) {
      return;
    }

    let nextItems = this.itemsState();
    let changed = false;

    for (const item of eligibleCandidates) {
      const updatedItems = this.upsertLinkedPantryItem(nextItems, item);
      if (updatedItems !== nextItems) {
        nextItems = updatedItems;
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    await this.persistItems(nextItems);
  }

  async remove(itemId: string): Promise<void> {
    const item = this.getById(itemId);
    if (!item) {
      return;
    }

    if (item.linkedPantryItemId && item.source === 'low-stock') {
      await this.addDismissedAutoAddPantryItemIds([item.linkedPantryItemId]);
    }

    const nextItems = this.itemsState().filter((item) => item.id !== itemId);
    await this.persistItems(nextItems);
  }

  async clearAll(): Promise<void> {
    await this.persistItems([]);
  }

  private upsertLinkedPantryItem(
    items: readonly ShoppingListItem[],
    pantryItem: PantryItem
  ): readonly ShoppingListItem[] {
    const desiredQuantity = Math.max(
      getPantryLowStockThreshold(pantryItem, this.settingsService.settings().defaultLowStockThreshold) -
        pantryItem.quantity,
      1
    );
    const existingItem = items.find(
      (current) => current.linkedPantryItemId === pantryItem.id && !current.completed
    );

    if (existingItem) {
      const nextQuantity = existingItem.quantityOverridden ? existingItem.quantity : desiredQuantity;

      if (
        existingItem.name === pantryItem.name &&
        existingItem.quantity === nextQuantity &&
        existingItem.unit === pantryItem.unit &&
        existingItem.source === 'low-stock'
      ) {
        return items;
      }

      return this.upsertItem(
        items,
        {
          name: pantryItem.name,
          quantity: nextQuantity,
          unit: pantryItem.unit,
          linkedPantryItemId: pantryItem.id,
          source: 'low-stock',
          germanStore: pantryItem.germanStore ?? false,
          indianStore: pantryItem.indianStore ?? false
        },
        existingItem.id
      ).nextItems;
    }

    return this.upsertItem(
      items,
      {
        name: pantryItem.name,
        quantity: desiredQuantity,
        unit: pantryItem.unit,
        linkedPantryItemId: pantryItem.id,
        source: 'low-stock',
        germanStore: pantryItem.germanStore ?? false,
        indianStore: pantryItem.indianStore ?? false
      }
    ).nextItems;
  }

  private upsertItem(
    items: readonly ShoppingListItem[],
    draft: ShoppingListItemDraft,
    itemId?: string | null
  ): { nextItem: ShoppingListItem; nextItems: readonly ShoppingListItem[] } {
    const existingItem = itemId ? items.find((item) => item.id === itemId) : undefined;
    const timestamp = new Date().toISOString();
    const quantity = this.normalizeQuantity(draft.quantity);

    const nextItem: ShoppingListItem = existingItem
      ? {
          ...existingItem,
          ...draft,
          quantity,
          quantityOverridden:
            existingItem.linkedPantryItemId !== null
              ? existingItem.quantityOverridden || quantity !== existingItem.quantity
              : existingItem.quantityOverridden,
          updatedAt: timestamp
        }
      : {
          id: createId('shop'),
          ...draft,
          quantity,
          quantityOverridden: false,
          completed: false,
          createdAt: timestamp,
          updatedAt: timestamp
        };

    const nextItems = existingItem
      ? items.map((item) => (item.id === existingItem.id ? nextItem : item))
      : [nextItem, ...items];

    return { nextItem, nextItems };
  }

  private async adjustQuantity(itemId: string, delta: number): Promise<void> {
    const item = this.getById(itemId);
    if (!item) {
      return;
    }

    const nextQuantity = Math.max(item.quantity + delta, 0);
    if (nextQuantity === item.quantity) {
      return;
    }

    if (nextQuantity === 0) {
      await this.remove(itemId);
      return;
    }

    const timestamp = new Date().toISOString();
    const nextItems = this.itemsState().map((current) =>
      current.id === itemId
        ? {
            ...current,
            quantity: nextQuantity,
            quantityOverridden: true,
            updatedAt: timestamp
          }
        : current
    );

    await this.persistItems(nextItems);
  }

  private normalizeItem(item: ShoppingListItem): ShoppingListItem {
    return {
      ...item,
      quantityOverridden: item.quantityOverridden ?? false,
      quantity: this.normalizeQuantity(item.quantity),
      germanStore: item.germanStore ?? false,
      indianStore: item.indianStore ?? false
    };
  }

  private async syncLinkedPantryQuantity(item: ShoppingListItem, completed: boolean): Promise<void> {
    if (!item.linkedPantryItemId) {
      return;
    }

    const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
    if (!pantryItem) {
      return;
    }

    const quantityDelta = completed ? item.quantity : -item.quantity;
    await this.pantryState.setQuantity(pantryItem.id, pantryItem.quantity + quantityDelta);
  }

  private normalizeQuantity(quantity: number | null | undefined): number {
    if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
      return 1;
    }

    return Math.max(quantity, 0);
  }

  private async addDismissedAutoAddPantryItemIds(itemIds: readonly string[]): Promise<void> {
    const nextDismissedIds = Array.from(
      new Set([...this.dismissedAutoAddPantryItemIdsState(), ...itemIds])
    );
    await this.repository.saveDismissedAutoAddPantryItemIds(nextDismissedIds);
    this.dismissedAutoAddPantryItemIdsState.set(nextDismissedIds);
  }

  private async clearDismissedAutoAddPantryItemIds(itemIds: readonly string[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const idsToClear = new Set(itemIds);
    const nextDismissedIds = this.dismissedAutoAddPantryItemIdsState().filter(
      (itemId) => !idsToClear.has(itemId)
    );

    if (nextDismissedIds.length === this.dismissedAutoAddPantryItemIdsState().length) {
      return;
    }

    await this.repository.saveDismissedAutoAddPantryItemIds(nextDismissedIds);
    this.dismissedAutoAddPantryItemIdsState.set(nextDismissedIds);
  }

  private async persistItems(items: readonly ShoppingListItem[]): Promise<void> {
    await this.repository.saveAll(items);
    this.itemsState.set(items);
  }
}
