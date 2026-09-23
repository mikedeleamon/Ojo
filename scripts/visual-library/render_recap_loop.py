#!/usr/bin/env python3
"""
render_recap_loop.py — the Weekly Recap's Instagram loop: the recap page's
cycling weather gradients under its ink scrim, rendered from the app's own
colors, geometry, timing and easing (work/data/library.json, which
export_data.ts reads out of src/lib/recapVisuals.ts).

With the app's timing, one step is a 2.5 s hold and an 8 s crossfade, so the
default single step (brand gradient → the next in the cycle) runs 10.5 s.

    python3 scripts/visual-library/render_recap_loop.py --out /tmp/recap.mp4
    python3 scripts/visual-library/render_recap_loop.py --frames-only --out /tmp/recap   # no ffmpeg
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
from PIL import Image

from vl_common import FPS, OUT_H, OUT_W, encode_frames, fail, load_library, to_rgb_image


def parse_color(css: str) -> tuple[np.ndarray, float]:
    """#rgb, #rrggbb, #rrggbbaa, rgb(…) or rgba(…) → (rgb float array, alpha)."""
    css = css.strip()
    if css.startswith("#"):
        hex_ = css[1:]
        if len(hex_) in (3, 4):
            hex_ = "".join(ch * 2 for ch in hex_)
        rgb = np.array([int(hex_[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
        return rgb, (int(hex_[6:8], 16) / 255 if len(hex_) == 8 else 1.0)
    m = re.fullmatch(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)", css)
    if not m:
        fail(f"Unrecognized color: {css}")
    return np.array([float(m[1]), float(m[2]), float(m[3])], np.float32), float(m[4]) if m[4] else 1.0


def linear_gradient(colors: list[str], start: dict, end: dict) -> np.ndarray:
    """
    An expo-linear-gradient as iOS draws it: start/end in the view's unit
    square, stops evenly spaced, and the gradient computed in that unit space
    (CAGradientLayer), so on a tall view the color bands tilt with the aspect.
    """
    u = (np.arange(OUT_W, dtype=np.float32)[None, :] + 0.5) / OUT_W
    v = (np.arange(OUT_H, dtype=np.float32)[:, None] + 0.5) / OUT_H
    dx, dy = end["x"] - start["x"], end["y"] - start["y"]
    t = np.clip(((u - start["x"]) * dx + (v - start["y"]) * dy) / (dx * dx + dy * dy), 0.0, 1.0)
    stops = np.linspace(0.0, 1.0, len(colors))
    rgb = np.stack([parse_color(c)[0] for c in colors])
    out = np.empty((OUT_H, OUT_W, 3), np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(t, stops, rgb[:, ch])
    return out


def cubic_bezier(x1: float, y1: float, x2: float, y2: float):
    """The same curve as RN's Easing.bezier: solve x(u) = x by bisection, return y(u)."""
    def x_at(u: float) -> float:
        return 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u ** 2 * x2 + u ** 3

    def y_at(u: float) -> float:
        return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3

    def ease(x: float) -> float:
        lo, hi = 0.0, 1.0
        for _ in range(40):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if x_at(mid) < x else (lo, mid)
        return y_at((lo + hi) / 2)

    return ease


def render_recap(recap: dict, out: Path, poster: Path | None = None, transitions: int = 1,
                 scrim: bool = True, frames_only: bool = False) -> None:
    cycle = recap["cycle"]
    if transitions < 1 or transitions >= len(cycle):
        fail(f"--transitions must be between 1 and {len(cycle) - 1}")

    scrim_rgb, scrim_alpha = parse_color(recap["scrim"]) if scrim else (np.zeros(3, np.float32), 0.0)
    gradients = [linear_gradient(c, recap["start"], recap["end"]) * (1 - scrim_alpha) + scrim_rgb * scrim_alpha
                 for c in cycle[:transitions + 1]]
    ease = cubic_bezier(*recap["easing"])
    hold = round(recap["holdMs"] / 1000 * FPS)
    fade = round(recap["fadeMs"] / 1000 * FPS)

    def frame_rgb(i: int) -> np.ndarray:
        step, k = divmod(i, hold + fade)
        a = gradients[step]
        if k < hold:
            rgb = a
        else:
            t = ease((k - hold) / max(1, fade - 1))
            rgb = a + (gradients[step + 1] - a) * t
        return rgb

    def frame(i: int) -> Image.Image:
        return to_rgb_image(frame_rgb(i))

    total = transitions * (hold + fade)
    if poster:
        poster.parent.mkdir(parents=True, exist_ok=True)
        frame(0).save(poster, "JPEG", quality=90, optimize=True, progressive=True)

    if frames_only:
        out.mkdir(parents=True, exist_ok=True)
        picks = [0, hold, hold + fade // 2, total - 1]
        for i in picks:
            frame(i).save(out / f"recap-{i:03d}.png")
        print(f"  recap: wrote {len(picks)} frames to {out}")
        return

    encode_frames((frame_rgb(i) for i in range(total)), out)
    print(f"  recap: {out} ({total / FPS:.1f} s, {out.stat().st_size / 1024 / 1024:.1f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="MP4 path, or a folder with --frames-only")
    parser.add_argument("--poster", type=Path, help="also write the first frame as a JPEG")
    parser.add_argument("--transitions", type=int, default=1, help="how many crossfades of the cycle to include")
    parser.add_argument("--no-scrim", action="store_true", help="skip the page's ink scrim")
    parser.add_argument("--frames-only", action="store_true", help="write a few PNG frames; no ffmpeg needed")
    args = parser.parse_args()
    render_recap(load_library()["recap"], args.out, poster=args.poster, transitions=args.transitions,
                 scrim=not args.no_scrim, frames_only=args.frames_only)


if __name__ == "__main__":
    main()
