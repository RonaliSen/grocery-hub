import { Routes } from '@angular/router';

export const SHELL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/tabs-shell.page').then((m) => m.TabsShellPage),
    children: [
      {
        path: 'home',
        loadChildren: () => import('../home/routes').then((m) => m.HOME_ROUTES)
      },
      {
        path: 'pantry',
        loadChildren: () => import('../pantry/routes').then((m) => m.PANTRY_ROUTES)
      },
      {
        path: 'shopping-list',
        loadChildren: () => import('../shopping-list/routes').then((m) => m.SHOPPING_LIST_ROUTES)
      },
      {
        path: 'expenses',
        loadChildren: () => import('../expenses/routes').then((m) => m.EXPENSES_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/routes').then((m) => m.SETTINGS_ROUTES)
      },
      {
        path: 'profile',
        loadChildren: () => import('../profile/routes').then((m) => m.PROFILE_ROUTES)
      },
      {
        path: 'expiry-tracker',
        loadChildren: () => import('../expiry-tracker/routes').then((m) => m.EXPIRY_TRACKER_ROUTES)
      },
      {
        path: 'meal-planner',
        loadChildren: () => import('../meal-planner/routes').then((m) => m.MEAL_PLANNER_ROUTES)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      }
    ]
  }
];
