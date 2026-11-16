import { computed, inject, Injectable, signal } from '@angular/core';

import { isExpired, isExpiringWithin } from '../../../core/utils/date.utils';
import { createId } from '../../../core/utils/id.utils';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryFilterType } from '../models/pantry-filter.model';
import { PantryItem, PantryItemDraft } from '../models/pantry-item.model';
import {
  getPantryLowStockThreshold,
  getPantryStockStatus,
  isPantryItemBelowThreshold,
  shouldShowPantryLowStock
} from '../utils/pantry-stock-status.util';
import { getPantryExpiryStatus } from '../utils/pantry-expiry.util';
import { PantryRepositoryService } from './pantry-repository.service';

export class PantryDuplicateItemNameError extends Error {
  constructor() {
    super('Pantry item name must be unique.');
    this.name = 'PantryDuplicateItemNameError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class PantryStateService {
  private readonly repository = inject(PantryRepositoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly itemsState = signal<readonly PantryItem[]>([]);
  private readonly loadedState = signal(false);
  private readonly searchQueryState = signal('');
  private readonly stockFilterState = signal<PantryFilterType>('all');
  private loadPromise: Promise<void> | null = null;

  readonly items = computed(() => this.itemsState());
  readonly loaded = computed(() => this.loadedState());
  readonly searchQuery = computed(() => this.searchQueryState());
  readonly stockFilter = computed(() => this.stockFilterState());
  readonly totalCount = computed(() => this.itemsState().length);
  readonly lowStockItems = computed(() =>
    this.itemsState()
      .filter((item) => isPantryItemBelowThreshold(item, this.settingsService.settings().defaultLowStockThreshold))
      .sort((left, right) => left.quantity - right.quantity)
  );
  readonly lowStockSignalItems = computed(() =>
    this.itemsState()
      .filter((item) => {
        if (item.quantity <= 0) {
          return false;
        }

        const threshold = getPantryLowStockThreshold(
          item,
          this.settingsService.settings().defaultLowStockThreshold
        );
        return item.quantity <= threshold;
      })
      .sort((left, right) => left.quantity - right.quantity)
  );
  readonly expiringSoonItems = computed(() =>
    this.itemsState()
      .filter(
        (item) =>
          item.expiryDate &&
          isExpiringWithin(item.expiryDate, this.settingsService.settings().reminderSettings.expiryLeadDays)
      )
      .sort((left, right) => (left.expiryDate ?? '').localeCompare(right.expiryDate ?? ''))
  );
  readonly expiredItems = computed(() =>
    this.itemsState()
      .filter((item) => item.expiryDate && isExpired(item.expiryDate))
      .sort((left, right) => (left.expiryDate ?? '').localeCompare(right.expiryDate ?? ''))
  );
  readonly filteredItems = computed(() => {
    const normalizedQuery = this.searchQueryState().trim().toLocaleLowerCase();
    const selectedFilter = this.stockFilterState();

    return this.itemsState()
      .filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 || item.name.toLocaleLowerCase().includes(normalizedQuery);

        let matchesFilter = selectedFilter === 'all';

        if (!matchesFilter) {
          if (selectedFilter === 'low-stock') {
            matchesFilter = shouldShowPantryLowStock(item, this.settingsService.settings().defaultLowStockThreshold);
          } else if (selectedFilter === 'expiring' || selectedFilter === 'expired') {
            // Same rule and lead time as the hero counts and the Expiry Tracker.
            matchesFilter =
              getPantryExpiryStatus(item, this.settingsService.settings().reminderSettings.expiryLeadDays) ===
              selectedFilter;
          } else {
            // It's a category
            matchesFilter = item.category === selectedFilter;
          }
        }

        return matchesQuery && matchesFilter;
      })
      .sort((left, right) => {
        const settings = this.settingsService.settings();
        const leftRank = this.getSortRank(
          left,
          settings.defaultLowStockThreshold,
          settings.reminderSettings.expiryLeadDays
        );
        const rightRank = this.getSortRank(
          right,
          settings.defaultLowStockThreshold,
          settings.reminderSettings.expiryLeadDays
        );

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.expiryDate && !right.expiryDate) {
          return -1;
        }

        if (!left.expiryDate && right.expiryDate) {
          return 1;
        }

        if (left.expiryDate && right.expiryDate) {
          const expiryComparison = left.expiryDate.localeCompare(right.expiryDate);
          if (expiryComparison !== 0) {
            return expiryComparison;
          }
        }

        return left.name.localeCompare(right.name);
      });
  });
  readonly hasActiveFilters = computed(
    () => this.searchQueryState().trim().length > 0 || this.stockFilterState() !== 'all'
  );

  async load(): Promise<void> {
    if (this.loadedState()) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.repository
      .getAll()
      .then((items) => {
        const normalizedItems = items.map((item) => this.normalizeItem(item));
        const shouldPersistNormalizedItems = items.some(
          (item, index) =>
            item.germanStore !== normalizedItems[index].germanStore ||
            item.indianStore !== normalizedItems[index].indianStore
        );

        this.itemsState.set(normalizedItems);
        this.loadedState.set(true);

        if (shouldPersistNormalizedItems) {
          return this.repository.saveAll(normalizedItems);
        }

        return undefined;
      })
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  getById(itemId: string | null): PantryItem | undefined {
    return this.itemsState().find((item) => item.id === itemId);
  }

  existsByName(name: string, excludeId?: string | null): boolean {
    const normalizedSearch = this.normalizeItemName(name);
    if (!normalizedSearch) {
      return false;
    }

    return this.itemsState().some(
      (item) => item.id !== excludeId && this.normalizeItemName(item.name) === normalizedSearch
    );
  }

  setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  setStockFilter(filter: PantryFilterType): void {
    this.stockFilterState.set(filter);
  }

  resetFilters(): void {
    this.searchQueryState.set('');
    this.stockFilterState.set('all');
  }

  async save(draft: PantryItemDraft, itemId?: string | null): Promise<PantryItem> {
    if (this.existsByName(draft.name, itemId)) {
      throw new PantryDuplicateItemNameError();
    }

    const existingItem = itemId ? this.getById(itemId) : undefined;
    const timestamp = new Date().toISOString();

    const nextItem: PantryItem = existingItem
      ? {
          ...existingItem,
          ...draft,
          updatedAt: timestamp
        }
      : {
          id: createId('pantry'),
          ...draft,
          createdAt: timestamp,
          updatedAt: timestamp
        };

    const nextItems = existingItem
      ? this.itemsState().map((item) => (item.id === existingItem.id ? nextItem : item))
      : [nextItem, ...this.itemsState()];

    await this.repository.saveAll(nextItems);
    this.itemsState.set(nextItems);
    this.loadedState.set(true);
    return nextItem;
  }

  async updateQuantity(itemId: string, delta: number): Promise<void> {
    const item = this.getById(itemId);
    if (!item) {
      return;
    }

    await this.setQuantity(itemId, item.quantity + delta);
  }

  async setQuantity(itemId: string, quantity: number): Promise<void> {
    const item = this.getById(itemId);
    if (!item) {
      return;
    }

    await this.save(
      {
        ...item,
        quantity: Math.max(0, quantity)
      },
      itemId
    );
  }

  /**
   * Sets new quantities for several items in a single storage write, so either every change is
   * saved or none is. Items not in `quantities`, missing from the pantry, or already at the
   * requested quantity are left untouched. Returns how many items were changed.
   */
  async setQuantities(quantities: ReadonlyMap<string, number>): Promise<number> {
    const timestamp = new Date().toISOString();
    let changedCount = 0;

    const nextItems = this.itemsState().map((item) => {
      const requested = quantities.get(item.id);
      if (requested === undefined) {
        return item;
      }

      const quantity = Math.max(0, requested);
      if (quantity === item.quantity) {
        return item;
      }

      changedCount++;
      return { ...item, quantity, updatedAt: timestamp };
    });

    if (changedCount === 0) {
      return 0;
    }

    await this.repository.saveAll(nextItems);
    this.itemsState.set(nextItems);
    this.loadedState.set(true);
    return changedCount;
  }

  async remove(itemId: string): Promise<void> {
    const nextItems = this.itemsState().filter((item) => item.id !== itemId);
    await this.repository.saveAll(nextItems);
    this.itemsState.set(nextItems);
    this.loadedState.set(true);
  }

  async clearAll(): Promise<void> {
    await this.repository.saveAll([]);
    this.itemsState.set([]);
    this.loadedState.set(true);
  }

  private normalizeItemName(name: string): string {
    return name.trim().toLowerCase();
  }

  private getSortRank(item: PantryItem, defaultLowStockThreshold: number, expiryLeadDays: number): number {
    if (item.expiryDate && isExpired(item.expiryDate)) {
      return 0;
    }

    const stockStatus = getPantryStockStatus(item, defaultLowStockThreshold);
    if (stockStatus === 'out-of-stock') {
      return 1;
    }
    if (stockStatus === 'low-stock') {
      return 2;
    }
    if (item.expiryDate && isExpiringWithin(item.expiryDate, expiryLeadDays)) {
      return 3;
    }

    return 4;
  }

  private normalizeItem(item: PantryItem): PantryItem {
    return {
      ...item,
      germanStore: item.germanStore ?? false,
      indianStore: item.indianStore ?? false
    };
  }
}
