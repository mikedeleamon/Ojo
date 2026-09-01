#!/usr/bin/env python3
"""
Regenerate assets/images/ojo_tripfit_tab_icon{,@2x,@3x}.png — the TripFit tab's
brand mark — from the geometry of TripFitIcon (src/components/icons/ClosetIcons.tsx).

Output is an iOS template image set: pure white, shape carried by the alpha
channel, 40/80/120px, matching ojo_home_tab_icon.png. iOS tints template images
with the tab bar's tintColor (the live weather accent), so the logo's
lime->green gradient is intentionally dropped — a template discards color.

Geometry below is transcribed from the SVG's 64x64 viewBox. If the logo's shapes
change in ClosetIcons.tsx, mirror the change here and re-run:

    python3 scripts/render-tripfit-tab-icon.py

Requires Pillow (pip install Pillow). Nothing at build time depends on this
script; it is a one-shot asset generator kept for reproducibility.
"""
import math
import os
from PIL import Image, ImageDraw

SCALE = 16                      # px per viewBox unit while rendering
CANVAS = 64 * SCALE
STROKE = 2.8                    # matches the SVG's strokeWidth
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "assets", "images", "ojo_tripfit_tab_icon")

u = lambda v: v * SCALE         # viewBox units -> render px


def arc_pts(cx, cy, r, a0, a1, n=48, flip_y=False):
    """Points along an arc; angles in degrees, y grows downward."""
    out = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        y = cy - r * math.sin(a) if flip_y else cy + r * math.sin(a)
        out.append((cx + r * math.cos(a), y))
    return out


def rounded_rect_outline(x, y, w, h, r):
    """Suitcase body: <Rect x=16 y=18 width=32 height=36 rx=4 /> as a closed path."""
    x2, y2 = x + w, y + h
    pts = [(x + r, y), (x2 - r, y)]
    pts += arc_pts(x2 - r, y + r, r, -90, 0)       # top-right
    pts += [(x2, y2 - r)]
    pts += arc_pts(x2 - r, y2 - r, r, 0, 90)       # bottom-right
    pts += [(x + r, y2)]
    pts += arc_pts(x + r, y2 - r, r, 90, 180)      # bottom-left
    pts += [(x, y + r)]
    pts += arc_pts(x + r, y + r, r, 180, 270)      # top-left
    pts.append((x + r, y))                         # close
    return pts


def plane_polygon():
    """The filled plane, with the SVG's translate(21.65 24.525) scale(0.9) applied."""
    pts = [(21, 16), (21, 14), (13, 9), (13, 3.5)]
    # a1.5 1.5 0 0 0 -3 0 — semicircular nose bulging up, center (11.5, 3.5)
    pts += arc_pts(11.5, 3.5, 1.5, 0, 180, n=32, flip_y=True)
    pts += [(10, 3.5), (10, 9), (2, 14), (2, 16), (10, 13.5), (10, 19),
            (8, 20.5), (8, 22), (11.5, 21), (15, 22), (15, 20.5),
            (13, 19), (13, 13.5)]
    return [(x * 0.9 + 21.65, y * 0.9 + 24.525) for x, y in pts]


img = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
W = int(round(u(STROKE)))
WHITE = (255, 255, 255, 255)

d.line([(u(x), u(y)) for x, y in rounded_rect_outline(16, 18, 32, 36, 4)],
       fill=WHITE, width=W, joint="curve")

# Handle: M26 18 v-4 h12 v4 — round caps/joins drawn explicitly.
handle = [(26, 18), (26, 14), (38, 14), (38, 18)]
d.line([(u(x), u(y)) for x, y in handle], fill=WHITE, width=W, joint="curve")
for x, y in handle:
    d.ellipse([u(x) - W / 2, u(y) - W / 2, u(x) + W / 2, u(y) + W / 2], fill=WHITE)

# Wheels: r=1.5 stroked at width W reads as a solid dot of radius 1.5 + W/2.
for cx, cy in ((24, 56), (40, 56)):
    rr = u(1.5) + W / 2
    d.ellipse([u(cx) - rr, u(cy) - rr, u(cx) + rr, u(cy) + rr], fill=WHITE)

d.polygon([(u(x), u(y)) for x, y in plane_polygon()], fill=WHITE)

# ── Normalize to the Home icon's box ─────────────────────────────────────────
# The raw SVG artwork is bottom-heavy inside its 64x64 viewBox (the wheels sit at
# y=56 of 64, the handle starts at y=14), so dropping it into the canvas as-is
# leaves ~6% bottom padding against ~17% on top. In the tab bar that reads as the
# glyph crowding its label. ojo_home_tab_icon.png fills 66% of its canvas and is
# centered, so crop to the ink, scale the long edge to match, and re-center.
FILL = 80 / 120                 # measured from ojo_home_tab_icon@3x.png

ink = img.crop(img.split()[3].getbbox())
target = CANVAS * FILL
factor = target / max(ink.size)
ink = ink.resize((max(1, round(ink.width * factor)),
                  max(1, round(ink.height * factor))), Image.LANCZOS)

icon = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 0))
icon.alpha_composite(ink, ((CANVAS - ink.width) // 2, (CANVAS - ink.height) // 2))

for px, suffix in ((40, ""), (80, "@2x"), (120, "@3x")):
    path = f"{OUT}{suffix}.png"
    icon.resize((px, px), Image.LANCZOS).save(path)
    print(f"wrote {os.path.relpath(path, REPO)} ({px}x{px})")
