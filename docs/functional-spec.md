# Grocery List: Functional Specification

**Status:** Setup flow, all four main tabs (including Settings), and the shopping trip are built. Finished trips are logged, but there's no screen to view the log yet.
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
- **Trip:** the shopping trip: pick the store you're at, check off what you put in the cart, and finish the visit.
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
| **Checked item** | An item the user has ticked on the master list: something they need. Checked items are what the shopping trip lists. |
| **In the cart** | A checked item the user has checked off on the current trip. It stays checked on the master list until the trip is finished. |
| **Trip** | One visit to one store. Finishing it logs the items in the cart as bought and unchecks them from the master list. |
| **Trip log** | The saved record of finished trips: the store, when, and each item bought (name, brand, quantity and department, as they were then). |
| **Last bought** | The date an item was last in a finished trip, saved on the item itself so the master list doesn't need to read the log. |
| **Quantity** | Optional free text attached to a checked item, e.g. "4" or "1/2 pound". Discarded when the item is unchecked. |
| **Appearance** | Whether the app is light, dark, or follows the device's setting (the default). Saved on the device. |
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
                              ├─ Stores ──▶ Store form (add / edit)
                              └─ Settings ── Delete all data ──▶ back to setup
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
- A new store starts with **no departments**. While the list is empty it shows "No departments yet. For example: Produce, Deli, Frozen." The store can't be saved until it has at least one.
- Each department row shows a **drag handle** on the left (☰ on iOS, ⋮⋮ on Android and web), its position number, its name, and **✕** to remove it.
- **Reordering is drag-and-drop:** press and hold the handle, drag the row to its new place, and let go. The other rows move aside as you drag, and the numbers update when you drop.
  - Only the handle starts a drag, so scrolling the form and tapping ✕ work normally.
  - Dragging near the top or bottom edge scrolls the form.
  - The new order is kept in the form and saved with **Save**, like every other change. Cancel discards it.
