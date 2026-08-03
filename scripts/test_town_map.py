"""Invariant tests for the editable static-town authoring workflow."""

from __future__ import annotations

import importlib.util
import json
import unittest
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
LAYOUT_PATH = ROOT / "Areas/Portalmon/Scripts/overworld/town-layout.json"
IMAGE_PATH = ROOT / "Areas/Portalmon/Content/Images/Overworld/enrichment-town.png"
BUILDER_PATH = ROOT / "scripts/build-town-map.py"

spec = importlib.util.spec_from_file_location("build_town_map", BUILDER_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load {BUILDER_PATH}")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class TownMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.layout = json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))
        cls.width = int(cls.layout["width"])
        cls.height = int(cls.layout["height"])
        cls.rectangles = builder.collision_rectangles(cls.layout)

    def test_generated_image_matches_declared_size_and_is_opaque(self) -> None:
        with Image.open(IMAGE_PATH) as source:
            image = source.convert("RGBA")
            tile_size = int(self.layout["tileSize"])
            self.assertEqual((self.width * tile_size, self.height * tile_size), image.size)
            self.assertEqual((255, 255), image.getchannel("A").getextrema())

    def test_source_tileset_contains_complete_sparse_grid(self) -> None:
        with Image.open(ROOT / "Tileset.png") as source:
            self.assertGreaterEqual(source.width, builder.SOURCE_ORIGIN + 28 * builder.SOURCE_PITCH - 1)
            self.assertGreaterEqual(source.height, builder.SOURCE_ORIGIN + 47 * builder.SOURCE_PITCH - 1)

    def test_collision_rectangles_stay_inside_map(self) -> None:
        for rectangle in self.rectangles:
            with self.subTest(rectangle=rectangle):
                self.assertGreater(int(rectangle["width"]), 0)
                self.assertGreater(int(rectangle["height"]), 0)
                self.assertGreaterEqual(int(rectangle["x"]), 0)
                self.assertGreaterEqual(int(rectangle["y"]), 0)
                self.assertLessEqual(int(rectangle["x"]) + int(rectangle["width"]), self.width)
                self.assertLessEqual(int(rectangle["y"]) + int(rectangle["height"]), self.height)

    def test_spawn_doors_and_bridge_are_reachable(self) -> None:
        blocked: set[tuple[int, int]] = set()
        for rectangle in self.rectangles:
            for y in range(int(rectangle["y"]), int(rectangle["y"]) + int(rectangle["height"])):
                for x in range(int(rectangle["x"]), int(rectangle["x"]) + int(rectangle["width"])):
                    blocked.add((x, y))

        spawn = tuple(int(value) for value in self.layout["defaultSpawn"])
        self.assertNotIn(spawn, blocked)
        reachable = {spawn}
        queue = deque([spawn])
        while queue:
            x, y = queue.popleft()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                nx, ny = neighbor
                if 0 <= nx < self.width and 0 <= ny < self.height and neighbor not in blocked and neighbor not in reachable:
                    reachable.add(neighbor)
                    queue.append(neighbor)

        buildings = {item["id"]: item for item in self.layout["buildings"]}
        targets = [
            tuple(int(value) for value in self.layout["points"]["centerReturn"]),
            (50, int(self.layout["ponds"][0]["bridgeY"])),
        ]
        for building in buildings.values():
            if building["kind"] in {"gym", "center"}:
                targets.append((
                    int(building["x"]) + int(building["width"]) // 2,
                    int(building["y"]) + int(building["height"]) - 1,
                ))
        for target in targets:
            with self.subTest(target=target):
                self.assertIn(target, reachable)

    def test_gym_slots_are_three_distinct_future_proof_positions(self) -> None:
        gyms = [item for item in self.layout["buildings"] if item["kind"] == "gym"]
        self.assertEqual([0, 1, 2], sorted(int(item["gymSlot"]) for item in gyms))
        doors = {
            (
                int(item["x"]) + int(item["width"]) // 2,
                int(item["y"]) + int(item["height"]) - 1,
            )
            for item in gyms
        }
        self.assertEqual(3, len(doors))


if __name__ == "__main__":
    unittest.main()
