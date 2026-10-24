---
status: accepted
date: 2026-10-24
---

# 0054. A Blender-style properties editor: icon tabs on a rail, foldable card panels, label-left fields and a settings search

## Context and problem statement

The inspector had three text tabs (Object, Data, Scene), each one long stack of always-open sections. The Scene tab alone held world, viewpoints, sun & sky, ground, roads & traffic and lists of every road and area; a selected object stacked name, position, colours, shape, label, motion and details. Every new feature made the stack longer, a colour field alone took about 120px, and there was nowhere obvious to put a new group of settings. The left (Add to scene) and right (outliner, inspector) panes also each had their own heading style.

## Decision drivers

- Easy to understand and to find your way around, for non-technical users.
- Room to grow: a new group of settings should have an obvious home, without making another one longer.
- Dense but calm: show more settings at once without looking cramped, and look good in both themes.
- Keep the existing kit (ADR-0024, ADR-0025) and inherited values (ADR-0027).

## Considered options

1. Keep the three text tabs and make every section foldable.
2. A properties editor like Blender's: icon tabs on a vertical rail, each tab a few foldable panels.

## Decision outcome

Chosen option: **2**, because adding an icon is the natural way to add a menu, and each tab stays short.

**Rail.** The properties editor (`src/ui/Inspector.tsx`, under the outliner) has a strip of icon tabs down its left edge (`RailTabs`, a kit component on Base UI's Tabs; each icon names itself in a tooltip). The world's tabs come first: **World** (title, theme, ground), **Sun & sky** (time of day, sun, lights), **Viewpoints**, **Traffic** (the world's traffic rules) and **Data**. After a divider come the selection's tabs, which depend on what's selected:

- an object: **Object** (name, transform), **Shape** (the part's own settings, if it has any), **Look** (colours, lights), **Label** (the label card, details in View mode), **Motion** (vehicles);
- a road: **Road** (name, style, traffic on it), **Shape** (the selected point, width, curves, bridges), **Look** (not for hidden routes);
- an area: **Area** (name, type), **Shape** (the selected corner, how high it's raised), **Look**.

Selecting something opens the selection tab you were last on if it has one, else Object; from a world tab it opens Object. Selecting a road point or area corner opens Shape, where its panel is. With nothing selected, a selection tab falls back to World. Each tab is described once as `{ value, label, icon, content }` (`IInspectorTab`); the selection's tabs come from `entityTabs`, `roadTabs` and `areaTabs`. The scene tab's lists of roads and areas are gone, since the outliner lists them.

**Header.** Above the panels, a header names what they're about ("🏢 Meridian Tower › Look", or the world's title for world tabs) and has a search button.

**Settings search.** Searching shows every tab's panels at once, each tab headed like the header ("Meridian Tower › Look", "Brightwater › Sun & sky") so the selection's settings can't be mistaken for the world's, filtered: a panel whose title (or `keywords`) matches shows whole; otherwise only its fields whose labels match show, and panels and tabs with nothing left hide. Fields mark themselves with `data-search-match` from `SettingsSearchContext`, and CSS (`:has()`) hides the rest, so a new field is searchable with no extra work. You edit the matches right there.

**Panels.** `Section` is now a card with a header band (icon, title, actions), on the properties' sunken background. Given an `id`, its header folds it, and whether it's open is remembered per browser in `editor/panelMemory` (`<app>:panels`, panel id → open), like the panel sizes and Add to scene's folded sections (ADR-0051). The outliner's groups fold the same way and are remembered in the same place (`outliner:<group>`). Changes start from what's stored right now and every open tab follows them (the `storage` event), so two tabs of the app don't undo each other's folds; Add to scene's memory now works the same way. When panels change in a later version nothing is wiped or migrated: a new panel shows its default, a removed or re-identified one leaves an entry that's never read, and a renamed one opens as its default once. If the stored shape ever changes, the old value is simply overwritten, with no migration: it only holds fold states, so every panel opening as its default again is harmless, unlike losing a world (ADR-0020).

**Fields.** In a panel wide enough (a container query on the panel body), each field is one row: the label right-aligned on the left, the control on the right, as in Blender. Hints and checkbox lists take the full width, multi-line text keeps its label above (`stacked`), three-number vectors stack their boxes (X, Y, Z), and switches sit in the control column with their label beside them. Narrower places (dialogs, the phone sheet's narrow screens) keep the label above. Inherited values (ADR-0027) still say **Default** / **From scene** next to the label, as a quiet note under it, and Reset becomes an icon with its tooltip. A colour field is one button (swatch and hex code) that opens the swatches and a free colour picker in a popover.

**One look for every pane.** Add to scene and the outliner get the same header band (`PaneHeader`: icon, title, actions) and icons on their category headings (`CATEGORY_ICONS`, shared with the properties). The outliner's "only things that show data" switch is an icon toggle in its header. The toolbar's buttons sit in sunken pill clusters (`IconButtonGroup cluster`) matching the Edit/View switch.

**Phones (ADR-0030, ADR-0046).** The sheet's tab bar becomes the rail laid sideways: Add and List, then the selection's tabs, then the world's, scrolling sideways when they don't fit.

### Consequences

- Good: each tab is short, and a new group of settings is a new icon or panel instead of a longer stack.
- Good: about twice as many settings fit on screen; folding is remembered.
- Good: any setting can be found by name.
- Bad: changing a colour after selecting an object takes a click on Look (the last selection tab is kept, so this happens once per kind of task, not per object).
- Bad: icons need learning; tooltips and the header's tab name help.
- Bad: the settings search relies on CSS `:has()` (all current browsers).

## More information

`src/ui/Inspector.tsx`, `src/ui/RailTabs.tsx`, `src/ui/PaneHeader.tsx`, `src/ui/inspectorTabs.ts`, `src/ui/fields/Section.tsx`, `src/ui/fields/settingsSearch.ts`, `src/editor/panelMemory.ts`. Related: ADR-0025 (UI kit), ADR-0027 (inherited values), ADR-0030 (narrow layout), ADR-0035 (outliner), ADR-0051 (Add to scene).
