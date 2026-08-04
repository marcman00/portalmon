"""Export Gym1's Tiled data into the small runtime map definition.

Gym maps render their TMX layers directly. Gameplay data stays in Tiled:

* ``walkable = false`` layers define collision;
* ``ice = true`` layers define slide tiles;
* ``Portals`` objects pair on their integer ``portal`` property;
* a Portals-layer ``directionalExit`` property is the default for its objects;
* ``Warp`` objects use ``map`` and ``spawn`` to move between maps;
* ``Spawns`` objects are safe, non-triggering arrival points.
* ``Actables`` objects provide signs, dialogue NPCs, and map-placed trainers;
* ``Wild`` objects define encounter zones.
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


def merged_properties(group_: ET.Element, object_: ET.Element) -> dict[str, str]:
    """Object properties override layer defaults, matching Tiled's authoring model."""

    return {**properties(group_), **properties(object_)}


def actables(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, object]]:
    actable_group = group(root, "Actables")
    result: list[dict[str, object]] = []
    positions: set[tuple[int, int]] = set()
    for object_ in actable_group.findall("object"):
        object_id = int(object_.get("id", "0"))
        object_properties = merged_properties(actable_group, object_)
        trainer_id = object_properties.get("trainerId", "").strip()
        x, y = one_tile_object(object_, tile_width, tile_height, "Actables")
        if (x, y) in positions:
            raise ValueError(f"Multiple Actables objects share tile {x},{y}")
        positions.add((x, y))
        facing = object_properties.get("facing", "down")
        if facing not in {"up", "down", "left", "right"}:
            raise ValueError(f"Actables object {object_id} has invalid facing: {facing}")
        entry: dict[str, object] = {"id": object_id, "position": {"x": x, "y": y}, "facing": facing}
        if trainer_id:
            entry["trainerId"] = trainer_id
        else:
            name = object_properties.get("name", "").strip()
            message = object_properties.get("message", "").strip()
            if not name or not message:
                raise ValueError(f"Actables object {object_id} needs non-empty 'name' and 'message' properties")
            entry["name"] = name
            entry["message"] = message
        result.append(entry)
    return result


def wild_zones(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, int]]:
    wild_group = group(root, "Wild")
    result: list[dict[str, int]] = []
    for object_ in wild_group.findall("object"):
        if merged_properties(wild_group, object_).get("wild") != "true":
            continue
        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Wild object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Wild object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Wild object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Wild object {object_id} height")
        if width <= 0 or height <= 0:
            raise ValueError(f"Wild object {object_id} must cover at least one tile")
        result.append({"x": x, "y": y, "width": width, "height": height})
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


def validate_portal_visuals(
    layers: list[tuple[ET.Element, list[int]]],
    width: int,
    portal_defs: list[dict[str, object]],
) -> None:
    """Keep portal behavior objects and their Tiled visuals in sync."""

    visual_layer = next((layer for layer, _ in layers if layer.get("name") == "Portal Visuals"), None)
    if visual_layer is None:
        raise ValueError("Gym map needs a 'Portal Visuals' tile layer")
    visual_gids = next(gids for layer, gids in layers if layer is visual_layer)
    missing = [
        portal["position"]
        for portal in portal_defs
        if visual_gids[portal["position"]["y"] * width + portal["position"]["x"]] == 0
    ]
    if missing:
        raise ValueError(f"Portal Visuals is missing tiles at portal endpoints: {missing}")


def validate_slides(
    width: int,
    height: int,
    blocked_tiles: set[tuple[int, int]],
    ice: list[dict[str, int]],
    portal_defs: list[dict[str, object]],
    spawn_defs: list[dict[str, object]],
    warp_defs: list[dict[str, object]],
) -> None:
    """Validate every movement route reachable from this map's configured spawns."""

    ice_tiles = {(tile["x"], tile["y"]) for tile in ice}
    warp_tiles = {
        (warp["position"]["x"], warp["position"]["y"])
        for warp in warp_defs
    }
    endpoints_by_id: dict[int, list[dict[str, object]]] = {}
    portals_by_position: dict[tuple[int, int], dict[str, object]] = {}
    for portal in portal_defs:
        endpoints_by_id.setdefault(portal["portalId"], []).append(portal)
        position = portal["position"]
        portals_by_position[(position["x"], position["y"])] = portal

    directions = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}

    def resolve_move(start: tuple[int, int], direction_name: str) -> tuple[int, int] | None:
        """Return the resting tile, or None when the move leaves the map by warp."""

        delta_x, delta_y = directions[direction_name]
        position = start
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
                return start
            position = next_position
            state = (position, direction_name)
            if state in seen:
                raise ValueError(f"Ice movement loops from {start} while moving {direction_name}")
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
            if position in warp_tiles:
                return None
            if position not in ice_tiles:
                return position

    reachable = {
        (spawn["position"]["x"], spawn["position"]["y"])
        for spawn in spawn_defs
    }
    pending = list(reachable)
    while pending:
        start = pending.pop()
        for direction_name in directions:
            destination = resolve_move(start, direction_name)
            if destination is not None and destination not in reachable:
                reachable.add(destination)
                pending.append(destination)


