---
status: accepted
date: 2026-10-21
---

# 0010. Data binding through named keys; static values for now

## Context and problem statement

Worlds show numbers, but it's unknown how data will be fetched, how often, or whether it will be live.

## Decision outcome

- The scene has a flat `data` list of `{ key, label, value, unit }`. Values are numbers or text; units are appended as typed (`"%"`, `" min"`).
- Entities **reference keys**, never sources: `label.dataKeys` for the floating card, `details.dataKeys` for view-mode tiles.
- Renaming a key updates all references; deleting a key removes them (`upsertData` / `removeData`).
- Today values are edited by hand in the Data tab.

Future (no ADR yet; write one when it's built): a data-provider layer that fills or overrides values by key from CSV, Google Sheets or REST, fetched by a Worker on a schedule. The scene would gain a `sources` section; entity bindings wouldn't change.

### Consequences

- Good: the source can be decided later without touching scenes or parts.
- Bad: no derived values yet (e.g. sizing a building by a metric); that needs a binding expression design.
