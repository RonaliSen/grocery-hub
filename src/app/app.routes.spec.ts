import { vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../testing/ionic-standalone.stubs'));
// @ts-ignore Spec-only lightweight module mock for the Platform DI token.
vi.mock(import('@ionic/angular'), () => ({
  Platform: class Platform {}
}) as any);

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Platform } from '@ionic/angular';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { StorageService } from './core/services/storage.service';
import { PantryStateService } from './features/pantry/services/pantry-state.service';
import { ShoppingListStateService } from './features/shopping-list/services/shopping-list-state.service';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter(routes),
        {
          provide: Platform,
          useValue: {
            backButton: { subscribeWithPriority: () => ({ unsubscribe: () => {} }) },
            is: () => false
          }
        },
        {
          provide: PantryStateService,
          useValue: {
            items: () => [],
            totalCount: () => 0,
            lowStockItems: () => [],
            lowStockSignalItems: () => [],
            expiringSoonItems: () => []
          }
        },
        {
          provide: ShoppingListStateService,
          useValue: {
            items: () => [],
            activeItems: () => [],
            totalCount: () => 0,
            incrementQuantity: async () => {},
            decrementQuantity: async () => {},
            save: async () => {}
          }
        },
        {
          provide: StorageService,
          useValue: {
            initialize: async () => {},
            get: async <T>(_key: string, fallback: T) => fallback,
            set: async () => {},
            clear: async () => {}
          }
        }
      ]
    }).compileComponents();
  });

  it('redirects the empty path to /tabs/home', async () => {
    await RouterTestingHarness.create('/');

    expect(TestBed.inject(Router).url).toBe('/tabs/home');
  });
});
