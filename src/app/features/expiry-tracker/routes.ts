import { Routes } from '@angular/router';

export const EXPIRY_TRACKER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/expiry-tracker.page').then((m) => m.ExpiryTrackerPage)
  }
];
