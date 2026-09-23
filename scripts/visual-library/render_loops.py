#!/usr/bin/env python3
"""
render_loops.py — the Instagram-story loops: WeatherHUD's backdrop, rendered offline.

A port of the app's own backdrop, not an imitation. Every colour and number
comes from work/data/library.json, which export_data.ts produces by running the
app's gradientFor() and backdropLayersFor() and copying out
src/lib/weather/backdropSpec.ts. The drawing rules mirror the components they
came from, one function each:

    draw_rain     StormIconLightning — RainLayer (streak columns)
    flash_alpha   StormIconLightning — SheetFlash
    StarField     ClearNightIconMoon — StarField (sparkles, six twinkle phases)
    draw_shooting_star  ShootingStar     — one streak, at a fixed time per loop
    SunGlare      SunGlare           — corner glow and lens-flare ghosts
    draw_flakes   FlakeFall          — snow and ice pellets
    FogField      FogDrift           — drifting fog banks

If one of those components changes how it draws, change the matching function.

    python3 scripts/visual-library/render_loops.py --look snow --out /tmp/snow.mp4
    python3 scripts/visual-library/render_loops.py --look sky.clearNight --frames-only --out /tmp/stars   # no ffmpeg
"""
from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from vl_common import FPS, OUT_H, OUT_W, encode_frames, fail, load_library, to_rgb_image

SECONDS = 8.0
SS = 2  # supersampling for the particle layer, so thin streaks and small flakes are anti-aliased
FLASH_AT_S = (2.4,)  # SheetFlash strikes on a random 4.5–9 s gap; an 8 s loop gets one, at a fixed time


def hex_rgb(color: str) -> tuple[int, int, int]:
    h = color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def phase(t_ms: float, delay: float, duration: float) -> float:
    """A native loop's 0→1 progress at t, as if it had been running forever (steady state)."""
    return ((t_ms - delay) % duration) / duration


def sampled(p: float, values: list[float]) -> float:
    """Evaluate an RN interpolation sampled at len(values) evenly spaced points (linear between)."""
    xs = np.linspace(0.0, 1.0, len(values))
    return float(np.interp(p, xs, values))


class Canvas:
    """The story canvas in points, and the px scale the frame is drawn at."""

    def __init__(self, lib: dict):
        c = lib["canvas"]
        self.w = c["widthPt"]
        self.h = c["heightPt"]
        self.scale = OUT_W / self.w  # px per pt
        self.particle = hex_rgb(c["particleColor"])
        self.fog = hex_rgb(c["fogColor"])
        self.flash = hex_rgb(c["flashColor"])


def vertical_gradient(colors: list[str]) -> np.ndarray:
    """expo-linear-gradient's default: top to bottom, stops evenly spaced. Float, unrounded."""
    stops = np.linspace(0.0, 1.0, len(colors))
    rgb = np.array([hex_rgb(c) for c in colors], np.float32)
    t = np.linspace(0.0, 1.0, OUT_H, dtype=np.float32)
    column = np.stack([np.interp(t, stops, rgb[:, ch]) for ch in range(3)], axis=1)
    return np.ascontiguousarray(np.broadcast_to(column[:, None, :], (OUT_H, OUT_W, 3)))


# ── Rain (StormIconLightning / RainLayer) ────────────────────────────────────

def draw_rain(pen: ImageDraw.ImageDraw, cv: Canvas, lib: dict, variant: str, t_ms: float) -> None:
    rain = lib["spec"]["rain"]
    v = rain["variants"][variant]
    k = cv.scale * SS
    seg = cv.h / rain["dropsPerGroup"]
    sw = rain["streakWidth"]
    fill = (*cv.particle, round(255 * v["opacity"]))
    for g in v["groups"]:
        p = phase(t_ms, g["startDelay"], g["duration"])
        ty, tx = seg * p, rain["angle"] * seg * p
        for xf in g["xOffsets"]:
            x = xf * cv.w - sw / 2 + tx
            for i in range(-1, rain["dropsPerGroup"]):
                y = i * seg + ty
                pen.rounded_rectangle(
                    (x * k, y * k, (x + sw) * k, (y + v["streakHeight"]) * k),
                    radius=sw / 2 * k, fill=fill,
                )


