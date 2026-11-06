# Grocery List

An Expo app for iOS and Android that keeps your grocery items organized by store and by the order you walk through each store's departments.

Built so far:
- the first-run **setup flow**: add stores and departments, then the items you usually buy and where to find them;
- the **main app**, with three tabs: Trip (placeholder), Items (the master list, with checkboxes and free-text quantities), and Stores (store configuration).

The shopping trip is next. See the [functional specification](docs/functional-spec.md) for screen-by-screen behavior.

**Stack:** Expo SDK 57 · React Native 0.86 · React 19.2 (React Compiler on) · Expo Router · RxDB 17 · TypeScript · Jest + React Native Testing Library · pnpm

---

## Getting started

### Prerequisites
- Node.js 20 or newer
- pnpm (`corepack enable` or `npm i -g pnpm`)
- A desktop browser, for the quickest way to run it (below).
- Optionally, the **Expo Go** app on an iPhone or Android phone. No custom build is needed: every native module used here ships in Expo Go.

### Run in a browser (recommended for day-to-day debugging)

```bash
pnpm install
npx expo start --web
```

Open **http://localhost:8081** in any browser. From WSL2, a browser on Windows works too, because WSL forwards `localhost`. Use the browser's device toolbar (F12 → toggle device, e.g. Pixel 7) for a phone-sized view, and its DevTools for console errors.

- Data lives in the browser's `localStorage`.
- **To see the first-run screens again,** clear site data: DevTools → Application → Storage → Clear site data. Or open a private window.
- On web, delete confirmations use the browser's own confirm dialog, and the tab bar is drawn by the app (see [Main app tabs](#main-app-tabs)).

### Run on a phone with Expo Go

```bash
npx expo start
```

Scan the QR code: on iPhone with the Camera app, on Android from inside Expo Go. The phone must be able to reach this computer over the network.

#### Running from WSL2

Getting a phone to load the app from WSL2 is unreliable. It didn't work on the original dev machine (see below), which is why the browser is the default.

By default WSL2 uses NAT networking: `hostname -I` shows a `172.x` address that phones can't reach, so a plain `npx expo start` QR code just spins in Expo Go. There are two fixes:

- **Tunnel:** `npx expo start --tunnel`. This relays through ngrok (`@expo/ngrok` is a dev dependency), so the dev server is reachable at a public URL while it runs. The QR URL should end in `.exp.direct`. "Failed to download remote update" in Expo Go means the phone couldn't fetch the manifest or bundle through the tunnel; restart the tunnel, or switch to mirrored networking.
- **Mirrored networking (more reliable, nothing public; Windows 11 22H2+):**
  1. Add `[wsl2]` / `networkingMode=mirrored` to `C:\Users\<you>\.wslconfig`.
  2. Run `wsl --shutdown` in PowerShell, then reopen the WSL terminal.
  3. Run plain `npx expo start` with the phone on the same Wi-Fi.
  4. If the phone still can't connect, allow port 8081 in an administrator PowerShell: `New-NetFirewallRule -DisplayName "Expo Metro" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow`.

While it runs: press `r` to reload. Saved code changes appear live.

**To see the first-run screens again on a phone,** clear Expo Go's app data (Android: Settings → Apps → Expo Go → Storage → Clear data) or reinstall Expo Go (iOS). This also erases your stores and items.

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
    _layout.tsx           Root: theme, DatabaseProvider, setup-vs-main gate
    setup/                First-run onboarding (Stack)
      index.tsx           Stores list
      store-form.tsx      → StoreFormScreen (back to /setup)
      items.tsx           Items list
      item-form.tsx       → ItemFormScreen (back to /setup/items)
    (tabs)/               Main app (NativeTabs); each tab has its own Stack
      (trip)/index.tsx    "/"        Shopping trip (placeholder)
      items/index.tsx     "/items"   Master list: checkbox + quantity per item
      items/form.tsx      "/items/form"   → ItemFormScreen
      stores/index.tsx    "/stores"  Store configuration
      stores/form.tsx     "/stores/form"  → StoreFormScreen
  screens/                Screens used by more than one route
    store-form-screen.tsx Add / edit store (?id=), takes backTo
    item-form-screen.tsx  Add / edit item (?id=), takes backTo
  domain/                 Pure logic: no React, no database
    types.ts              Store, Department, Item, ItemLocation
    departments.ts        Defaults, add/remove/move
    store-draft.ts        Store form state + validation
    item-draft.ts         Item form state + validation, location pruning
    describe.ts           "Store · Dept" display text
    quantity.ts           Free-text quantity cleanup
  data/                   Repositories: the only code that touches collections
    stores-repo.ts        observe / save / delete stores (+ prune items)
    items-repo.ts         observe / save / delete items
    list-repo.ts          check / uncheck items, set quantity
    settings-repo.ts      setupComplete flag
  db/
    schema.ts             RxDB JSON schemas
    database.ts           createAppDatabase(), getAppDatabase() singleton
    storage.native.ts     iOS/Android storage (SQLite-backed localStorage)
    storage.ts            Web storage (browser localStorage)
    hash.ts               SHA-256 via expo-crypto
    database-provider.tsx <DatabaseProvider>, useDatabase()
  hooks/
    use-data.ts           useStores(), useItems(), useListEntries(), useSetupComplete()
    use-observable.ts     Subscribe a component to an RxJS observable
  components/             Shared UI (Button, TextField, Screen, Card, editors…)
  constants/theme.ts      Colors (light/dark), spacing
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

