"""
The AI loop report, laid out step by step: typed → copied prompt → built → wrong → fixed.

An EXAMPLE from the first run (2026-11-09): its steps, findings and fixes are that run's. Copy it
to the run folder, keep the helpers (step, status, fig, cell, the overview table) and replace the
world sections and the overview rows with this run's. Reads <run>/requests.json,
<run>/change-requests.json and each step's prompt.md and answer.md; writes <out>/index.html from
<out>/template2.html (report/template.html, copied there, with its fixes and open questions replaced).

    python3 build.py <run-folder> <out-folder>
"""
import html
import json
import re
import sys

L = sys.argv[1]
OUT = sys.argv[2]
esc = html.escape


def read(path):
    with open(f"{L}/{path}") as f:
        return f.read()


def note_after(path):
    text = read(path)
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    return text[m.end():].strip() if m else text.strip()


def inline(text):
    out = esc(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", out)


def md(text):
    out, items = [], []
    for line in text.split("\n"):
        line = line.rstrip()
        if line.startswith("- "):
            items.append(f"<li>{inline(line[2:])}</li>")
            continue
        if items:
            out.append("<ul>" + "".join(items) + "</ul>")
            items = []
        if line:
            out.append(f"<p>{inline(line)}</p>")
    if items:
        out.append("<ul>" + "".join(items) + "</ul>")
    return "".join(out)


requests = {r["id"]: r for r in json.loads(read("requests.json"))}
changes = {r["id"]: r for r in json.loads(read("change-requests.json"))}

STATUS = {"good": "good", "warn": "warn", "bad": "bad"}


def status(kind, text):
    return f'<span class="status status-{kind}"><span class="mark" aria-hidden="true"></span>{esc(text)}</span>'


def fig(name, caption):
    return (
        f'<figure><button type="button" class="zoom" data-full="img/{name}.jpg" aria-label="Show full size: {esc(caption)}">'
        f'<img src="img/{name}.jpg" alt="{esc(caption)}" loading="lazy" width="1600" height="879"></button>'
        f"<figcaption>{esc(caption)}</figcaption></figure>"
    )


def bullets(items):
    return "<ul>" + "".join(f"<li>{item}</li>" for item in items) + "</ul>"


def fixes_ref(ids):
    return " ".join(f'<a class="fix-ref" href="#fix-{i}">Fix {i}</a>' for i in ids)


def step(
    anchor, number, kind, title, typed, typed_note, data, answered_by, state, figures,
    worked, wrong, fixed, prompt_path, note=None,
):
    rows = [
        f'<article class="step" id="{anchor}">',
        f'<header class="step-head"><span class="step-no">Step {number}</span>'
        f'<span class="kind kind-{kind}">{"New world" if kind == "new" else "Change"}</span>'
        f"<h4>{esc(title)}</h4>{state}</header>",
        '<div class="step-grid">',
        '<div class="field"><p class="label">What the person typed</p>'
        f"<blockquote>{esc(typed)}</blockquote>"
        f'{f"<p class=small>{typed_note}</p>" if typed_note else ""}{data}</div>',
        f'<div class="field wide"><p class="label">Answered by</p><p>{esc(answered_by)}</p></div>',
        f'<div class="field wide"><p class="label">What it built</p><div class="figs">{"".join(fig(n, c) for n, c in figures)}</div></div>',
        f'<div class="field"><p class="label">What worked</p>{bullets(worked)}</div>',
        f'<div class="field"><p class="label">What went wrong</p>{bullets(wrong)}</div>',
        f'<div class="field wide"><p class="label">Fixed after this step</p><p>{fixed}</p></div>',
        "</div>",
        '<div class="extras">',
    ]
    if note:
        rows.append(
            f'<details class="note"><summary>What the AI said to the person, after its JSON</summary><div class="note-body">{md(note)}</div></details>'
        )
    text = read(prompt_path)
    rows.append(
        f'<details class="prompt"><summary>The full prompt the app copied <span class="size">'
        f"{round(len(text.encode()) / 1024)} KB: the request above, plus the guide, every part and an example"
        f'{", and the whole world" if kind == "change" else ""}</span></summary><pre>{esc(text)}</pre></details>'
    )
    rows.append("</div></article>")
    return "".join(rows)


def data_block(rid):
    data = requests[rid]["data"]
    if not data:
        return ""
    rows = data.strip().split("\n")
    return f'<details class="data"><summary>…and pasted their data: {len(rows) - 1} rows</summary><pre>{esc(data)}</pre></details>'


CHAT = "A plain chat AI: no tools, only the prompt"
TOOLS = "An AI with HTTP tools: it could read the format online and check its answer with validate"
FROM_PICTURES = "Written by a separate agent that had seen only the pictures of the world above."

alpine_r = requests["alpine-village-dusk"]
alpine_c = changes["alpine-village-dusk"]["request"]
alpine_c2 = alpine_c.replace(
    "And please take away that plain brown box standing in the street by the church, it looks like a crate someone forgot.",
    "And please take away this plain brown box by the church (I've selected it), it looks like a crate someone forgot.",
)

alpine = "".join([
    step(
        "alpine-1", 1, "new", "First prompt", alpine_r["description"], esc(alpine_r["persona"]), "",
        CHAT, status("bad", "Opened as “Ready to open”, but 36 hidden issues"),
        [("alpine-r1-overview", "Daylight, and a flat block for a hill"), ("alpine-r1-lift", "The chairlift cable drawn as a thick beam")],
        ["Snow falls, a church with a spire, chalets, a station, a train, skaters."],
        [
            "Daylight, not dusk. The AI wrote <code>lighting.timeOfDay</code>, which isn’t a field. The app dropped it without saying so.",
            "The hill is a flat-topped block.",
            "The chairlift cable is a thick black beam: 0.04 wide is under the shapes’ 0.05 minimum, so it was drawn at the default, 1.",
            "The top station is buried inside the hill.",
            "The pale blue frozen pond can’t be seen against the snow.",
        ],
        fixes_ref([1, 2, 3, 4, 7]), "r1/alpine-village-dusk/prompt.md",
    ),
    step(
        "alpine-2", 2, "new", "Same request, improved prompt", alpine_r["description"], "The same words as step 1.", "",
        CHAT, status("good", "0 problems, 0 warnings"),
        [("alpine-r2-overview", "Dusk, lamps lit along the main street"), ("alpine-r2-lift", "The chairlift climbs a sloped hill")],
        [
            "A real time of day, snow lying on the roofs, the right ground colour.",
            "A hill with a peak; the chairlift towers stand on the slope.",
            "Street lamps lit, the train’s headlights on.",
            "It said what it built from shapes (train, chairlift, skaters).",
        ],
        ["It set the clock running so the lamps would visibly come on, and the dusk turned to night within a minute (the picture says 20:51)."],
        fixes_ref([7]) + " (what a running clock does)", "r2/alpine-village-dusk/prompt.md",
        note_after("r2/alpine-village-dusk/answer.md"),
    ),
    step(
        "alpine-3", 3, "change", "Follow-up: change the world", alpine_c, FROM_PICTURES, "",
        CHAT, status("warn", "Applied, with 10 warnings"),
        [("alpine-c1-overview", "Pink dusk, held at 19:36"), ("alpine-c1-lift", "The valley station is gone; pines half buried")],
        ["Dusk held at 19:36 with a pink glow.", "A redder train, skiers and more pines."],
        [
            "It removed the wrong “brown box”. The AI reads the world as JSON and can’t see it, so it guessed, and removed the chairlift’s valley station.",
            "10 of the 12 new pines are sunk into the hill: it can’t work out the hill’s height at a spot.",
            "The answer had no room for a note, so it couldn’t say it was unsure.",
        ],
        fixes_ref([8, 9, 10]), "c1/alpine-village-dusk/prompt.md",
    ),
    step(
        "alpine-4", 4, "change", "Same follow-up, with the box selected", alpine_c2,
        "The person selected the box first. The prompt now lists what’s selected (Fix 9).", "",
        CHAT, status("good", "0 problems, 0 warnings"),
        [("alpine-c2-overview", "The selected thing, the bakery, removed"), ("alpine-c2-lift", "Skiers and firs standing on the slope")],
        [
            "It removed what was selected: the bakery, which looked like a plain box at dusk.",
            "The chairlift was left alone.",
            "Trees and skiers stand on the slope.",
            "Its note says the selection didn’t look like a box, and to undo if that was wrong.",
        ],
        ["Nothing seen."],
        "Nothing needed.", "c2/alpine-village-dusk/prompt.md", note_after("c2/alpine-village-dusk/answer.md"),
    ),
])

food_r = requests["food-bank-deliveries"]
food = "".join([
    step(
        "food-1", 1, "new", "First prompt", food_r["description"], esc(food_r["persona"]), data_block("food-bank-deliveries"),
        CHAT, status("warn", "Opened, 1 hidden issue"),
        [("food-r1-overview", "A road from the warehouse to each pantry"), ("food-r1-warehouse", "The warehouse yard and its vans")],
        ["A road to each pantry, more vans where there are more deliveries.", "A card per pantry with families fed; totals along the bottom.", "Churches, a school, and a mosque built from shapes."],
        ["The tile reads “2,750kg”: a unit that’s a word needs a space before it.", "Ten full-size cards cover the roads and vans."],
        fixes_ref([5, 7]), "r1/food-bank-deliveries/prompt.md",
    ),
    step(
        "food-2", 2, "new", "Same request, improved prompt", food_r["description"], "The same words and data as step 1.", "",
        CHAT, status("good", "0 problems, 0 warnings"),
        [("food-r2-overview", "“2,750 kg”, textured grass"), ("food-r2-warehouse", "The warehouse and its routes")],
        ["Units spaced, a textured grass ground, the same clear layout."],
        ["The cards still crowd the middle: this prompt didn’t yet suggest showing many cards as chips."],
        fixes_ref([7]) + " (cards as chips, added after this step)", "r2/food-bank-deliveries/prompt.md",
        note_after("r2/food-bank-deliveries/answer.md"),
    ),
    step(
        "food-3", 3, "change", "Follow-up: change the world", changes["food-bank-deliveries"]["request"], FROM_PICTURES, "",
        TOOLS, status("warn", "Applied cleanly, but with a trade-off"),
        [("food-c1-overview", "Maple Grove added; green roof and vans"), ("food-c1-warehouse", "The green vans are now fixed objects")],
        ["41 and 72 corrected; total families now 1,222.", "Maple Grove added bottom-left, with its card and road.", "The warehouse roof is green."],
        [
            "Vans on a data road can’t be recoloured. To make them green, the AI switched off every data road’s vans and placed 26 fixed green vans: the van counts no longer follow the data.",
            "The answer had no room for a note, so it couldn’t tell the person about that.",
        ],
        fixes_ref([8]) + ". The van colours are an open question below.", "c1/food-bank-deliveries/prompt.md",
    ),
])

campus_r = requests["campus-energy-and-shuttles"]
campus = "".join([
    step(
        "campus-1", 1, "new", "First prompt", campus_r["description"], esc(campus_r["persona"]), data_block("campus-energy-and-shuttles"),
        TOOLS, status("warn", "Opened, 4 hidden issues"),
        [("campus-r1-overview", "Cards reading “103.4KkWh”"), ("campus-r1-carpark", "The stadium car park")],
        ["Buildings coloured by electricity used.", "A ring road with a shuttle, a full car park by the stadium.", "The library in the middle by the lake."],
        [
            "Cards read “103.4KkWh”. The format told AIs to write units like <code>\"km/h\"</code>, with no space.",
            "Solar panels sit inside the library’s roof.",
            "It took dozens of validate calls to find roof heights: the warning didn’t say how tall anything is.",
        ],
        fixes_ref([5, 6]), "r1/campus-energy-and-shuttles/prompt.md",
    ),
    step(
        "campus-2", 2, "new", "Same request, improved prompt", campus_r["description"], "The same words and data as step 1.", "",
        TOOLS, status("good", "0 problems, 0 warnings"),
        [("campus-r2-overview", "“103.4K kWh”, morning light"), ("campus-r2-carpark", "The car park and stadium")],
        ["Units spaced; set at 8:30 for the morning jam.", "Electricity shown three ways: colour, a bar beside each building, a card."],
        ["It still took about 40 validate calls to find roof heights (Fix 6 came after this step)."],
        fixes_ref([6]), "r2/campus-energy-and-shuttles/prompt.md",
        note_after("r2/campus-energy-and-shuttles/answer.md"),
    ),
])


def cell(anchor, kind, text):
    if not anchor:
        return f'<td class="none">{esc(text)}</td>'
    return f'<td><a href="#{anchor}">{status(kind, text)}</a></td>'


overview = (
    '<div class="table-wrap"><table class="overview"><thead><tr><th scope="col">World</th>'
    '<th scope="col">New world:<br>first prompt</th><th scope="col">New world:<br>improved prompt</th>'
    '<th scope="col">Follow-up change</th><th scope="col">Follow-up,<br>thing selected</th></tr></thead><tbody>'
    '<tr><th scope="row"><a href="#alpine">Alpine village</a></th>'
    + cell("alpine-1", "bad", "36 issues")
    + cell("alpine-2", "good", "Clean")
    + cell("alpine-3", "warn", "Wrong thing removed")
    + cell("alpine-4", "good", "Clean")
    + '</tr><tr><th scope="row"><a href="#food">Food bank</a></th>'
    + cell("food-1", "warn", "1 issue")
    + cell("food-2", "good", "Clean")
    + cell("food-3", "warn", "Vans stopped following data")
    + cell(None, "", "Not run")
    + '</tr><tr><th scope="row"><a href="#campus">Campus energy</a></th>'
    + cell("campus-1", "warn", "4 issues")
    + cell("campus-2", "good", "Clean")
    + cell(None, "", "Not run")
    + cell(None, "", "Not run")
    + "</tr></tbody></table></div>"
)

page = open(f"{OUT}/template2.html").read()
page = (
    page.replace("{{OVERVIEW}}", overview)
    .replace("{{ALPINE}}", alpine)
    .replace("{{FOOD}}", food)
    .replace("{{CAMPUS}}", campus)
)
with open(f"{OUT}/index.html", "w") as f:
    f.write(page)
print(len(page.encode()) // 1024, "KB")
