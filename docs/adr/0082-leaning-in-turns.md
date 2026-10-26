---
status: proposed
date: 2026-10-26
---

# 0082. Vehicles lean in turns, as far as their kind does

## Context and problem statement

Vehicles on a route turn by their heading only, upright like toys on a rail. A boat leans into a turn, a car's body rolls a little out of it, a plane banks hard. The owner asked for boats to lean into turns first, the same way reusable for planes and helicopters later, as a setting next to how vehicles take corners (2026-10-26).

## Decision drivers

- How much and which way belongs to the kind of vehicle; whether it does belongs to the world, a road or a vehicle, like the turn style (ADR-0017).
- Worked out from the route, like the wake (ADR-0081): nothing to remember.

## Decision outcome

- A part says how it leans (`turnLean`: degrees per unit of sideways acceleration, negative out of the turn, and at most how far). The yacht leans into turns, 8° per unit, at most 10°; cars don't for now (the owner wasn't sure how much they should).
- The lean is the sideways pull, the speed² × how sharply the route bends over the vehicle's length round where it is (`turnLeanDegrees` in `scene/routes.ts`), eased in and out (`EntityNode`), and none while motion is paused. It turns about the vehicle's own length: the rotation order is heading, then the slope's pitch, then the lean (Euler `YZX`, which is the same as before while the lean is 0).
- A setting at three levels, like **Vehicles turn**: the world's **Lean in turns** (`leansInTurns`, on by default; Traffic tab), a road's and a vehicle's (null = the road's, else the world's; From scene / From road and Reset). Only vehicles whose kind leans show the vehicle's switch: unlike an option waiting on something the user can add (AGENTS.md: don't hide what isn't available yet), nothing in a car's settings could make it lean.

### Consequences

- Good: boats read as moving through water; planes and helicopters get banking by declaring it.
- Bad: old worlds' boats start leaning (on by default; Lantern Bay's ferry by a few degrees in its corners); a vehicle leans about its base, not its centre of mass.
- Later: cars rolling out of turns if wanted; planes and helicopters (ADR-0018's route heights), with a helicopter's nose dipping as it speeds up.

## More information

Code: `src/scene/routes.ts` (`turnLeanDegrees`), `src/scene/roads.ts` (`resolveLeansInTurns`), `src/scene/schema.ts`, `src/parts/types.ts` (`turnLean`), `src/parts/vehicles/yacht_01.tsx`, `src/render/EntityNode.tsx`, `src/ui/WorldTabs.tsx`, `src/ui/RoadInspector.tsx`, `src/ui/EntityInspector.tsx`. Related: ADR-0017, ADR-0042, ADR-0081.
