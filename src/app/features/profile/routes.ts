import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/profile-details.page').then((m) => m.ProfileDetailsPage)
  }
];
