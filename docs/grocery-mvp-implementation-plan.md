# Grocery Tracker MVP Implementation Plan

## 0) Summary
Build a frontend-only Android grocery tracking app with Angular, Ionic, and Capacitor. The MVP is optimized for single-user offline usage and stores all data locally on-device. Success for V1 means a user can manage pantry inventory, track quantity and low-stock status, maintain a shopping list, receive expiry reminders through local notifications, and use the app comfortably on a phone without any backend dependency.

## 1) Product Scope

### In Scope
- Pantry item CRUD
- Quantity tracking with unit support
- Low-stock detection based on user-defined threshold
- Expiry date tracking and reminders
- Shopping list CRUD
- Add shopping items manually or from pantry low-stock actions
- Local notifications for expiry reminders and low-stock digest
- Local-only persistence
- Mobile-first UI for Android phones

### Out of Scope
- User accounts or cloud sync
- Multi-device sync
- Barcode scanning
- OCR receipt import
- Shared household collaboration
- Analytics/dashboard history
- Push notifications
- Complex recipe planning

### Next Iterations
- Capacitor SQLite driver for stronger native persistence guarantees
- Pantry categories with icons and filters
- Barcode scanner
- Recurring purchase suggestions
- Backup/export and import
- Cloud sync and authentication

## 2) Recommended Technical Stack
- Angular standalone architecture
- Ionic UI components and Ionic Angular router integration
- Capacitor for Android packaging and native plugins
- `@ionic/storage-angular` as the persistence abstraction for V1
- Capacitor Local Notifications plugin
- Angular signals for local feature state
- RxJS only at storage/plugin boundaries
- Reactive forms for all create/edit flows

## 3) Architecture Principles
- Keep the app feature-based, not layer-based.
- Use standalone pages and lazy-loaded route boundaries.
- Put domain logic in services, never in UI components.
- Use signals for derived UI state like low-stock and expiring-soon lists.
- Hide persistence details behind repository-style services so V2 can replace local storage with SQLite or an API.
- Optimize for one-handed mobile usage: large tap targets, bottom-tab navigation, sticky primary actions, and short forms.

## 4) Proposed App Structure

```text
src/
  app/
    app.component.ts
    app.routes.ts
    core/
      constants/
        storage-keys.ts
        app-config.ts
      models/
        app-error.model.ts
        result.model.ts
      services/
        storage.service.ts
        notifications.service.ts
        app-init.service.ts
      utils/
        date.utils.ts
        quantity.utils.ts
        id.utils.ts
    shared/
      components/
        empty-state-card/
        stat-card/
        confirm-sheet/
        item-chip/
      pipes/
        quantity-label.pipe.ts
        expiry-status.pipe.ts
      ui/
        page-header/
        section-card/
    features/
      shell/
        pages/
          tabs-shell.page.ts
        routes.ts
      dashboard/
        pages/
          dashboard.page.ts
        components/
          overview-cards.component.ts
          expiring-soon-list.component.ts
          low-stock-list.component.ts
        routes.ts
      pantry/
        pages/
          pantry-list.page.ts
          pantry-detail.page.ts
          pantry-form.page.ts
        components/
          pantry-item-card.component.ts
          pantry-filters.component.ts
          quantity-stepper.component.ts
        models/
          pantry-item.model.ts
          pantry-filter.model.ts
        services/
          pantry-repository.service.ts
          pantry-state.service.ts
        routes.ts
      shopping-list/
        pages/
          shopping-list.page.ts
          shopping-item-form.page.ts
        components/
          shopping-item-row.component.ts
          shopping-list-summary.component.ts
        models/
          shopping-list-item.model.ts
        services/
          shopping-list-repository.service.ts
          shopping-list-state.service.ts
        routes.ts
      reminders/
        pages/
          reminders.page.ts
        models/
          reminder-settings.model.ts
        services/
          reminder.service.ts
        routes.ts
      settings/
        pages/
          settings.page.ts
        models/
          app-settings.model.ts
        services/
          settings.service.ts
        routes.ts
```

## 5) Route Plan

### Top-Level Navigation
- `/tabs/dashboard`
- `/tabs/pantry`
- `/tabs/shopping-list`
- `/tabs/reminders`
- `/tabs/settings`

### Feature Routes
- `/tabs/pantry/new`
- `/tabs/pantry/:itemId`
- `/tabs/pantry/:itemId/edit`
- `/tabs/shopping-list/new`

### Notes
- Use Ionic tabs for the main mobile shell.
- Keep forms as standalone routes first; if desired, present them inside `ion-modal` later without changing business logic.
- Dashboard is the landing screen because it surfaces the two time-sensitive actions: expiring items and low stock.

## 6) Screen Breakdown

### Dashboard
- Overview cards: total pantry items, low-stock count, expiring soon count, shopping list count
- Quick actions: add pantry item, add shopping item
- Sections for low-stock items and expiring soon items

### Pantry List
- Search by item name
- Filter by category and stock status
- Card/list view optimized for thumb scrolling
- Swipe or action sheet for edit, delete, add to shopping list