def flash_alpha(lib: dict, t_ms: float) -> float:
    """SheetFlash's opacity at t: FLASH_CURVE over FLASH_MS, once per strike."""
    f = lib["spec"]["flash"]
    for at in FLASH_AT_S:
        p = (t_ms - at * 1000) / f["ms"]
        if 0 <= p <= 1:
            return float(np.interp(p, f["curve"]["inputRange"], f["curve"]["outputRange"]))
    return 0.0


# ── Snow and ice pellets (FlakeFall) ─────────────────────────────────────────

SWAY_STEPS = 12


def draw_flakes(pen: ImageDraw.ImageDraw, cv: Canvas, lib: dict, which: str, slant: float, t_ms: float) -> None:
    fl = lib["spec"]["flakes"]
    k = cv.scale * SS
    seg = cv.h / fl["perColumn"]
    for g in fl[which]:
        p = phase(t_ms, g["startDelay"], g["duration"])
        drift = [g["sway"] * math.sin(2 * math.pi * i / SWAY_STEPS) + slant * seg * i / SWAY_STEPS
                 for i in range(SWAY_STEPS + 1)]
        tx, ty = sampled(p, drift), seg * p
        alpha = round(255 * g["opacity"])
        for ci, xf in enumerate(g["xOffsets"]):
            ph = g["phases"][ci] if ci < len(g["phases"]) else 0
            for i in range(-1, fl["perColumn"]):
                y = (i + ph) * seg
                x = xf * cv.w + slant * (y - cv.h / 2)
                cx, cy = (x + tx) * k, (y + ty) * k
                if g["shape"] == "dot":
                    r = g["size"] / 2 * k
                    pen.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*cv.particle, alpha))
                else:
                    r, w = g["size"] / 2 * k, fl["stroke"] * k
                    for deg in (90, 30, 150):
                        a = math.radians(deg)
                        dx, dy = r * math.cos(a), r * math.sin(a)
                        pen.line((cx - dx, cy - dy, cx + dx, cy + dy), fill=(*cv.particle, alpha), width=max(1, round(w)))
                        for ex, ey in ((cx - dx, cy - dy), (cx + dx, cy + dy)):  # round caps
                            pen.ellipse((ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2), fill=(*cv.particle, alpha))


# ── Fog (FogDrift) ───────────────────────────────────────────────────────────

class FogField:
    """Each layer's alpha, two canvases wide and repeating every width, drifted left over its duration."""

    COPIES = (-2, -1, 0, 1, 2)

    def __init__(self, cv: Canvas, lib: dict):
        self.cv = cv
        self.layers = []
        w2 = OUT_W * 2
        ys = np.arange(OUT_H, dtype=np.float32)[:, None] + 0.5
        xs = np.arange(w2, dtype=np.float32)[None, :] + 0.5
        for spec in lib["spec"]["fog"]:
            keep = np.ones((OUT_H, w2), np.float32)  # product of (1 - band alpha): source-over of same-colour bands
            for b in spec["bands"]:
                rx, ry = b["wf"] * OUT_W / 2, b["hf"] * OUT_H / 2
                cy = b["yf"] * OUT_H
                for copy in self.COPIES:
                    cx = (b["xf"] + b["wf"] / 2 + copy) * OUT_W
                    r = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
                    keep *= 1 - b["opacity"] * np.clip(1 - r, 0, 1)  # radial fade: opacity at centre → 0 at edge
            self.layers.append((spec["duration"], 1 - keep))

    def alpha(self, t_ms: float) -> np.ndarray:
        total_keep = np.ones((OUT_H, OUT_W), np.float32)
        for duration, a in self.layers:
            x = OUT_W * ((t_ms % duration) / duration)
            x0, f = int(x), x - int(x)
            cols = (1 - f) * a[:, x0:x0 + OUT_W] + f * a[:, x0 + 1:x0 + 1 + OUT_W]
            total_keep *= 1 - cols
        return 1 - total_keep


