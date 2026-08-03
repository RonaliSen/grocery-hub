import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular/standalone';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { ShoppingListStateService } from '../../shopping-list/services/shopping-list-state.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryRepositoryService } from '../services/pantry-repository.service';
import { PantryStateService } from '../services/pantry-state.service';
import { PantryListPage } from './pantry-list.page';

function dateOnlyFromOffset(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

describe('PantryListPage', () => {
  const repository = {
    getAll: vi.fn(),
    saveAll: vi.fn()
  };

  beforeEach(async () => {
    repository.getAll.mockResolvedValue([]);
    repository.saveAll.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PantryListPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        PantryStateService,
        {
          provide: PantryRepositoryService,
          useValue: repository
        },
        {
          provide: SettingsService,
          useValue: {
            settings: () => DEFAULT_APP_SETTINGS
          }
        },
        {
          provide: ShoppingListStateService,
          useValue: {
            addFromPantryItem: vi.fn()
          }
        },
        {
          provide: AlertController,
          useValue: {
            create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) })
          }
        }
      ]
    }).compileComponents();
  });

  it('renders an empty state when there are no pantry items', async () => {
    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Your pantry is empty');
    expect(textContent).toContain('Add pantry item');
    // Note: 'View shopping list' removed in new design
  });

  it('renders pantry items and filters them by search query', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'milk';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Milk');
    expect(textContent).not.toContain('Pasta');
    // Note: 'Showing X of Y' stats removed in new design
  });

  it('filters by category using the pill bar', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.filter-pill')) as HTMLButtonElement[];
    const dairyButton = buttons.find((button) => button.textContent?.includes('Dairy'));

    dairyButton?.click();
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Milk');
    expect(textContent).not.toContain('Pasta');
  });

  it('clears search text from the clear icon button', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'milk';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const clearButton = fixture.nativeElement.querySelector('.search-clear') as HTMLButtonElement | null;
    expect(clearButton).not.toBeNull();

    clearButton?.click();
    fixture.detectChanges();

    expect(pantryState.searchQuery()).toBe('');
    expect((fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
  });

  it('resets to all items when pantry is opened without a filter query param', async () => {
    repository.getAll.mockResolvedValue([
      {
        id: 'milk',
        name: 'Milk',
        category: 'dairy',
        unit: 'count',
        quantity: 1,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: dateOnlyFromOffset(3),
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'pasta',
        name: 'Pasta',
        category: 'grains',
        unit: 'box',
        quantity: 4,
        minQuantity: 1,
        avgDailyUsage: null,
        autoAddToShoppingList: true,
        expiryDate: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const pantryState = TestBed.inject(PantryStateService);
    await pantryState.load();
    pantryState.setStockFilter('expiring');
    expect(pantryState.stockFilter()).toBe('expiring');

    const fixture = TestBed.createComponent(PantryListPage);
    fixture.detectChanges();

    expect(pantryState.stockFilter()).toBe('all');
    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Milk');
    expect(textContent).toContain('Pasta');
  });
});
