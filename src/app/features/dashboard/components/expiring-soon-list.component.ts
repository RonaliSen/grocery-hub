import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';

import { PantryItem } from '../../pantry/models/pantry-item.model';
import { PantryImagePipe } from '../../pantry/pipes/pantry-image.pipe';
import { ExpiryStatusPipe } from '../../../shared/pipes/expiry-status.pipe';
import { FallbackImageDirective } from '../../../shared/directives/fallback-image.directive';

@Component({
  selector: 'app-expiring-soon-list',
  standalone: true,
  imports: [ExpiryStatusPipe, FallbackImageDirective, PantryImagePipe, RouterLink, UpperCasePipe],
  template: `
    <section class="expiring-section" id="expiring-soon">
      <div class="section-header">
        <h2 class="section-title">Expiring Soon</h2>
        <button class="view-all-btn" [routerLink]="['/tabs/pantry']" [queryParams]="{ filter: 'expiring' }">
          View All
        </button>
      </div>

      <div class="expiring-grid no-scrollbar">
        @for (item of items(); track item.id) {
          <div class="expiring-card" [routerLink]="['/tabs/pantry', item.id, 'edit']">
            <div class="expiring-card__image-container">
              <img
                [src]="item | pantryImage"
                [appFallbackImage]="item | pantryImage: 'fallback'"
                [alt]="item.name"
                class="expiring-card__image"
                loading="lazy"
              />
            </div>
            <span
              class="expiring-card__badge"
              [class.badge--urgent]="isUrgent(item)"
              [class.badge--warning]="!isUrgent(item)"
            >
              {{ item.expiryDate | expiryStatus | uppercase }}
            </span>
            <p class="expiring-card__name">{{ item.name }}</p>
            <p class="expiring-card__location">Dairy Fridge</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .expiring-section {
        margin: 0;
        display: grid;
        gap: var(--app-space-4);
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--app-space-3);
        flex-wrap: wrap;
      }

      .section-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--app-ink);
        margin: 0;
        letter-spacing: -0.01em;
      }

      .view-all-btn {
        color: var(--app-primary);
        font-size: 0.875rem;
        font-weight: 700;
        background: none;
        border: none;
        padding: 0;
      }

      .expiring-grid {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(15rem, 82%);
        gap: var(--app-space-4);
        overflow-x: auto;
        overscroll-behavior-x: contain;
        padding-bottom: var(--app-space-2);
        scroll-snap-type: x proximity;
      }

      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      .expiring-card {
        background: var(--app-surface);
        border: 1px solid var(--app-border);
        border-radius: var(--app-radius-sm);
        padding: var(--app-space-4);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        transition: transform 0.2s ease;
        scroll-snap-align: start;
        min-width: 0;
        display: grid;
        gap: var(--app-space-3);

        &:active {
          transform: scale(0.98);
        }
      }

      .expiring-card__image-container {
        width: 100%;
        height: 120px;
        background: var(--app-surface-muted);
        border-radius: var(--app-radius-xs);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .expiring-card__image {
        width: min(100%, 80px);
        height: auto;
        max-height: 80px;
        object-fit: contain;
      }

      .expiring-card__badge {
        display: inline-block;
        padding: 4px 8px;
        font-size: 10px;
        font-weight: 700;
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .badge--urgent {
        background: #fef2f2;
        color: var(--accent-red);
      }

      .badge--warning {
        background: var(--app-warning-surface);
        color: var(--accent-orange);
      }

      .expiring-card__name {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--app-ink);
        margin: 0;
        line-height: 1.4;
        word-break: break-word;
      }

      .expiring-card__location {
        font-size: 0.75rem;
        color: var(--app-text-muted);
        font-weight: 500;
        margin: 0;
      }

      @media (max-width: 479px) {
        .expiring-grid {
          grid-auto-columns: minmax(14rem, 88%);
        }
      }

      @media (min-width: 768px) {
        .expiring-grid {
          grid-auto-flow: row;
          grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
          overflow: visible;
          padding-bottom: 0;
          scroll-snap-type: none;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiringSoonListComponent {
  readonly items = input.required<readonly PantryItem[]>();

  protected isUrgent(item: PantryItem): boolean {
    // Basic logic for demonstration; would ideally use more robust date diffing
    if (!item.expiryDate) return false;
    return item.expiryDate.includes('2 days') || item.expiryDate.includes('tomorrow') || item.expiryDate.includes('Today');
  }
}
