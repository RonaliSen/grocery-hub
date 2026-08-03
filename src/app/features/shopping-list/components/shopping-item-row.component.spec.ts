// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { TestBed, getTestBed } from '@angular/core/testing';

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch {
  // Environment already initialized
}

import { PantryStateService } from '../../pantry/services/pantry-state.service';
import { ShoppingItemRowComponent } from './shopping-item-row.component';

const pantryStateStub = {
  getById: vi.fn(),
};

const shoppingItem = {
  id: 'shop-1',
  name: 'Tomatoes',
  quantity: 2,
  quantityOverridden: false,
  unit: 'count',
  linkedPantryItemId: null,
  source: 'manual' as const,
  germanStore: true,
  indianStore: false,
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ShoppingItemRowComponent', () => {
  beforeEach(async () => {
    pantryStateStub.getById.mockReset();

    await TestBed.configureTestingModule({
      imports: [ShoppingItemRowComponent],
      providers: [
        {
          provide: PantryStateService,
          useValue: pantryStateStub,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders quantity stepper and emits increment/decrement/remove/toggle events', () => {
    const fixture = TestBed.createComponent(ShoppingItemRowComponent);
    fixture.componentRef.setInput('item', shoppingItem);

    const incrementSpy = vi.fn();
    const decrementSpy = vi.fn();
    const removeSpy = vi.fn();
    const toggleSpy = vi.fn();

    fixture.componentInstance.increment.subscribe(incrementSpy);
    fixture.componentInstance.decrement.subscribe(decrementSpy);
    fixture.componentInstance.remove.subscribe(removeSpy);
    fixture.componentInstance.toggle.subscribe(toggleSpy);

    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0]?.click();
    buttons[1]?.click();
    buttons[2]?.click();
    buttons[3]?.click();

    expect(fixture.nativeElement.textContent).toContain('Tomatoes');
    expect(fixture.nativeElement.textContent).toContain('2');
    expect(toggleSpy).toHaveBeenCalledWith('shop-1');
    expect(decrementSpy).toHaveBeenCalledWith('shop-1');
    expect(incrementSpy).toHaveBeenCalledWith('shop-1');
    expect(removeSpy).toHaveBeenCalledWith('shop-1');
  });
});
