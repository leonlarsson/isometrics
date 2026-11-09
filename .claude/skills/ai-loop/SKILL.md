---
name: ai-loop
description: Test and improve Build with AI end to end, the way a person uses it, in rounds. Isolated agents write requests, a Playwright harness copies the real prompt from the dialog, other isolated agents answer it as outside AIs, the answers are pasted back and pictured, then the prompt, guide, validate or dialog are fixed and the same requests run again; then the same for changing a world. Ends with a report artifact of the requests, prompts and worlds in pictures. Use when asked to test, evaluate or improve the AI flow, the prompt Build with AI copies, the guide's section for AIs, /api/worlds/validate, or patches.
---

# The AI loop

Build with AI (ADR-0116) hands a long prompt to an AI the app never sees, and reads back whatever comes. Unit tests can't tell whether that prompt teaches an AI enough. This loop does: it runs the flow exactly as a person would, with AIs that know nothing but the prompt, looks at the worlds that come back, and fixes what went wrong, round after round.

The first run (2026-11-09) found 41 issues in round 1's worlds that validate didn't report, and fixed ten things (commits `2d844f4`, `4deaf66`, `d3b7976`). Its report is at https://claude.ai/artifact/7HsT17zcqJscEqrzQ94epv: read it once (`Artifact` action `read`) to see what a finished run looks like.

## What's in this folder

| File | What it is |
|---|---|
| `harness.spec.ts.template` | The Playwright harness. Copy it to `e2e/ai-loop.spec.ts` for the run; delete it before committing. Kept as `.template` because `tsc` checks every `.ts` in the repo and its imports only resolve from `e2e/`. |
| `run-job.sh` | Runs one harness job: `run-job.sh <absolute path to job.json>`. |
| `pictures.mjs` | Crops the screenshots' bars and writes JPEGs for the report. |
| `report/template.html`, `report/build-example.py` | The report's page and the builder from the first run, to copy and adapt. |

## Setup

1. **A run folder** in your scratchpad, e.g. `<scratchpad>/loop/`. Everything a run makes goes there (prompts, answers, pictures), never in the repo. Below, `$RUN` is its absolute path.
2. **The dev server.** Use the owner's on :3000 if it answers (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`); never kill or restart it. If nothing answers, start `pnpm dev` in the background yourself, and say at the end that it's still running.
3. **The harness:** `cp .claude/skills/ai-loop/harness.spec.ts.template e2e/ai-loop.spec.ts`.
4. **Chromium's libraries.** On a bare WSL machine Playwright's Chromium fails with `libnspr4.so: cannot open shared object file`. Without sudo: `mkdir -p $RUN/libs/debs && cd $RUN/libs/debs && apt-get download libnspr4 libnss3 libasound2t64 && for f in *.deb; do dpkg -x $f $RUN/libs/root; done`, then `export CHROMIUM_LIBS=$RUN/libs/root/usr/lib/x86_64-linux-gnu` for `run-job.sh`.
5. **Smoke test:** a `new-prompt` job (below) with any description. It should pass in about 15 seconds and write a prompt of 30 KB or more.

## The jobs

Each job is a JSON file; paths inside it are absolute. `run-job.sh` changes into the repo, so relative paths break.

```json
{ "kind": "new-prompt", "description": "…", "data": "csv or empty", "out": "$RUN/r1/<id>/prompt.md" }
{ "kind": "open", "answer": "$RUN/r1/<id>/world.json", "outDir": "$RUN/r1/<id>/opened" }
{ "kind": "change-prompt", "world": "$RUN/r2/<id>/world.json", "description": "…", "select": "<entity id, optional>", "out": "$RUN/c1/<id>/prompt.md" }
{ "kind": "change-open", "world": "$RUN/r2/<id>/world.json", "patch": "$RUN/c1/<id>/patch.json", "outDir": "$RUN/c1/<id>/opened" }
```

- `new-prompt` fills **What should your AI build?** (and **Add your data**), clicks **Copy the prompt** and saves the clipboard. That clipboard text is the prompt; never build it yourself from `aiPrompt()`.
- `open` pastes into **What your AI wrote** under **A new world** (with a world open, the dialog starts on Change), saves the dialog's check (`dialog-check.txt`), clicks **Open it**, and takes pictures in View mode of the opening view and up to five viewpoints, plus `opened-world.json`.
- `change-prompt` opens the world, selects `select` if given, opens **Change this world…**, saves what the dialog says (`prompt.md.dialog.txt`, where the selection hint shows) and copies the prompt.
- `change-open` opens the world, pastes the patch under **Change “…”**, saves the check, clicks **Apply the changes** and takes the pictures.

An answer pasted back is the AI's whole reply, words and all, as a person would paste it. When the AI handed over a file instead (the prompt asks for `world.json` when it can make files), open that file. To get the JSON alone for validate: the first fenced block, or the whole text.

## The agents: isolation is the point

