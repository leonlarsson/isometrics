---
status: proposed
date: 2026-10-28
---

# 0099. Label cards slide under the side panels

## Context and problem statement

Cards keep clear of everything outside the 3D canvas (ADR-0048), and the canvas ends where a side panel starts. So cards near that edge stepped inwards when a panel opened or widened, as if they were avoiding the panels, while the world itself just slides under them.

## Decision drivers

- Opening a panel shouldn't rearrange the cards.
- Cards and the world they label should behave alike at the edges.

## Considered options

1. **Cards over the panels:** the label layer drawn above them, outside the canvas: cards would cover the panels' controls.
2. **Cards slide under the panels:** the canvas's sides are no longer obstacles; the label layer clips cards at the canvas's edge, as the world is.
3. **As it was:** cards step inwards.

## Decision outcome

Chosen option: **2** (the owner, 2026-10-28). This changes one point of ADR-0048: of what's outside the canvas, only above and below it are obstacles now (the toolbar's side and the window's bottom). The UI over the canvas (the title, the floating bars, sheets) still is.

### Consequences

- Good: opening or widening a panel leaves the cards where they were; a card near the edge is cut off by the panel like the world under it.
- Bad: a card can be partly hidden at the sides, where before it moved to stay whole; panning brings it back.
