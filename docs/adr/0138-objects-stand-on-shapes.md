---
status: proposed
date: 2026-11-04
---

# 0138. Objects stand on the tops of shapes, and a bottom handle lifts the base

## Context and problem statement

Shapes (ADR-0124) are for building things out of several, side by side and on top of each other, but things only stood on the ground and raised land (ADR-0098): a box dropped or dragged onto another sank into it and had to be lifted by hand, to the exact height. And a shape's size handles grew it from its base only; to raise its bottom under a top that stays (a beam under a roof, a shelf), it took a lift and a resize.

## Decision drivers

- Stacking just works, the way standing on raised land does: drop or drag onto a shape, it lands on its top under the pointer, and moving it keeps how high above that it was.
- One general idea of "what things stand on", not a case for shapes in each tool (the move tools, the drop, paste, group moves, the altitude's default).
- No cost per frame, and a change costs what it touches (PERFORMANCE.md).
- What `altitude` means doesn't change (ADR-0104): stacking is how the editor places things, nothing new is saved.

## Considered options

1. **Tops as ground:** what things stand on is a list of tops over the ground, the raised areas' and those of objects whose part says how high its top is at each point; every place that put things on the ground asks it instead.
2. **Raycasting the drawn meshes:** exact for any part, but only in the 3D view (the store, paste and the inspector have no meshes), and it would stand things on trees and roofs.
3. **Snapping to the box of any object:** simple, but a car dragged across a city would climb every house and tree in its way, and a pyramid's top would be flat.

## Decision outcome

Chosen option: **1**.

- **What stands on what:** a part can say how high its top is at a point of its own space (`topHeightAt`, at scale 1, null where nothing stands on it). Every shape has one, worked out from its props (`parts/shapes/shapeTops.ts`): flat for a box, a panel or an arch; up the side for cones, pyramids and wedges; round for balls and domes; the band of a ring; the treads of stairs; nothing in a hollow box's or cylinder's opening or past an arc. Shipping containers have one too, so they stack. Other parts don't (a tree, a pitched roof): nothing stands on them unless lifted by hand.
- **Tops** (`scene/standing.ts`): a raised area or an object is an `ITop`, its box on the ground, its highest altitude and its altitude at a point. `parts/standing.ts` makes them for a world's objects (turned and scaled as the object is; a tipped one by its box as it's turned), each worked out once per object as it is and the list once per list of objects, so a change only works out what it touched. Hidden objects and vehicles following a road aren't stood on.
- **The pointer** (`surfaceHitOnRay`): the ray is walked over each top it passes above, from where it comes over its box, and the nearest crossing wins; the base ground is where nothing is. So the drop from Add to scene, dragging, the gizmo's square and G with no axis land on a shape's top where the pointer is over it, or on its edge where the pointer is on its side, as on a cliff. Roads, fences and painting keep to the ground (painting keeps off objects anyway, ADR-0091).
- **Moving keeps the height above what it stands on** (ADR-0098, `altitudeMovedTo`): a thing moved freely is as high above what it stands on where it goes as it was where it stood. What moves is never what it stands on: the object itself, a group's members (so a stack moved together stays a stack). Where it is now, only tops at or below its base count, so a copy left in its place (Ctrl+drag, Shift+D) or a shape it was sunk into isn't what it stands on; a group's copy (Ctrl+drag) also leaves out the originals exactly where its members are, so a copied stack stays one.
- **The same everywhere it stood on the ground:** a new object without a height of its own, paste at a spot (a stack pasted stays one), group moves, the free lift with G, and the altitude's default in the properties ("on what's under it").
- **The bottom handle** (`render/SizeHandles.tsx`): parts sized along their height get a handle under their base too, standing further off than the others, below the transform gizmo that stands on the base: dragging it moves the base, the top staying where it is (the height changes by the distance, and the altitude the other way). One undo step per drag, Esc cancels, none while data sizes it, as for the other handles.
- A thing dragged across a shape climbs onto it while its middle is over it; a Ctrl+drag copy of a shape rides on the one left behind until it's past its edge, which is a quick way to stack copies.

### Consequences

- Good: building with shapes is building: stack, drag, copy and paste stacks without typing heights.
- Good: any part can be stood on by saying where its top is, with nothing in the tools.
- Bad: moving or resizing what something stands on leaves it where it was, floating or sunk (as reshaping raised land does, ADR-0098): move them together, or lift it.
- Bad: tops follow an object's own settings, not sizes that follow data (ADR-0109), and round shapes are taken as smooth, not by their facets.
- Later: things standing on a shape riding with it when it moves alone; tops for buildings with flat roofs; the bottom handle snapping the base onto what's under it.

## More information

`src/scene/standing.ts`, `src/parts/standing.ts`, `src/parts/shapes/shapeTops.ts`, `src/parts/types.ts` (`topHeightAt`), `src/render/useGroundDrag.ts` (`surfaceHitOnRay`), `src/render/SizeHandles.tsx`. Tests: `src/parts/standing.test.ts`, `src/parts/shapes/shapeTops.test.ts`, `src/render/useGroundDrag.test.ts`, `src/editor/groupTransform.test.ts`, `src/editor/clipboard.test.ts`, `e2e/shapes.spec.ts`. Related: ADR-0091, ADR-0097, ADR-0098, ADR-0104, ADR-0109, ADR-0124.
