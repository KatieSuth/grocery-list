# Grocery List: Functional Specification

**Status:** Setup flow and main app tabs built. The Items tab has checkboxes and quantities; the shopping trip itself is not yet designed.
**Last updated:** 2026-11-05

This document describes what the app does from the user's point of view: screens, fields, rules, and behavior. For how it's built, see the [README](../README.md).

---

## 1. Overview

Grocery List helps a shopper keep a list of the items they usually buy, organized by the stores they shop at and the order they walk through each store's departments.

On first launch, the user goes through a short **setup flow**:

1. **Stores:** add the stores they shop at, each with its departments in walking order.
2. **Items:** add the items they usually pick up, and where each is found in each store.
3. **Finish:** leave setup and enter the main app.

The **main app** has three tabs:
- **Trip:** the current shopping trip (coming soon).
- **Items:** the master list, where the user checks what they need and can note a quantity.
- **Stores:** store configuration.

Nothing in setup is final. Stores and items can be added, edited, or removed at any time, and the screens say so.

The app runs on iOS and Android, and in a web browser (used for development and testing). All data is stored on the device. There is no account and no network use.

---

## 2. Core concepts

| Concept | Description |
| --- | --- |
| **Store** | A place the user shops. Has a name, an optional location, and an ordered list of departments. |
| **Department** | A section of a store, such as Produce. Each store has its own list in the order the user walks through it. Two stores can both have "Produce", but they are separate departments. |
| **Item** | Something the user buys. Has a name, an optional brand, and one or more **locations**. |
| **Location** | Where an item is found in one store: a (store, department) pair. An item has at most one department per store. |
| **Checked item** | An item the user has ticked on the master list. Will feed the shopping trip (not yet built). |
| **Quantity** | Optional free text attached to a checked item, e.g. "4" or "1/2 pound". Discarded when the item is unchecked. |
| **Setup complete** | A saved flag that records whether the user has finished (or skipped) setup. It decides which screens the app opens to. |

---

## 3. Navigation map

```
App launch
  │
  ├─ setup not complete ──▶ Stores ──▶ Store form (add / edit)
  │                           │
  │                           └─ Next ──▶ Items ──▶ Item form (add / edit)
  │                                        │
  │                                        ├─ Back ──▶ Stores
  │                                        └─ Finish / Skip for now ──▶ Main app
  │
  └─ setup complete ──────▶ Main app (tabs)
                              ├─ Trip   (opens here)
                              ├─ Items  ──▶ Item form (add / edit)
                              └─ Stores ──▶ Store form (add / edit)
```

- Once setup is complete, setup screens are not reachable by back navigation or link. Stores and items are edited from the Stores and Items tabs.
- The device or header back gesture acts like Cancel on the forms: nothing is saved.

---

## 4. Screens

### 4.1 Stores ("Your stores")

The first screen on a new install.

**Content**
- Heading "Where do you shop?" and a one-line explanation.
- A list of saved stores in the order they were created. Each row shows:
  - the store name,
  - the location (if any),
  - the departments in order, e.g. "Produce → Bakery → Frozen".
- An **Add a store** button that opens the Store form.

**When there are no stores**
- The message "No stores yet."
- A reassurance message: "You can add, edit, or remove stores and items at any time."
- The footer shows **Skip for now**.

**When at least one store exists**
- The footer shows **Next**, which goes to the Items screen.
- The reassurance message is hidden.

**Actions**
| Action | Result |
| --- | --- |
| Tap a store | Opens the Store form to edit that store. |
| Add a store | Opens an empty Store form. |
| Next | Goes to the Items screen. |
| Skip for now | Marks setup complete and opens the main app. (Items need a store, so skipping stores skips item setup too.) |

### 4.2 Store form ("Add a store" / "Edit store")

**Fields**
| Field | Required | Notes |
| --- | --- | --- |
| Store name | Yes | Placeholder "e.g. Corner Market". |
| Location | No | Free text, e.g. "Main St, downtown". Not a structured address. |
| Departments | At least one | See below. |

