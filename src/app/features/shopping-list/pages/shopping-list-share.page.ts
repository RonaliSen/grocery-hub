import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { jsPDF } from 'jspdf';
import {
  arrowBackOutline,
  cartOutline,
  chevronForwardOutline,
  copyOutline,
  documentOutline,
  calendarOutline,
  logoWhatsapp,
  shieldCheckmarkOutline,
  storefrontOutline
} from 'ionicons/icons';

import { APP_NAME } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { ShoppingListStateService } from '../services/shopping-list-state.service';

type ShareMethod = 'whatsapp' | 'clipboard' | 'pdf';

type ShareOption = {
  readonly method: ShareMethod;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
};

@Component({
  selector: 'app-shopping-list-share-page',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <header class="flow-header">
      <button type="button" class="icon-btn plain" (click)="goBack()" aria-label="Back to cart">
        <ion-icon [icon]="backIcon" aria-hidden="true" />
      </button>
      <h1>Share Shopping List</h1>
    </header>

    <ion-content [fullscreen]="true" class="share-content">
      <main class="share-screen">
        <section class="share-summary-card">
          <div class="share-summary-hero">
            <div class="share-summary-icon" aria-hidden="true">
              <ion-icon [icon]="cartIcon" />
            </div>
            <div class="share-summary-copy">
              <h2>Shopping List</h2>
              <p>
                <strong>{{ shareLineItemCount() }}</strong>
                items ready to share
              </p>
            </div>
          </div>

          <div class="share-items-list" role="list" aria-label="Shopping items">
            @for (item of shareItems(); track item.id) {
              <div class="share-item-row" role="listitem">
                <span class="share-item-name">
                  <span class="share-item-checkbox" aria-hidden="true"></span>
                  <span>{{ item.name }}</span>
                </span>
                <span class="share-item-qty">× {{ item.quantity }}</span>
              </div>
            }
          </div>

          <div class="share-summary-meta">
            <div class="share-meta-row">
              <ion-icon [icon]="storeIcon" aria-hidden="true" />
              <span>Store: {{ activeStoreNameLabel() }}</span>
            </div>
            <div class="share-meta-row">
              <ion-icon [icon]="calendarIcon" aria-hidden="true" />
              <span>Date: {{ shareGeneratedDateLongLabel() }}</span>
            </div>
          </div>
        </section>

        <section class="share-options-section">
          <h2>Choose a format</h2>
          <p>Select how you want to share your list</p>

          <div class="share-options">
            @for (option of shareOptions; track option.method) {
              <button
                type="button"
                class="share-option-card"
                [class.is-selected]="selectedShareMethod() === option.method"
                (click)="shareWithMethod(option.method)"
              >
                <span class="share-option-icon">
                  <ion-icon [icon]="option.icon" aria-hidden="true" />
                </span>
                <span class="share-option-copy">
                  <strong>{{ option.title }}</strong>
                  <small>{{ option.subtitle }}</small>
                </span>
                <span class="share-option-arrow" aria-hidden="true">
                  <ion-icon [icon]="forwardIcon" />
                </span>
              </button>
            }
          </div>
        </section>

        <aside class="share-note">
          <ion-icon [icon]="shieldIcon" aria-hidden="true" />
          <p>Only active items from the selected store are included.</p>
        </aside>

        <p class="share-branding">Generated from Grocery Hub <span aria-hidden="true">♥</span></p>
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
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: calc(env(safe-area-inset-top, 0px) + 1rem) 1.1rem 0.95rem;
      background: rgba(244, 248, 245, 0.94);
      backdrop-filter: blur(18px);
      border-bottom: 1px solid #d9e5de;
    }

    .flow-header h1 {
      margin: 0;
      font-size: clamp(1.4rem, 5.2vw, 1.95rem);
      color: #11673f;
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
      color: #11673f;
      border: 1px solid #d9e5de;
    }

    .share-content {
      --background: #f4f8f5;
    }

    .share-screen {
      width: min(100%, 680px);
      margin: 0 auto;
      padding: 1.15rem 1rem calc(2rem + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .share-summary-card,
    .share-option-card,
    .share-note {
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid #d9e5de;
      box-shadow: 0 16px 32px rgba(18, 69, 44, 0.08);
    }

    .share-summary-card {
      border-radius: 24px;
      padding: 1.15rem;
      display: grid;
      gap: 1rem;
    }

    .share-summary-hero {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.9rem;
      align-items: center;
    }

    .share-summary-icon,
    .share-option-icon,
    .share-note ion-icon {
      display: grid;
      place-items: center;
      color: #14834f;
      background: linear-gradient(180deg, #eef8f2, #e5f3eb);
    }

    .share-summary-icon {
      width: 4.25rem;
      height: 4.25rem;
      border-radius: 999px;
      font-size: 1.75rem;
    }

    .share-summary-copy h2,
    .share-options-section h2 {
      margin: 0;
      color: #0f2d1e;
      font-size: clamp(1.25rem, 4.8vw, 1.9rem);
      letter-spacing: -0.02em;
    }

    .share-summary-copy p,
    .share-options-section p,
    .share-note p {
      margin: 0;
      color: #5d7366;
    }

    .share-summary-copy p {
      font-size: 1rem;
    }

    .share-summary-copy strong {
      color: #14834f;
      font-size: 1.65rem;
      margin-right: 0.3rem;
    }

    .share-items-list,
    .share-summary-meta {
      display: grid;
    }

    .share-items-list {
      border-top: 1px solid #dfe7e1;
      border-bottom: 1px solid #dfe7e1;
    }

    .share-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 0.1rem;
    }

    .share-item-row + .share-item-row {
      border-top: 1px solid #edf3ef;
    }

    .share-item-name {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
      min-width: 0;
      color: #16281e;
      font-size: 1.02rem;
    }

    .share-item-name span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .share-item-checkbox {
      width: 1.35rem;
      height: 1.35rem;
      border-radius: 0.4rem;
      border: 2px solid #8eb79e;
      background: #ffffff;
      flex-shrink: 0;
    }

    .share-item-qty {
      white-space: nowrap;
      color: #16281e;
      font-weight: 700;
      font-size: 1.05rem;
    }

    .share-summary-meta {
      gap: 0.95rem;
    }

    .share-meta-row {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
      color: #22382d;
      font-size: 1rem;
    }

    .share-meta-row ion-icon {
      color: #14834f;
      font-size: 1.35rem;
    }

    .share-options {
      display: grid;
      gap: 0.9rem;
    }

    .share-option-card {
      border-radius: 22px;
      padding: 1rem;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.9rem;
      align-items: center;
      text-align: left;
    }

    .share-option-card.is-selected {
      border-color: #149255;
      background: #eef8f2;
      box-shadow: 0 10px 24px rgba(20, 146, 85, 0.12);
    }

    .share-option-icon {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 999px;
      font-size: 1.45rem;
    }

    .share-option-copy {
      display: grid;
      gap: 0.15rem;
    }

    .share-option-copy strong {
      color: #163728;
      font-size: 1rem;
    }

    .share-option-copy small {
      color: #6b8375;
      font-size: 0.9rem;
    }

    .share-option-arrow {
      color: #14834f;
      font-size: 1.45rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .share-options-section {
      display: grid;
      gap: 0.45rem;
    }

    .share-options-section p {
      font-size: 0.98rem;
      margin-bottom: 0.4rem;
    }

    .share-note {
      border-radius: 20px;
      padding: 1.1rem 1rem;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.9rem;
      align-items: center;
      background: linear-gradient(135deg, rgba(237, 248, 242, 0.96), rgba(246, 251, 248, 0.96));
    }

    .share-note ion-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 999px;
      font-size: 1.35rem;
    }

    .share-branding {
      margin: 0.25rem 0 0;
      text-align: center;
      color: #61776b;
      font-size: 1rem;
      font-weight: 600;
    }

    .share-branding span {
      color: #14834f;
    }

    @media (max-width: 480px) {
      .share-summary-copy strong {
        font-size: 1.4rem;
      }

      .share-item-row,
      .share-meta-row,
      .share-option-copy small,
      .share-note p,
      .share-branding {
        font-size: 0.94rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingListSharePage {
  private static readonly shareTitle = 'Grocery Hub Shopping List';
  private static readonly brandGreen = [20, 118, 74] as const;
  private static readonly brandGreenDark = [12, 92, 57] as const;
  private static readonly brandGreenTint = [239, 248, 242] as const;
  private static readonly borderColor = [211, 227, 217] as const;
  private static readonly bodyText = [28, 45, 36] as const;
  private static readonly mutedText = [91, 113, 101] as const;
  private readonly route = inject(ActivatedRoute);
  private readonly pantryState = inject(PantryStateService);
  private readonly shoppingState = inject(ShoppingListStateService);
  private readonly settingsService = inject(SettingsService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly toastController = inject(ToastController);

  protected readonly backIcon = arrowBackOutline;
  protected readonly cartIcon = cartOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly forwardIcon = chevronForwardOutline;
  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly storeIcon = storefrontOutline;
  protected readonly shareOptions: readonly ShareOption[] = [
    {
      method: 'whatsapp',
      title: 'Share via WhatsApp',
      subtitle: 'Send directly in WhatsApp',
      icon: logoWhatsapp
    },
    {
      method: 'clipboard',
      title: 'Copy to Clipboard',
      subtitle: 'Copy the list as plain text',
      icon: copyOutline
    },
    {
      method: 'pdf',
      title: 'Save as PDF',
      subtitle: 'Generate a PDF to save or share',
      icon: documentOutline
    }
  ];
  protected readonly selectedShareMethod = signal<ShareMethod>('whatsapp');
  protected readonly shareGeneratedAt = signal(new Date());
  protected readonly activeStore = signal<'german' | 'indian'>(
    this.route.snapshot.queryParamMap.get('store') === 'indian' ? 'indian' : 'german'
  );
  protected readonly shareItems = computed(() =>
    this.shoppingState.activeItems().filter((item) => this.matchesActiveStore(item))
  );
  protected readonly shareLineItemCount = computed(() => this.shareItems().length);
  protected readonly shareTotalItemCount = computed(() =>
    this.shareItems().reduce((sum, item) => sum + item.quantity, 0)
  );
  protected readonly shareGeneratedDateLabel = computed(() =>
    this.shareGeneratedAt().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  );
  protected readonly shareGeneratedDateTimeLabel = computed(() =>
    this.shareGeneratedAt().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  );
  protected readonly shareGeneratedDateLongLabel = computed(() =>
    this.shareGeneratedAt().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })
  );
  protected readonly sharedByLabel = computed(() => {
    const fullName = this.settingsService.settings().profile.fullName.trim();
    return fullName || 'Generated by Grocery Hub User';
  });

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/shopping-list');
  }

  protected selectShareMethod(method: ShareMethod): void {
    this.selectedShareMethod.set(method);
    this.shareGeneratedAt.set(new Date());
  }

  protected activeStoreLabel(): string {
    return this.activeStore() === 'german' ? 'German' : 'Indian';
  }

  protected activeStoreNameLabel(): string {
    return `${this.activeStoreLabel()} Store`;
  }

  protected async shareWithMethod(method: ShareMethod): Promise<void> {
    this.selectShareMethod(method);
    await this.shareNow();
  }

  protected async shareNow(): Promise<void> {
    if (this.shareItems().length <= 0) {
      await this.presentToast('No items available to export.', 'warning');
      return;
    }

    try {
      const listText = this.buildShoppingListText();

      switch (this.selectedShareMethod()) {
        case 'whatsapp':
          await this.openWhatsAppShare(listText);
          await this.presentToast('Opening WhatsApp…', 'success');
          break;
        case 'clipboard':
          await this.copyShoppingListToClipboard(listText);
          await this.presentToast('Shopping list copied successfully', 'success');
          break;
        case 'pdf':
          await this.shareShoppingListPdf();
          await this.presentToast('PDF ready to share', 'success');
          break;
        default:
          await this.copyShoppingListToClipboard(listText);
          await this.presentToast('Shopping list copied successfully', 'success');
          break;
      }

      await this.navigationHistory.back('/tabs/shopping-list');
    } catch {
      await this.presentToast('Unable to share the shopping list right now.', 'danger');
    }
  }

  protected async saveShoppingListAsPdf(): Promise<void> {
    if (this.shareItems().length <= 0) {
      await this.presentToast('No items available to export.', 'warning');
      return;
    }

    try {
      await this.savePdfToDevice();
      await this.presentToast('Shopping list PDF saved successfully', 'success');
      await this.navigationHistory.back('/tabs/shopping-list');
    } catch {
      await this.presentToast('PDF generation failed. Please try again.', 'danger');
    }
  }

  private matchesActiveStore(item: ShoppingListItem): boolean {
    if (item.linkedPantryItemId) {
      const pantryItem = this.pantryState.getById(item.linkedPantryItemId);
      if (pantryItem) {
        return this.activeStore() === 'german' ? pantryItem.germanStore : pantryItem.indianStore;
      }
    }

    return this.activeStore() === 'german' ? item.germanStore : item.indianStore;
  }

  private buildShoppingListText(): string {
    const lines = this.shareItems().map(
      (item) => `□ ${item.name} - ${this.formatQuantityLabel(item)}`
    );
    return [
      '🛒 Grocery Hub Shopping List',
      `Generated on: ${this.shareGeneratedDateTimeLabel()}`,
      `Shared by: ${this.sharedByLabel()}`,
      '',
      ...lines,
      '',
      `Total Items: ${this.shareTotalItemCount()}`,
      '',
      'Generated from Grocery Hub'
    ].join('\n');
  }

  private async copyShoppingListToClipboard(text: string): Promise<void> {
    try {
      await Clipboard.write({ string: text });
      return;
    } catch {
      // Fall through to the browser clipboard API.
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    throw new Error('Clipboard unavailable');
  }

  private async openWhatsAppShare(text: string): Promise<void> {
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const openedWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }
  }

  private async shareShoppingListPdf(): Promise<void> {
    const fileName = this.buildPdfFileName();
    const pdfBlob = this.createPdfBlob();

    if (Capacitor.isNativePlatform()) {
      const uri = await this.writePdfFile(fileName, pdfBlob, Directory.Cache);
      await Share.share({
        title: ShoppingListSharePage.shareTitle,
        text: 'Shared from Grocery Hub',
        files: [uri],
        dialogTitle: 'Share Shopping List PDF'
      });
      return;
    }

    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      'canShare' in navigator &&
      navigator.canShare?.({ files: [pdfFile] })
    ) {
      await navigator.share({
        title: ShoppingListSharePage.shareTitle,
        files: [pdfFile]
      });
      return;
    }

    this.downloadBlob(pdfBlob, fileName);
  }

  private async savePdfToDevice(): Promise<void> {
    const fileName = this.buildPdfFileName();
    const pdfBlob = this.createPdfBlob();

    if (Capacitor.isNativePlatform()) {
      await this.writePdfFile(fileName, pdfBlob, Directory.Documents);
      return;
    }

    this.downloadBlob(pdfBlob, fileName);
  }

  private createPdfBlob(): Blob {
    const document = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const left = 40;
    const contentWidth = pageWidth - left * 2;
    const footerY = pageHeight - 44;
    const bottomSafeLimit = pageHeight - 118;
    const tableHeaderHeight = 28;
    const quantityColWidth = 94;
    const serialColWidth = 34;
    const checkboxColWidth = 36;
    const itemColWidth = contentWidth - serialColWidth - quantityColWidth - checkboxColWidth;
    const rowPaddingX = 10;
    let y = this.drawFirstPageHeader(document, left, contentWidth);

    const drawContinuationHeader = (): void => {
      document.addPage();
      y = this.drawContinuationPageHeader(document, left, contentWidth);
    };

    const drawTableHeader = (): void => {
      if (y + tableHeaderHeight > bottomSafeLimit) {
        drawContinuationHeader();
      }

      document.setFillColor(...ShoppingListSharePage.brandGreenDark);
      document.roundedRect(left, y, contentWidth, tableHeaderHeight, 8, 8, 'F');
      document.setFont('helvetica', 'bold');
      document.setFontSize(11);
      document.setTextColor(255, 255, 255);
      document.text('#', left + rowPaddingX, y + 18);
      document.text('Item', left + serialColWidth + rowPaddingX, y + 18);
      document.text('Quantity', left + serialColWidth + itemColWidth + rowPaddingX, y + 18);
      document.text('✓', left + contentWidth - checkboxColWidth / 2 - 3, y + 18, { align: 'center' });
      y += tableHeaderHeight;
    };

    drawTableHeader();

    this.shareItems().forEach((item, index) => {
      const quantityLabel = this.formatQuantityLabel(item);
      const itemLines = document.splitTextToSize(item.name, itemColWidth - rowPaddingX * 2);
      const quantityLines = document.splitTextToSize(quantityLabel, quantityColWidth - rowPaddingX * 2);
      const contentLines = Math.max(itemLines.length, quantityLines.length);
      const rowHeight = Math.max(34, contentLines * 14 + 14);

      if (y + rowHeight > bottomSafeLimit) {
        drawContinuationHeader();
        drawTableHeader();
      }

      this.drawTableRow(
        document,
        {
          x: left,
          y,
          width: contentWidth,
          height: rowHeight,
          serialColWidth,
          itemColWidth,
          quantityColWidth,
          checkboxColWidth,
          rowPaddingX
        },
        index + 1,
        itemLines,
        quantityLines
      );

      y += rowHeight;
    });

    const totalCardHeight = 52;
    const footerSpacing = 22;
    if (y + totalCardHeight + footerSpacing > bottomSafeLimit) {
      drawContinuationHeader();
    }

    y += 18;
    this.drawTotalCard(document, left, y, contentWidth, totalCardHeight);
    this.drawFooter(document, pageWidth, footerY);

    const totalPages = document.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      document.setPage(page);
      this.drawFooter(document, pageWidth, footerY);
    }

    return document.output('blob');
  }

  private buildPdfFileName(): string {
    const storeLabel = this.activeStoreLabel().toLowerCase();
    const generatedAt = this.shareGeneratedAt();
    const timestamp = [
      generatedAt.getFullYear(),
      `${generatedAt.getMonth() + 1}`.padStart(2, '0'),
      `${generatedAt.getDate()}`.padStart(2, '0')
    ].join('-');
    return `grocery-hub-${storeLabel}-shopping-list-${timestamp}.pdf`;
  }

  private drawFirstPageHeader(document: jsPDF, left: number, contentWidth: number): number {
    let y = 46;
    this.drawBrandLockup(document, left, y);

    document.setFont('helvetica', 'bold');
    document.setFontSize(10);
    document.setTextColor(...ShoppingListSharePage.mutedText);
    document.text('Generated on:', left + contentWidth, y + 4, { align: 'right' });
    document.setFont('helvetica', 'normal');
    document.setFontSize(11);
    document.setTextColor(...ShoppingListSharePage.bodyText);
    document.text(this.shareGeneratedDateTimeLabel(), left + contentWidth, y + 20, { align: 'right' });

    y += 72;
    document.setFont('helvetica', 'bold');
    document.setFontSize(24);
    document.setTextColor(...ShoppingListSharePage.brandGreenDark);
    document.text(ShoppingListSharePage.shareTitle, left, y);
    this.drawCartIcon(document, left + contentWidth - 8, y - 10);

    y += 16;
    document.setDrawColor(...ShoppingListSharePage.brandGreen);
    document.setLineWidth(1.2);
    document.line(left, y, left + contentWidth, y);

    y += 18;
    this.drawSharedByCard(document, left, y, contentWidth);
    return y + 66;
  }

  private drawContinuationPageHeader(document: jsPDF, left: number, contentWidth: number): number {
    let y = 42;
    this.drawBrandLockup(document, left, y);

    document.setFont('helvetica', 'bold');
    document.setFontSize(10);
    document.setTextColor(...ShoppingListSharePage.mutedText);
    document.text('Generated on:', left + contentWidth, y + 4, { align: 'right' });
    document.setFont('helvetica', 'normal');
    document.setFontSize(11);
    document.setTextColor(...ShoppingListSharePage.bodyText);
    document.text(this.shareGeneratedDateTimeLabel(), left + contentWidth, y + 20, { align: 'right' });

    y += 46;
    document.setFont('helvetica', 'bold');
    document.setFontSize(16);
    document.setTextColor(...ShoppingListSharePage.brandGreenDark);
    document.text(ShoppingListSharePage.shareTitle, left, y);

    y += 14;
    document.setDrawColor(...ShoppingListSharePage.borderColor);
    document.setLineWidth(1);
    document.line(left, y, left + contentWidth, y);
    return y + 16;
  }

  private drawBrandLockup(document: jsPDF, x: number, y: number): void {
    const green = ShoppingListSharePage.brandGreenDark;

    document.setDrawColor(...green);
    document.setLineWidth(1.6);
    document.roundedRect(x, y, 20, 24, 4, 4, 'S');
    document.line(x + 5, y, x + 10, y - 6);
    document.line(x + 15, y, x + 10, y - 6);
    document.setDrawColor(...ShoppingListSharePage.brandGreen);
    document.setLineWidth(1.2);
    document.line(x + 6, y + 7, x + 14, y + 11);
    document.line(x + 14, y + 11, x + 10, y + 18);
    document.line(x + 10, y + 18, x + 6, y + 7);
    document.line(x + 9, y + 13, x + 13, y + 9);

    document.setFont('helvetica', 'bold');
    document.setFontSize(14);
    document.setTextColor(...ShoppingListSharePage.brandGreenDark);
    document.text('Grocery', x + 28, y + 11);
    document.text('Hub', x + 28, y + 26);
  }

  private drawSharedByCard(document: jsPDF, x: number, y: number, width: number): void {
    document.setFillColor(255, 255, 255);
    document.setDrawColor(...ShoppingListSharePage.borderColor);
    document.roundedRect(x, y, width, 48, 10, 10, 'FD');
    this.drawUserIcon(document, x + 14, y + 14);

    document.setFont('helvetica', 'bold');
    document.setFontSize(10);
    document.setTextColor(...ShoppingListSharePage.mutedText);
    document.text('Shared by', x + 50, y + 18);

    document.setFont('helvetica', 'normal');
    document.setFontSize(12);
    document.setTextColor(...ShoppingListSharePage.bodyText);
    document.text(this.sharedByLabel(), x + 50, y + 34);
  }

  private drawTableRow(
    document: jsPDF,
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      serialColWidth: number;
      itemColWidth: number;
      quantityColWidth: number;
      checkboxColWidth: number;
      rowPaddingX: number;
    },
    index: number,
    itemLines: string[],
    quantityLines: string[]
  ): void {
    const {
      x,
      y,
      width,
      height,
      serialColWidth,
      itemColWidth,
      quantityColWidth,
      checkboxColWidth,
      rowPaddingX
    } = layout;
    const itemX = x + serialColWidth;
    const quantityX = itemX + itemColWidth;
    const checkboxX = quantityX + quantityColWidth;
    const baselineY = y + 18;

    document.setFillColor(255, 255, 255);
    document.setDrawColor(...ShoppingListSharePage.borderColor);
    document.rect(x, y, width, height, 'FD');
    document.line(itemX, y, itemX, y + height);
    document.line(quantityX, y, quantityX, y + height);
    document.line(checkboxX, y, checkboxX, y + height);

    document.setFont('helvetica', 'normal');
    document.setFontSize(11);
    document.setTextColor(...ShoppingListSharePage.bodyText);
    document.text(String(index), x + rowPaddingX, baselineY);
    document.text(itemLines, itemX + rowPaddingX, baselineY);
    document.text(quantityLines, quantityX + rowPaddingX, baselineY);
    document.roundedRect(checkboxX + 10, y + height / 2 - 7, 14, 14, 2, 2, 'S');
  }

  private drawTotalCard(document: jsPDF, x: number, y: number, width: number, height: number): void {
    document.setFillColor(...ShoppingListSharePage.brandGreenTint);
    document.setDrawColor(...ShoppingListSharePage.brandGreen);
    document.roundedRect(x, y, width, height, 10, 10, 'FD');
    this.drawBasketIcon(document, x + 14, y + 13);

    document.setFont('helvetica', 'bold');
    document.setFontSize(14);
    document.setTextColor(...ShoppingListSharePage.brandGreenDark);
    document.text('Total Items', x + 50, y + 22);

    document.setFontSize(16);
    document.text(String(this.shareTotalItemCount()), x + width - 16, y + 22, { align: 'right' });
  }

  private drawFooter(document: jsPDF, pageWidth: number, y: number): void {
    const footerText = `Generated from ${APP_NAME}`;
    const heartX = pageWidth / 2 + document.getTextWidth(footerText) / 2 + 12;

    document.setFont('helvetica', 'normal');
    document.setFontSize(10);
    document.setTextColor(...ShoppingListSharePage.mutedText);
    document.text(footerText, pageWidth / 2, y, { align: 'center' });
    this.drawHeart(document, heartX, y - 4);
  }

  private drawCartIcon(document: jsPDF, x: number, y: number): void {
    document.setDrawColor(...ShoppingListSharePage.brandGreen);
    document.setLineWidth(1.8);
    document.line(x - 24, y + 2, x - 18, y + 2);
    document.line(x - 18, y + 2, x - 14, y + 16);
    document.line(x - 14, y + 16, x - 3, y + 16);
    document.line(x - 3, y + 16, x, y + 7);
    document.line(x - 13, y + 9, x - 1, y + 9);
    document.circle(x - 11, y + 22, 1.8, 'S');
    document.circle(x - 3, y + 22, 1.8, 'S');
  }

  private drawUserIcon(document: jsPDF, x: number, y: number): void {
    document.setDrawColor(...ShoppingListSharePage.brandGreen);
    document.setLineWidth(1.3);
    document.circle(x + 7, y + 5, 4, 'S');
    document.circle(x + 17, y + 8, 4, 'S');
    document.roundedRect(x, y + 13, 14, 9, 4, 4, 'S');
    document.roundedRect(x + 10, y + 13, 14, 9, 4, 4, 'S');
  }

  private drawBasketIcon(document: jsPDF, x: number, y: number): void {
    document.setDrawColor(...ShoppingListSharePage.brandGreenDark);
    document.setLineWidth(1.5);
    document.line(x + 6, y, x + 12, y - 10);
    document.line(x + 18, y, x + 12, y - 10);
    document.rect(x, y, 24, 15, 'S');
    document.line(x + 5, y + 4, x + 19, y + 4);
    document.line(x + 7, y + 4, x + 9, y + 15);
    document.line(x + 12, y + 4, x + 12, y + 15);
    document.line(x + 17, y + 4, x + 15, y + 15);
  }

  private drawHeart(document: jsPDF, x: number, y: number): void {
    document.setFillColor(...ShoppingListSharePage.brandGreen);
    document.circle(x - 3, y, 2.4, 'F');
    document.circle(x + 3, y, 2.4, 'F');
    document.triangle(x - 6, y + 1, x + 6, y + 1, x, y + 8, 'F');
  }

  private formatQuantityLabel(item: ShoppingListItem): string {
    if (!item.unit || item.unit === 'count') {
      return String(item.quantity);
    }

    return `${item.quantity} ${this.formatUnitLabel(item.unit)}`;
  }

  private formatUnitLabel(unit: NonNullable<ShoppingListItem['unit']>): string {
    switch (unit) {
      case 'kg':
        return 'kg';
      case 'g':
        return 'g';
      case 'l':
        return 'L';
      case 'ml':
        return 'ml';
      case 'pack':
        return 'pack';
      case 'box':
        return 'box';
      case 'count':
      default:
        return 'pcs';
    }
  }

  private async writePdfFile(fileName: string, pdfBlob: Blob, directory: Directory): Promise<string> {
    const base64Data = await this.blobToBase64(pdfBlob);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory,
      recursive: true
    });
    return result.uri;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const [, base64 = ''] = result.split(',', 2);
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read generated PDF.'));
      reader.readAsDataURL(blob);
    });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  private async presentToast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