def main() -> None:
    root = ET.parse(SOURCE_PATH).getroot()
    width = int(root.get("width", "0"))
    height = int(root.get("height", "0"))
    tile_width = int(root.get("tilewidth", "0"))
    tile_height = int(root.get("tileheight", "0"))
    if width <= 0 or height <= 0 or tile_width != 16 or tile_height != 16:
        raise ValueError("Gym maps must have positive 16px tile dimensions")

    tilesets: list[dict[str, int | str]] = []
    for tileset_reference in root.findall("tileset"):
        source = tileset_reference.get("source")
        if source is None:
            raise ValueError("Gym maps only support external tilesets")
        tileset_path = SOURCE_PATH.parent / source
        tileset = ET.parse(tileset_path).getroot()
        image = tileset.find("image")
        if image is None or image.get("source") is None:
            raise ValueError(f"Gym tileset {source!r} needs an image")
        tile_count = int(tileset.get("tilecount", "0"))
        columns = int(tileset.get("columns", "0"))
        if tile_count <= 0 or columns <= 0:
            raise ValueError(f"Gym tileset {source!r} needs positive tilecount and columns")
        tilesets.append({
            "imagePath": "/" + image.get("source"),
            "firstGid": int(tileset_reference.get("firstgid", "0")),
            "tileCount": tile_count,
            "columns": columns,
            "spacing": int(tileset.get("spacing", "0")),
            "margin": int(tileset.get("margin", "0")),
        })
    if not tilesets:
        raise ValueError("Gym map needs at least one external tileset")

    layers = [(layer, layer_gids(layer, width)) for layer in root.findall("layer")]
    collision_rects, blocked_tiles = collision_rectangles(layers, width)
    ice = ice_tiles(layers, width)
    portal_defs = portals(root, tile_width, tile_height)
    spawn_defs = spawns(root, tile_width, tile_height)
    warp_defs = warps(root, tile_width, tile_height)
    actable_defs = actables(root, tile_width, tile_height)
    wild_defs = wild_zones(root, tile_width, tile_height)
    validate_portal_visuals(layers, width, portal_defs)
    for spawn in spawn_defs:
        position = spawn["position"]
        if (position["x"], position["y"]) in blocked_tiles:
            raise ValueError(f"Spawn {spawn['id']!r} is blocked")
    validate_slides(width, height, blocked_tiles, ice, portal_defs, spawn_defs, warp_defs)

    output = [
        "// Generated from Gym1.tmx by scripts/build-tiled-gym.py. Do not edit.",
        'import { MapActableDef, MapCollisionRect, MapEncounterZone, MapPoint, MapPortalDef, MapSpawnDef, MapTilesetDef, MapWarpDef } from "./OverworldMapTypes";',
        "",
        f"export const GYM1_WIDTH = {width};",
        f"export const GYM1_HEIGHT = {height};",
        "export const GYM1_TILESETS: MapTilesetDef[] = " + json.dumps(tilesets) + ";",
        "export const GYM1_TILE_LAYERS: number[][] = " + json.dumps([gids for _, gids in layers]) + ";",
        "export const GYM1_COLLISION_RECTS: MapCollisionRect[] = " + json.dumps(collision_rects) + ";",
        "export const GYM1_ICE_TILES: MapPoint[] = " + json.dumps(ice) + ";",
        "export const GYM1_PORTALS: MapPortalDef[] = " + json.dumps(portal_defs) + ";",
        "export const GYM1_SPAWNS: MapSpawnDef[] = " + json.dumps(spawn_defs) + ";",
        "export const GYM1_WARPS: MapWarpDef[] = " + json.dumps(warp_defs) + ";",
        "export const GYM1_ACTABLES: MapActableDef[] = " + json.dumps(actable_defs) + ";",
        "export const GYM1_WILD_ZONES: MapEncounterZone[] = " + json.dumps(wild_defs) + ";",
        "",
    ]
    OUTPUT_PATH.write_text("\n".join(output), encoding="utf-8")


if __name__ == "__main__":
    main()