**Departments**
- A new store starts with the defaults **Produce, Deli, Frozen**, in that order.
- Each department row shows its position number and three controls:
  - **↑**: move up one place (disabled for the first department),
  - **↓**: move down one place (disabled for the last department),
  - **✕**: remove the department.
- **New department** field with an **Add** button. Pressing the keyboard's Done key also adds.
  - A blank name shows "Enter a department name."
  - A name already in the list (ignoring case and extra spaces) shows "\"<name>\" is already in the list."
- **Suggestions from other stores.** As the user types in New department, matching department names from their saved stores appear under the field, headed "From your stores, tap to fill in:".
  - Each suggestion shows the name and the stores that use it, e.g. "Bakery · Corner Market, Big Box". A name used by several stores appears **once**, listing all of them.
  - Matching ignores case and extra spaces, and finds the text anywhere in the name ("bar" finds "Kombucha Bar").
  - Order: names that *start* with the typed text first, then names used at more stores, then alphabetical. At most 5 are shown.
  - Departments already in this store's list are never suggested.
  - **Tapping a suggestion fills it into the field**; the user then taps Add (or Done) to add it. Once the field holds exactly that name, the suggestion is no longer offered.
  - Typing a name that matches one from another store and pressing Add uses the existing spelling ("bulk bins" → "Bulk Bins"), so names stay consistent across stores.
- If every department is removed, the list shows "No departments yet."

**Footer**
- **Cancel:** discards changes and returns to the Stores screen.
- **Save:** validates. If valid, saves and returns to the Stores screen, where the store now appears.

**Validation** (shown after the first Save attempt, then updated as the user types)
| Rule | Message |
| --- | --- |
| Name is blank | "Store name is required." |
| No departments | "Add at least one department so items can be placed in this store." |

