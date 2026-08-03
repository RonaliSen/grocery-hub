import { Routes } from '@angular/router';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/expenses-dashboard.page').then((m) => m.ExpensesDashboardPage)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/add-expense.page').then((m) => m.AddExpensePage)
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/expenses-list.page').then((m) => m.ExpensesListPage)
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/expenses-breakdown.page').then((m) => m.ExpensesBreakdownPage)
  },
  {
    path: 'budget',
    loadComponent: () => import('./pages/budget-settings.page').then((m) => m.BudgetSettingsPage)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/edit-expense.page').then((m) => m.EditExpensePage)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/expense-detail.page').then((m) => m.ExpenseDetailPage)
  }
];
