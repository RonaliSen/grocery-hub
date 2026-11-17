import { toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { AlertController } from '@ionic/angular/standalone';
import {
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/angular/standalone';
import { filter, map, startWith } from 'rxjs';

import { NavigationHistoryService } from '../../../core/services/navigation-history.service';

type AppTabId = 'home' | 'pantry' | 'shopping-list' | 'expenses' | 'settings';

const APP_TABS = new Set<AppTabId>(['home', 'pantry', 'shopping-list', 'expenses', 'settings']);

function resolveActiveTab(url: string): AppTabId | null {
  const path = getPathname(url);
  const [, tabsRoute, activeChildRoute] = path.split('/');

  if (tabsRoute !== 'tabs' || !activeChildRoute || !APP_TABS.has(activeChildRoute as AppTabId)) {
    return null;
  }

  return activeChildRoute as AppTabId;
}

function getPathname(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

@Component({
  selector: 'app-tabs-shell-page',
  standalone: true,
  imports: [IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-router-outlet />

      <ion-tab-bar slot="bottom" class="custom-tab-bar" [selectedTab]="activeTab()">
        <ion-tab-button tab="home" href="/tabs/home" [selected]="activeTab() === 'home'">
          <i class="fa-solid fa-house tab-icon"></i>
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button
          tab="pantry"
          href="/tabs/pantry"
          [selected]="activeTab() === 'pantry'"
        >
          <i class="fa-solid fa-box-archive tab-icon"></i>
          <ion-label>Pantry</ion-label>
        </ion-tab-button>

        <ion-tab-button
          tab="shopping-list"
          href="/tabs/shopping-list"
          [selected]="activeTab() === 'shopping-list'"
        >
          <i class="fa-solid fa-cart-shopping tab-icon"></i>
          <ion-label>Cart</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="expenses" href="/tabs/expenses" [selected]="activeTab() === 'expenses'">
          <i class="fa-solid fa-wallet tab-icon"></i>
          <ion-label>Expenses</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="settings" href="/tabs/settings" [selected]="activeTab() === 'settings'">
          <i class="fa-regular fa-user tab-icon"></i>
          <ion-label>Account</ion-label>
        </ion-tab-button>
      </ion-tab-bar>

    </ion-tabs>
  `,
  styles: [
    `
      .custom-tab-bar {
        --background: transparent;
        --border-color: transparent;
        height: calc(86px + env(safe-area-inset-bottom, 0px));
        padding-bottom: 0;
        display: flex;
        justify-content: space-around;
        align-items: stretch;
        margin: 0 12px 0;
        border: 1px solid var(--app-border);
        border-radius: 22px;
        backdrop-filter: blur(14px);
        box-shadow: var(--app-shadow-strong);
        background: var(--app-tabbar-background);
      }

      ion-tab-button {
        --color: var(--app-text-muted);
        --color-selected: var(--app-primary);
        background: transparent;
        height: 100%;
        flex: 1 1 0;
        min-width: 0;
        transition: all 0.2s;

        &::part(native) {
          padding-top: 8px;
          border-radius: 14px;
        }
      }

      .tab-icon {
        font-size: 20px;
        margin-bottom: 4px;
      }

      ion-label {
        font-size: 10px;
        font-weight: 500;
        margin-top: 2px;
        text-transform: none;
        white-space: nowrap;
      }

    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabsShellPage {
  private readonly alertController = inject(AlertController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly activeTab = computed(() => resolveActiveTab(this.currentUrl()));

  constructor() {
    if (!this.platform.is('android')) {
      return;
    }

    const subscription = this.platform.backButton.subscribeWithPriority(1, async (processNextHandler) => {
      if (this.navigationHistory.canGoBack()) {
        processNextHandler();
        return;
      }

      if (!this.navigationHistory.isCurrentRouteRootScreen()) {
        await this.navigationHistory.back(this.resolveBackFallbackUrl());
        return;
      }

      const alert = await this.alertController.create({
        header: 'Exit Grocery Hub?',
        message: 'You are at the end of your navigation history.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Exit',
            role: 'destructive',
            handler: () => processNextHandler()
          }
        ]
      });
      await alert.present();
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private resolveBackFallbackUrl(): string {
    const activeTab = this.activeTab();

    if (activeTab) {
      return `/tabs/${activeTab}`;
    }

    const path = getPathname(this.router.url);

    if (path.startsWith('/tabs/profile')) {
      return '/tabs/settings';
    }

    // A meal goes back to its day; a day goes back to the week.
    const mealDay = /^\/tabs\/meal-planner\/([^/]+)\/meals\//.exec(path);
    if (mealDay) {
      return `/tabs/meal-planner/${mealDay[1]}`;
    }

    if (path.startsWith('/tabs/meal-planner/')) {
      return '/tabs/meal-planner';
    }

    return '/tabs/home';
  }
}
