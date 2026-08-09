"""Downscale Portalmon artwork to the sizes the game actually displays.

The Area ships badge and portrait PNGs authored at 700-1500px that render into
boxes of roughly 47-100 device pixels. The extra pixels cost download bytes on
every visitor and main-thread decode time when an overlay opens, and they buy
no visible quality.

Measured display sizes (Chrome, devicePixelRatio 1.125, .gba-shell zoom 1.5):

    badge medallion      47x47      -> BADGE budget
    gym card portrait    75x102     -> PORTRAIT budget
    battle trainer art   ~135x200   -> BATTLE budget
    bench portrait       47x47      -> PORTRAIT budget covers it
    creature battle art  135x68 box -> CREATURE budget

Budgets below are the longest edge, already doubled for high-DPI displays.

Dry run (default) prints what would change and saves nothing:

    python scripts/optimize-images.py

Apply the resize in place:

    python scripts/optimize-images.py --apply

Originals are copied alongside as <name>.orig.png unless --no-backup is passed.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
IMAGE_ROOT = REPO_ROOT / "Areas" / "Portalmon" / "Content" / "Images"

# Longest-edge budget per directory, in pixels, at 2x the measured display size.
BUDGETS: dict[str, int] = {
    "Badges": 160,
    "Trainers": 320,
    "Portalmon": 256,
    "Overworld": 0,  # tilesets and the town background are sampled 1:1 - never resize
}


def budget_for(path: Path) -> int:
    for part in path.relative_to(IMAGE_ROOT).parts:
        if part in BUDGETS:
            return BUDGETS[part]
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write the resized files")
    parser.add_argument("--no-backup", action="store_true", help="skip the .orig.png copies")
    args = parser.parse_args()

    saved = 0
    total = 0
    for path in sorted(IMAGE_ROOT.rglob("*.png")):
        if path.name.endswith(".orig.png"):
            continue
        budget = budget_for(path)
        if budget <= 0:
            continue

        with Image.open(path) as image:
            width, height = image.size
            longest = max(width, height)
            before = path.stat().st_size
            total += before
            if longest <= budget:
                continue

            scale = budget / longest
            new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
            print(f"{path.relative_to(REPO_ROOT)}: {width}x{height} -> {new_size[0]}x{new_size[1]}"
                  f"  ({before // 1024} KB)")
            if not args.apply:
                continue

            resized = image.convert("RGBA").resize(new_size, Image.Resampling.LANCZOS)

        if not args.no_backup:
            backup = path.with_suffix(".orig.png")
            if not backup.exists():
                shutil.copy2(path, backup)
        resized.save(path, format="PNG", optimize=True)
        saved += before - path.stat().st_size

    if args.apply:
        print(f"\nReclaimed {saved / 1048576:.1f} MB of {total / 1048576:.1f} MB scanned.")
    else:
        print("\nDry run - nothing written. Re-run with --apply to resize.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
