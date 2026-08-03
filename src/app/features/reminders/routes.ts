import { Routes } from '@angular/router';

export const REMINDERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/tabs/settings'
  }
];
