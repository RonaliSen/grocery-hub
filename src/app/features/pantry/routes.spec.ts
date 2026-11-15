import { describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vitest import-based module mocks are valid at runtime but wider than Angular's type pass.
vi.mock(
  import('@ionic/angular/standalone'),
  async () => import('../../../testing/ionic-standalone.stubs')
);

import { PANTRY_ROUTES } from './routes';
import { PantryAuditIntroPage } from './pages/pantry-audit-intro.page';
import { PantryAuditCountPage } from './pages/pantry-audit-count.page';
import { PantryAuditReviewPage } from './pages/pantry-audit-review.page';
import { PantryAuditSelectPage } from './pages/pantry-audit-select.page';

describe('PANTRY_ROUTES', () => {
  it('exposes list, new-item, audit, and edit-item routes', () => {
    expect(PANTRY_ROUTES.map((route) => route.path)).toEqual(['', 'new', 'audit', ':itemId/edit']);
  });

  it('lazy-loads the inventory audit intro, item selection, count and review pages', async () => {
    const auditChildren = PANTRY_ROUTES.find((route) => route.path === 'audit')?.children ?? [];

    expect(auditChildren.map((route) => route.path)).toEqual(['', 'select', 'count', 'review']);
    await expect(auditChildren[0].loadComponent?.()).resolves.toBe(PantryAuditIntroPage);
    await expect(auditChildren[1].loadComponent?.()).resolves.toBe(PantryAuditSelectPage);
    await expect(auditChildren[2].loadComponent?.()).resolves.toBe(PantryAuditCountPage);
    await expect(auditChildren[3].loadComponent?.()).resolves.toBe(PantryAuditReviewPage);
  });
});