- **Screen readers:** dragging isn't possible with VoiceOver or TalkBack, so each handle offers **Move up** and **Move down** actions in the actions menu. The first department has no Move up and the last has no Move down. Each handle is announced as "Reorder Produce, position 1 of 3".
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
- **Copy from another store.** A "Copy from another store" button appears under the list when at least one *other* saved store exists. The store being edited is never offered.
  - Tapping it opens a prompt, "Copy departments from…", listing each other store with its location and its departments in order (e.g. "Produce → Deli → Bakery"). Cancel (or Android's back button) closes it without changes.
  - Choosing a store adds its departments **after** this store's current ones, in that store's walking order. The user can drag them afterwards.
  - **No duplicates:** a department whose name is already in the list is skipped. Matching ignores case and extra spaces, so "deli" isn't added when "Deli" is there. The existing entry keeps its spelling and position.
  - A note under the button says what happened: "Copied 2 departments from Corner Market: Bakery, Frozen Foods." or "Every department at Corner Market is already in this list."
  - Copies are new departments belonging to this store; nothing is linked to the other store. As with any edit, nothing is saved until Save.
- If every department is removed, the list shows the same "No departments yet. For example: Produce, Deli, Frozen." message.

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
| Brand/Distinguisher | No | Placeholder "e.g. 'Organic Valley,' '3-pack,' etc." |
| Where to find it | At least one store, each with a department | See below. |

**Where to find it**
- Every store is listed with a checkbox, in the same order as the Stores screen.
- Checking a store shows its departments as choices, **A–Z** (ignoring case), not in the store's walking order. Walking order is kept for the shopping trip. The user picks exactly one.
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

After setup, the app has four tabs along the bottom:

| Tab | Icon | Purpose |
| --- | --- | --- |
| **Items** | List | The master item list, with checkboxes and quantities (§4.5.2). |
| **Trip** | Shopping cart | The shopping trip (§4.5.1). |
| **Stores** | Storefront | Store and department configuration (§4.5.3). |
| **Settings** | Gear | Appearance and deleting all data (§4.5.4). |

- The app opens on **Items**, including right after setup is finished or skipped.
- Icons are each platform's standard symbols: SF Symbols on iOS (`list.bullet`, `cart`, `storefront`, `gearshape`), Material Symbols on Android (`list`, `shopping_cart`, `storefront`, `settings`). The Trip, Stores and Settings icons switch to their filled versions when selected on iOS.
- Each tab keeps its own history. Editing an item or store opens inside its tab, with the tab bar still visible, and Save, Cancel, or Delete return to that tab's list.

#### 4.5.1 Trip tab ("Shopping trip")

**Choosing the store**
- At the top, a **Store** dropdown: "Choose a store" until one is picked, then the store's name (and location, if any) with a ▾.
- Tapping it opens "Which store are you at?", listing every store; the current one is outlined and marked ✓ (spoken as "…, current"). Cancel closes it.
- The choice is remembered across app launches. If that store is deleted, the tab goes back to "Choose a store".
- With no store chosen: "Where are you shopping?" / "Choose a store to see what to get there."
- With no stores at all: "No stores to shop at yet" / "Add the stores you shop at on the Stores tab."

**What to get**
- Every **checked** item from the master list that has a department at the chosen store, grouped under **department headings in the store's walking order**. Items are A–Z within each department. Departments with nothing to get are left out.
- Each row shows a checkbox, the item name, and its brand and quantity if any (e.g. "Acme · 1 lb"). The quantity is read-only here; it's set on the Items tab.
- A summary line: "1 of 3 in cart", or "Nothing to get here".
- Below the list: "2 checked items aren't sold at Corner Market." when some checked items have no department there.
- With nothing to get: "Nothing to get at Corner Market" / "Check items on the Items tab that are sold here, and they'll show up in department order."

**Reverse order**
- A **Reverse order** switch lists the departments last-to-first, for walking the store the other way. Items within a department stay A–Z.
- It's remembered across launches, and applies to whichever store is chosen.

**Checking off**
- Tapping a row puts the item **in the cart**: the box is checked and the text is struck through and dimmed. Tapping again takes it out.
- This does **not** uncheck it on the master list. It stays checked there, with its quantity, until the trip is finished.
- Unchecking an item on the master list removes it from the trip, cart and all.

**Finishing the trip**
- A **Finish trip** button is pinned at the bottom. It's disabled until at least one item is in the cart.
- It asks first: "Finish your trip at Corner Market?" / "2 items you checked off will be logged as bought and unchecked from your list. 1 item you didn't check off will stay on your list." (The second sentence only appears when something wasn't checked off.) Buttons: Cancel, **Finish trip**.
- On confirming:
  - A trip record is added to the log: the store, the time, and each item in the cart (name, brand, quantity and department at that moment).
  - Each of those items gets its **last bought** date set to now.
  - Those items are **unchecked** on the master list (their quantities go with them).
  - Items that weren't checked off stay checked, and stay on the trip list.
  - The tab shows "Trip finished: 2 items logged as bought."
- If saving fails: "Could not finish the trip. Please try again." The items stay in the cart, so the user can press Finish trip again.
  - Finishing saves the log record first, marked as in progress, then updates the items, then marks the record done. If it's interrupted at any point (an error, or the app being closed), the next Finish completes **that same trip**. It is never logged twice and no items are lost.
  - If there's an unfinished trip, the next Finish completes it first. Anything put in the cart since is left there for the following Finish.
  - An item that was unchecked and checked again since the interrupted attempt keeps its new check.
- If the cart empties while the question is open (for example, the items were unchecked on the Items tab), confirming logs nothing and says "Nothing was checked off, so there was nothing to log."

**Switching stores mid-trip**
- If nothing is in the cart, choosing another store just switches.
- If something is in the cart, the app asks "Done with your trip at Corner Market?" / "You've checked off 2 items here. Finish this trip to log them as bought, then switch to Big Box. If you're not done, you'll stay at Corner Market." Buttons: **Not yet** and **Finish and switch**.
  - Finish and switch: finishes the trip exactly as above, then switches. If finishing fails, it doesn't switch.
  - Not yet: nothing changes; the store stays as it was, cart and all.
- This prevents checked-off items being left behind at a store the user is no longer looking at.
- Each new trip starts with an empty cart. Switching stores clears any leftover cart marks, such as from a store that was deleted mid-trip.

On the web, the questions use the browser's own OK/Cancel dialog, so the button labels differ.

*Planned (not built):* checked items from the master list will appear here. See §8.

#### 4.5.2 Items tab: the master list ("Items")

**Content**
- At the top: a **search box** with a **filter button** and a **sort button** to its right (§ Search and filters, § Sorting below), then an **Add an item** button, which opens the Item form (§4.4).
- Every item, in the default sort chosen in Settings (by name, A–Z, unless changed; § Sorting). Each row shows:
  - a **checkbox** on the left,
  - the item name, brand (if any), and where to find it ("Corner Market · Deli", or "No store selected"),
  - "Last bought today", "yesterday", "3 days ago" (under a week), or a date ("Nov 3"; "Dec 25, 2025" if not this year), once the item has been in a finished trip,
  - while checked, a **quantity** field.
- With no items: "No items yet" and a suggestion.

**Search and filters**
- **Search** ("Search items") narrows the list as the user types. It matches anywhere in the item **name**, ignoring case and extra spaces ("mil" finds "Whole Milk"). It doesn't search brands.
- An **✕** in the search box clears the search.
- The **filter button** (a filter icon) opens and closes a panel with four groups of options:
  - **Show:** **All**, **Checked** or **Unchecked** items; exactly one is picked, All by default. Checked or Unchecked counts as one filter. While Unchecked is picked, checking an item takes it off the list (and Checked, the other way round).
  - **Stores:** every store, in store order.
  - **Departments:** every department name across all stores, alphabetical. A name used by several stores (e.g. Deli) appears **once** and matches that department in every store.
  - **Brands:** every brand across all items, alphabetical, **once** each. "Acme" and "acme" count as one brand. The label is the most common spelling; on a tie, the one starting with a capital letter.
  - A group with nothing in it says so ("No stores yet.", "No departments yet.", "No items have a brand yet.").
- **Combining:**
  - Options picked within a group widen the list: Deli *or* Bakery.
  - Picks in different groups, and the search, narrow it: an Acme item *and* in the Deli.
  - Store and department are checked on the **same location**: Big Box + Deli shows items in the Deli *at Big Box*, not items that are at Big Box and also in some store's Deli.
- **While filters are on:**
  - The filter button shows a badge with the number of options picked.
  - A "N filter(s) on" line with a **Clear filters** button appears, even with the panel closed. Clear filters removes all picks (and sets Show back to All) but keeps the search text.
- While searching or filtering, "Showing X of Y items" appears.
- If nothing matches: "No matching items", with a **Clear search and filters** button.
- Picks for a store, department or brand that has since been deleted are dropped automatically.
- Search and filters are not saved; they reset when the app restarts.

**Sorting**
- The **sort button** (an up/down arrows icon) opens and closes a sort panel. Opening it closes the filter panel, and the other way round. It has two sets of choices:
  - **Sort by:** **Name**, **Department** or **Last bought**.
  - **Order:** **A–Z** or **Z–A**. For Last bought these read **Newest first** and **Oldest first**.
  - The list opens with the **default sort** chosen in Settings (§4.5.4), which is Name, A–Z unless changed.
- **Name:** one list of items by name, ignoring case.
- **Department:** items are grouped under department headings, with items by name inside each group.
  - A–Z or Z–A applies to both the headings and the items within them.
  - A department name used by several stores (e.g. Deli) is **one** group, as in the filters. An item in the Deli at two stores is listed once under it.
  - An item in **different departments** at different stores (Deli at Corner Market, Frozen at Big Box) is listed **under each** of them. The panel says so while Department is chosen.
  - If a store or department filter is on, only the departments that match it are used. Filtering by Big Box groups by Big Box's departments only.
  - Items with no department left (their stores were deleted) go last, under "No department", in either order.
- **Last bought:** items by the date they were last bought (§4.5.1), with no headings.
  - Items bought on the same trip share a date, and are listed A–Z among themselves in either order.
  - Items never bought go last, A–Z, under a "Never bought" heading, in either order.
  - Switching between sorts keeps the order position: Oldest first becomes Z–A when switching to Name, and the other way round.
- **One item, several rows:** the copies are the same item, matched by its ID.
  - Checking or unchecking any copy checks or unchecks them all.
  - A quantity typed in any copy appears in every other copy as it's typed, and is saved once for the item.
  - "Showing X of Y items" counts items, not rows.
- Sorting works together with search and filters. The button is highlighted while the list isn't in the default sort from Settings, and announces the current choice ("Sort, by department, Z to A").
- Choices made here aren't saved: the list returns to the default sort when the app restarts. Choosing a new default in Settings shows the list that way straight away.

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

#### 4.5.4 Settings tab ("Settings")

**Appearance:** three choices, System, Light and Dark (spoken "Match system appearance", "Light mode", "Dark mode").
- **System** is the default. The app follows the device's light/dark setting and changes with it.
- **Light** or **Dark** keeps the app that way whatever the device is set to. On iOS and Android this includes the tab bar, alerts and keyboard; on the web it includes scrollbars and form controls.
- A line under the choices explains the current one: "Follows your device’s light or dark setting." or "Always dark, whatever your device is set to."
- The choice applies immediately and is remembered between launches.

**Items list:** the **default sort** for the Items tab: **Default sort** (Name, Department or Last bought) and **Default order** (A–Z or Z–A; Newest first or Oldest first for Last bought). These are the same choices as the Items tab's sort panel (§4.5.2).
- Spoken as "Default sort: name", "Default order: A to Z" and so on.
- Under them: "How the Items tab is sorted when it opens. Sorting there changes it only until you leave the app."
- The default is Name, A–Z. A choice applies immediately, including to the Items tab if it's already open, and is remembered between launches.

**Your data:** "Your stores, items, list and trip history are stored only on this device.", an **Import from CSV** button, and a **Delete all data** button.

**Import from CSV** adds stores, departments and items from a CSV file (see "Importing a CSV file" in Data rules).
- Under the button: "Columns: Store, Item name, Department, Brand (optional). A header row is fine. New stores and departments are added, and items already in your list are skipped."
- Tapping it opens the system file picker (the browser's file chooser on the web), limited to one CSV or text file.
- Once a file is chosen, a spinner shows "Checking the file…" while it's read and checked, and "Importing…" while it's saved. Import from CSV and Delete all data are disabled meanwhile. The spinner stops before any message appears.
- If the file can't be used, an alert titled "Can’t import this file" says why and ends "Nothing was imported." Problems in rows are listed as "Row 3: Department is empty.", up to five, then "…and N more problems."
- If the file is fine, the app asks first, e.g. "Import from CSV?" / "This adds 3 new items, 1 new store and 2 new departments. 1 row is already in your list and will be skipped." with **Cancel** and **Import**. Afterwards: "Imported" / "Added 3 new items, 1 new store and 2 new departments."
- If everything in the file is already in the app: "Nothing new to import" / "Everything in this file is already in your list."
- If the import fails while saving: "Could not finish the import. Some of it may have been saved; check your stores and items."

- It asks first: "Delete all data?" / "This permanently deletes your stores, items, shopping list and trip history from this device, then starts setup again. It can’t be undone." with **Cancel** and **Delete everything** (destructive). The web shows the browser's OK/Cancel dialog.
- On confirming, every store, item, check, quantity, last-bought date and logged trip is deleted, the trip tab's store and order are forgotten, and the app returns to the first setup screen ("No stores yet").
- The appearance choice and the items' default sort are kept.
- If deleting fails: "Could not delete all of your data. Please try again." Setup is only restarted once everything is gone, so trying again finishes the job.

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
- Departments: the order the user arranged, everywhere except the item form's department choices, which are A–Z.
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

**Trips**
- Checking off on the trip, the Reverse order switch and the chosen store save immediately.
- Finishing a trip saves the log record, the last-bought dates and the unchecks.
- The trip log is kept indefinitely. Deleting an item or store later doesn't change past records, which keep the names as they were.

**Importing a CSV file**
- Columns, in order: Store, Item name, Department, Brand. Brand may be empty or left out. Extra empty cells at the end of a row are ignored; more than four columns is an error.
- The first row is skipped if it's a header (Store, Item name or Item, Department, and optionally Brand, in any case). Blank rows are skipped.
- Values are text only and are cleaned up like typed names. Commas, quotes and line breaks work inside quoted values (`"Bread, sourdough"`); a quote inside a quoted value is doubled (`""`).
- Names are matched ignoring case and spacing, and existing spellings are kept.
  - A store that doesn't exist is created, with its departments in the order they first appear in the file.
  - A department that doesn't exist at a store is added to the end of that store's order.
  - An item is the same item if its name and brand match (no brand matches no brand). If it's already at that store in that department, the row is skipped. If it exists but isn't at that store, the store is added to it. Otherwise a new item is created.
- An item can be in only one department per store, so a row that would put an item in a second department at a store (compared with the app, or with an earlier row) is an error.
- The whole file is checked first. If any row has a problem, nothing is imported.
- Limits: files up to 1 MB, up to 2,000 rows, names up to 100 characters, up to 200 departments per store, and up to 100 stores in total.
- Not allowed in any value: control characters, invisible zero-width characters, and characters that change text direction. Accents, emoji and other languages are fine.

**Persistence**
- Everything is saved on the device as soon as the user taps Save, Add more, Continue, Delete, Finish, Skip for now, or a master-list checkbox. Quantities save as they're typed.
- Data survives closing and reopening the app.
- Data is removed by **Delete all data** in Settings, by uninstalling the app, or by clearing its data in system settings.
- Deleted stores, items, checks and trips are kept as hidden "deleted" markers for up to a month (so a future sync can tell what was deleted), then purged automatically. **Delete all data** purges them at once, leaving no copy on the device.
- Form edits are not saved until the user saves; closing a form any other way discards them.

---

## 6. Accessibility

- Every button, field, checkbox, and department choice has a spoken label. For example, a department's drag handle announces "Reorder Produce, position 1 of 3", with Move up / Move down actions. Department choices announce "Deli in Corner Market".
- Checkboxes and department choices report their checked state.
- On the master list, each checkbox is announced by the item's name. The quantity field is announced as "Quantity for <item>". The rest of the row is a separate "Edit this item" button.
- On Android, TalkBack announces validation and "Saved" messages when they appear. On iOS, VoiceOver doesn't announce them automatically yet; this is a known gap.
- Touch targets are at least 48 points tall (the ✕ remove control has a larger tap area than it looks; drag handles are 40 points square).
- Follows the system light/dark setting unless Light or Dark is chosen in Settings.
- Appearance choices are radio buttons and report which is selected.

---

## 7. Decisions made during the first build

The original request left these open. They are easy to revisit.

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Departments are reordered by drag-and-drop, using a handle on each row. (Originally ↑/↓ buttons; changed on request.) | A handle keeps scrolling and the ✕ button working normally. Screen-reader users get Move up / Move down actions on the handle instead. |
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
| 14 | Master-list filters: OR within a group, AND across groups; store + department matched on the same location. | Matches how people think: "Deli or Bakery", and "the Deli at Big Box". |
| 15 | Filters are shown as an expandable panel above the list, not a separate screen. | The list updates live under the panel, so the effect of each pick is visible immediately. |
| 16 | Search and filters aren't remembered between app launches. | Opening the master list should show everything. Easy to change if they should persist. |
| 17 | The item form lists each store's departments A–Z, not in walking order. (Changed on request.) | Finding a name is quicker in A–Z order. The walking order the user set is for the shopping trip. |
| 18 | Copied departments go after the current ones, in the source store's order; names already listed are skipped and keep their place. The source store is chosen from an in-app prompt. | Keeps any order the user already set. A prompt listing each store's departments lets them see what they'll get; the system alert can't hold more than three stores on Android. |
| 19 | Sorting by department lists an item under **each** department it's in (once per department name), with department headings in the chosen order. The copies share one check and quantity, matched by item ID. (Changed on request; first built as "first store's department only".) | Requested by the user: an item should be findable under every department it's in. Sharing state by ID keeps the copies from disagreeing. |
| 20 | The store picker is an in-app sheet, not a native picker. | It works the same on iOS, Android and web, shows each store's location, and doesn't need a new native module. |
| 21 | Reverse order reverses the departments; items stay A–Z within each. | Walking the store backwards changes which department comes first. Order within a department doesn't depend on direction. |
| 22 | Finish trip is disabled with nothing in the cart. | Nothing would be logged. |
| 23 | A trip only finishes items in the cart **and** sold at the chosen store. | Matches what the user saw on screen when they confirmed. |
| 24 | Each trip record copies the item's name, brand, quantity and department. | The log stays readable if items or stores are renamed or deleted later. |
| 25 | Switching stores clears cart marks. | A trip belongs to one store. With items in the cart, the user must finish first, so this only clears leftovers. |
| 26 | Finishing a trip is resumable: the record is saved first as pending, and a retry completes it. | The steps can't be one transaction in this storage. Saving the record first means a failure never loses the log, and completing the pending record means a retry never duplicates it. |
| 27 | The appearance choice is saved in the app's database, so the app waits for the database (behind the splash screen) before drawing anything. | The first screen never flashes the wrong colors. |
| 28 | Delete all data keeps the appearance choice. | It's how the app looks, not shopping data. Someone using dark mode shouldn't be blinded by a reset. |
| 29 | Delete all data returns to the first setup screen rather than an empty main app. | It's the same as a fresh install, and setup is the quickest way to add stores again. |
| 30 | Last bought: newest first is the default, same-trip items are A–Z, and never-bought items go last under a heading. | Recent purchases are what people look for. Never-bought items have no date to compare, and putting them at the top of "oldest first" would bury the actual dates. |
| 31 | CSV import checks the whole file and imports nothing if any row has a problem, and asks before saving. (Chosen with the user.) | A partial import of a messy file is harder to fix than a rejected one. The summary lets the user catch a wrong file before it changes anything. |
| 32 | CSV import treats the file as untrusted: size, row, length and count limits; no hidden, control or direction-changing characters; values are only ever text (never numbers, formulas or code); ids always come from the app; on Android the chosen file is read in place (nothing is copied), and on iOS the picker's copy is deleted after reading. | The file comes from outside the app. The limits keep storage and screens (like the drag-to-reorder list) usable, and hidden characters could make two names look the same. Formula characters (`=`, `+`, `-`, `@`) are allowed because the app never writes spreadsheets; a future export must escape them. |
| 33 | An item that's in a different department at a store than the CSV says blocks the import instead of moving the item. (Chosen with the user.) | Moving items without asking could quietly change the shopping order. |
| 34 | The items' default sort is set in Settings; sorting on the Items tab stays temporary. Delete all data keeps the default. (Requested by the user.) | A quick re-sort while shopping shouldn't change how the list usually opens. Like the appearance choice, the default is a preference, not shopping data. |

---

## 8. Out of scope (for now)

These were deliberately left out of the first build:

- **Viewing the trip log.** Finished trips are saved, but there's no screen to browse them yet.
- **Online backend and sync.** The data model is ready for it (RxDB supports replication), but nothing leaves the device today.
- **Store addresses.** Location is free text only.
- **UPC barcode scanning** to add items.