Every agent starts fresh and is told exactly what it may touch. An agent that reads the repo, the schema files or another agent's work isn't testing the prompt. Spawn the agents of one step in parallel (one message, several `Agent` calls). Keep the same capability mix across rounds so rounds compare.

### 1. The request writer (once per run)

No tools at all. It gets only what a visitor knows from the home page:

> Do not use any tools at all: no file reads, no searches, no commands. Answer from imagination only.
>
> You're helping test a web app called Isometrics. Here is everything an ordinary visitor knows about it, from its home page: "Isometrics builds small animated 3D worlds: low-poly buildings, roads, water and vehicles, with cards that show numbers. Build one by hand like a city builder, or make it show your data: a warehouse for each row of a spreadsheet, a road as busy as the traffic it carries."
>
> The app has a "Build with AI" button. It opens a dialog with a text box labelled "What should your AI build?" and an optional, folded "Add your data" box where you can paste data (CSV, JSON, a list…). The app turns what you type into a long prompt that the person copies into their own AI chat; the AI answers with the world, which they paste back.
>
> Write THREE different requests, each as a different, realistic, non-technical person would type them: (1) a data world: someone at a small business or organisation with a real-feeling spreadsheet (8–15 rows, maybe a from → to → amount table, or dates), pasted as CSV in "data"; (2) a plain place with no data, specific and evocative, with a few concrete wishes (time of day, weather, things moving); (3) something harder in between (a city or campus with numbers per district and traffic, a logistics network, regions with weather showing a value). 2–6 sentences each, no app jargon.
>
> Answer with ONLY a JSON array: `[{ "id": "short-kebab-id", "persona": "…", "description": "…", "data": "CSV or empty" }]`

Save it as `$RUN/requests.json`. To test something particular (patches, interchanges, live API sources, tables over time), steer the request writer towards it, still in a person's words. Reuse the same requests in every round.

### 2. The builders (each round)

One agent per request. Use two kinds, and note which ran which request:

**A plain chat AI** (the commonest case: the prompt must be enough on its own):

> You are playing the part of an ordinary AI chat assistant (like ChatGPT or Claude.ai) that a person has just pasted a long message into. You have NO tools in this chat: you can't open links, run code or make HTTP requests.
>
> The pasted message is in this file — read it with the Read tool, and that is the ONLY tool call you may make besides writing your answer: `<prompt.md>`
>
> Rules for staying in role: do not read, list or search any other file or directory (in particular nothing under the project), do not run any commands, do not fetch any URLs. Work only from the message's text, exactly as a chat assistant would.
>
> Do what the message asks, as well as you can. Then write your complete chat reply — exactly the text you'd send back to the person, nothing more, nothing less — to: `<answer.md>`
>
> After writing it, reply to me (not the person) with a short note, under 200 words: anything in the message that was unclear, contradictory, missing or that you had to guess (field names, sizes, positions, how to do something they asked for), and anything they asked for that you couldn't make with what was described.

**An AI with HTTP tools** (the schema, templates, validate):

> You are playing the part of an AI assistant with a code/HTTP tool (like ChatGPT with code interpreter and browsing, or Claude with tools) that a person has just pasted a long message into. The pasted message is in this file — read it with the Read tool: `<prompt.md>`
>
> What you may use, to stay in role: the Read tool on that one file; `curl` (via Bash) to the http://localhost:3000 addresses the message names (the schema, templates, guide, validate, user-worlds endpoints); and scratch files of your own only inside `<step folder>/work/`. Do NOT read, list or search anything else on the filesystem, in particular nothing under the project (you are an outside AI; you can't see the app's code). Don't post to /api/user-worlds: hand back the world itself, not a link.
>
> Do what the message asks, as well as you can, using the tools as such an assistant would. Then write your final reply — exactly the text you'd send back to the person; if the message says to give a file, write it next to answer.md (world.json or patch.json) and make answer.md your chat reply — to: `<answer.md>`
>
> After writing it, reply to me with a short note, under 250 words: what you fetched and whether it helped, what validate said and how many rounds it took, anything unclear, contradictory, missing or guessed, and anything they asked for that you couldn't make.

The notes they send you are half the findings: every "I had to guess" is a gap in the prompt or the format.

### 3. The change-request writer (after a good round)

It sees only the pictures, as the person would. Give it each world's persona, what they asked for, and two to four picture paths, and allow the Read tool on those images only:

> Look at the pictures and write, as each person, ONE change request as they'd really type it (2–5 sentences, plain words, no app jargon): react to what they see — fix what bothers them, and add one or two things. Make the requests exercise different kinds of change: moving or removing specific things, adding things in a particular place, changing the time, weather or look, changing data (a new row with its numbers, a corrected number), recolouring. Don't ask to start over. Answer with ONLY a JSON array: `[{ "id": "…", "request": "…" }]`

Save it as `$RUN/change-requests.json`. Then `change-prompt` jobs, then builders as above (their answer is a patch). When a request points at something ("that box by the church"), run it a second time with the thing selected (`select`) and the request saying so, to test that the selection reaches the AI.

## Looking at what came back

For every answer, in this order:

1. **The dialog's check** (`dialog-check.txt`): opened as "Ready to open", with problems, or not at all.
2. **validate**: `curl -s -X POST -H 'content-type: application/json' --data @world.json http://localhost:3000/api/worlds/validate`; for a patch, POST `{ "world": …, "patch": … }`. Count problems and warnings, and read each.
3. **What the AI wrote around the JSON**, and its note to you.
4. **The pictures** (Read the PNGs). Look for what the person asked for and didn't get: the time of day, the weather, things on the ground or floating or buried, things drawn far too big or small (a prop out of range falls back to its default), cards covering the world, units that read wrong, data shown or not.
5. **The opened world vs what was written** (`opened-world.json` against `world.json`): a field that vanished was dropped on opening. If validate didn't say so, that's a validate gap.

Keep a list of findings per step: what worked, what went wrong, the cause, and whether the cause is the prompt, the guide, validate, the dialog, the app, or the AI's own judgement.

## Fixing, then running again

Fix by cause. Most fixes go in one of these places:

| Cause | Where |
|---|---|
| The AI guessed a field name, a format, a unit, a meaning | The guide's "For AIs: the world format" section (`src/guide/guide.ts`; it goes into every prompt and `/guide.md`), or the field's `.describe()` in `src/scene/schema.ts` (what `/api/worlds/schema` shows) |
| What to answer with, how to handle data or missing parts | `src/editor/aiPrompt.ts` (`WORLD_ANSWER`, `PATCH_ANSWER`, the data section, `EXAMPLE_WORLD`) |
| A mistake opened without a word | `src/parts/validateWorld.ts` (problems: what opening repairs or leaves out; warnings: what opens but won't look as meant), with a test in `validateWorld.test.ts` |
| The person couldn't say what they meant | The dialog, `src/ui/BuildWithAiDialog.tsx`, and the guide's walkthrough of it |
| What a patch did, said badly | `describePatchChanges` in `src/scene/worldPatch.ts` |
| Something the app can't do (a missing part, a setting that doesn't exist) | Not a prompt fix: put it under open questions for the owner, or TODO.md if agreed |

Rules that hold while fixing:

- Follow AGENTS.md as for any change: names that say what they hold, the guide by its labels, one wording everywhere, every template still validating with **no warnings** (`validateWorld.test.ts` checks), old worlds opening.
- A new validate warning must not fire on the templates. If it does, the threshold is wrong, not the templates (the buried-object check allows 0.75 into a slope because Stockholm's buildings sit a little into theirs).
- Don't overfit to one world: the guide teaches the format, not this alpine village.
- After the fixes, re-copy the prompts (the guide changed) and run new builders on the **same requests**. Then compare rounds: validate's count on each round's worlds, using the new validate for both, and the pictures side by side.

Stop when a round comes back clean, or when what's left is in the app rather than the prompt. Two or three rounds is typical.

## Checks before reporting

`pnpm check && pnpm typecheck && pnpm test`, and the end-to-end specs for what changed: `pnpm e2e e2e/onboarding.spec.ts e2e/sharing.spec.ts` for the dialog (with `LD_LIBRARY_PATH=$CHROMIUM_LIBS` if needed). Add a unit test for each new validate warning, and an e2e test for a dialog change.

## The report

A report artifact for the owner (the `Artifact` tool: a `quickstart` with intent `other`, then a plain page). What made the first one clear, after a version that wasn't:

- **Terms first.** *Request* (what the person typed), *prompt* (what the app copied), *AI*, *result*. "Prompt" otherwise means two things.
- **An overview table:** a row per world, a column per kind of step (new world: first prompt; new world: improved prompt; follow-up change; follow-up with the thing selected). Each cell shows how the step went, as a status with a shape as well as a colour, and links to the step. A step that wasn't run says **Not run**.
- **Every step has the same labelled parts, in the same order:** step number, a New world / Change tag, how it went, **What the person typed** (verbatim, including the follow-up requests), **Answered by**, **What it built** (pictures; click for full size), **What worked**, **What went wrong**, **Fixed after this step** (links to numbered fixes). Folded away under it: the full copied prompt, and what the AI said after its JSON.
- Bullets, not paragraphs. Short, plain sentences.
- Then **the fixes**, numbered, each with its files; then **questions for the owner**, each pointing at the step that showed it.
- Pictures: `node .claude/skills/ai-loop/pictures.mjs $RUN/report/img <name>=<png> …`, published with the page through `files`. Click-to-enlarge (a `<dialog>` lightbox with Previous / Next and Esc) is in `report/template.html`.

Copy `report/template.html` and `report/build-example.py` into the run folder, keep their structure and helpers, and replace the content with this run's.

## Wrapping up

- Delete `e2e/ai-loop.spec.ts`; never commit it or anything from the run folder.
- Don't commit or push without the owner's go-ahead. When they say yes: commit as them, no AI lines, one commit per kind of fix (validate; the prompt and guide; the dialog), each with a one-line message.
- Say whether the dev server you started is still running.
