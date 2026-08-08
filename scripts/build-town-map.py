"""Build the static Enrichment Township background and its generated map data.

Edit Areas/Portalmon/Scripts/overworld/town-layout.json, then run:

    python scripts/build-town-map.py

The browser loads only the generated PNG and TypeScript data. Tileset.png is
never fetched or assembled at runtime.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "Areas/Portalmon/Content/Images/Overworld/Tilesets/Tileset.png"
LAYOUT_PATH = ROOT / "Areas/Portalmon/Scripts/overworld/town-layout.json"
IMAGE_PATH = ROOT / "Areas/Portalmon/Content/Images/Overworld/enrichment-town.png"
DATA_PATH = ROOT / "Areas/Portalmon/Scripts/overworld/TownLayout.generated.ts"

SOURCE_TILE_SIZE = 16
SOURCE_PITCH = 17
SOURCE_ORIGIN = 1

THEME_COLORS: dict[str, tuple[int, int, int]] = {
    "aqua": (86, 188, 181),
    "blue": (72, 132, 207),
    "clinic": (223, 102, 104),
    "gold": (224, 184, 74),
    "green": (93, 172, 93),
    "orange": (216, 126, 56),
    "rose": (190, 105, 126),
    "sand": (205, 176, 112),
}


class TownPainter:
    def __init__(self, source: Image.Image, layout: dict[str, Any]) -> None:
        self.source = source.convert("RGBA")
        self.layout = layout
        self.tile_size = int(layout["tileSize"])
        self.image = Image.new(
            "RGBA",
            (int(layout["width"]) * self.tile_size, int(layout["height"]) * self.tile_size),
            (88, 188, 166, 255),
        )
        self._tile_cache: dict[tuple[int, int, str | None], Image.Image] = {}

    def source_tile(self, column: int, row: int, theme: str | None = None) -> Image.Image:
        key = (column, row, theme)
        if key in self._tile_cache:
            return self._tile_cache[key]
        x = SOURCE_ORIGIN + column * SOURCE_PITCH
        y = SOURCE_ORIGIN + row * SOURCE_PITCH
        tile = self.source.crop((x, y, x + SOURCE_TILE_SIZE, y + SOURCE_TILE_SIZE))
        if theme is not None:
            tile = self._tint(tile, THEME_COLORS[theme], 0.42)
        self._tile_cache[key] = tile
        return tile

    @staticmethod
    def _tint(image: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
        alpha = image.getchannel("A")
        gray = ImageOps.grayscale(image)
        colored = ImageOps.colorize(gray, black=(28, 39, 45), white=color).convert("RGBA")
        colored.putalpha(alpha)
        result = Image.blend(image, colored, strength)
        result.putalpha(alpha)
        return ImageEnhance.Color(result).enhance(1.08)

    def put(self, column: int, row: int, x: int, y: int, theme: str | None = None) -> None:
        tile = self.source_tile(column, row, theme)
        self.image.alpha_composite(tile, (x * self.tile_size, y * self.tile_size))

    def fill(self, x: int, y: int, width: int, height: int, tiles: list[tuple[int, int]]) -> None:
        for dy in range(height):
            for dx in range(width):
                column, row = tiles[(x * 7 + y * 11 + dx * 3 + dy * 5) % len(tiles)]
                self.put(column, row, x + dx, y + dy)

    def stamp(
        self,
        source_x: int,
        source_y: int,
        width: int,
        height: int,
        x: int,
        y: int,
        theme: str | None = None,
    ) -> None:
        for dy in range(height):
            for dx in range(width):
                self.put(source_x + dx, source_y + dy, x + dx, y + dy, theme)

    def paint_base(self) -> None:
        self.fill(
            0,
            0,
            int(self.layout["width"]),
            int(self.layout["height"]),
            [(0, 3)],
        )
        road_tiles = {
            "path": [(0, 6)],
            "stone": [(1, 13)],
            "technical": [(0, 24)],
        }
        for road in self.layout["roads"]:
            self.fill(
                int(road["x"]),
                int(road["y"]),
                int(road["width"]),
                int(road["height"]),
                road_tiles[str(road["kind"])],
            )

    def paint_ponds(self) -> None:
        for pond in self.layout["ponds"]:
            x, y = int(pond["x"]), int(pond["y"])
            width, height = int(pond["width"]), int(pond["height"])
            for dy in range(height):
                for dx in range(width):
                    source_column = 10 if dx == 0 else 12 if dx == width - 1 else 11
                    source_row = 0 if dy == 0 else 2 if dy == height - 1 else 1
                    self.put(source_column, source_row, x + dx, y + dy)
            bridge_y = int(pond["bridgeY"])
            bridge_height = int(pond["bridgeHeight"])
            for dy in range(bridge_height):
                for dx in range(width):
                    self.put((dx + dy) % 5, 18, x + dx, bridge_y + dy)

    def paint_buildings(self) -> None:
        for building in self.layout["buildings"]:
            kind = str(building["kind"])
            if kind == "gym":
                self._paint_gym(building)
            elif kind == "center":
                self._paint_center(building)
            elif kind == "champion":
                self._paint_champion(building)
            else:
                self._paint_house(building)

    def _paint_gym(self, building: dict[str, Any]) -> None:
        x, y = int(building["x"]), int(building["y"])
        width, height = int(building["width"]), int(building["height"])
        theme = str(building["theme"])
        for dy in range(height):
            for dx in range(width):
                self.put(1, 20, x + dx, y + dy, theme)
        for dx in range(width):
            self.put(19 if dx == 0 else 23 if dx == width - 1 else 20 + dx % 3, 8, x + dx, y, theme)
        for dy in range(1, height):
            self.put(19, min(12, 8 + dy), x, y + dy, theme)
            self.put(23, min(12, 8 + dy), x + width - 1, y + dy, theme)
        for dy in range(1, height):
            for dx in range(1, width - 1):
                self.put(20 + (dx % 3), min(12, 8 + dy), x + dx, y + dy, theme)
        door_x = x + width // 2
        self.stamp(6, 25, 3, 3, door_x - 1, y + height - 3)
        self.put(21, 3, door_x, y + 1, theme)

    def _paint_center(self, building: dict[str, Any]) -> None:
        x, y = int(building["x"]), int(building["y"])
        width, height = int(building["width"]), int(building["height"])
        for dy in range(height):
            for dx in range(width):
                self.put(1, 20, x + dx, y + dy, "clinic")
        for dx in range(width):
            self.put(24 if dx == 0 else 27 if dx == width - 1 else 25 + dx % 2, 0, x + dx, y, "clinic")
        for dy in range(1, height):
            self.put(24, min(3, dy), x, y + dy, "clinic")
            self.put(27, min(3, dy), x + width - 1, y + dy, "clinic")
            for dx in range(1, width - 1):
                self.put(25 + dx % 2, min(3, dy), x + dx, y + dy, "clinic")
        door_x = x + width // 2
        self.stamp(6, 25, 3, 3, door_x - 1, y + height - 3)
        self.put(22, 3, door_x, y + 1)

    def _paint_champion(self, building: dict[str, Any]) -> None:
        self._paint_gym({**building, "kind": "gym"})
        x, y = int(building["x"]), int(building["y"])
        width = int(building["width"])
        self.put(23, 0, x + width // 2, y)
        self.put(23, 1, x + width // 2, y + 1)

    def _paint_house(self, building: dict[str, Any]) -> None:
        x, y = int(building["x"]), int(building["y"])
        width, height = int(building["width"]), int(building["height"])
        theme = str(building["theme"])
        for dy in range(height):
            for dx in range(width):
                self.put(1, 18, x + dx, y + dy, theme)
        for dx in range(width):
            self.put(10 if dx == 0 else 13 if dx == width - 1 else 11 + dx % 2, 20, x + dx, y, theme)
        for dy in range(1, height):
            self.put(10, min(23, 20 + dy), x, y + dy, theme)
            self.put(13, min(23, 20 + dy), x + width - 1, y + dy, theme)
            for dx in range(1, width - 1):
                self.put(11 + dx % 2, min(23, 20 + dy), x + dx, y + dy, theme)
        door_x = x + width // 2
        self.put(20, 4, x + 1, y + 2)
        self.put(21, 4, x + width - 2, y + 2)
        self.stamp(6, 25, 3, 3, door_x - 1, y + height - 3)

    def paint_trees(self) -> None:
        for tree in self.layout["trees"]:
            x, y = int(tree["x"]), int(tree["y"])
            source_x = 3 if tree["variant"] == "green" else 0
            self.stamp(source_x, 34, 3, 4, x, y)

    def paint_decorations(self) -> None:
        for decoration in self.layout["decorations"]:
            kind = str(decoration["kind"])
            x, y = int(decoration["x"]), int(decoration["y"])
            if kind == "fountain":
                self.stamp(22, 0, 2, 3, x, y)
            elif kind == "gym-sign":
                self.put(20, 3, x, y, str(decoration["theme"]))
            elif kind == "center-sign":
                self.put(22, 4, x, y)
            elif kind == "flower-bed":
                width = int(decoration["width"])
                for dx in range(width):
                    self.put(7 if dx % 2 == 0 else 17, 2 if dx % 2 == 0 else 13, x + dx, y)
            elif kind == "cargo":
                self.stamp(10, 26, min(4, int(decoration["width"])), min(4, int(decoration["height"])), x, y)
                self.stamp(12, 26, 2, 3, x + 4, y)
            elif kind == "machinery":
                self.stamp(19, 2, min(5, int(decoration["width"])), min(4, int(decoration["height"])), x, y)

    def save(self) -> None:
        IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.image.convert("RGB").save(IMAGE_PATH, optimize=True)


def collision_rectangles(layout: dict[str, Any]) -> list[dict[str, Any]]:
    rectangles = [dict(item) for item in layout["boundaryCollision"]]
    for building in layout["buildings"]:
        x, y = int(building["x"]), int(building["y"])
        width, height = int(building["width"]), int(building["height"])
        label = str(building["label"])
        if building["kind"] in {"gym", "center"}:
            door_x = x + width // 2
            rectangles.append({"x": x, "y": y, "width": width, "height": height - 1, "label": label})
            rectangles.append({"x": x, "y": y + height - 1, "width": door_x - x, "height": 1, "label": label})
            rectangles.append({
                "x": door_x + 1,
                "y": y + height - 1,
                "width": x + width - door_x - 1,
                "height": 1,
                "label": label,
            })
        else:
            rectangles.append({"x": x, "y": y, "width": width, "height": height, "label": label})
    for pond in layout["ponds"]:
        x, y = int(pond["x"]), int(pond["y"])
        width, height = int(pond["width"]), int(pond["height"])
        bridge_y, bridge_height = int(pond["bridgeY"]), int(pond["bridgeHeight"])
        rectangles.append({"x": x, "y": y, "width": width, "height": bridge_y - y, "label": pond["label"]})
        lower_y = bridge_y + bridge_height
        rectangles.append({"x": x, "y": lower_y, "width": width, "height": y + height - lower_y, "label": pond["label"]})
    for tree in layout["trees"]:
        rectangles.append({"x": tree["x"], "y": tree["y"], "width": 3, "height": 4, "label": "tree"})
    for decoration in layout["decorations"]:
        if decoration.get("blocking"):
            rectangles.append({
                "x": decoration["x"],
                "y": decoration["y"],
                "width": decoration.get("width", 1),
                "height": decoration.get("height", 1),
                "label": decoration.get("label", decoration["kind"]),
            })
    return [item for item in rectangles if int(item["width"]) > 0 and int(item["height"]) > 0]


def write_generated_data(layout: dict[str, Any]) -> None:
    buildings = {str(item["id"]): item for item in layout["buildings"]}
    center = buildings["portalmon-center"]
    center_door = [int(center["x"]) + int(center["width"]) // 2, int(center["y"]) + int(center["height"]) - 1]
    gym_interactions = []
    for building in layout["buildings"]:
        if building["kind"] != "gym":
            continue
        gym_interactions.append({
            "position": {
                "x": int(building["x"]) + int(building["width"]) // 2,
                "y": int(building["y"]) + int(building["height"]) - 1,
            },
            "kind": "gym",
            "gymSlot": int(building["gymSlot"]),
        })

    payload = {
        "width": int(layout["width"]),
        "height": int(layout["height"]),
        "defaultSpawn": {"x": int(layout["defaultSpawn"][0]), "y": int(layout["defaultSpawn"][1])},
        "defaultFacing": layout["defaultFacing"],
        "centerDoor": {"x": center_door[0], "y": center_door[1]},
        "centerReturn": {
            "x": int(layout["points"]["centerReturn"][0]),
            "y": int(layout["points"]["centerReturn"][1]),
        },
        "maintenanceTech": {
            "x": int(layout["points"]["maintenanceTech"][0]),
            "y": int(layout["points"]["maintenanceTech"][1]),
        },
        "collisionRects": collision_rectangles(layout),
        "interactions": gym_interactions,
    }
    json_payload = json.dumps(payload, indent=2)
    DATA_PATH.write_text(
        "// Generated by scripts/build-town-map.py from town-layout.json.\n"
        "// Edit the JSON and rerun the builder; do not hand-edit this file.\n\n"
        f"export const GENERATED_TOWN_LAYOUT = {json_payload} as const;\n",
        encoding="utf-8",
    )


def main() -> None:
    layout = json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))
    source = Image.open(SOURCE_PATH)
    painter = TownPainter(source, layout)
    painter.paint_base()
    painter.paint_ponds()
    painter.paint_buildings()
    painter.paint_trees()
    painter.paint_decorations()
    painter.save()
    write_generated_data(layout)
    print(f"Wrote {IMAGE_PATH.relative_to(ROOT)}")
    print(f"Wrote {DATA_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
