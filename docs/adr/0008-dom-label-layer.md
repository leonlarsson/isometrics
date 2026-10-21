---
status: accepted
date: 2026-10-21
---

# 0008. Label cards are a DOM overlay positioned by a projector

## Context and problem statement

Data cards ("Orders packed 148") float above objects, joined by a dashed leader line. The first version used drei `<Html>`. That creates one React root per label, and those roots raced with React 19's commit phase ("Attempted to synchronously unmount a root while React was already rendering"), leaving some labels blank.

## Decision outcome

Labels are split in two:

- **3D side** (`src/render/EntityLabel.tsx`): pin dot, dashed leader line, and an empty anchor `group` at the card position, registered in `src/render/labelRegistry.ts`.
- **DOM side** (`src/ui/LabelLayer.tsx`): one normal React tree of cards in an absolutely positioned layer over the canvas. Each card registers its element.
- `src/render/LabelProjector.tsx` runs every frame: it projects each anchor to screen space and writes `transform` directly to the element. Moving vehicles' cards follow without re-rendering React.

### Consequences

- Good: one React tree, accessible buttons, normal CSS Modules styling. It also leaves room for label collision avoidance later, since all cards are in one layer.
- Bad: a small module-level registry couples the two sides; cards don't hide behind 3D geometry (no occlusion).
