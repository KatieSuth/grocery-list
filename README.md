# Grocery List

An Expo app for iOS and Android that keeps your grocery items organized by store and by the order you walk through each store's departments.

Built so far:
- the first-run **setup flow**: add stores and departments, then the items you usually buy and where to find them;
- the **main app**, with four tabs: Items (the master list and home screen, with checkboxes, free-text quantities, optional tags, search, filters, sorting and "last bought"), Trip (the shopping trip: pick a store, check items into the cart in department order, finish to log them as bought; a history icon opens past trips, searchable by item or brand and filterable by dates, store and tag), Stores (store configuration; long-press a store to edit, copy or delete it, and a copy can also list the source store's items), and Settings (light/dark mode, the Items tab's default sort, Import from CSV, Delete all data).

See the [functional specification](docs/functional-spec.md) for screen-by-screen behavior.

**Stack:** Expo SDK 58 · React Native 0.88 · React 19.3 (React Compiler on) · Expo Router · RxDB 17 · TypeScript · Jest + React Native Testing Library · pnpm

---

## Getting started

### Prerequisites
- Node.js 20 or newer
- pnpm (`corepack enable` or `npm i -g pnpm`)
- The **Expo Go** app on an Android phone or iPhone. No custom build is needed: every native module used here ships in Expo Go. This is how the app is mainly tested.
- Optionally, a desktop browser, for quick checks and the Playwright tests. Web isn't a release target; it was used for early testing.

### Run on a phone with Expo Go

```bash
pnpm install
npx expo start
```

Scan the QR code: on Android from inside Expo Go, on iPhone with the Camera app. The phone must be able to reach this computer over the network (from WSL2, see below).

While it runs: press `r` to reload. Saved code changes appear live.

**To see the first-run screens again,** use **Settings → Delete all data** in the app. This erases your stores, items and trips.

#### Running from WSL2

WSL2's default NAT networking gives the dev server a `172.x` address (`hostname -I`) that phones can't reach, so the QR code from a plain `npx expo start` just spins in Expo Go. Use one of these:

- **Tunnel:** `npx expo start --tunnel`. This relays through ngrok (`@expo/ngrok` is a dev dependency), so the dev server is reachable at a public URL while it runs. The QR URL should end in `.exp.direct`. "Failed to download remote update" in Expo Go means the phone couldn't fetch the manifest or bundle through the tunnel; restart the tunnel, or switch to mirrored networking.
- **Mirrored networking (more reliable, nothing public; Windows 11 22H2+):**
  1. Add `[wsl2]` / `networkingMode=mirrored` to `C:\Users\<you>\.wslconfig`.
  2. Run `wsl --shutdown` in PowerShell, then reopen the WSL terminal.
  3. Run plain `npx expo start` with the phone on the same Wi-Fi.
  4. If the phone still can't connect, allow port 8081 in an administrator PowerShell: `New-NetFirewallRule -DisplayName "Expo Metro" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow`.

### Run in a browser (quick checks)

```bash
npx expo start --web
```

Open **http://localhost:8081** in any browser. From WSL2, a browser on Windows works too, because WSL forwards `localhost`. Use the browser's device toolbar (F12 → toggle device, e.g. Pixel 7) for a phone-sized view, and its DevTools for console errors.

- Data lives in the browser's `localStorage`.
- **To see the first-run screens again,** clear site data (DevTools → Application → Storage → Clear site data), open a private window, or use Settings → Delete all data.
- On web, confirmations use the browser's own OK/Cancel dialog, and the tab bar is drawn by the app (see [Main app tabs](#main-app-tabs)).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npx expo start` | Start the dev server. |
| `npx expo start --web` | Start the dev server and serve the app at http://localhost:8081. |
| `pnpm test` | Run all Jest tests as iOS, Android, and web, with coverage. **Fails below 100%.** |
| `pnpm test:e2e:web` | Run the Playwright tests of the web app in headless Chromium. Starts the web dev server itself. |
| `pnpm test:watch` | Watch mode, no coverage. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | `expo lint` (ESLint, `eslint-config-expo`). |
| `npx expo-doctor` | Check dependency and config health. |
| `npx expo install <pkg>` | **Always** use this to add packages; it picks SDK-compatible versions. |

