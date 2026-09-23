#!/usr/bin/env python3
"""
build_dist.py — step 2: render every story loop the app can ask for.

    python3 scripts/visual-library/build_dist.py                      # every look, then the recap
    python3 scripts/visual-library/build_dist.py --looks snow,sky.sunset
    python3 scripts/visual-library/build_dist.py --only recap

Writes work/dist/loops/ and work/dist/index.json, which
publishVisualLibrary.ts uploads. Partial runs update index.json in place.

  loops/<look>.mp4          WeatherHUD's backdrop for that look, 8 s
  loops/<look>.poster.jpg   its first frame
  loops/recap.mp4 (+poster) the Weekly Recap gradient loop
"""
from __future__ import annotations

import argparse
import time

from render_loops import render_loop
from render_recap_loop import render_recap
from vl_common import DIST, DIST_INDEX, OUT_H, OUT_W, fail, find_ffmpeg, load_json, load_library, write_json


def entry(key: str) -> dict:
    return {"file": f"loops/{key}.mp4", "poster": f"loops/{key}.poster.jpg", "w": OUT_W, "h": OUT_H}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", choices=["looks", "recap"], help="build one part")
    parser.add_argument("--looks", help="comma-separated looks (default: all)")
    args = parser.parse_args()

    find_ffmpeg()  # fail before any work, not halfway through with index.json unwritten
    library = load_library()
    looks = [k.strip() for k in args.looks.split(",")] if args.looks else list(library["looks"])
    unknown = [k for k in looks if k not in library["looks"]]
    if unknown:
        fail(f"Unknown looks: {', '.join(unknown)}")

    index = load_json(DIST_INDEX) if DIST_INDEX.exists() else {"loops": {}}
    out = DIST / "loops"
    started = time.time()

    if args.only in (None, "looks"):
        print(f"Looks ({len(looks)}):")
        for look in looks:
            render_loop(library, look, out / f"{look}.mp4", poster=out / f"{look}.poster.jpg")
            index["loops"][look] = entry(look)
            write_json(DIST_INDEX, index)  # after each, so an interrupted run keeps what it finished
    if args.only in (None, "recap"):
        print("Recap:")
        render_recap(library["recap"], out / "recap.mp4", poster=out / "recap.poster.jpg")
        index["loops"]["recap"] = entry("recap")
        write_json(DIST_INDEX, index)

    print(f"Done in {(time.time() - started) / 60:.1f} min. Wrote {DIST_INDEX}.")
    print("Next: cd server && npx ts-node src/scripts/publishVisualLibrary.ts")


if __name__ == "__main__":
    main()
