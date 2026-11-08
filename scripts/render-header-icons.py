#!/usr/bin/env python3
"""
Regenerate the Home nav-bar button glyphs used on the iPhone Duo:

    assets/images/ojo_header_location{,@2x,@3x}.png  <- LocationsIcon (map pin)
    assets/images/ojo_header_settings{,@2x,@3x}.png  <- GearIcon
    assets/images/ojo_header_close{,@2x,@3x}.png     <- CloseIcon (paywall)

On the Duo, Home's Location and Settings buttons are native nav-bar items
(Stack.Toolbar), which iOS places in the side column next to the tab rail. Native
items take images, not React views, so these are the app's own pin and gear drawn
as iOS template images: pure white, shape in the alpha channel, 22/44/66 px. iOS
tints them with the toolbar's tintColor. On a regular iPhone the original SVG
components still render, so the two must stay identical: if the paths in
src/components/icons/LocationsIcon.tsx or GearIcon.tsx change, copy them here
and re-run:

    python3 scripts/render-header-icons.py

Requires Pillow. Nothing at build time depends on this script; it is a one-shot
asset generator kept for reproducibility, like render-tripfit-tab-icon.py.
"""
import math
import os
import re
from PIL import Image, ImageDraw

VIEWBOX = 24.0       # both icons use viewBox 0 0 24 24
STROKE = 1.5         # strokeWidth in both components
BASE_PX = 22         # the components' default size, in points
SUPERSAMPLE = 16
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO, "assets", "images")

# Transcribed from the components. Each icon: list of ("path", d) / ("circle", cx, cy, r).
ICONS = {
    "ojo_header_close": [
        ("path", "M18 6L6 18M6 6l12 12"),
    ],
    "ojo_header_location": [
        ("path", "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"),
        ("circle", 12, 10, 3),
    ],
    "ojo_header_settings": [
        ("circle", 12, 12, 3),
        ("path",
         "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 "
         "1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06"
         "a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09"
         "A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68"
         "a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06"
         "a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09"
         "a1.65 1.65 0 0 0-1.51 1z"),
    ],
}

TOKEN = re.compile(r"[MmLlHhVvCcSsQqAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def arc_points(x1, y1, rx, ry, phi_deg, large, sweep, x2, y2, steps=24):
    """SVG elliptical arc -> points (SVG spec, appendix F.6.5)."""
    if rx == 0 or ry == 0:
        return [(x2, y2)]
    phi = math.radians(phi_deg)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = (x1p ** 2) / (rx ** 2) + (y1p ** 2) / (ry ** 2)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    coef = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        coef = -coef
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    pts = []
    for i in range(1, steps + 1):
        t = t1 + dt * i / steps
        x = cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp
        y = cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp
        pts.append((x, y))
    return pts


def cubic_points(p0, p1, p2, p3, steps=20):
    pts = []
    for i in range(1, steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def flatten(d):
    """Path data -> list of (points, closed) subpaths in viewBox units."""
    toks = TOKEN.findall(d)
    i, cmd = 0, None
    x = y = sx = sy = 0.0
    last_ctrl = None
    subpaths, cur = [], []

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]):
            cmd = toks[i]
            i += 1
        rel = cmd.islower()
        c = cmd.upper()
        if c == "Z":
            if cur:
                subpaths.append((cur, True))
            cur, x, y, last_ctrl = [], sx, sy, None
            continue
        if c == "M":
            nx, ny = num(), num()
            if rel:
                nx, ny = x + nx, y + ny
            if cur:
                subpaths.append((cur, False))
            x, y, sx, sy = nx, ny, nx, ny
            cur = [(x, y)]
            cmd = "l" if rel else "L"   # implicit lineto after moveto
            last_ctrl = None
        elif c == "L":
            nx, ny = num(), num()
            if rel:
                nx, ny = x + nx, y + ny
            x, y = nx, ny
            cur.append((x, y))
            last_ctrl = None
        elif c == "H":
            nx = num()
            x = x + nx if rel else nx
            cur.append((x, y))
            last_ctrl = None
        elif c == "V":
            ny = num()
            y = y + ny if rel else ny
            cur.append((x, y))
            last_ctrl = None
        elif c in ("C", "S"):
            if c == "C":
                x1, y1 = num(), num()
                if rel:
                    x1, y1 = x + x1, y + y1
            else:
                x1, y1 = (2 * x - last_ctrl[0], 2 * y - last_ctrl[1]) if last_ctrl else (x, y)
            x2, y2, nx, ny = num(), num(), num(), num()
            if rel:
                x2, y2, nx, ny = x + x2, y + y2, x + nx, y + ny
            cur.extend(cubic_points((x, y), (x1, y1), (x2, y2), (nx, ny)))
            last_ctrl = (x2, y2)
            x, y = nx, ny
        elif c == "A":
            rx, ry, rot, large, sweep, nx, ny = num(), num(), num(), num(), num(), num(), num()
            if rel:
                nx, ny = x + nx, y + ny
            cur.extend(arc_points(x, y, rx, ry, rot, int(large), int(sweep), nx, ny))
            x, y = nx, ny
            last_ctrl = None
        else:
            raise ValueError(f"unsupported command {cmd}")
    if cur:
        subpaths.append((cur, False))
    return subpaths


def render(shapes, px):
    size = px * SUPERSAMPLE
    k = size / VIEWBOX
    w = max(1, round(STROKE * k))
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    def dot(p):
        r = w / 2
        draw.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=255)

    for shape in shapes:
        if shape[0] == "circle":
            _, cx, cy, r = shape
            ro, ri = (r + STROKE / 2) * k, (r - STROKE / 2) * k
            draw.ellipse((cx * k - ro, cy * k - ro, cx * k + ro, cy * k + ro), fill=255)
            draw.ellipse((cx * k - ri, cy * k - ri, cx * k + ri, cy * k + ri), fill=0)
            continue
        for pts, closed in flatten(shape[1]):
            scaled = [(px_ * k, py_ * k) for px_, py_ in pts]
            if closed:
                scaled.append(scaled[0])
            draw.line(scaled, fill=255, width=w, joint="curve")
            for p in scaled:          # round joins and caps
                dot(p)
    mask = mask.resize((px, px), Image.LANCZOS)
    out = Image.new("RGBA", (px, px), (255, 255, 255, 0))
    out.putalpha(mask)
    return out


def main():
    for name, shapes in ICONS.items():
        for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
            px = BASE_PX * scale
            path = os.path.join(OUT_DIR, f"{name}{suffix}.png")
            render(shapes, px).save(path)
            print(f"wrote {os.path.relpath(path, REPO)} ({px}x{px})")


if __name__ == "__main__":
    main()