### Pantry Detail
- Full item details
- Quantity stepper
- Expiry status
- Button to add item to shopping list

### Pantry Form
- Name, category, unit, quantity, min quantity, expiry date, notes
- Clear validation and mobile numeric inputs

### Shopping List
- Group unchecked and checked items
- Manual add flow
- Convert low-stock pantry items into list entries
- Mark purchased, edit, or remove

### Reminders
- Expiry reminder settings
- Low-stock digest settings
- Preview of upcoming reminders

### Settings
- Notification toggle
- Reminder lead time
- Seed/reset sample data for development

## 7) Angular Standalone Component Strategy

### Smart Pages
- `TabsShellPage`: owns tab layout
- `DashboardPage`: wires dashboard signals into presentational sections
- `PantryListPage`: loads filters, search, and pantry list actions
- `PantryDetailPage`: orchestrates item detail actions
- `PantryFormPage`: owns reactive form and save/update flows
- `ShoppingListPage`: handles grouped shopping items and completion actions
- `ShoppingItemFormPage`: manages add/edit shopping item form
- `RemindersPage`: manages reminder preferences
- `SettingsPage`: manages app-level preferences

### Presentational Components
- `PantryItemCardComponent`
- `QuantityStepperComponent`
- `PantryFiltersComponent`
- `ShoppingItemRowComponent`
- `ShoppingListSummaryComponent`
- `OverviewCardsComponent`
- `ExpiringSoonListComponent`
- `LowStockListComponent`
- `EmptyStateCardComponent`
- `ConfirmSheetComponent`

### Component Rules
- All components standalone
- `ChangeDetectionStrategy.OnPush` everywhere
- Presentational components use inputs/outputs only
- Page components inject services and manage route/form orchestration

## 8) Core Data Models

```ts
export interface PantryItem {
  readonly id: string;
  readonly name: string;
  readonly category: PantryCategory;
  readonly unit: QuantityUnit;
  readonly quantity: number;
  readonly minQuantity: number;
  readonly expiryDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ShoppingListItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number | null;
  readonly unit: QuantityUnit | null;
  readonly linkedPantryItemId: string | null;
  readonly source: 'manual' | 'low-stock' | 'expiry';
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReminderSettings {
  readonly expiryRemindersEnabled: boolean;
  readonly expiryLeadDays: number;
  readonly lowStockDigestEnabled: boolean;
  readonly lowStockDigestHour: number;
}

export interface AppSettings {
  readonly notificationsEnabled: boolean;
  readonly defaultCategory: PantryCategory | null;
  readonly reminderSettings: ReminderSettings;
}

export type PantryCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'frozen'
  | 'grains'
  | 'snacks'
  | 'beverages'
  | 'other';

export type QuantityUnit =
  | 'count'
  | 'kg'
  | 'g'
  | 'l'
  | 'ml'
  | 'pack'
  | 'box';
```

## 9) Derived Domain Rules
- Low stock: `quantity <= minQuantity`
- Expiring soon: item has `expiryDate` and expiry is within configured lead days
- Expired: `expiryDate < today`
- Shopping list duplicate prevention: if a linked pantry item already has an incomplete shopping entry, update quantity instead of creating a duplicate
- Delete behavior: deleting a pantry item does not delete completed shopping history in V1; incomplete linked shopping entries can remain but lose the link

## 10) Storage Approach

### Recommendation
Use `@ionic/storage-angular` behind a single `StorageService` abstraction. For V1 this keeps persistence simple while still allowing a later switch to SQLite or backend sync.

### Storage Keys
- `grocery.pantryItems`
- `grocery.shoppingListItems`
- `grocery.appSettings`
- `grocery.lastNotificationSync`

### Persistence Pattern
- Each feature repository reads and writes a full collection array for simplicity.
- State services keep in-memory signals and call repository methods for persistence.
- On app start, `AppInitService` loads settings and collections, then triggers reminder rescheduling.

### Why This Works For MVP
- Data size is small enough that collection-based reads and writes are acceptable.
- The storage API is easy to mock and test.
- The repository boundary prevents coupling components to a specific persistence layer.

### Upgrade Path
- Replace repository internals with SQLite-backed queries
- Add sync adapter for a future backend
- Keep models and page components unchanged

## 11) Service Design

### Core Services
- `StorageService`
  - Initializes Ionic Storage
  - Exposes generic `get`, `set`, and `remove`

- `NotificationsService`
  - Wraps Capacitor Local Notifications
  - Requests permission
  - Schedules and cancels notifications

- `AppInitService`
  - Bootstraps storage
  - Loads settings
  - Triggers reminder sync on startup

### Pantry Feature Services
- `PantryRepositoryService`
  - `getAll()`
  - `saveAll(items)`
  - `create(itemDraft)`
  - `update(itemId, updates)`
  - `delete(itemId)`

- `PantryStateService`
  - Holds `items` signal
  - Exposes `lowStockItems`, `expiringSoonItems`, `expiredItems`, `categories`
  - Handles optimistic local state updates before persist confirmation

### Shopping List Feature Services
- `ShoppingListRepositoryService`
  - CRUD for shopping items