# ── Stars (ClearNightIconMoon / StarField) ───────────────────────────────────

def sparkle_polygon(path: str) -> list[tuple[float, float]]:
    nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", path)]
    return list(zip(nums[0::2], nums[1::2]))


class StarField:
    """One pre-drawn layer per twinkle phase, plus one for the fixed stars; each frame scales their alpha."""

    def __init__(self, cv: Canvas, lib: dict):
        st = lib["spec"]["stars"]
        self.st = st
        shape = sparkle_polygon(st["sparklePath"])
        k = cv.scale * SS
        groups: dict[str, list] = {}

        def base_alpha(d: float) -> float:
            return 0.55 + 0.45 * (d - st["minD"]) / (st["maxD"] - st["minD"])

        # Near and far are separate StarField instances in WeatherHUD, each
        # round-robining its own pool: near → FAST phases, far → SLOW.
        counters = {"near": 0, "far": 0}
        for seed in st["seeds"]:
            near = seed["d"] >= st["nearMinD"]
            band = "near" if near else "far"
            pool = st["fastPhaseIndices"] if near else st["slowPhaseIndices"]
            idx = pool[counters[band] % len(pool)]
            counters[band] += 1
            groups.setdefault(f"{idx}:{band}", []).append(seed)
        groups["static"] = list(st["staticSeeds"])

        self.layers = []
        for key, seeds in groups.items():
            img = Image.new("RGBA", (OUT_W * SS, OUT_H * SS), (0, 0, 0, 0))
            pen = ImageDraw.Draw(img)
            for s in seeds:
                span = s["d"] * st["spanRatio"]
                left, top = s["xf"] * cv.w - span / 2, s["yf"] * cv.h - span / 2
                pts = [((left + px / 100 * span) * k, (top + py / 100 * span) * k) for px, py in shape]
                pen.polygon(pts, fill=(*cv.particle, round(255 * base_alpha(s["d"]))))
            layer = np.asarray(img.resize((OUT_W, OUT_H), Image.BOX), np.float32)
            if key == "static":
                self.layers.append((None, None, layer))
            else:
                idx, band = key.split(":")
                self.layers.append((int(idx), st["twinkleMinNear"] if band == "near" else st["twinkleMinFar"], layer))

    def composite(self, frame: np.ndarray, t_ms: float) -> None:
        for idx, lo, layer in self.layers:
            opacity = 1.0
            if idx is not None:
                ph = self.st["phases"][idx]
                p = phase(t_ms, ph["delay"], ph["duration"])
                # pingPong(1, lo): 12 samples of a cosine swing, as lib/animation/curves.
                opacity = sampled(p, [1 + (lo - 1) * (0.5 - 0.5 * math.cos(2 * math.pi * i / 12)) for i in range(13)])
            a = layer[..., 3:4] / 255 * opacity
            frame[...] = frame * (1 - a) + layer[..., :3] * a


# ── Shooting star (ShootingStar) ─────────────────────────────────────────────

def draw_shooting_star(pen: ImageDraw.ImageDraw, cv: Canvas, lib: dict, t_ms: float) -> bool:
    """The app picks a random spot and heading every 14–30 s; a loop gets the one in spec.story."""
    s = lib["spec"]["shootingStar"]
    story = s["story"]
    p = (t_ms - story["atMs"]) / s["ms"]
    if not 0 <= p <= 1:
        return False
    eased = 1 - (1 - p) ** 2  # Easing.out(Easing.quad)
    f = s["fade"]
    opacity = float(np.interp(eased, f["inputRange"], f["outputRange"])) * s["opacity"]
    if opacity <= 0:
        return False

    # The box is centred on (cx, cy) and rotated about its centre; the streak
    # slides along its local x axis from the box's left edge by travel·eased.
    rot = math.radians(180 - story["angleDeg"] if story["leftward"] else story["angleDeg"])
    ux, uy = math.cos(rot), math.sin(rot)
    cx, cy = story["xf"] * cv.w, story["yf"] * cv.h
    start = -(s["travel"] + s["tail"]) / 2 + s["travel"] * eased  # tail end, local x
    body = s["tail"] - s["head"] / 2
    k = cv.scale * SS

    def at(local_x: float) -> tuple[float, float]:
        return ((cx + ux * local_x) * k, (cy + uy * local_x) * k)

    # The gradient streak as short segments, transparent at the tail to full at the head.
    steps = 40
    for i in range(steps):
        a0, a1 = start + body * i / steps, start + body * (i + 1) / steps
        alpha = (i + 0.5) / steps * opacity
        pen.line([at(a0), at(a1)], fill=(*cv.particle, round(255 * alpha)), width=max(1, round(s["width"] * k)))
    hx, hy = at(start + body)
    r = s["head"] / 2 * k
    pen.ellipse([hx - r, hy - r, hx + r, hy + r], fill=(*cv.particle, round(255 * opacity)))
    return True


