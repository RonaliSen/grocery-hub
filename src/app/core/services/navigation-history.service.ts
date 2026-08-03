import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

type NavigationHistoryMode = 'push' | 'replace' | 'pop';

const DEFAULT_FALLBACK_URL = '/tabs/home';
const ROOT_SCREEN_PATHS = new Set([
  '/tabs/home',
  '/tabs/pantry',
  '/tabs/shopping-list',
  '/tabs/expenses',
  '/tabs/settings'
]);

function normalizeUrl(url: string): string {
  const [path, fragment = ''] = url.split('#', 2);
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return fragment ? `${normalizedPath}#${fragment}` : normalizedPath;
}

function getPathname(url: string): string {
  return normalizeUrl(url).split(/[?#]/, 1)[0] ?? url;
}

@Injectable({
  providedIn: 'root'
})
export class NavigationHistoryService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly historyState = signal<string[]>([]);
  private pendingMode: NavigationHistoryMode = 'push';

  readonly history = computed(() => this.historyState());
  readonly currentUrl = computed(() => {
    const history = this.historyState();
    return history[history.length - 1] ?? normalizeUrl(this.router.url);
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (event.navigationTrigger === 'popstate') {
          this.pendingMode = 'pop';
          return;
        }

        const navigation = this.router.getCurrentNavigation();
        this.pendingMode = navigation?.extras.replaceUrl ? 'replace' : 'push';
      });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.recordNavigation(event.urlAfterRedirects);
      });
  }

  canGoBack(): boolean {
    return this.historyState().length > 1;
  }

  isCurrentRouteRootScreen(): boolean {
    return ROOT_SCREEN_PATHS.has(getPathname(this.currentUrl()));
  }

  async back(fallbackUrl = DEFAULT_FALLBACK_URL): Promise<boolean> {
    if (this.canGoBack()) {
      this.location.back();
      return true;
    }

    return this.router.navigateByUrl(fallbackUrl);
  }

  private recordNavigation(rawUrl: string): void {
    const url = normalizeUrl(rawUrl);
    const currentHistory = this.historyState();

    if (currentHistory.length === 0) {
      this.historyState.set([url]);
      this.pendingMode = 'push';
      return;
    }

    if (this.pendingMode === 'replace') {
      const nextHistory = [...currentHistory];
      nextHistory[nextHistory.length - 1] = url;
      this.historyState.set(nextHistory);
      this.pendingMode = 'push';
      return;
    }

    if (this.pendingMode === 'pop') {
      const existingIndex = currentHistory.lastIndexOf(url);

      if (existingIndex >= 0) {
        this.historyState.set(currentHistory.slice(0, existingIndex + 1));
      } else {
        this.historyState.set([...currentHistory, url]);
      }

      this.pendingMode = 'push';
      return;
    }

    if (currentHistory[currentHistory.length - 1] !== url) {
      this.historyState.set([...currentHistory, url]);
    }

    this.pendingMode = 'push';
  }
}
