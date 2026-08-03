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
    path: ':itemId/edit',
    loadComponent: () => import('./pages/pantry-form.page').then((m) => m.PantryFormPage)
  }
];