# ── Sun glare (SunGlare) ─────────────────────────────────────────────────────

class SunGlare:
    """The glow is pre-drawn once and breathes; the ghosts are redrawn each frame at their slid position."""

    def __init__(self, cv: Canvas, lib: dict):
        g = lib["spec"]["sunGlare"]
        self.g, self.cv = g, cv
        self.color = np.array(hex_rgb(g["color"]), np.float32)
        s = cv.scale
        self.sx, self.sy = g["source"]["xf"] * cv.w, g["source"]["yf"] * cv.h
        # Radial fade, as react-native-svg's RadialGradient: linear between stops by distance / radius.
        ys, xs = np.mgrid[0:OUT_H, 0:OUT_W].astype(np.float32)
        dist = np.hypot(xs / s - self.sx, ys / s - self.sy) / (g["glowRadiusF"] * cv.w)
        stops = g["glowStops"]
        self.glow = np.interp(dist, [st["offset"] for st in stops], [st["opacity"] for st in stops]).astype(np.float32)
        self.dx, self.dy = cv.w - 2 * self.sx, cv.h - 2 * self.sy
        n = math.hypot(self.dx, self.dy)
        self.ux, self.uy = self.dx / n, self.dy / n

    def composite(self, frame: np.ndarray, t_ms: float) -> np.ndarray:
        g = self.g
        p = phase(t_ms, 0, g["breatheMs"])
        swing = sampled(p, [0.5 - 0.5 * math.cos(2 * math.pi * i / 12) for i in range(13)])  # pingPong(0, 1)
        opacity = 1 + (g["breatheMin"] - 1) * swing
        a = (self.glow * opacity)[..., None]
        frame = frame * (1 - a) + self.color * a

        layer = Image.new("RGBA", (OUT_W * SS, OUT_H * SS), (0, 0, 0, 0))
        pen = ImageDraw.Draw(layer)
        k = self.cv.scale * SS
        off = g["drift"] * swing
        rgb = tuple(int(c) for c in self.color)
        for gh in g["ghosts"]:
            x = (self.sx + gh["t"] * self.dx + off * self.ux) * k
            y = (self.sy + gh["t"] * self.dy + off * self.uy) * k
            r = gh["d"] / 2 * k
            fill = (*rgb, round(255 * gh["opacity"]))
            if gh["shape"] == "ring":
                pen.ellipse([x - r, y - r, x + r, y + r], outline=fill, width=max(1, round(g["ringStroke"] * k)))
            else:
                pen.ellipse([x - r, y - r, x + r, y + r], fill=fill)
        p_arr = np.asarray(layer.resize((OUT_W, OUT_H), Image.BOX), np.float32)
        a = p_arr[..., 3:4] / 255
        return frame * (1 - a) + p_arr[..., :3] * a


# ── A look ───────────────────────────────────────────────────────────────────

