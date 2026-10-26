"""Render lab: side-by-side comparison sheets of screenshots (docs/rendering-study).

    python3 scripts/render-lab/grid.py out.png <columns> <name> [name…]

Names are files in scripts/render-lab/shots/ without .png; each is labelled in its corner.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out, columns, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
shots = Path(__file__).parent / "shots"
width, height = 640, 358
font = ImageFont.load_default(size=18)
rows = (len(names) + columns - 1) // columns
sheet = Image.new("RGB", (width * columns, height * rows), "white")
for i, name in enumerate(names):
    picture = Image.open(shots / f"{name}.png").convert("RGB").resize((width, height))
    draw = ImageDraw.Draw(picture)
    draw.rectangle([0, 0, 8 + 10 * len(name), 26], fill=(0, 0, 0))
    draw.text((5, 3), name, fill="white", font=font)
    sheet.paste(picture, ((i % columns) * width, (i // columns) * height))
sheet.save(out)
