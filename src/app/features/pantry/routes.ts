import { Routes } from '@angular/router';

export const PANTRY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/pantry-list.page').then((m) => m.PantryListPage)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/pantry-form.page').then((m) => m.PantryFormPage)
  },
  {
    path: 'audit',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/pantry-audit-intro.page').then((m) => m.PantryAuditIntroPage)
      },
      {
        path: 'select',
        loadComponent: () =>
          import('./pages/pantry-audit-select.page').then((m) => m.PantryAuditSelectPage)
      },
      {
        path: 'count',
        loadComponent: () =>
          import('./pages/pantry-audit-count.page').then((m) => m.PantryAuditCountPage)
      },
      {
        path: 'review',
        loadComponent: () =>
          import('./pages/pantry-audit-review.page').then((m) => m.PantryAuditReviewPage)
      }
    ]
  },
  {
    path: ':itemId/edit',
    loadComponent: () => import('./pages/pantry-form.page').then((m) => m.PantryFormPage)
  }
];
