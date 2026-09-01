import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addOutline, arrowBackOutline, calendarOutline, checkmarkOutline, trashOutline } from 'ionicons/icons';

import { CATEGORY_LABELS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { formatCurrencyAmount, getCurrencySymbol } from '../../../core/utils/currency.utils';
import { PantryCategory } from '../../pantry/models/pantry-item.model';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { ExpenseService } from '../../expenses/services/expense.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { ShoppingListStateService } from '../services/shopping-list-state.service';

type CheckoutLine = {
  itemId: string;
  name: string;
  quantity: number;
  category: PantryCategory;
  imageUrl: string | null;
  unitPriceInput: string;
  isCustom: boolean;
  linkedPantryItemId: string | null;
};

const RESTOCK_QUANTITY = 2;

@Component({
  selector: 'app-shopping-list-checkout-page',
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon],
  template: `
    <header class="flow-header">
      <button type="button" class="icon-btn plain" (click)="goBack()" aria-label="Back to cart">
        <ion-icon [icon]="backIcon" aria-hidden="true" />
      </button>
      <div class="flow-header-copy">
        <span>Cart checkout</span>
        <h1>Complete Purchase</h1>
      </div>
      <button
        type="button"
        class="icon-btn success"
        [disabled]="!hasEnteredAnyPrice()"
        (click)="confirmPurchase()"
        aria-label="Confirm purchase"
      >
        <ion-icon [icon]="checkIcon" aria-hidden="true" />
      </button>
    </header>

    <ion-content [fullscreen]="true" class="checkout-content">
      <main class="checkout-screen">
        <section class="checkout-intro">
          <p>Enter actual prices from your grocery bill.</p>
          <div class="checkout-meta">
            <span><ion-icon [icon]="calendarIcon" aria-hidden="true" /> {{ checkoutDateLabel() }}</span>
            <strong>{{ checkoutTotalItems() }} item{{ checkoutTotalItems() === 1 ? '' : 's' }}</strong>
          </div>
        </section>

        <section class="checkout-card">
          <div class="checkout-card-header">
            <h2>Items in Cart</h2>
            <button type="button" class="ghost-btn" (click)="addCustomCheckoutItem()">
              <ion-icon [icon]="addIcon" aria-hidden="true" />
              <span>Add Custom Item</span>
            </button>
          </div>

          <div class="checkout-list">
            @for (line of checkoutLines(); track line.itemId) {
              <article class="checkout-item">
                @if (line.imageUrl) {
                  <img [src]="line.imageUrl" [alt]="line.name || 'Custom item'" />
                } @else {
                  <div class="item-image-fallback">
                    {{ (line.name.charAt(0) || '?').toUpperCase() }}
                  </div>
                }

                <div class="item-main">
                  @if (line.isCustom) {
                    <input
                      type="text"
                      class="custom-name-input"
                      maxlength="80"
                      [ngModel]="line.name"
                      (ngModelChange)="onCustomCheckoutItemNameChange(line.itemId, $event)"
                      placeholder="Custom item name"
                    />
                  } @else {
                    <h3>{{ line.name }}</h3>
                  }
                  <p>Qty: {{ line.quantity }} · {{ categoryLabels[line.category] }}</p>
                </div>

                <div class="item-actions">
                  <label class="price-field">
                    <span>{{ currencySymbol() }}</span>
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.01"
                      [ngModel]="line.unitPriceInput"
                      (ngModelChange)="onUnitPriceChange(line.itemId, $event)"
                      (blur)="onUnitPriceBlur(line.itemId)"
                      placeholder="0.00"
                    />
                  </label>

                  <button
                    type="button"
                    class="delete-line-button"
                    (click)="removeCheckoutLine(line.itemId)"
                    [attr.aria-label]="'Delete ' + line.name"
                  >
                    <ion-icon [icon]="deleteIcon" aria-hidden="true" />
                  </button>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="summary-card">
          <label class="store-field">
            <span>Store <small>(optional)</small></span>
            <input
              type="text"
              [ngModel]="checkoutStoreName()"
              (ngModelChange)="onStoreNameChange($event)"
              placeholder="e.g. Lidl, Aldi"
            />
          </label>

          <div class="summary-grid">
            <p>Total Items <strong>{{ checkoutTotalItems() }}</strong></p>
            <p>Total Amount <strong>{{ formatMoney(checkoutGrandTotal()) }}</strong></p>
          </div>
        </section>

        <div class="actions">
          <button type="button" class="primary-btn" [disabled]="!hasEnteredAnyPrice()" (click)="confirmPurchase()">
            Confirm Purchase
          </button>
          <button type="button" class="secondary-btn" (click)="goBack()">Cancel</button>
        </div>
      </main>
    </ion-content>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f4f8f5;
    }

    .flow-header {
      position: sticky;
      top: 0;
      z-index: 30;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.9rem;
      background: rgba(244, 248, 245, 0.96);
      backdrop-filter: blur(18px);
      border-bottom: 1px solid #d9e5de;
    }

    .flow-header-copy span {
      display: block;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5f7869;
    }

    .flow-header-copy h1 {
      margin: 0.2rem 0 0;
      font-size: clamp(1.35rem, 5vw, 1.75rem);
      color: #0f7d4d;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .icon-btn {
      width: 2.8rem;
      height: 2.8rem;
      border: none;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
    }

    .icon-btn.plain {
      background: #ffffff;
      color: #1f4e38;
      border: 1px solid #d9e5de;
    }

    .icon-btn.success {
      background: #149255;
      color: #ffffff;
    }

    .icon-btn:disabled {
      opacity: 0.45;
    }

    .checkout-content {
      --background: #f4f8f5;
    }

    .checkout-screen {
      width: min(100%, 760px);
      margin: 0 auto;
      padding: 1rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
      display: grid;
      gap: 1rem;
    }

    .checkout-intro,
    .checkout-card,
    .summary-card {
      background: #ffffff;
      border: 1px solid #d9e5de;
      border-radius: 22px;
      box-shadow: 0 18px 38px rgba(22, 61, 42, 0.08);
    }

    .checkout-intro {
      padding: 1rem 1.1rem;
    }

    .checkout-intro p {
      margin: 0 0 0.75rem;
      color: #466352;
      font-weight: 600;
    }

    .checkout-meta {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
      color: #5f7869;
      font-size: 0.88rem;
    }

    .checkout-meta span {
      display: inline-flex;
      gap: 0.45rem;
      align-items: center;
    }

    .checkout-meta strong {
      color: #0f7d4d;
    }

    .checkout-card {
      padding: 1rem 1rem 0.6rem;
      display: grid;
      gap: 0.95rem;
    }

    .checkout-card-header {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .checkout-card-header h2 {
      margin: 0;
      font-size: 1rem;
      color: #113222;
    }

    .ghost-btn {
      border: 1px solid #cfe0d6;
      background: #f6fbf8;
      color: #0f7d4d;
      border-radius: 999px;
      min-height: 2.4rem;
      padding: 0 0.9rem;
      display: inline-flex;
      gap: 0.45rem;
      align-items: center;
      font-weight: 700;
    }

    .checkout-list {
      display: grid;
      gap: 0.85rem;
    }

    .checkout-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.85rem;
      border: 1px solid #e0e8e3;
      border-radius: 18px;
      padding: 0.85rem;
    }

    .checkout-item img,
    .item-image-fallback {
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 14px;
      object-fit: cover;
    }

    .item-image-fallback {
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #dcf6e8, #eff9f3);
      color: #0f7d4d;
      font-weight: 800;
    }

    .item-main {
      display: grid;
      gap: 0.35rem;
    }

    .item-main h3 {
      margin: 0;
      font-size: 1rem;
      color: #163728;
    }

    .item-main p {
      margin: 0;
      font-size: 0.84rem;
      color: #6b8375;
    }

    .custom-name-input,
    .store-field input,
    .price-field input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      color: #163728;
      font-size: 0.95rem;
      min-width: 0;
    }

    .custom-name-input {
      font-weight: 700;
      padding: 0;
    }

    .item-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 0.7rem;
      align-items: center;
    }

    .price-field {
      flex: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 0.4rem;
      min-height: 2.8rem;
      padding: 0 0.85rem;
      border: 1px solid #dbe5df;
      border-radius: 14px;
      background: #f8fbf9;
    }

    .price-field span {
      font-weight: 800;
      color: #28543e;
    }

    .delete-line-button {
      width: 2.8rem;
      height: 2.8rem;
      border: none;
      border-radius: 14px;
      background: #fff2f1;
      color: #c24138;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .summary-card {
      padding: 1rem;
      display: grid;
      gap: 1rem;
    }

    .store-field {
      display: grid;
      gap: 0.4rem;
    }

    .store-field span {
      font-size: 0.88rem;
      font-weight: 700;
      color: #466352;
    }

    .store-field small {
      font-weight: 500;
      color: #6d8476;
    }

    .store-field input {
      min-height: 2.9rem;
      padding: 0 0.9rem;
      border: 1px solid #dbe5df;
      border-radius: 14px;
      background: #f8fbf9;
    }

    .summary-grid {
      display: grid;
      gap: 0.65rem;
    }

    .summary-grid p {
      margin: 0;
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      color: #466352;
      font-weight: 600;
    }

    .summary-grid strong {
      color: #113222;
    }

    .actions {
      display: grid;
      gap: 0.65rem;
    }

    .primary-btn,
    .secondary-btn {
      min-height: 3rem;
      border: none;
      border-radius: 16px;
      font-weight: 800;
      font-size: 0.96rem;
    }

    .primary-btn {
      background: #149255;
      color: #ffffff;
    }

    .secondary-btn {
      background: transparent;
      color: #1f6f4a;
    }

    .primary-btn:disabled {
      opacity: 0.45;
    }

    @media (max-width: 640px) {
      .checkout-card-header,
      .checkout-meta {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingListCheckoutPage {
  private readonly pantryState = inject(PantryStateService);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly expenseService = inject(ExpenseService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly navigationState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as
    | { checkoutLines?: readonly CheckoutLine[]; activeStore?: 'german' | 'indian' }
    | undefined;

  protected readonly backIcon = arrowBackOutline;
  protected readonly checkIcon = checkmarkOutline;
  protected readonly addIcon = addOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly deleteIcon = trashOutline;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly checkoutLines = signal<readonly CheckoutLine[]>(
    this.navigationState?.checkoutLines?.length
      ? this.navigationState.checkoutLines
      : this.buildCheckoutLines(this.navigationState?.activeStore ?? 'german')
  );
  protected readonly checkoutStoreName = signal('');
  protected readonly checkoutDateLabel = signal(new Date().toLocaleDateString());
  protected readonly currentBudgetCurrency = computed(() => this.expenseService.getDisplayCurrency());
  protected readonly checkoutTotalItems = computed(() =>
    this.checkoutLines().reduce((sum, line) => sum + line.quantity, 0)
  );
  protected readonly checkoutGrandTotal = computed(() =>
    this.roundCurrency(
      this.checkoutLines().reduce(
        (sum, line) => sum + this.roundCurrency(this.parsePrice(line.unitPriceInput) * line.quantity),
        0
      )
    )
  );
  protected readonly hasEnteredAnyPrice = computed(() =>
    this.checkoutLines().some((line) => this.parsePrice(line.unitPriceInput) > 0)
  );

  protected currencySymbol(): string {
    return getCurrencySymbol(this.currentBudgetCurrency());
  }

  protected formatMoney(amount: number): string {
    return formatCurrencyAmount(amount, this.currentBudgetCurrency());
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/shopping-list');
  }

  protected onUnitPriceChange(itemId: string, rawValue: string): void {
    const normalizedValue = this.normalizePriceInput(rawValue);
    this.checkoutLines.set(
      this.checkoutLines().map((line) =>
        line.itemId === itemId
          ? {
              ...line,
              unitPriceInput: normalizedValue
            }
          : line
      )
    );
  }

  protected onUnitPriceBlur(itemId: string): void {
    this.checkoutLines.set(
      this.checkoutLines().map((line) => {
        if (line.itemId !== itemId) {
          return line;
        }

        const amount = this.parsePrice(line.unitPriceInput);
        return {
          ...line,
          unitPriceInput: amount > 0 ? amount.toFixed(2) : ''
        };
      })
    );
  }

  protected addCustomCheckoutItem(): void {
    const itemNumber = this.checkoutLines().length + 1;
    this.checkoutLines.set([
      ...this.checkoutLines(),
      {
        itemId: `custom-${Date.now()}-${itemNumber}`,
        name: '',
        quantity: 1,
        category: 'other',
        imageUrl: null,
        unitPriceInput: '',
        isCustom: true,
        linkedPantryItemId: null
      }
    ]);
  }

  protected onCustomCheckoutItemNameChange(itemId: string, rawValue: string): void {
    const normalizedValue = String(rawValue ?? '').slice(0, 80);
    this.checkoutLines.set(
      this.checkoutLines().map((line) =>
        line.itemId === itemId
          ? {
              ...line,
              name: normalizedValue
            }
          : line
      )
    );
  }

  protected onStoreNameChange(rawValue: unknown): void {
    this.checkoutStoreName.set(String(rawValue ?? ''));
  }

  protected removeCheckoutLine(itemId: string): void {
    this.checkoutLines.set(this.checkoutLines().filter((line) => line.itemId !== itemId));
  }

  protected async confirmPurchase(): Promise<void> {
    if (!this.hasEnteredAnyPrice()) {
      return;
    }

    const purchaseDate = new Date().toISOString();
    const lines = this.checkoutLines().map((line) => {
      const unitPrice = this.parsePrice(line.unitPriceInput);
      return {
        id: line.itemId,
        itemName: line.name.trim() || 'Custom Item',
        quantity: line.quantity,
        unitPrice,
        totalPrice: this.roundCurrency(unitPrice * line.quantity),
        category: line.category,
        purchaseDate,
        store: this.checkoutStoreName().trim() || undefined
      };
    });

    await this.expenseService.addPurchaseRecord({
      store: this.checkoutStoreName().trim() || undefined,
      items: lines
    });

    await this.restockLinkedPantryItems();
    await this.clearVisibleActiveItems();
    const toast = await this.toastController.create({
      message: 'Purchase added to expenses',
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
    await this.router.navigateByUrl('/tabs/shopping-list', { replaceUrl: true });
    await this.router.navigateByUrl('/tabs/expenses');
  }

  private buildCheckoutLines(activeStore: 'german' | 'indian'): readonly CheckoutLine[] {
    return this.shoppingState.activeItems()
      .filter((item) => this.matchesStore(item, activeStore))
      .map((item) => {
        const pantryItem = item.linkedPantryItemId ? this.pantryState.getById(item.linkedPantryItemId) : undefined;
        return {
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          category: this.resolveCategory(item),
          imageUrl: pantryItem?.imageUrl ?? null,
          unitPriceInput: '',
          isCustom: false,
          linkedPantryItemId: item.linkedPantryItemId ?? null
        };
      });
  }

  private matchesStore(item: ShoppingListItem, activeStore: 'german' | 'indian'): boolean {
    if (item.linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
      if (pantryItem) {
        return activeStore === 'german' ? pantryItem.germanStore : pantryItem.indianStore;
      }
    }

    return activeStore === 'german' ? item.germanStore : item.indianStore;
  }

  private resolveCategory(item: ShoppingListItem): PantryCategory {
    if (item.linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
      if (pantryItem) {
        return pantryItem.category;
      }
    }

    return 'other';
  }

  private async restockLinkedPantryItems(): Promise<void> {
    const pantryItemIds = [
      ...new Set(
        this.checkoutLines()
          .filter((line) => !line.isCustom && line.linkedPantryItemId)
          .map((line) => line.linkedPantryItemId as string)
      )
    ];

    for (const pantryItemId of pantryItemIds) {
      await this.pantryState.setQuantity(pantryItemId, RESTOCK_QUANTITY);
    }
  }

  private async clearVisibleActiveItems(): Promise<void> {
    const itemIds = this.checkoutLines()
      .filter((line) => !line.isCustom)
      .map((line) => line.itemId);

    for (const itemId of itemIds) {
      await this.shoppingState.remove(itemId);
    }
  }

  private normalizePriceInput(value: string): string {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (normalized === '') {
      return '';
    }
    if (!/^\d*\.?\d*$/.test(normalized)) {
      return '';
    }
    const decimalParts = normalized.split('.');
    if (decimalParts.length > 2) {
      return '';
    }
    return normalized;
  }

  private parsePrice(value: string): number {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (normalized === '' || normalized === '.') {
      return 0;
    }
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return this.roundCurrency(parsed);
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