- **Domain** holds the rules: validation, default departments, reordering, location pruning. It's plain TypeScript, so it's trivial to test and reuse in the main app.
- **Repositories** are the only place that reads or writes RxDB. They normalize input (trim, collapse spaces, drop blank optional fields) and keep items consistent when stores change.
- **Hooks** expose live queries. Screens re-render automatically when data changes, so after Save, a screen just navigates back and the list is already up to date.
- **Screens** hold form state as a *draft* (`StoreDraft`, `ItemDraft`). They validate with domain functions and save through repositories.

### Navigation gate

`src/app/_layout.tsx` reads the persisted `setupComplete` flag and uses `Stack.Protected`:
- `setup/*` is available only while `setupComplete` is false.
- `(tabs)` (the main app) is available only while it's true.

Flipping the flag (Finish or Skip for now) switches flows and drops the old flow's history.

### Main app tabs

`(tabs)/_layout.tsx` renders `components/app-tabs`, which has a different file per platform:

- **iOS/Android** (`app-tabs.tsx`): `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 58 moves it to `expo-router/native-tabs`), so each platform's own tab bar is used. Icons are SF Symbols on iOS and Material Symbols on Android, set with the `sf` and `md` props; both ship in Expo Go.
- **Web** (`app-tabs.web.tsx`): `NativeTabs` draws its bar at the top of the page, over the screen header. Web instead gets a bottom tab bar built from expo-router's headless `Tabs` (`expo-router/ui`), with the same Material icons drawn by `SymbolView`.

Each tab is a folder with its own `Stack`, so forms push inside the tab and keep the tab bar visible. The add/edit forms live in `src/screens/` and are reused by the setup and tab routes. A `backTo` prop says where Save, Cancel, and Delete return to. The splash screen stays up until the flag has loaded, so users never see the wrong flow flash.

### Data model

Four RxDB collections, all schema `version: 0`:

| Collection | Document | Notes |
| --- | --- | --- |
| `stores` | `{ id, name, location?, departments: [{ id, name }], createdAt }` | Departments are embedded and ordered. Indexed on `createdAt`. |
| `items` | `{ id, name, brand?, locations: [{ storeId, departmentId }], createdAt }` | Locations reference store and department ids. |
| `listEntries` | `{ itemId, quantity?, checkedAt }` | One per **checked** item; primary key is the item id. Unchecking deletes it, so a quantity never outlives its check. Deleting an item deletes its entry. |
| `settings` | `{ id: 'app', setupComplete }` | Single document. |

IDs come from RxDB's `randomToken(16)`. Timestamps are epoch milliseconds.

Checked state is a separate collection, not a field on `items`. Checks change constantly and items rarely do, and the shopping trip will build on entries without touching the item catalog.

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

### Future sync

RxDB has built-in replication (HTTP, GraphQL, CouchDB, Firestore, Supabase, …). Adding a backend should mean adding a replication plugin in `database.ts`, not restructuring the data layer. All documents already have stable string ids.

---

## Testing

```bash
pnpm test          # everything, iOS + Android, coverage enforced at 100%
npx jest src/__tests__/domain --coverage=false   # a subset
```

The Jest config (`package.json` → `jest`, Jest 29) has three projects:

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
| `e2e/` (Playwright) | The web build in a real browser: setup, tabs, checking and quantities surviving a reload, delete confirmations. |

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
  - Switch tabs with `await act(() => router.navigate('/items'))`. Don't use `testRouter.navigate`: tab switches add an internal query param that breaks its pathname assertion.
  - `tabs-layout-test.tsx` mocks `NativeTabs` to check tab order, labels, and icons.
- **Fire-and-forget writes** (checkbox, quantity): assert on the DB with `eventually(...)` from `test-utils/app`. It retries while advancing the fake timers.
- **Test files go in `__tests__/`** and are named `*-test.ts(x)`. Web-only tests are named `*.web-test.ts(x)`.

---

## Expo SDK version

The project is on **SDK 57**, not the latest (58). The App Store and Google Play versions of Expo Go only run SDK 57 projects until Expo ships Expo Go for SDK 58, so the project was moved down to 57 on 2026-11-05.

**SDK 57 workarounds** (each marked in the code):

| Workaround | Where | Why |
| --- | --- | --- |
| `babel.config.js` with `babel-preset-expo` | project root | SDK 57's `jest-expo` doesn't apply Expo's Babel preset by itself. |
| `mingo` added to `transformIgnorePatterns` | `package.json` → `jest` | RxDB's query engine resolves to ES modules under Jest 29. |
| `test-renderer` pinned to `~1.2.0` | `package.json` | 1.3 needs React 19.3; SDK 57 ships React 19.2. |
| Route-helper shim in `renderRouterWithRouteHelpers` | `src/test-utils/app.tsx` | SDK 57's `renderRouter` was written for Testing Library 13's synchronous `render`. |
| Typings for `toHavePathname` and the other router matchers | `src/test-utils/router-matchers.d.ts` | SDK 57 ships those matchers without type declarations. |
| Path assertions instead of exact-URL ones after tab switches | `__tests__/app/main-app-test.tsx` | SDK 57's router adds an internal `__internal_expo_router_no_animation` param to the URL. |

**Moving back to SDK 58** once Expo Go for 58 is in the stores:

1. `npx expo install expo@^58.0.0 && npx expo install --fix`
2. Change the tabs import back to `expo-router/native-tabs`, in `(tabs)/_layout.tsx` and `tabs-layout-test.tsx`.
3. Remove the route-helper shim and `router-matchers.d.ts` (SDK 58 provides both), and the `test-renderer` pin.
4. Try removing `babel.config.js` and the `mingo` pattern. Keep whichever turn out to still be needed.
5. Run `pnpm typecheck && pnpm lint && pnpm test`, `npx expo-doctor`, and a native export.

## Conventions

- **Navigation:** import `router`, `Link`, and `useLocalSearchParams` from `expo-router`. Use `goBack(fallback)` from `utils/navigation` so screens opened from a deep link still have somewhere to go.
- **No `ios/` or `android/` folders.** They're generated by Expo (Continuous Native Generation). Configure native behavior in `app.json` and config plugins.
- **New native libraries** may not be in Expo Go. Adding one means using a development build (`npx expo run:ios|android` or `eas build --profile development`).
- **pnpm build scripts:** `pnpm-workspace.yaml` explicitly denies `@parcel/watcher`'s install script. It's an optional file watcher, and pnpm 12 otherwise fails the install.

---

## Status and known limitations

- The Trip tab is a placeholder.
- **Verified in a browser:** the full app runs in Chromium with no console errors, and data survives reloads (Playwright, `e2e/`).
- **Not yet run on a phone or simulator.** Loading in Expo Go on Android from WSL2 failed at the network level: the tunnel gave "Failed to download remote update", and the dev server never received a request. The iOS and Android bundles build and all Jest tests pass, but the on-device storage path (`storage.native.ts`) is only checked by tests so far.
- Departments are reordered with ↑/↓ buttons. Drag-and-drop isn't built.
- On iOS, VoiceOver doesn't automatically announce validation messages.
- There's no way back into the setup flow from the main app. Everything is edited from the tabs instead.
- Out of scope for now: the shopping trip itself, backend sync, store addresses, UPC scanning, and the final default department list. See [functional spec §8](docs/functional-spec.md#8-out-of-scope-for-now).
