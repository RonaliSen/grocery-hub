import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage)
  },
  {
    path: 'reminders/completed',
    loadComponent: () =>
      import('../reminders/pages/completed-reminders.page').then((m) => m.CompletedRemindersPage)
  },
  {
    path: 'reminders',
    loadComponent: () => import('../reminders/pages/reminders.page').then((m) => m.RemindersPage)
  }
];
