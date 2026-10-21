---
status: proposed
date: 2026-10-21
---

# 0012. AI scene generation: deferred, designed for

## Context and problem statement

AI is a possible way in for non-technical users ("describe your business" → scene), but whether and how to use it is undecided.

## Decision outcome

Not built yet. The architecture already supports it:

- AI output would be a scene document (or a patch to one) and must pass `parseScene()` (ADR-0003). The part registry (kinds, prop schemas, descriptions) can be serialised into the prompt or tool schema.
- Calls must go through a Worker endpoint (ADR-0002) so API keys never reach the browser.
- If built with Claude, use structured output / tool use against the Zod-derived JSON schema.

Accept this ADR, or write a replacement, when the feature is started.
