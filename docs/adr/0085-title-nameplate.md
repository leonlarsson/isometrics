---
status: accepted
date: 2026-10-27
---

# 0085. The world's title on a nameplate

## Context and problem statement

The world's title, subtitle and time sat straight on the stage, in the theme's text colours, and the light theme's title turned light on a night sky (ADR-0052). What's behind them varies: the day's sky over the theme's background, the sky dome in perspective, a backdrop of the world's own (ADR-0070), or the world itself. Mid-tones (dusk, golden hour) left the subtitle hard to read in both themes, and a golden sky in the dark theme put light text on a light sky (owner, 2026-10-27).

## Decision drivers

- The title reads at every hour, in both themes, on any backdrop and over the world.
- It looks like the rest of the view's UI (the label cards).

## Considered options

1. **Pick the text's colour from what's behind it:** work out the colour in the top-left corner (backdrop, dome, or the sky over the theme's background), choose dark or light text by contrast, and add a glow behind it. On a mid-tone no colour of text reaches 4.5:1 (3.7:1 at dusk in the light theme), it's a guess where the world or clouds show through, and the glow is visible as a smudge.
2. **A nameplate:** the title on a card like the label cards (raised surface, border, card shadow), in the theme's own colours.

## Decision outcome

Chosen option: **2**, because it reads everywhere without guessing what's behind it, and matches the label cards. It replaces ADR-0052's light title on a night sky.

### Consequences

- Good: the same contrast as the editor's panels, whatever the sky, backdrop or world; less code.
- Bad: a card over the world's corner rather than bare text; a world that wants bare text would need a setting for it (not built).

## More information

`ui/AppShell.module.css` (`.sceneTitle`), `ui/AppShell.tsx` (`SceneTitle`). The stage's sky colour and weight moved to `dioramaSkyAt` in `scene/sky.ts`.