Before calling a change done, run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e:web`.

First time only, for the browser tests: `npx playwright install chromium`.

---

## Project structure

```
src/
  app/                    Expo Router routes ONLY (every file is a screen)
    _layout.tsx           Root: DatabaseProvider, AppearanceProvider, setup-vs-main gate
    setup/                First-run onboarding (Stack)
      index.tsx           Stores list
      store-form.tsx      → StoreFormScreen (back to /setup)
      items.tsx           Items list
      item-form.tsx       → ItemFormScreen (back to /setup/items)
    item-form.tsx         "/item-form"   → ItemFormScreen (back to /); covers the tabs
    store-form.tsx        "/store-form"  → StoreFormScreen (back to /stores); covers the tabs
    (tabs)/               Main app (NativeTabs); each tab has its own Stack
      (items)/index.tsx   "/"        Master list (the home tab): search, filters, checkbox + quantity per item
      trip/index.tsx      "/trip"    Shopping trip: store dropdown, cart, Finish; history icon
      trip/history/index.tsx "/trip/history"  Trip log: search, date range + store filters
      trip/history/[id].tsx  "/trip/history/:id"  One past trip's items, by name or department
      stores/index.tsx    "/stores"  Store configuration; long-press menu: Edit, Copy store, Delete store
      settings/index.tsx  "/settings"  Appearance, items' default sort, Import from CSV, Delete all data
  screens/                Screens used by more than one route
    store-form-screen.tsx Add / edit (?id=) / copy (?copyFrom=) a store, takes backTo
    item-form-screen.tsx  Add / edit item (?id=), takes backTo
  domain/                 Pure logic: no React, no database
    types.ts              Store, Department, Item, ItemLocation, ListEntry, TripRecord
    departments.ts        Add/remove/move/copy, suggestions from other stores
    tags.ts               Item tags: rules, add/remove, suggestions from other items, CSV cell splitting, display text
    store-draft.ts        Store form state + validation (incl. same name and location), changes, departments to reassign before removing, copying a store (copyStoreDraft, copiedLocations)
    item-draft.ts         Item form state + validation, changes, duplicate items, location pruning
    store-sort.ts         Store order everywhere: A–Z by name, then location
    describe.ts           "Store · Dept" display text, and its spoken form ("Dept at Store"); storeLabel ("Kroger, Main St")
    quantity.ts           Free-text quantity cleanup
    item-filter.ts        Master-list search + checked/store/department/brand/tag filters
    item-sort.ts          Master-list sort: by name, department or last bought; either direction
    trip.ts               Trip list: checked items at a store, by department in walking order
    trip-history.ts       Trip log: date ranges, store and tag options, search, item sort, date text
    last-bought.ts        "Last bought yesterday" text
    appearance.ts         System / Light / Dark choice and labels
    csv-import.ts         CSV import: parse + validate the file (papaparse), plan the changes, messages
    names.ts              The name rules (length, forbidden characters) shared by the forms and the import
  data/                   Repositories: the only code that touches collections
    stores-repo.ts        observe (A–Z) / save (+ reassign items, prune, roll back) / copy / delete stores, add a department from the item form
    items-repo.ts         observe / save / delete items
    list-repo.ts          check / uncheck items, set quantity, cart marks
    settings-repo.ts      setupComplete flag, trip store + reverse order, appearance, items' default sort
    trips-repo.ts         finishTrip(): log, set last bought, uncheck; observeTrips() newest first
    erase-repo.ts         deleteAllData(): delete and purge everything, back to setup
    import-repo.ts        applyImportPlan(): write a checked CSV import (adds, and fills in missing store locations)
  db/
    schema.ts             RxDB JSON schemas
    database.ts           createAppDatabase(), getAppDatabase() singleton
    storage.native.ts     iOS/Android storage (SQLite-backed localStorage)
    storage.ts            Web storage (browser localStorage)
    hash.ts               SHA-256 via expo-crypto
    change-events.ts      Clears RxDB's leftover change-event keys after Delete all data
    database-provider.tsx <DatabaseProvider>, useDatabase()
  hooks/
    use-data.ts           useStores(), useItems(), useListEntries(), useSetupComplete(), useTripSettings(), useColorSchemeChoice(), useItemSortChoice(), useTrips()
    use-delete-store.ts   Delete a store after asking (store form and the Stores tab's menu)
    use-focus-after-remove.ts  Keeps the screen reader's place when a tag or department is removed with ✕
    use-unsaved-changes-warning.ts  Asks before a form with changes is closed (usePreventRemove)
    use-delayed-quantity-save.ts    Saves quantities once typing pauses (and on close / backgrounding)
    use-announcement.ts   Reads a message aloud on iOS (Android uses live regions)
    use-color-scheme.ts   Device scheme unless overridden in Settings (.web.ts: also SSR-safe)
    color-scheme-choice.ts  Context holding the Settings choice
    use-theme.ts          Colors for the current scheme
    use-observable.ts     Subscribe a component to an RxJS observable
  utils/                  Small helpers; platform splits as .web.ts
    pick-csv-file.ts      Pick + read one CSV (expo-document-picker, expo-file-system; .web.ts: browser File)
    notify.ts             Message with OK (Alert; .web.ts: window.alert)
    confirm.ts            Cancel / confirm question (Alert; .web.ts: window.confirm)
    run-write.ts          runWrite(): a database write that tells the user if it fails
    accessibility-focus.ts  Move the screen reader to a view (.web.ts: DOM focus)
    menu-position.ts      Where a dropdown menu goes: under its row, or above it
  components/             Shared UI (Button, TextField, Screen, Card, SwitchRow, StatusText, StoreActionsMenu, BusyOverlay, TagEditor, ReassignDepartments, editors…)
  constants/theme.ts      Colors (light/dark, with contrast checked by a test), spacing, chip tap area
  test-utils/             Test helpers (not shipped)
  __tests__/              All tests, mirroring src/
docs/
  functional-spec.md      What the app does, screen by screen
```

`src/app/` must contain only routes and layouts, because Expo Router treats every file there as a screen. This is also why tests live in `src/__tests__/`.

---

## Architecture

### Layers

```
screens (src/app)  ──uses──▶  hooks (useStores…)  ──▶  repositories (src/data)  ──▶  RxDB
       │                                                     │
       └────────── domain (pure validation / transforms) ◀──┘
```

- **Domain** holds the rules: validation, reordering, location pruning. It's plain TypeScript, so it's trivial to test and reuse in the main app.
- **Repositories** are the only place that reads or writes RxDB. They normalize input (trim, collapse spaces, drop blank optional fields) and keep items consistent when stores change.
- **Hooks** expose live queries. Screens re-render automatically when data changes, so after Save, a screen just navigates back and the list is already up to date.
- **Screens** hold form state as a *draft* (`StoreDraft`, `ItemDraft`). They validate with domain functions and save through repositories.

### Navigation gate

`src/app/_layout.tsx` reads the persisted `setupComplete` flag and uses `Stack.Protected`:
- `setup/*` is available only while `setupComplete` is false.
- `(tabs)` (the main app), `item-form` and `store-form` are available only while it's true.

The main app's forms live in the root Stack, not inside a tab, so they cover the tab bar. Native tabs can't block a tab press, so this is what keeps a form from being left open (with stale data) while another tab changes things. Leaving a form with unsaved changes asks first (`useUnsavedChangesWarning`, built on `usePreventRemove`).

Flipping the flag (Finish or Skip for now) switches flows and drops the old flow's history.

### Drag-to-reorder

Departments are reordered with [`react-native-sortables`](https://github.com/MatiPl01/react-native-sortables): `Sortable.Grid` with one column, plus a `Sortable.Handle` on each row (`customHandle`). It builds on Reanimated and Gesture Handler, both included in Expo Go. Requirements:
- The root layout wraps the app in `GestureHandlerRootView`.
- The store form's `Screen` passes a Reanimated scroll ref as `scrollableRef`, so dragging near the edge auto-scrolls.

`onDragEnd` returns the reordered list, which goes into the form draft.

### Main app tabs

`(tabs)/_layout.tsx` renders `components/app-tabs`, which has a different file per platform:

- **iOS/Android** (`app-tabs.tsx`): `NativeTabs` from `expo-router/native-tabs`, so each platform's own tab bar is used. Icons are SF Symbols on iOS and Material Symbols on Android, set with the `sf` and `md` props; both ship in Expo Go.
- Four tabs: Items (the home screen, `/`), Trip, Stores, Settings (gear: `gearshape` / `settings`).
- **Web** (`app-tabs.web.tsx`): `NativeTabs` draws its bar at the top of the page, over the screen header. Web instead gets a bottom tab bar built from expo-router's headless `Tabs` (`expo-router/ui`), with the same Material icons drawn by `SymbolView`.

Each tab is a folder with its own `Stack`. The main app's add/edit forms (`/item-form`, `/store-form`) are in the root Stack instead, so they cover the tab bar (see [Navigation gate](#navigation-gate)). The forms themselves live in `src/screens/` and are reused by the setup and main-app routes. A `backTo` prop says where Save, Cancel, and Delete return to. The splash screen stays up until the flag has loaded, so users never see the wrong flow flash.

### Light and dark mode

The Settings choice (`system`, `light` or `dark`) is saved in the `settings` document. `components/appearance-provider.tsx` sits inside `DatabaseProvider` in the root layout:
- It puts the choice in `ColorSchemeChoiceContext`. `hooks/use-color-scheme` returns the choice, or the device's scheme for `system`, so `useTheme()` and every themed component follow it. It also sets the navigation theme for headers.
- It calls `utils/apply-color-scheme` for UI the app doesn't draw. On iOS and Android that's `Appearance.setColorScheme()` (`'unspecified'` for system), which covers the native tab bar, alerts and keyboard. On web, React Native Web can't override the scheme, so it sets CSS `color-scheme` on `<html>` for scrollbars and form controls.
- It renders nothing until the choice has loaded, while the splash screen is still up, so the wrong colors never flash.

Screens outside it (the startup error) follow the device.

### Data model

Five RxDB collections:

| Collection | Version | Document | Notes |
| --- | --- | --- | --- |
| `stores` | 0 | `{ id, name, location?, departments: [{ id, name }], createdAt }` | Departments are embedded and ordered. Indexed on `createdAt`. |
| `items` | 2 | `{ id, name, brand?, locations: [{ storeId, departmentId }], tags?, createdAt, lastBoughtAt? }` | Locations reference store and department ids. `tags` (v2) are the user's labels, in the order added. `lastBoughtAt` is set when a trip that included the item is finished, so the master list never reads the trip log. |
| `listEntries` | 1 | `{ itemId, quantity?, checkedAt, inCartAt? }` | One per **checked** item; primary key is the item id. Unchecking deletes it, so a quantity never outlives its check. `inCartAt` marks it as checked off on the current trip. Deleting an item deletes its entry. |
| `settings` | 3 | `{ id: 'app', setupComplete, tripStoreId?, tripReversed?, colorScheme?, itemSort?, itemSortDirection? }` | Single document. Only change it through `settings-repo.ts`, which patches it. An `upsert` would wipe the other fields. |
| `trips` | 3 | `{ id, storeId, storeName, storeLocation?, finishedAt, items: [{ itemId, name, brand?, quantity?, department, tags? }], pending? }` | The trip log: one document per finished trip. Names, the store's location (v2) and items' tags (v3) are copied so the record survives renames and deletions. `pending` is set only while a trip is being finished. Indexed on `finishedAt`. |

IDs come from RxDB's `randomToken(16)`. Timestamps are epoch milliseconds.

Checked state is a separate collection, not a field on `items`. Checks change constantly and items rarely do. The cart is a field on the entry, so unchecking an item on the master list takes it out of the cart too, and nothing can be left behind.

**Finishing a trip** (`finishTrip` in `trips-repo.ts`) is several writes, not a transaction, so it's built to be retried:
1. Insert the log record with `pending: true`.
2. Set `lastBoughtAt` on its items (skipping deleted ones).
3. Bulk-remove the entries still in the cart. `bulkRemove` reports failures in its result instead of throwing, so the result is checked and an error is thrown.
4. Clear `pending`.

Every step can be repeated safely. If any step fails, the user sees an error. The next `finishTrip` first completes every pending record, then logs the current cart as usual, so a retry never logs twice or loses items. While it runs, the Trip tab locks its store picker, so switching stores can't clear the cart halfway through. An item that was unchecked and checked again in between keeps its new check, because only entries still in the cart are removed.

**Delete all data** (`deleteAllData` in `erase-repo.ts`) bulk-removes every trip, entry, item and store, checking each result. Only then does it reset `settings` to `{ setupComplete: false }`, keeping `colorScheme`, `itemSort` and `itemSortDirection`. That sends the app back to setup only once everything is gone, so a failed attempt can simply be retried. RxDB keeps deleted documents as tombstones. The `RxDBCleanupPlugin` purges them a month after deletion, and `deleteAllData` purges them at once with `cleanup(0)`. The LocalStorage storage also keeps each collection's last change event, including the old document, for other tabs until the database closes, so `forgetChangeEvents` removes those keys too.

**Migrations:** version 1 of `items`, `listEntries`, `settings` and `trips` only added optional fields, so each uses the identity strategy `addedOptionalFields` from `schema.ts`. Settings versions 2 and 3 added `colorScheme`, then `itemSort` and `itemSortDirection`, the same way (`settingsMigrations`). The `RxDBMigrationSchemaPlugin` is always registered, and `__tests__/db/database-test.ts` opens real version-0 databases to check they migrate.

> **Adding a collection** needs no migration: existing databases simply gain it. A test in `__tests__/db/database-test.ts` covers this.
>
> **Changing a schema:** bump that schema's `version` and add a `migrationStrategies` entry for the new version in `database.ts`. Otherwise RxDB will refuse to open existing users' databases. Add a test that opens a database with old-format documents and migrates them.

### Persistence

RxDB's SQLite and Expo Filesystem storages are **paid (premium) plugins**, so the app uses the free **LocalStorage RxStorage**:

- **iOS/Android** (`storage.native.ts`):
  - `expo-sqlite/localStorage/install` provides a synchronous, SQLite-backed `globalThis.localStorage`, which RxDB writes to.
  - Two React Native workarounds are needed:
    - RxDB calls `window.addEventListener('storage')`, which React Native lacks, so a no-op is installed.
    - Hermes has no `crypto.subtle`, so hashing uses `expo-crypto`.
- **Web** (`storage.ts`): the browser's own `localStorage`, and the browser's `crypto.subtle` for hashing. That only exists on secure origins, so open the app via `localhost`, not a LAN IP over plain `http`.
- **Tests:** in-memory storage (`rxdb/plugins/storage-memory`), one fresh database per test.

This suits a personal grocery list's data volume. To move to a faster storage later (e.g. RxDB Premium SQLite), change only `getStorageConfig()`; schemas, repositories, and screens are untouched.

Development builds also enable RxDB dev-mode and wrap storage in **z-schema validation**, which rejects documents that don't match the schema. Production builds skip both for speed. z-schema is used instead of ajv because ajv relies on `eval`.

### CSV import

Settings → Import from CSV reads a "Store, Item name, Department, Brand, Location, Tags" file (Brand, the store's Location and Tags optional; several tags separated by ";", only ever added to items). The file is untrusted input, so:

- **Picking** uses `expo-document-picker` (the system picker; no storage permission). On **Android** the picker returns a one-time `content://` link that `expo-file-system` reads directly, with nothing copied. The picker's cache copy can't be used there, because Expo Go's file sandbox doesn't allow reading the cache folder it lands in, so the file looks missing. On **iOS** the copy is needed to read the file, and it's deleted afterwards, but only if it's in the app's cache. The size is checked before reading: an empty or unknown size is refused, and so is anything over 1 MB. On web, the browser's `File` is read instead.
- **Parsing** uses papaparse on the string only: `header: false` (arrays, so file contents never become object keys), `dynamicTyping: false`, a fixed `,` delimiter, and no workers or downloads. Quote errors reject the file.
- **Validation** (`domain/csv-import.ts`) checks every row before anything is written. It enforces the row, department and store limits, and checks every value with the same name rules as the forms (`domain/names.ts`: length, and no control, zero-width or bidi characters). Lookups use `Map`s, and ids always come from `createId()`.
- **Matching stores** is by name and location. A row without a location matches the only store with that name (several is an error); a row with a location for a same-named store that has none gives it that location.
- **Writing** (`data/import-repo.ts`) creates stores first, then appends departments, then fills in missing store locations, then creates items, then appends item locations. It only ever adds (a store's location is set only if it still has none), so if a later step fails, nothing is left pointing at a missing department.

The rules users see are in [functional spec §5](docs/functional-spec.md#5-data-rules).

### Future sync

RxDB has built-in replication (HTTP, GraphQL, CouchDB, Firestore, Supabase, …). Adding a backend should mean adding a replication plugin in `database.ts`, not restructuring the data layer. All documents already have stable string ids.

---

## Testing

```bash
pnpm test          # everything: iOS + Android (+ web-only tests), coverage enforced at 100%
npx jest src/__tests__/domain --coverage=false   # a subset
```

The Jest config (`package.json` → `jest`, Jest 30) has three projects:

| Project | Runs | Preset |
| --- | --- | --- |
| `ios` | every `__tests__/**/*-test.ts(x)` | `jest-expo/ios` |
| `android` | the same files again | `jest-expo/android` |
| `web` | only `*.web-test.ts(x)` files, for web-only code | `jest-expo/web` (jsdom; `jest.setup.web.ts` adds `TextEncoder` and `crypto.subtle`) |

Web screens can't be rendered by React Native Testing Library: it only accepts React Native's own `Text`, and on web text renders as `<div>`/`<h1>`. Web UI is therefore covered by **Playwright** (`e2e/`, `pnpm test:e2e:web`), which drives the real app in headless Chromium at a phone-sized viewport. It fails on any console error. `app-tabs.web.tsx` is excluded from Jest coverage for this reason.

### Kinds of tests

| Folder | What it covers |
| --- | --- |
| `__tests__/domain`, `utils` | Pure functions: validation, ordering, text cleanup. |
| `__tests__/data` | Repositories against a real in-memory RxDB. |
| `__tests__/db` | Database creation, schema validation, production mode, storage setup, hashing, provider. |
| `__tests__/hooks`, `components` | Hooks and small UI helpers. |
| `__tests__/app` | **Full app** tests: the real router and screens, driven like a user (press buttons, type text) against an in-memory database. |
| `e2e/` (Playwright) | The web build in a real browser: setup, drag-to-reorder, tabs, search and filters, checking and quantities surviving a reload, a shopping trip, CSV import, confirmations. |

### Writing a full-app test

```tsx
import { cleanup, screen } from 'expo-router/testing-library';
import { press, renderApp, type } from '@/test-utils/app';
import { closeTestDatabases } from '@/test-utils/db';

jest.mock('@/db/database', () => ({
  ...jest.requireActual('@/db/database'),
  getAppDatabase: jest.fn(),
}));

afterEach(async () => {
  await cleanup();
  jest.useRealTimers(); // renderRouter turns on fake timers; RxDB needs real ones to close
  await closeTestDatabases();
});

test('adds a store', async () => {
  const db = await renderApp(); // or renderApp({ seed: async (db) => {...}, initialUrl: '/setup/items' })
  await press('Add a store');
  await type('Store name', 'Corner Market');
  await press('Save');
  expect(await screen.findByText('Corner Market')).toBeOnTheScreen();
});
```

### Gotchas

- **Everything is async.** In RNTL 14, `render`, `fireEvent.*`, and `renderHook` return promises; always `await` them.
- **Query by role and label,** e.g. `getByRole('button', { name: 'Save' })`. This also checks accessibility.
- **Use `aria-checked` / `aria-selected` / `aria-disabled`, not `accessibilityState`.** React Native Web ignores `accessibilityState`, so browsers and screen readers on web never see the state. The `aria-*` props work on all three platforms.
- **Don't await database queries inside `waitFor`.** It causes overlapping `act()` calls and breaks later tests. Assert on the screen instead, and query the DB afterwards.
- **The clock is frozen under `renderRouter`.** Documents created in the same test get the same `createdAt`. Call `jest.setSystemTime(Date.now() + 1000)` between creates if order matters.
- **Native UI doesn't render in Jest.** Stack headers and the tab bar are invisible to tests, so header titles and tab presses can't be asserted on directly.
  - Switch tabs with `await act(() => router.navigate('/trip'))`. Don't use `testRouter.navigate`: tab switches add an internal query param that breaks its pathname assertion.
  - `tabs-layout-test.tsx` mocks `NativeTabs` to check tab order, labels, and icons.
- **Reanimated and drag-to-reorder have Jest stand-ins** (`jest.setup.ts`):
  - Reanimated and Worklets use their official mocks. Reanimated 4.7's mock also needs a custom resolver, `jest.resolver.js`. Reanimated ships one, but it doesn't work with pnpm; see the comment at the top of the file.
  - `react-native-sortables` uses `src/test-utils/sortables-mock.tsx`, which renders rows normally.
  - `react-native-keyboard-controller` (which keeps the focused field above the keyboard in `Screen`) uses its official mock.
  - In tests, reorder departments with `moveDepartment(name, 'up' | 'down')` (the screen-reader actions) or `dragDepartment(from, to)` (simulates a drop).
  - Real dragging is covered by the Playwright tests.
- **Fire-and-forget writes** (checkbox, quantity): assert on the DB with `eventually(...)` from `test-utils/app`. It retries while advancing the fake timers, which also lets the delayed quantity save run (`QUANTITY_SAVE_DELAY_MS`).
- **Rows say everything they show,** so their spoken labels are long ("Soup, Acme. Deli at Corner Market. Last bought today."). Find them by the start: `press(/^Soup, Acme\./)`.
- **Alerts:** `answerAlertWith('Leave')` from `test-utils/app` makes `Alert.alert` press that button.
- **On/off rows** (`SwitchRow`) are one `switch` element: `getByRole('switch', { name: 'Needed' })`, then `toBeChecked()` and `fireEvent.press`. The inner native switch is hidden from accessibility; find it with `getByTestId('switch-row-toggle', { includeHiddenElements: true })`.
- **Test files go in `__tests__/`** and are named `*-test.ts(x)`. Web-only tests are named `*.web-test.ts(x)`.

---

## Expo SDK version

The project is on **SDK 58**. It was on SDK 57 from 2026-11-05 to 2026-11-07, while the store versions of Expo Go only supported 57. The SDK 57 workarounds were removed when it moved back.

When upgrading the SDK, also check the Reanimated rules copied into `jest.resolver.js` (`REANIMATED_WEB_ONLY`) against `react-native-reanimated/jest/resolver.js`.

## Conventions

- **Navigation:** import `router`, `Link`, and `useLocalSearchParams` from `expo-router`. Use `goBack(fallback)` from `utils/navigation` so screens opened from a deep link still have somewhere to go.
- **No `ios/` or `android/` folders.** They're generated by Expo (Continuous Native Generation). Configure native behavior in `app.json` and config plugins.
- **New native libraries** may not be in Expo Go. Adding one means using a development build (`npx expo run:ios|android` or `eas build --profile development`).
- **Fire-and-forget writes** from taps go through `runWrite(write, message)` from `utils/run-write`, so a failure is shown instead of silently ignored.
- **Forms** use `useUnsavedChangesWarning(changed, 'item')` and close with the `leave` function it returns after saving or deleting, so they don't ask.
- **Messages** that appear after something happens use `StatusText` (notes) or `ErrorText` (errors), which are read aloud on every platform.
- **Names** (stores, items, departments, brands, locations) follow `domain/names.ts`: `checkName()` and `maxLength={MAX_NAME_LENGTH}` on the field.
- **Store order** comes from `observeStores` (A–Z by name, then location). Don't re-sort stores elsewhere.
- **pnpm build scripts:** `pnpm-workspace.yaml` explicitly denies `@parcel/watcher`'s install script. It's an optional file watcher, and pnpm 12 otherwise fails the install.

---

## Status and known limitations

- **Tested mainly on an Android phone in Expo Go.** If the dev server runs in WSL2, the phone can't reach it without a tunnel or mirrored networking (see [Running from WSL2](#running-from-wsl2)).
- **Not yet run on an iPhone.** The iOS bundle builds and every Jest test runs as iOS. Untested on a device: drag-to-reorder departments (react-native-sortables issue #349, a dragged item sticking after a screen was detached and re-attached on iOS with Gesture Handler 2.x, should be fixed by Gesture Handler 3 in SDK 58) and VoiceOver announcements.
- **Web** is for quick checks and the Playwright tests (`e2e/`), not a release target. The database isn't shared between browser tabs (`multiInstance: false`), so two open tabs don't see each other's changes. Screen readers on web don't get the Move up / Move down actions, because React Native Web doesn't support accessibility actions.
- **Accessibility** was reviewed in code (spoken labels, headings, announcements, contrast, tap targets, large text), but not yet tried with TalkBack or VoiceOver.
- **Storage** is RxDB's LocalStorage storage on SQLite-backed `localStorage`, which rewrites whole index arrays on each write. That's fine for a personal list; it would be worth measuring with thousands of items.
- The only way back into the setup flow from the main app is Settings → Delete all data. Everything else is edited from the tabs.
- Out of scope for now: a screen for browsing the trip log, backend sync, store addresses, and UPC scanning. See [functional spec §8](docs/functional-spec.md#8-out-of-scope-for-now).
