import { Routes } from '@angular/router';

export const SHOPPING_LIST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/shopping-list.page').then((m) => m.ShoppingListPage)
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/shopping-list-checkout.page').then((m) => m.ShoppingListCheckoutPage)
  },
  {
    path: 'share',
    loadComponent: () => import('./pages/shopping-list-share.page').then((m) => m.ShoppingListSharePage)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/shopping-item-form.page').then((m) => m.ShoppingItemFormPage)
  },
  {
    path: ':itemId/edit',
    loadComponent: () => import('./pages/shopping-item-form.page').then((m) => m.ShoppingItemFormPage)
  }
];
