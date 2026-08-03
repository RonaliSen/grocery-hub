import { vi } from 'vitest';

vi.mock('@ionic/angular/standalone', async () => import('../../../../testing/ionic-standalone.stubs'));

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { BehaviorSubject, of } from 'rxjs';

import { DEFAULT_APP_SETTINGS } from '../../../core/constants/app-config';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { SettingsService } from '../../settings/services/settings.service';
import { PantryFormPage } from './pantry-form.page';
import { PantryDuplicateItemNameError, PantryStateService } from '../services/pantry-state.service';

describe('PantryFormPage', () => {
  const router = {
    navigateByUrl: vi.fn()
  };
  const navigationHistory = {
    back: vi.fn()
  };
  const settingsService = {
    settings: vi.fn(() => ({
      ...DEFAULT_APP_SETTINGS,
      defaultCategory: 'beverages',
      defaultLowStockThreshold: 4,
      defaultAutoAddToShoppingList: false
    }))
  };
  const pantryState = {
    loaded: vi.fn(() => true),
    items: vi.fn(() => []),
    getById: vi.fn(),
    existsByName: vi.fn<(name: string, excludeId?: string | null) => boolean>(() => false),
    save: vi.fn()
  };

  function configure(
    itemId: string | null = null,
    paramMap$ = of(convertToParamMap(itemId ? { itemId } : {}))
  ): Promise<void> {
    pantryState.getById.mockReset();
    pantryState.items.mockReset();
    pantryState.items.mockReturnValue([]);
    pantryState.existsByName.mockReset();
    pantryState.existsByName.mockReturnValue(false);
    pantryState.save.mockReset();
    router.navigateByUrl.mockReset();
    navigationHistory.back.mockReset();
    navigationHistory.back.mockResolvedValue(true);
    settingsService.settings.mockReset();
    settingsService.settings.mockReturnValue({
      ...DEFAULT_APP_SETTINGS,
      defaultCategory: 'beverages',
      defaultLowStockThreshold: 4,
      defaultAutoAddToShoppingList: false
    });

    return TestBed.configureTestingModule({
      imports: [PantryFormPage],
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        {
          provide: PantryStateService,
          useValue: pantryState
        },
        {
          provide: SettingsService,
          useValue: settingsService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(itemId ? { itemId } : {})
            },
            paramMap: paramMap$
          }
        },
        {
          provide: Router,
          useValue: router
        },
        {
          provide: NavigationHistoryService,
          useValue: navigationHistory
        }
      ]
    }).compileComponents();
  }

  it('uses create-mode defaults', async () => {
    await configure();

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: '',
      category: '',
      unit: 'count',
      quantity: 1,
      minQuantity: 4,
      autoAddToShoppingList: false,
      expiryDate: '',
      germanStore: false,
      indianStore: false,
      notes: ''
    });
  });

  it('offers biscuits, snacks, sauces, vegetables and fruits in the category dropdown options', async () => {
    await configure();

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    expect(component.availableCategories()).toContain('biscuits');
    expect(component.availableCategories()).toContain('snacks');
    expect(component.availableCategories()).toContain('sauces');
    expect(component.availableCategories()).toContain('vegetables');
    expect(component.availableCategories()).toContain('fruits');
    expect(component.categoryLabels.biscuits).toBe('Biscuits');
    expect(component.categoryLabels.sauces).toBe('Sauces');
    expect(component.categoryLabels.vegetables).toBe('Vegetables');
    expect(component.categoryLabels.fruits).toBe('Fruits');
  });

  it('patches existing values in edit mode', async () => {
    await configure('item-1');
    pantryState.getById.mockReturnValue({
      id: 'item-1',
      name: 'Greek Yogurt',
      category: 'dairy',
      unit: 'count',
      quantity: 2,
      minQuantity: 1,
      autoAddToShoppingList: true,
      expiryDate: '2026-03-20',
      germanStore: true,
      indianStore: false,
      notes: 'Top shelf',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: 'Greek Yogurt',
      category: 'dairy',
      unit: 'count',
      quantity: 2,
      minQuantity: 1,
      autoAddToShoppingList: true,
      expiryDate: '2026-03-20',
      germanStore: true,
      indianStore: false,
      notes: 'Top shelf'
    });
  });

  it('applies popular-pick category mapping while editing older items', async () => {
    await configure('item-1');
    pantryState.getById.mockReturnValue({
      id: 'item-1',
      name: 'Milk',
      category: 'produce',
      unit: 'count',
      quantity: 1,
      minQuantity: 1,
      autoAddToShoppingList: true,
      expiryDate: null,
      germanStore: false,
      indianStore: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    expect(component.form.controls.category.value).toBe('dairy');
  });

  it('blocks submit when the form is invalid', async () => {
    await configure();

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.patchValue({
      name: ''
    });

    await component.save();

    expect(pantryState.save).not.toHaveBeenCalled();
  });

  it('sends trimmed values, resets the form and returns through navigation history after save', async () => {
    await configure();
    pantryState.save.mockResolvedValue({
      id: 'saved-item'
    });

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.patchValue({
      name: '  Bananas  ',
      category: 'produce',
      unit: 'count',
      quantity: 6,
      minQuantity: 2,
      autoAddToShoppingList: false,
      expiryDate: '2026-03-18',
      germanStore: true,
      indianStore: false,
      notes: '  Countertop  '
    });

    await component.save();

    expect(pantryState.save).toHaveBeenCalledWith(
      {
        name: 'Bananas',
        category: 'produce',
        unit: 'count',
        quantity: 6,
        minQuantity: 2,
        avgDailyUsage: null,
        autoAddToShoppingList: false,
        expiryDate: '2026-03-18',
        germanStore: true,
        indianStore: false,
        notes: 'Countertop'
      },
      null
    );
    expect(component.form.getRawValue()).toEqual({
      name: '',
      category: '',
      unit: 'count',
      quantity: 1,
      minQuantity: 4,
      autoAddToShoppingList: false,
      expiryDate: '',
      germanStore: false,
      indianStore: false,
      notes: ''
    });
    expect(component.form.pristine).toBe(true);
    expect(navigationHistory.back).toHaveBeenCalledWith('/tabs/pantry');
  });

  it('shows duplicate validation error while creating when normalized name already exists', async () => {
    await configure();

    pantryState.existsByName.mockImplementation((name: string, excludeId?: string | null) => {
      if (excludeId) {
        return false;
      }

      return name.trim().toLowerCase() === 'milk';
    });

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.patchValue({
      name: '  MILK  '
    });
    component.form.controls.name.markAsTouched();
    fixture.detectChanges();

    expect(component.form.controls.name.errors).toEqual({ duplicate: true });
    expect(component.errorMessage('name')).toBe('Item already exists');
  });

  it('shows edit duplicate error and blocks navigation on save conflict', async () => {
    await configure('item-2');
    pantryState.getById.mockImplementation((itemId: string | null) =>
      itemId === 'item-2'
        ? {
            id: 'item-2',
            name: 'Bread',
            category: 'other',
            unit: 'count',
            quantity: 2,
            minQuantity: 1,
            autoAddToShoppingList: true,
            expiryDate: null,
            germanStore: false,
            indianStore: false,
            notes: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        : undefined
    );
    pantryState.existsByName.mockImplementation((name: string, excludeId?: string | null) => {
      const normalized = name.trim().toLowerCase();
      return normalized === 'milk' && excludeId !== 'item-1';
    });
    pantryState.save.mockRejectedValue(new PantryDuplicateItemNameError());

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.patchValue({
      name: ' Milk '
    });

    await component.save();

    expect(component.form.controls.name.errors?.duplicate).toBe(true);
    expect(component.errorMessage('name')).toBe('Item with this name already exists');
    expect(navigationHistory.back).not.toHaveBeenCalled();
  });

  it('resets the form to create defaults when returning from edit mode', async () => {
    const paramMap$ = new BehaviorSubject(convertToParamMap({ itemId: 'item-1' }));

    await configure('item-1', paramMap$);
    pantryState.getById.mockImplementation((itemId: string | null) =>
      itemId === 'item-1'
        ? {
            id: 'item-1',
            name: 'Greek Yogurt',
            category: 'dairy',
            unit: 'count',
            quantity: 2,
            minQuantity: 1,
            autoAddToShoppingList: true,
            expiryDate: '2026-03-20',
            germanStore: true,
            indianStore: false,
            notes: 'Top shelf',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        : undefined
    );

    const fixture = TestBed.createComponent(PantryFormPage);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.form.patchValue({
      name: 'Edited Yogurt',
      minQuantity: 7
    });
    component.form.markAsDirty();
    expect(component.form.dirty).toBe(true);

    paramMap$.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: '',
      category: '',
      unit: 'count',
      quantity: 1,
      minQuantity: 4,
      autoAddToShoppingList: false,
      expiryDate: '',
      germanStore: false,
      indianStore: false,
      notes: ''
    });
    expect(component.form.pristine).toBe(true);
  });
});
