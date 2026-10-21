---
status: accepted
date: 2026-10-21
---

# 0019. Product direction: a 3D world builder where data is a core pillar

## Context and problem statement

Isometrics was pitched as an app for animated 3D *dashboards*. It's growing into more than that: drawable and elevated roads, bridges, and soon terrain and Blender-style editing (`TODO.md`) make it a builder for small 3D worlds. Without a stated direction, features could drift into a pure scene editor where data is an afterthought.

## Decision outcome

Isometrics is a **builder for animated 3D miniature worlds, where data is a core pillar**. The owner's framing: it's becoming more than a dashboard app, but data-driven or data-supported worlds remain central.

What this means for decisions:

- **Every world exists to show something.** View mode, with live values in labels and details, is the finished product. Editing tools serve building worlds that communicate data.
- **New scene elements should be data-aware where it's natural.** When adding an element (a part, a road, terrain…), consider how it could show or react to data: labels and detail tiles today; later possibly colour, size, speed, traffic or state driven by values. If a feature could reasonably be data-driven, don't design it in a way that rules that out.
- **Data stays first-class in the scene model.** Bindings go through named data keys (ADR-0010), so data sources can change without touching scenes.
- **World-building depth is welcome** (roads, bridges, terrain, gizmos), but it must stay approachable for non-technical users (ADR-0009).

Unchanged: where data comes from (static values now; providers later, ADR-0010) and whether AI helps build worlds (ADR-0012) are still open.

### Consequences

- Good: a clear tie-breaker for future features. Prefer the version that keeps worlds data-capable.
- Bad: some features take extra design work to leave room for data binding.
