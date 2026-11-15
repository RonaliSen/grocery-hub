import { computed, inject, Injectable, signal } from '@angular/core';

import { PantryItem } from '../models/pantry-item.model';
import {
  AuditQuantityInput,
  auditQuantityDifference,
  parseAuditQuantity
} from '../utils/pantry-audit.util';
import { PantryStateService } from './pantry-state.service';

export interface PantryAuditCountEntry {
  readonly item: PantryItem;
  /** Exactly what the user typed, so partially typed values like "1." are never rewritten. */
  readonly rawInput: string;
  readonly input: AuditQuantityInput;
  /** Actual minus saved quantity, or null until a valid count has been entered. */
  readonly difference: number | null;
}

/**
 * Holds the in-progress inventory audit: which pantry items are included and what
 * quantities were actually counted. The pantry is only changed by `applyAdjustments()`.
 *
 * Selection is always reconciled against the live pantry, so items deleted while an
 * audit is in progress silently drop out of the selection and counts stay accurate.
 */
@Injectable({
  providedIn: 'root'
})
export class PantryAuditSessionService {
  private readonly pantryState = inject(PantryStateService);
  private readonly selectedIdsState = signal<ReadonlySet<string>>(new Set());
  private readonly countInputsState = signal<ReadonlyMap<string, string>>(new Map());

  /** Pantry items in the order they should be presented during the audit. */
  readonly availableItems = computed<readonly PantryItem[]>(() =>
    [...this.pantryState.items()].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    )
  );
  readonly selectedIds = computed<ReadonlySet<string>>(() => {
    const selected = this.selectedIdsState();
    return new Set(this.pantryState.items().filter((item) => selected.has(item.id)).map((item) => item.id));
  });
  readonly selectedItems = computed<readonly PantryItem[]>(() => {
    const selected = this.selectedIds();
    return this.availableItems().filter((item) => selected.has(item.id));
  });
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly totalCount = computed(() => this.pantryState.totalCount());
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly allSelected = computed(
    () => this.totalCount() > 0 && this.selectedCount() === this.totalCount()
  );
  readonly partiallySelected = computed(() => this.hasSelection() && !this.allSelected());

  /** One entry per selected item, with the counted quantity and its difference from the saved one. */
  readonly countEntries = computed<readonly PantryAuditCountEntry[]>(() => {
    const inputs = this.countInputsState();

    return this.selectedItems().map((item) => {
      const rawInput = inputs.get(item.id) ?? '';
      const input = parseAuditQuantity(rawInput);
      const difference =
        input.status === 'valid' ? auditQuantityDifference(item.quantity, input.value) : null;

      return { item, rawInput, input, difference };
    });
  });

  readonly countedCount = computed(
    () => this.countEntries().filter((entry) => entry.input.status === 'valid').length
  );
  readonly missingCount = computed(
    () => this.countEntries().filter((entry) => entry.input.status === 'empty').length
  );
  readonly invalidCount = computed(
    () => this.countEntries().filter((entry) => entry.input.status === 'invalid').length
  );
  /** True when every selected item has a valid actual quantity, so the audit can be reviewed. */
  readonly allCounted = computed(
    () => this.countEntries().length > 0 && this.countedCount() === this.countEntries().length
  );
  /** Counted items whose actual quantity differs from the saved one. */
  readonly adjustments = computed(() =>
    this.countEntries().filter((entry) => entry.difference !== null && entry.difference !== 0)
  );
  /** Counted items whose actual quantity matches the saved one. */
  readonly unchanged = computed(() => this.countEntries().filter((entry) => entry.difference === 0));

  isSelected(itemId: string): boolean {
    return this.selectedIds().has(itemId);
  }

  toggle(itemId: string): void {
    this.setSelected(itemId, !this.isSelected(itemId));
  }

  setSelected(itemId: string, selected: boolean): void {
    const next = new Set(this.selectedIds());
    if (selected) {
      next.add(itemId);
    } else {
      next.delete(itemId);
    }
    this.selectedIdsState.set(next);
  }

  selectAll(): void {
    this.selectedIdsState.set(new Set(this.pantryState.items().map((item) => item.id)));
  }

  clearSelection(): void {
    this.selectedIdsState.set(new Set());
  }

  /**
   * Records what the user typed for an item's actual quantity. Kept even if the item is
   * later deselected, so re-selecting it restores the count.
   */
  setCountInput(itemId: string, rawInput: string): void {
    const next = new Map(this.countInputsState());
    next.set(itemId, rawInput);
    this.countInputsState.set(next);
  }

  /**
   * Saves the counted quantity of every item that needs adjustment to the pantry in a single
   * write, then ends the audit. Unchanged and unselected items are not touched.
   * Returns the number of pantry items updated. On failure the audit is kept so it can be retried.
   */
  async applyAdjustments(): Promise<number> {
    if (!this.allCounted()) {
      throw new Error('Every selected item needs a valid count before the pantry can be updated.');
    }

    const quantities = new Map<string, number>();
    for (const entry of this.adjustments()) {
      if (entry.input.status === 'valid') {
        quantities.set(entry.item.id, entry.input.value);
      }
    }

    const updatedCount = await this.pantryState.setQuantities(quantities);
    this.reset();
    return updatedCount;
  }

  /** Starts a fresh audit, discarding the selection and counts from a previous one. */
  reset(): void {
    this.clearSelection();
    this.countInputsState.set(new Map());
  }
}