class LookRenderer:
    def __init__(self, lib: dict, look: str):
        if look not in lib["looks"]:
            fail(f"Unknown look: {look}")
        self.lib = lib
        self.cv = Canvas(lib)
        entry = lib["looks"][look]
        self.layers = entry["layers"]
        self.base = vertical_gradient(entry["gradient"])
        self.stars = StarField(self.cv, lib) if self.layers["stars"] else None
        self.fog = FogField(self.cv, lib) if self.layers["fog"] else None
        self.glare = SunGlare(self.cv, lib) if self.layers.get("glare") else None
        self.angle = lib["spec"]["rain"]["angle"]

    def frame(self, f: int) -> Image.Image:
        return to_rgb_image(self.frame_rgb(f))

    def frame_rgb(self, f: int) -> np.ndarray:
        """Frame f as float RGB, before any rounding to 8 bits."""
        t = f * 1000 / FPS
        out = self.base.copy()
        if self.glare:
            out = self.glare.composite(out, t)
        if self.stars:
            self.stars.composite(out, t)
            streak = Image.new("RGBA", (OUT_W * SS, OUT_H * SS), (0, 0, 0, 0))
            if draw_shooting_star(ImageDraw.Draw(streak), self.cv, self.lib, t):
                p = np.asarray(streak.resize((OUT_W, OUT_H), Image.BOX), np.float32)
                a = p[..., 3:4] / 255
                out = out * (1 - a) + p[..., :3] * a
        if self.layers["rain"] or self.layers["flakes"]:
            particles = Image.new("RGBA", (OUT_W * SS, OUT_H * SS), (0, 0, 0, 0))
            pen = ImageDraw.Draw(particles)
            if self.layers["rain"]:
                draw_rain(pen, self.cv, self.lib, self.layers["rain"], t)
            if self.layers["flakes"] == "snow":
                draw_flakes(pen, self.cv, self.lib, "snow", 0.0, t)
            elif self.layers["flakes"] == "pellets":
                draw_flakes(pen, self.cv, self.lib, "pellets", self.angle, t)
            p = np.asarray(particles.resize((OUT_W, OUT_H), Image.BOX), np.float32)
            a = p[..., 3:4] / 255
            out = out * (1 - a) + p[..., :3] * a
        if self.fog:
            a = self.fog.alpha(t)[..., None]
            out = out * (1 - a) + np.array(self.cv.fog, np.float32) * a
        if self.layers["flash"]:
            a = flash_alpha(self.lib, t)
            if a:
                out = out * (1 - a) + np.array(self.cv.flash, np.float32) * a
        return out


def render_loop(lib: dict, look: str, out: Path, poster: Path | None = None,
                seconds: float = SECONDS, frames_only: bool = False) -> None:
    r = LookRenderer(lib, look)
    total = int(round(seconds * FPS))
    if poster:
        poster.parent.mkdir(parents=True, exist_ok=True)
        r.frame(0).save(poster, "JPEG", quality=88, optimize=True, progressive=True)
    if frames_only:
        out.mkdir(parents=True, exist_ok=True)
        picks = {0, total // 2} | {round(s * FPS) + 3 for s in FLASH_AT_S if r.layers["flash"]}
        if r.layers["stars"]:
            shot = lib["spec"]["shootingStar"]
            picks.add(round((shot["story"]["atMs"] + shot["ms"] * 0.3) * FPS / 1000))
        picks = sorted(picks)
        for f in picks:
            r.frame(f).save(out / f"{look}-{f:03d}.png")
        print(f"  {look}: wrote {len(picks)} frames to {out}")
        return
    encode_frames((r.frame_rgb(f) for f in range(total)), out)
    print(f"  {look}: {out} ({out.stat().st_size / 1024 / 1024:.2f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--look", required=True, help="a look from work/data/library.json, e.g. snow or sky.sunset")
    parser.add_argument("--out", type=Path, required=True, help="MP4 path, or a folder with --frames-only")
    parser.add_argument("--poster", type=Path, help="also write the first frame as a JPEG")
    parser.add_argument("--seconds", type=float, default=SECONDS)
    parser.add_argument("--frames-only", action="store_true", help="write a few PNG frames; no ffmpeg needed")
    args = parser.parse_args()
    render_loop(load_library(), args.look, args.out, poster=args.poster, seconds=args.seconds,
                frames_only=args.frames_only)


if __name__ == "__main__":
    main()
