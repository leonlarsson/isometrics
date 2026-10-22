---
status: accepted
date: 2026-10-22
---

# 0025. One UI kit for every panel

## Context and problem statement

The editor's controls grew ad hoc. There were about ten button styles in seven CSS files, icons at four sizes, native `<select>` and range inputs next to custom-styled ones, hand-rolled tabs, `title` attributes as tooltips and `window.alert` for errors. Each new panel copied whichever pattern was nearest. ADR-0024 adopted Base UI for interactive primitives; this decision says how the whole UI uses them.

## Decision drivers

- Every panel looks and behaves the same, so users learn a control once.
- New panels (save slots, the transform gizmo, weather) are quick to build from existing parts.
- Keyboard and screen-reader support comes from Base UI, not from each panel.

## Decision outcome

All panels, bars and dialogs are built from one kit in `src/ui/`, styled only with tokens from `src/styles.css`:

| Need | Use |
|---|---|
| A button | `Button` (variants `primary`, `secondary`, `ghost`, `danger`; sizes `md` in bars and dialogs, `sm` in panels; optional `icon`, `block`, `meta`) |
| An icon-only button | `IconButton` (its `label` is the accessible name and the tooltip; `md` in the toolbar, `sm` elsewhere) |
| Groups of buttons | `ButtonGroup` (row, or `vertical`), `IconButtonGroup` (section headers) |
| A field | `TextField`, `NumberField`, `SliderField`, `VectorField`, `SelectField`, `SwitchField`, `CheckboxGroupField`, `ColorField` from `fields.tsx`; `Field` for a custom control |
| Panel structure | `Section` (title + optional actions), `Hint`, `GroupLabel`, `Kbd` |
| A list of things | `List` + `ListItem` (swatch, label, meta, selected state, trailing actions) |
| Tabs | `Tabs` + `TabPanel` |
| A tooltip | `Tooltip` (never a `title` attribute on a control) |
| A question | `ConfirmDialog` (never `window.confirm`) |
| A message | `notify()` from `src/editor/toasts.ts`, rendered by `Toaster` (never `window.alert`) |
| A menu | `Menu` (ADR-0024) |

Field anatomy is always the same: a label row (label on the left, an optional action such as **Default** on the right), then the control, then an optional hint. Number labels (and the X/Y/Z letters of vector fields) can be dragged left and right to scrub the value, as in Blender or Figma. Number boxes clamp to the field's range and show up to three decimals.

Base UI is only imported inside the kit's files; panels import the kit. `notify` lives in the editor layer, so code outside React (file actions, hotkeys) can raise toasts without depending on `ui/`.

A dev-only page at `/kit` shows every component in light and dark; check it after changing the kit. Production builds answer `/kit` with a 404.

### Consequences

- Good: one look across the inspector, palette, toolbar, bars and dialogs; panels are shorter because they compose fields instead of styling inputs.
- Good: tooltips on every icon button, scrubbable numbers, keyboard support in selects, tabs and checkboxes.
- Bad: label scrubbing uses the Pointer Lock API in Chromium browsers, which shows the browser's "Press Esc to show your cursor" notice while dragging. It also crashes Playwright's headless *shell*; use the full Chromium build with `--headless=new` for automated checks.
- A few one-off controls keep their own styles on purpose: the label cards (ADR-0008), the palette's part tiles and the Edit/View switch.

## More information

- Supersedes the ad-hoc classes that lived in `Fields.module.css` (`smallButton`, `iconButton`, `dangerButton`, `linkButton`, …).
- Related: ADR-0007 (tokens), ADR-0024 (Base UI), ADR-0016 (keyboard shortcuts stay in TanStack Hotkeys).
