---
status: proposed
date: 2026-10-31
---

# 0116. A welcome on the first visit, a guide, and building with your own AI

## Context and problem statement

Opening the app drops people into Brightwater in Edit mode, with panels full of settings and no word on what to do. Turning data into a world (reading it, deciding what each row becomes, sizing things, wiring cards) is the hardest part, and the kind of work an AI does well. ADR-0012 planned AI generation, and `/schema.json` (ADR-0032) and `/templates.json` (ADR-0034) exist for it, but nothing in the app leads there.

## Decision drivers

- Someone arriving should know within a glance what they can do, and start in one click.
- No AI provider of our own: no keys, no costs, no proxies for one provider. People bring the AI they already use.
- What they want, in their own words, should drive the world, not a form.
- One explanation of how a world is made, for people and for the AIs they ask, that can't drift apart.
- Never discard user data (ADR-0020): an AI's world mustn't overwrite one without a way back.

## Considered options

1. Call an AI from the app (a key on our server, or the user's key in the browser).
2. **Copy a prompt, paste the answer**: the app writes a prompt for any AI chat and reads back the world it writes.
3. Only documentation, no flow in the app.

## Decision outcome

Chosen option: **2**, because it works with any AI, costs and stores nothing, and keeps people in charge of what's sent where.

- **The welcome** (`ui/Welcome.tsx`, `editor/welcome.ts`): shown once to a browser that has never kept a world, three ways in with pictures of the starters: **Build a city** (New world on the places, **Uses data** off, ADR-0115), **Show my data** (Build with your AI) and **Explore an example** (New world on the data maps). **Look around first** closes it. File → **Welcome…** shows it again. End-to-end tests skip it unless they `test.use({ welcomes: true })`.
- **Build with your AI** (a File submenu, **A new world…** and **Change this world…**, and the welcome; `ui/BuildWithAiDialog.tsx`, `editor/aiPrompt.ts`): a new world or a change to this one. First they **describe it** (how it looks, what it has; the prompt can't be copied until they have), then add data if it shows data (pasted cells, CSV or JSON, or a file), copy the prompt, and paste back the answer. The prompt quotes their words, carries their data (cut past 60,000 characters, saying so) or the world to change, the guide's rules and format, every part kind with its props and colours, the road, area and fence kinds, a small example world (tested to open with no repairs) and the site's addresses for more. The answer's JSON is found among any words around it and read with `readWorld()`; a new world opens next to the others (`startNewWorld`), a change replaces the world in one undo step. Nothing is sent anywhere by the app.
- **The guide** (`guide/guide.ts`): the pieces of a world, a walkthrough with the Battlefield Stats API (read `/outputs/counts` as a table, place one for each row, or give your own objects their rows by name, read `/users/count` as a value, look at it in View), building with your own AI, what makes a good data world, and the format for AIs. One text, shown at `/guide`, served as Markdown at `/guide.md`, and quoted by the prompt.

### Consequences

- Good: works with every AI chat, today's and tomorrow's; no keys, accounts or costs; people see the whole prompt.
- Good: the guide is the one place that says how worlds are made; the walkthrough uses a real, open API, so people can follow it step by step.
- Bad: copy and paste is a step more than a button that builds the world; big worlds or data can be too long for some chats (data is cut, saying so).
- Bad: the guide names the app's labels in words; renaming a label means updating it (`grep` the guide with the label, AGENTS.md's consistent wording).

## More information

ADR-0012 (AI generation), ADR-0032 (`/schema.json`), ADR-0034 (templates as worlds), ADR-0026 and ADR-0104 (`readWorld`), ADR-0044 (new worlds open next to the others), ADR-0115 (a world without data).
