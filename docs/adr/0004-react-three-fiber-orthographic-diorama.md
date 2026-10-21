---
status: accepted
date: 2026-10-21
---

# 0004. React Three Fiber with an orthographic "diorama" camera

## Context and problem statement

The target look is a low-poly isometric diorama: soft lighting, gentle shadows, a fixed-ish viewing angle, cards floating above objects.

## Considered options

1. three.js + `@react-three/fiber` + `@react-three/drei`
2. Raw three.js
3. Babylon.js / PlayCanvas

## Decision outcome

Chosen option: **R3F + drei**, because the scene maps naturally to React components driven by the store, and drei gives us RoundedBox, Line, Grid and OrbitControls.

Camera and controls:

- Orthographic camera kept far away (`CAMERA_DISTANCE`) along a fixed isometric direction. `src/render/CameraRig.tsx` computes the zoom from the ground's projected corners on resize, on ground resize and on "re-centre".
- **We don't use drei `<Bounds>`**: it moves an orthographic camera very close to the scene, which made drei `<Html>` hide labels as "behind the camera".
- OrbitControls with limited polar angle and zoom ("iso + limited orbit"), so users can look around but can't break the view.
- Shadows use PCF (`shadows="percentage"`); PCFSoft was removed in three r18x.

### Consequences

- Good: consistent, forgiving view for non-technical users; resolution-independent framing.
- Bad: perspective-only effects (depth of field, fog) are out unless we revisit.
