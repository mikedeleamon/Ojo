"""
vl_common.py — paths and helpers shared by the visual-library scripts.
See README.md for the pipeline. Requires numpy and Pillow.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
# $VL_WORK points every step at another work folder — for trying the pipeline
# on throwaway data without touching real output.
WORK = Path(os.environ["VL_WORK"]).resolve() if os.environ.get("VL_WORK") else ROOT / "work"
DATA_FILE = WORK / "data" / "library.json"
DIST = WORK / "dist"
DIST_INDEX = DIST / "index.json"

# Instagram Story size, which is also what share cards export at.
OUT_W, OUT_H = 1080, 1920
FPS = 30

# Instagram re-encodes anyway. These keep an 8 s loop to about 1 MB. Input is
# already yuv420p (see encode_frames), so ffmpeg does no color conversion, and
# the tags say which matrix it was built with.
X264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-crf", "20", "-maxrate", "3500k", "-bufsize", "7000k",
        "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv",
        "-movflags", "+faststart", "-an"]
# Declares what to_yuv420 produces. Without it ffmpeg treats the raw input as
# untagged and "converts" it to BT.709, shifting every color by several levels.
YUV_IN = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]

# Fixed dither patterns, the same on every frame so they never flicker:
# triangular noise of ±1 level. Without them a gradient rounded to 8 bits shows
# as stripes, worst on the dark night and cloudy skies and the sunset hues.
_rng = np.random.default_rng(0)


def _tpdf(*shape: int) -> np.ndarray:
    return (_rng.random(shape) - _rng.random(shape)).astype(np.float32)


# For stills (posters, --frames-only PNGs): one pattern shared by R, G and B,
# so it adds no color speckle.
DITHER = _tpdf(OUT_H, OUT_W, 1)
# For video: one per Y, Cb and Cr plane. ffmpeg's own RGB → YUV conversion
# rounds dithered RGB back into bands, so encode_frames converts in float and
# dithers each plane itself.
_DITHER_Y = _tpdf(OUT_H, OUT_W)
_DITHER_CB = _tpdf(OUT_H // 2, OUT_W // 2)
_DITHER_CR = _tpdf(OUT_H // 2, OUT_W // 2)

# BT.709, limited range — what the X264 tags declare.
_KR, _KB = 0.2126, 0.0722
_KG = 1 - _KR - _KB


def to_rgb_image(rgb: np.ndarray) -> Image.Image:
    """A float 0–255 frame → dithered 8-bit RGB, for stills."""
    return Image.fromarray(np.clip(rgb + DITHER + 0.5, 0, 255).astype(np.uint8), "RGB")


def to_yuv420(rgb: np.ndarray) -> bytes:
    """A float 0–255 RGB frame → dithered 8-bit yuv420p planes, for video."""
    r, g, b = (rgb[..., i] * (1 / 255) for i in range(3))
    y = _KR * r + _KG * g + _KB * b
    # Chroma is averaged over each 2×2 block before rounding, as 4:2:0 stores it.
    half = lambda p: p.reshape(OUT_H // 2, 2, OUT_W // 2, 2).mean(axis=(1, 3))
    cb = half((b - y) / (2 * (1 - _KB)))
    cr = half((r - y) / (2 * (1 - _KR)))
    q = lambda p, d: np.clip(p + d + 0.5, 0, 255).astype(np.uint8).tobytes()
    return q(16 + 219 * y, _DITHER_Y) + q(128 + 224 * cb, _DITHER_CB) + q(128 + 224 * cr, _DITHER_CR)


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def load_library() -> dict:
    """The app's own definitions, exported by export_data.ts."""
    if not DATA_FILE.exists():
        fail(f"Missing {DATA_FILE} — run `npx tsx scripts/visual-library/export_data.ts` first.")
    return load_json(DATA_FILE)


def find_ffmpeg() -> str:
    """ffmpeg from $FFMPEG or PATH. Homebrew's build includes libx264."""
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not exe:
        fail("ffmpeg not found. Install it with `brew install ffmpeg`, or point $FFMPEG at a binary.")
    return exe


def encode_frames(frames: Iterable[np.ndarray], out: Path) -> None:
    """Pipe OUT_W×OUT_H float RGB frames to ffmpeg as dithered yuv420p → H.264 MP4, no audio."""
    out.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [find_ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "yuv420p", *YUV_IN,
         "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "-", *X264, str(out)],
        stdin=subprocess.PIPE,
    )
    assert proc.stdin is not None
    try:
        for frame in frames:
            proc.stdin.write(to_yuv420(frame))
    finally:
        proc.stdin.close()
    if proc.wait() != 0:
        fail(f"ffmpeg failed rendering {out}")
