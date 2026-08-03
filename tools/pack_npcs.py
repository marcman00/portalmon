"""Pack manually selected NPC crops into a transparent, Tiled-ready tileset.

Place one PNG per NPC in ``npcs-picked/``.  The script removes the mint-green
background used by ``npcs.png``, trims empty border, bottom-aligns each NPC on
an output tile, and writes a PNG, TSX, and JSON manifest.  Files are packed in
natural filename order, so prefix them (for example ``001_may.png``) to choose
their tile order.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


DEFAULT_KEY_COLORS = {(115, 197, 165), (115, 199, 165)}


@dataclass(frozen=True)
class PackedSprite:
    path: Path
    image: Image.Image
    source_bbox: tuple[int, int, int, int]


def natural_key(path: Path) -> list[object]:
    return [int(value) if value.isdigit() else value.casefold() for value in re.split(r"(\d+)", path.name)]


def remove_sheet_background(image: Image.Image, key_colors: set[tuple[int, int, int]]) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = [
        (0, 0, 0, 0) if pixel[:3] in key_colors else pixel
        for pixel in rgba.get_flattened_data()
    ]
    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(pixels)
    return cleaned


def load_sprite(path: Path, key_colors: set[tuple[int, int, int]]) -> PackedSprite:
    cleaned = remove_sheet_background(Image.open(path), key_colors)
    bbox = cleaned.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("contains no visible pixels after green-background removal")
    return PackedSprite(path=path, image=cleaned.crop(bbox), source_bbox=bbox)


def write_tileset(path: Path, image_path: Path, tile_width: int, tile_height: int, columns: int, tile_count: int, image_height: int) -> None:
    path.write_text(
        "\n".join(
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                f'<tileset version="1.10" tiledversion="1.12.2" name="{path.stem}" tilewidth="{tile_width}" tileheight="{tile_height}" tilecount="{tile_count}" columns="{columns}">',
                f' <image source="{image_path.name}" width="{columns * tile_width}" height="{image_height}"/>',
                "</tileset>",
                "",
            ]
        ),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pack hand-picked NPC PNGs into a transparent Tiled tileset.")
    parser.add_argument("--input", type=Path, default=Path("npcs-picked"), help="Folder containing one PNG crop per NPC (default: npcs-picked).")
    parser.add_argument("--output", type=Path, default=Path("npcs-manual.png"), help="Output tileset PNG (default: npcs-manual.png).")
    parser.add_argument("--tsx", type=Path, default=Path("npcs-manual.tsx"), help="Output Tiled TSX (default: npcs-manual.tsx).")
    parser.add_argument("--manifest", type=Path, default=Path("npcs-manual.json"), help="Output tile-ID manifest (default: npcs-manual.json).")
    parser.add_argument("--tile-width", type=int, default=16, help="Output tile width in pixels (default: 16).")
    parser.add_argument("--tile-height", type=int, default=16, help="Output tile height in pixels (default: 16).")
    parser.add_argument("--columns", type=int, default=16, help="Output sheet columns (default: 16).")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.tile_width <= 0 or args.tile_height <= 0 or args.columns <= 0:
        print("Tile width, tile height, and columns must be positive.", file=sys.stderr)
        return 2

    args.input.mkdir(parents=True, exist_ok=True)
    paths = sorted(args.input.glob("*.png"), key=natural_key)
    if not paths:
        print(f"No PNGs found. Add one crop per NPC to {args.input}/, then run this command again.", file=sys.stderr)
        return 2

    sprites: list[PackedSprite] = []
    failures: list[str] = []
    for path in paths:
        try:
            sprite = load_sprite(path, DEFAULT_KEY_COLORS)
            if sprite.image.width > args.tile_width or sprite.image.height > args.tile_height:
                failures.append(
                    f"{path}: trimmed sprite is {sprite.image.width}x{sprite.image.height}, larger than the {args.tile_width}x{args.tile_height} output tile"
                )
            else:
                sprites.append(sprite)
        except (OSError, ValueError) as error:
            failures.append(f"{path}: {error}")

    if failures:
        print("Packing stopped; no output was written:\n" + "\n".join(f"- {failure}" for failure in failures), file=sys.stderr)
        return 1

    rows = (len(sprites) + args.columns - 1) // args.columns
    sheet = Image.new("RGBA", (args.columns * args.tile_width, rows * args.tile_height))
    manifest_tiles = []
    for tile_id, sprite in enumerate(sprites):
        column = tile_id % args.columns
        row = tile_id // args.columns
        x = column * args.tile_width + (args.tile_width - sprite.image.width) // 2
        y = (row + 1) * args.tile_height - sprite.image.height
        sheet.alpha_composite(sprite.image, (x, y))
        manifest_tiles.append(
            {
                "tile_id": tile_id,
                "source": sprite.path.as_posix(),
                "source_visible_bounds": sprite.source_bbox,
                "position": [x, y],
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.tsx.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output)
    write_tileset(args.tsx, args.output, args.tile_width, args.tile_height, args.columns, len(sprites), sheet.height)
    args.manifest.write_text(json.dumps({"tile_width": args.tile_width, "tile_height": args.tile_height, "columns": args.columns, "tiles": manifest_tiles}, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {len(sprites)} NPCs into {args.output} ({args.columns} columns, {rows} rows).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