- `ShoppingListStateService`
  - Holds `items` signal
  - Exposes `activeItems`, `completedItems`, `itemCount`
  - Handles conversion from pantry low-stock item to shopping item

### Reminder Services
- `ReminderService`
  - Computes expiry notifications from pantry items and settings
  - Computes low-stock digest payload
  - Rebuilds notification schedule on startup and after pantry/settings changes

- `SettingsService`
  - Loads and saves `AppSettings`
  - Exposes settings as a signal

## 12) Notification Strategy

### Expiry Reminders
- Schedule one notification per pantry item with an expiry date
- Fire at a default morning hour on `expiryDate - expiryLeadDays`
- Cancel and reschedule when item expiry or reminder settings change

### Low-Stock Notifications
- Use one digest notification per day instead of one notification per item
- Build digest content from current low-stock items
- Schedule digest only if low-stock notifications are enabled and at least one item is low

### Trigger Points
- App launch
- Pantry item create/update/delete
- Reminder setting changes
- Notification permission changes

### Edge Cases
- If notification permission is denied, show inline settings guidance but keep reminder indicators in the UI
- If a scheduled fire time is already in the past, skip or move to next valid run

## 13) UX and Form Behavior

### Pantry Form Fields
- `name`: required, 2 to 50 characters
- `category`: required
- `unit`: required
- `quantity`: required, `>= 0`
- `minQuantity`: required, `>= 0`
- `expiryDate`: optional, cannot be wildly invalid or malformed
- `notes`: optional, max 200 characters

### Error States
- Empty pantry: show CTA to add first item
- Empty shopping list: show CTA to create list item
- Storage failure: toast plus retry action
- Notification permission denied: non-blocking callout in Reminders and Settings

### Interaction Policy
- Prefer inline optimistic updates for quantity stepper and check/uncheck actions
- Use action sheet or confirm sheet for destructive actions
- Use toasts for save success and recoverable errors

## 14) Recommended State Management
Use a lightweight service-store pattern with Angular signals.

### Why
- NgRx is unnecessary for a frontend-only MVP
- Signals keep derived state simple and readable
- Repository services already create a clean seam for future growth

### Pattern
- Repository services handle persistence
- State services expose writable/private signals and readonly computed signals
- Pages call state service methods and bind directly to signal outputs

## 15) MVP Build Order

### Milestone 1: Project Foundation
- Create Ionic Angular Capacitor app
- Enable Angular standalone routing
- Set up Android Capacitor target
- Install Ionic Storage and Local Notifications
- Create app shell, tabs, theme tokens, and shared UI primitives

### Milestone 2: Pantry Core
- Define pantry models
- Implement storage, repository, and pantry state services
- Build pantry list, detail, and create/edit flows
- Add validation and empty states

### Milestone 3: Shopping List
- Define shopping list models
- Implement shopping list repository and state services
- Build shopping list page and add/edit interactions
- Add "add to shopping list" from pantry and low-stock actions

### Milestone 4: Reminders and Notifications
- Implement settings and reminder models
- Integrate Capacitor Local Notifications
- Schedule expiry reminders and low-stock digest
- Add reminders and settings screens

### Milestone 5: Polish and Release Readiness
- Improve accessibility, keyboard handling, and focus states
- Add loading/error states and confirmations
- Test on Android emulator and physical device
- Create app icon, splash, and release checklist

## 16) Testing Plan

### Unit Tests
- Repository service CRUD behavior
- Pantry low-stock and expiry computations
- Shopping list grouping and duplicate prevention
- Reminder scheduling logic
- Form validation helpers

### Component Tests
- Pantry form validation and submit behavior
- Quantity stepper interactions
- Shopping list completion flow
- Dashboard conditional sections and empty states

### Device Validation
- Android emulator navigation and storage persistence
- Notification permission prompt flow
- Scheduled notification delivery behavior
- App relaunch persistence

## 17) Risks and Simplifications

### Main Risks
- Capacitor local notification behavior can vary across Android versions and power-saving modes
- IndexedDB-backed storage is acceptable for MVP but is weaker than SQLite for long-term native reliability
- Notification rescheduling logic can become brittle if not centralized in one service

### Simplifications Chosen
- Single-user local-only data model
- Full-collection persistence instead of normalized query storage
- One low-stock digest notification instead of many per-item alerts
- No background sync or background fetch requirements

### Assumptions
- V1 targets Android only
- All data is local and single-device
- Pantry inventory size remains small to moderate
- The PDF intent matches the feature set described in your prompt

## 18) Suggested Delivery Timeline
- Week 1: foundation, pantry CRUD, quantity tracking
- Week 2: shopping list, low-stock logic, expiry reminders
- Week 3: notification polish, settings, Android QA, release prep

## 19) Handoff Summary

### What To Build First
1. App shell and tabs
2. Storage abstraction
3. Pantry repository and state service
4. Pantry list and form pages
5. Shopping list flow
6. Reminder scheduling

### Keep Stable For V2
- Feature routes
- Domain models
- Repository interfaces
- Signal-based page bindings
