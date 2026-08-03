"""Export Gym1's Tiled data into the small runtime map definition.

Gym maps render their TMX layers directly. Gameplay data stays in Tiled:

* ``walkable = false`` layers define collision;
* ``ice = true`` layers define slide tiles;
* ``Portals`` objects pair on their integer ``portal`` property;
* a Portals-layer ``directionalExit`` property is the default for its objects;
* ``Warp`` objects use ``map`` and ``spawn`` to move between maps;
* ``Spawns`` objects are safe, non-triggering arrival points.
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "Gym1.tmx"
OUTPUT_PATH = ROOT / "Areas/Portalmon/Scripts/overworld/Gym1.generated.ts"


def properties(element: ET.Element) -> dict[str, str]:
    return {
        property_.get("name", ""): property_.get("value", property_.text or "")
        for property_ in element.findall("./properties/property")
    }


def exact_tile(value: float, unit: int, description: str) -> int:
    tile_value = value / unit
    if abs(tile_value - round(tile_value)) > 1e-8:
        raise ValueError(f"{description} must align to the {unit}px tile grid (found {value:g})")
    return round(tile_value)


def layer_gids(layer: ET.Element, width: int) -> list[int]:
    data = layer.find("data")
    if data is None or data.get("encoding") != "csv":
        raise ValueError(f"Layer {layer.get('name')!r} must use CSV encoding")
    gids = [int(value.strip()) for value in (data.text or "").split(",") if value.strip()]
    expected = width * int(layer.get("height", "0"))
    if len(gids) != expected:
        raise ValueError(f"Layer {layer.get('name')!r} has {len(gids)} tiles; expected {expected}")
    return gids


def one_tile_object(object_: ET.Element, tile_width: int, tile_height: int, group_name: str) -> tuple[int, int]:
    object_id = object_.get("id", "?")
    x = exact_tile(float(object_.get("x", "0")), tile_width, f"{group_name} object {object_id} X")
    y = exact_tile(float(object_.get("y", "0")), tile_height, f"{group_name} object {object_id} Y")
    width = exact_tile(float(object_.get("width", "0")), tile_width, f"{group_name} object {object_id} width")
    height = exact_tile(float(object_.get("height", "0")), tile_height, f"{group_name} object {object_id} height")
    if width != 1 or height != 1:
        raise ValueError(f"{group_name} object {object_id} must be exactly one tile (found {width}x{height})")
    return x, y


def group(root: ET.Element, name: str, required: bool = True) -> ET.Element | None:
    result = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == name), None)
    if result is None and required:
        raise ValueError(f"Missing required object layer: {name}")
    return result


def collision_rectangles(layers: list[tuple[ET.Element, list[int]]], width: int) -> tuple[list[dict[str, int | str]], set[tuple[int, int]]]:
    rectangles: list[dict[str, int | str]] = []
    points: set[tuple[int, int]] = set()
    for layer, gids in layers:
        if properties(layer).get("walkable") != "false":
            continue
        label = layer.get("name", "obstacle").lower()
        for y in range(int(layer.get("height", "0"))):
            row = gids[y * width : (y + 1) * width]
            x = 0
            while x < width:
                if row[x] == 0:
                    x += 1
                    continue
                start = x
                while x < width and row[x] != 0:
                    points.add((x, y))
                    x += 1
                rectangles.append({"x": start, "y": y, "width": x - start, "height": 1, "label": label})
    return rectangles, points


def ice_tiles(layers: list[tuple[ET.Element, list[int]]], width: int) -> list[dict[str, int]]:
    tiles: list[dict[str, int]] = []
    for layer, gids in layers:
        if properties(layer).get("ice") != "true":
            continue
        for index, gid in enumerate(gids):
            if gid != 0:
                tiles.append({"x": index % width, "y": index // width})
    return tiles


def warps(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    warp_group = group(root, "Warp", required=False)
    if warp_group is None:
        return result
    for object_ in warp_group.findall("object"):
        object_properties = properties(object_)
        if not object_properties:
            continue
        target_map = object_properties.get("map", "").strip()
        target_spawn = object_properties.get("spawn", "").strip()
        if not target_map or not target_spawn:
            raise ValueError(f"Warp object {object_.get('id')} needs non-empty 'map' and 'spawn' properties")
        x, y = one_tile_object(object_, tile_width, tile_height, "Warp")
        result.append({"position": {"x": x, "y": y}, "targetMapId": target_map, "targetSpawnId": target_spawn})
    return result


def spawns(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, object]]:
    spawn_group = group(root, "Spawns")
    result: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    for object_ in spawn_group.findall("object"):
        object_properties = properties(object_)
        spawn_id = object_properties.get("spawn", "").strip()
        if not spawn_id:
            raise ValueError(f"Spawns object {object_.get('id')} needs a non-empty 'spawn' property")
        if spawn_id in seen_ids:
            raise ValueError(f"Duplicate spawn ID: {spawn_id}")
        seen_ids.add(spawn_id)
        facing = object_properties.get("facing", "down")
        if facing not in {"up", "down", "left", "right"}:
            raise ValueError(f"Spawns object {object_.get('id')} has invalid facing: {facing}")
        x, y = one_tile_object(object_, tile_width, tile_height, "Spawns")
        result.append({"id": spawn_id, "position": {"x": x, "y": y}, "facing": facing})
    return result


def portals(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, object]]:
    portal_group = group(root, "Portals")
    layer_properties = properties(portal_group)
    layer_directional_exit = layer_properties.get("directionalExit", "false") == "true"
    result: list[dict[str, object]] = []
    counts: dict[int, int] = {}
    for object_ in portal_group.findall("object"):
        object_properties = properties(object_)
        try:
            portal_id = int(object_properties["portal"])
        except (KeyError, ValueError) as error:
            raise ValueError(f"Portals object {object_.get('id')} needs an integer 'portal' property") from error
        x, y = one_tile_object(object_, tile_width, tile_height, "Portals")
        directional_exit = object_properties.get("directionalExit", str(layer_directional_exit).lower()) == "true"
        result.append({"portalId": portal_id, "position": {"x": x, "y": y}, "directionalExit": directional_exit})
        counts[portal_id] = counts.get(portal_id, 0) + 1
    invalid = [portal_id for portal_id, count in counts.items() if count != 2]
    if invalid:
        raise ValueError(f"Each portal ID must have exactly two endpoints; invalid IDs: {invalid}")
    return result


def validate_slides(
    width: int,
    height: int,
    blocked_tiles: set[tuple[int, int]],
    ice: list[dict[str, int]],
    portal_defs: list[dict[str, object]],
) -> None:
    """Reject every ice route that would loop or leave a portal into a wall.

    Testing every open tile and direction means this remains correct even after a
    level designer rearranges the ice without updating a separate test case.
    """

    ice_tiles = {(tile["x"], tile["y"]) for tile in ice}
    endpoints_by_id: dict[int, list[dict[str, object]]] = {}
    portals_by_position: dict[tuple[int, int], dict[str, object]] = {}
    for portal in portal_defs:
        endpoints_by_id.setdefault(portal["portalId"], []).append(portal)
        position = portal["position"]
        portals_by_position[(position["x"], position["y"])] = portal

    directions = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
    for start_y in range(height):
        for start_x in range(width):
            if (start_x, start_y) in blocked_tiles:
                continue
            for direction_name, (delta_x, delta_y) in directions.items():
                position = (start_x, start_y)
                seen: set[tuple[tuple[int, int], str]] = set()
                while True:
                    next_position = (position[0] + delta_x, position[1] + delta_y)
                    if (
                        next_position[0] < 0
                        or next_position[0] >= width
                        or next_position[1] < 0
                        or next_position[1] >= height
                        or next_position in blocked_tiles
                    ):
                        break
                    position = next_position
                    state = (position, direction_name)
                    if state in seen:
                        raise ValueError(f"Ice movement loops from {start_x},{start_y} while moving {direction_name}")
                    seen.add(state)

                    source = portals_by_position.get(position)
                    if source is not None:
                        target = next(
                            endpoint
                            for endpoint in endpoints_by_id[source["portalId"]]
                            if endpoint["position"] != source["position"]
                        )
                        target_position = target["position"]
                        position = (
                            target_position["x"] + (delta_x if target["directionalExit"] else 0),
                            target_position["y"] + (delta_y if target["directionalExit"] else 0),
                        )
                        if (
                            position[0] < 0
                            or position[0] >= width
                            or position[1] < 0
                            or position[1] >= height
                            or position in blocked_tiles
                        ):
                            raise ValueError(
                                f"Portal {source['portalId']} exits into a blocked tile from {source['position']} "
                                f"while moving {direction_name}"
                            )
                    if position not in ice_tiles:
                        break


def main() -> None:
    root = ET.parse(SOURCE_PATH).getroot()
    width = int(root.get("width", "0"))
    height = int(root.get("height", "0"))
    tile_width = int(root.get("tilewidth", "0"))
    tile_height = int(root.get("tileheight", "0"))
    if width <= 0 or height <= 0 or tile_width != 16 or tile_height != 16:
        raise ValueError("Gym maps must have positive 16px tile dimensions")

    tileset_reference = root.find("tileset")
    if tileset_reference is None or tileset_reference.get("source") is None:
        raise ValueError("Gym map needs one external tileset")
    tileset_path = SOURCE_PATH.parent / tileset_reference.get("source")
    tileset = ET.parse(tileset_path).getroot()
    image = tileset.find("image")
    if image is None or image.get("source") is None:
        raise ValueError("Gym tileset needs an image")

    layers = [(layer, layer_gids(layer, width)) for layer in root.findall("layer")]
    collision_rects, blocked_tiles = collision_rectangles(layers, width)
    ice = ice_tiles(layers, width)
    portal_defs = portals(root, tile_width, tile_height)
    validate_slides(width, height, blocked_tiles, ice, portal_defs)
    for spawn in spawns(root, tile_width, tile_height):
        position = spawn["position"]
        if (position["x"], position["y"]) in blocked_tiles:
            raise ValueError(f"Spawn {spawn['id']!r} is blocked")

    output = [
        "// Generated from Gym1.tmx by scripts/build-tiled-gym.py. Do not edit.",
        'import { MapCollisionRect, MapPoint, MapPortalDef, MapSpawnDef, MapTilesetDef, MapWarpDef } from "./OverworldMapTypes";',
        "",
        f"export const GYM1_WIDTH = {width};",
        f"export const GYM1_HEIGHT = {height};",
        "export const GYM1_TILESET: MapTilesetDef = " + json.dumps({
            "imagePath": "/" + image.get("source"),
            "firstGid": int(tileset_reference.get("firstgid", "1")),
            "columns": int(tileset.get("columns", "0")),
        }) + ";",
        "export const GYM1_TILE_LAYERS: number[][] = " + json.dumps([gids for _, gids in layers]) + ";",
        "export const GYM1_COLLISION_RECTS: MapCollisionRect[] = " + json.dumps(collision_rects) + ";",
        "export const GYM1_ICE_TILES: MapPoint[] = " + json.dumps(ice) + ";",
        "export const GYM1_PORTALS: MapPortalDef[] = " + json.dumps(portal_defs) + ";",
        "export const GYM1_SPAWNS: MapSpawnDef[] = " + json.dumps(spawns(root, tile_width, tile_height)) + ";",
        "export const GYM1_WARPS: MapWarpDef[] = " + json.dumps(warps(root, tile_width, tile_height)) + ";",
        "",
    ]
    OUTPUT_PATH.write_text("\n".join(output), encoding="utf-8")


if __name__ == "__main__":
    main()
