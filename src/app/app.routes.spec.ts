import { vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(import('@ionic/angular/standalone'), async () => import('../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';

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
          provide: PantryStateService,
          useValue: {
            totalCount: () => 0,
            lowStockItems: () => [],
            lowStockSignalItems: () => [],
            expiringSoonItems: () => []
          }
        },
        {
          provide: ShoppingListStateService,
          useValue: {
            totalCount: () => 0
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
