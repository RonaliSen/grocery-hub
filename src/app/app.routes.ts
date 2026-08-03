import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tabs/home'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./features/shell/routes').then((m) => m.SHELL_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'tabs/home'
  }
];