**Edit mode only**
- The form opens with the store's current values.
- A **Delete store** button asks for confirmation: "Delete <name>?" / "Items will no longer be listed under this store." The options are Cancel and Delete. Delete removes the store and returns to the Stores screen. (In a web browser, this is the browser's own OK/Cancel dialog. The same applies to deleting items.)

### 4.3 Items ("Your items")

**Content**
- Heading "What do you usually buy?" and a one-line explanation.
- Items sorted alphabetically (case-insensitive). Each row shows:
  - the item name,
  - the brand (if any),
  - where to find it, in store order, e.g. "Corner Market · Deli, Big Box · Frozen". If the item has no remaining locations: "No store selected".
- An **Add an item** button that opens the Item form.

**When there are no items**
- The message "No items yet" with a suggestion.
- The reassurance message.
- The footer shows **Back** and **Skip for now**.

**When at least one item exists**
- The footer shows **Back** and **Finish**.

**Actions**
| Action | Result |
| --- | --- |
| Tap an item | Opens the Item form to edit it. |
| Add an item | Opens an empty Item form. |
| Back | Returns to the Stores screen. Saved items are kept. |
| Finish / Skip for now | Marks setup complete and opens the main app. |

### 4.4 Item form ("Add an item" / "Edit item")

**Fields**
| Field | Required | Notes |
| --- | --- | --- |
| Item name | Yes | Placeholder "e.g. Milk". |
| Brand | No | Placeholder "e.g. Organic Valley". |
| Where to find it | At least one store, each with a department | See below. |

**Where to find it**
- Every store is listed with a checkbox, in the same order as the Stores screen.
- Checking a store shows its departments as choices, in that store's walking order. The user picks exactly one.
- Unchecking a store hides its choices and clears the selection for that store.
- If no stores exist, the form shows "Go back and add a store first, so you can say where to find this item."

**Validation** (shown after the first save attempt)
| Rule | Message |
| --- | --- |
| Name is blank | "Item name is required." |
| No store checked | "Choose at least one store." |
| A checked store has no department chosen | "Choose a department in <store>." (under that store) |

**Footer: adding a new item**
| Button | Behavior |
| --- | --- |
| **Add more** | Validates and saves, then clears the form for the next item and shows "Saved “<name>”. Add another, or tap Continue." |
| **Continue** | Validates, saves, and returns to the Items screen. If the form is completely empty (for example, right after Add more), it just returns without saving or showing errors. |

**Footer: editing an existing item**
| Button | Behavior |
| --- | --- |
| **Cancel** | Discards changes and returns to the Items screen. |
| **Save** | Validates, saves, and returns to the Items screen. |

Edit mode also has a **Delete item** button, with a confirmation ("Delete <name>?", Cancel / Delete).

### 4.5 Main app

After setup, the app has three tabs along the bottom:

| Tab | Icon | Purpose |
| --- | --- | --- |
| **Trip** | Shopping cart | The current shopping trip. Placeholder for now (§4.5.1). |
| **Items** | List | The master item list, with checkboxes and quantities (§4.5.2). |
| **Stores** | Storefront | Store and department configuration (§4.5.3). |

- The app opens on **Trip**.
- Icons are each platform's standard symbols: SF Symbols on iOS (`cart`, `list.bullet`, `storefront`), Material Symbols on Android (`shopping_cart`, `list`, `storefront`). The Trip and Stores icons switch to their filled versions when selected on iOS.
- Each tab keeps its own history. Editing an item or store opens inside its tab, with the tab bar still visible, and Save, Cancel, or Delete return to that tab's list.

#### 4.5.1 Trip tab ("Shopping trip")

Placeholder: "Shopping trips are coming soon" / "For now, check off what you need on the Items tab."

*Planned (not built):* checked items from the master list will appear here. See §8.

#### 4.5.2 Items tab: the master list ("Items")

**Content**
- An **Add an item** button at the top, which opens the Item form (§4.4).
- Every item, alphabetical. Each row shows:
  - a **checkbox** on the left,
  - the item name, brand (if any), and where to find it ("Corner Market · Deli", or "No store selected"),
  - while checked, a **quantity** field.
- With no items: "No items yet" and a suggestion.

**Checking items**
- Tap the checkbox to check or uncheck the item. The change saves immediately.
- Checking an item shows its quantity field, starting blank.
- Unchecking hides the field and **discards the quantity**. The next time the item is checked, the quantity starts blank again. Quantity belongs to one check, not to the item, because it's expected to change from trip to trip.
- Checked items and their quantities stay saved after the app is closed.

**Quantity**
- Optional. Leaving it blank is fine.
- Free text, not just a number: "4", "1 pint", "1/2 pound", "2 bunches". Placeholder: "Quantity (optional), e.g. 4 or 1/2 lb".
- Saved as the user types. Leading, trailing, and repeated spaces are dropped when saved; the field itself shows exactly what was typed.
- Up to 40 characters.

**Other actions**
- Tap the item's name or details (not the checkbox) to open it for editing.
- Editing an item keeps its checked state and quantity.
- Deleting an item also removes its check.

#### 4.5.3 Stores tab ("Stores")

The same store configuration as setup:
- an **Add a store** button at the top,
- the list of stores with their department order,
- tap a store to edit or delete it (§4.2).

With no stores: "No stores yet."

### 4.6 Not-found and error states

| Situation | What the user sees |
| --- | --- |
| A link to a store or item that no longer exists | "Store not found" / "Item not found", "It may have been deleted.", and a Back button. |
| Saving fails | "Could not save this store. Please try again." (or "item"). The form stays open with the user's input. |
| The on-device database can't be opened at launch | "Something went wrong opening your grocery data." and the error detail. |

---

## 5. Data rules

**Text cleanup.** Names, locations, and brands are trimmed, and repeated spaces are collapsed, so "  Corner   Market " is saved as "Corner Market". A location or brand that is blank after cleanup is saved as "not set", not as an empty value.

**Ordering**
- Stores: the order they were created.
- Departments: the order the user arranged.
- Items: alphabetical by name, ignoring case.
- An item's locations: always shown in store order.

**Keeping items consistent when stores change**
- **Deleting a store** removes that store from every item's locations. The items themselves stay.
- **Removing a department and saving the store** removes that department from every item that used it. Those items are no longer listed under that store.
- An item can end up with no locations this way. It stays in the list as "No store selected" until the user edits it.

**Checked items**
- Checking or unchecking saves immediately.
- A quantity is saved as it's typed.
- Unchecking deletes the quantity.
- Deleting an item deletes its check.
- Editing an item keeps its check.

**Persistence**
- Everything is saved on the device as soon as the user taps Save, Add more, Continue, Delete, Finish, Skip for now, or a master-list checkbox. Quantities save as they're typed.
- Data survives closing and reopening the app.
- Data is removed only by uninstalling the app, or by clearing its data in system settings.
- Form edits are not saved until the user saves; closing a form any other way discards them.

---

## 6. Accessibility

- Every button, field, checkbox, and department choice has a spoken label. For example, the reorder controls announce "Move Produce up". Department choices announce "Deli in Corner Market".
- Checkboxes and department choices report their checked state.
- On the master list, each checkbox is announced by the item's name. The quantity field is announced as "Quantity for <item>". The rest of the row is a separate "Edit this item" button.
- On Android, TalkBack announces validation and "Saved" messages when they appear. On iOS, VoiceOver doesn't announce them automatically yet; this is a known gap.
- Touch targets are at least 48 points tall (the smaller reorder controls have a larger tap area).
- Follows the system light/dark setting.

---

## 7. Decisions made during the first build

The original request left these open. They are easy to revisit.

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Departments are reordered with ↑/↓ buttons, not drag-and-drop. | Reliable, accessible, and testable. Drag-and-drop can be added later. |
| 2 | "Skip for now" also appears on the empty Stores screen. | Read from "same for the store option". It skips item setup too, because items need a store. |
| 3 | A store needs at least one department to save. | Without one, no item could be placed in that store. |
| 4 | Tapping a saved store or item opens it for editing, with Delete. | Supports "can be configured/edited at any time". |
| 5 | Continue on an empty item form returns without errors. | The common case right after "Add more". |
| 6 | Editing an item shows Save/Cancel instead of Add more/Continue. | "Add more" makes no sense when editing. |
| 7 | The main app has no way back into the setup flow. | Stores and items are now edited from their tabs. (This replaces the earlier "Edit stores and items" placeholder button.) |
| 8 | The quantity field appears only while an item is checked. | Quantity describes one check, so there's nothing to enter until the item is checked. |
| 9 | Unchecking discards the quantity; re-checking starts blank. | From "expected to change with each time a user chooses to check it". |
| 10 | Tapping the item's name opens it for editing; only the checkbox checks it. | Keeps checking a single, deliberate tap, and keeps edit access on the master list. |
| 11 | The Add buttons on the Items and Stores tabs are at the top of the list. | They stay reachable without scrolling to the end of a long list. |
| 12 | Tapping a department suggestion fills the field; the user still taps Add. | Requested by the user: lets them check or tweak the name before adding. |
| 13 | Suggestions come from all saved stores, including the saved version of the store being edited. | A department removed from this store by mistake can be re-added with one tap. Defaults aren't suggested on their own; they appear once a store uses them. |

---

## 8. Out of scope (for now)

These were deliberately left out of the first build:

- **The shopping trip** (Trip tab). Checked items will appear there; how that works is still to be designed.
- **Online backend and sync.** The data model is ready for it (RxDB supports replication), but nothing leaves the device today.
- **Store addresses.** Location is free text only.
- **UPC barcode scanning** to add items.
- **The final default department list.** Currently Produce, Deli, Frozen.
