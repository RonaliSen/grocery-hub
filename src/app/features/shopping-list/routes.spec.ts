import { describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../testing/ionic-standalone.stubs')
);

import { SHOPPING_LIST_ROUTES } from './routes';

describe('SHOPPING_LIST_ROUTES', () => {
  it('exposes list, checkout, share, new-item, and edit-item routes', () => {
    expect(SHOPPING_LIST_ROUTES.map((route) => route.path)).toEqual([
      '',
      'checkout',
      'share',
      'new',
      ':itemId/edit'
    ]);
  });
});
