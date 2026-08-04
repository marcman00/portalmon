"""Export Portalmon overworld gameplay data from the Tiled TMX source.

The game deliberately renders the precomposed Overworld.png at runtime.  This
script turns the non-visual information in Overworld.tmx into TypeScript:

* every non-empty tile in a layer whose ``walkable`` property is false blocks;
* objects in the Warp layer become numbered door locations or named map warps;
* objects in the Actables layer become talkable people and signs, carrying the
  ``name`` and ``message`` authored in Tiled.

Run ``npm run map:tiled`` after editing the TMX in Tiled.
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "Overworld.tmx"
OUTPUT_PATH = ROOT / "Areas/Portalmon/Scripts/overworld/TiledOverworld.generated.ts"


def properties(element: ET.Element) -> dict[str, str]:
    return {
        property_.get("name", ""): property_.get("value", property_.text or "")
        for property_ in element.findall("./properties/property")
    }


def merged_properties(group: ET.Element, object_: ET.Element) -> dict[str, str]:
    return {**properties(group), **properties(object_)}


def exact_tile(value: float, unit: int, description: str) -> int:
    tile_value = value / unit
    if abs(tile_value - round(tile_value)) > 1e-8:
        raise ValueError(f"{description} must align to the {unit}px tile grid (found {value:g})")
    return round(tile_value)


def object_placements(
    root: ET.Element,
    group_name: str,
    property_name: str,
    tile_width: int,
    tile_height: int,
) -> list[tuple[int, int, int]]:
    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == group_name), None)
    if group is None:
        raise ValueError(f"Missing required object layer: {group_name}")

    placements: list[tuple[int, int, int]] = []
    seen_ids: set[int] = set()
    for object_ in group.findall("object"):
        object_properties = properties(object_)
        if property_name not in object_properties:
            if object_properties.get("map", "").strip() or object_properties.get("spawn", "").strip():
                continue
            raise ValueError(
                f"{group_name} object {object_.get('id')} needs an integer {property_name!r} property"
            )
        try:
            placement_id = int(object_properties[property_name])
        except ValueError as error:
            raise ValueError(
                f"{group_name} object {object_.get('id')} has a non-integer {property_name!r} property"
            ) from error
        if placement_id in seen_ids:
            raise ValueError(f"Duplicate {property_name} ID: {placement_id}")
        seen_ids.add(placement_id)

        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"{group_name} object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"{group_name} object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"{group_name} object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"{group_name} object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"{group_name} object {object_id} must be exactly one tile (found {width}x{height})")
        placements.append((placement_id, x, y))

    return sorted(placements)


def warp_placements(
    root: ET.Element,
    tile_width: int,
    tile_height: int,
) -> list[tuple[int, int, str, str]]:
    """Read Warp objects that use the map/spawn transition convention.

    Legacy objects with only a ``door`` property remain available through
    ``TILED_DOORS``. A transition must provide both values so it can resolve to
    a non-triggering spawn point in the target map.
    """

    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Warp"), None)
    if group is None:
        return []

    placements: list[tuple[int, int, str, str]] = []
    for object_ in group.findall("object"):
        object_properties = properties(object_)
        target_map = object_properties.get("map", "").strip()
        target_spawn = object_properties.get("spawn", "").strip()
        if not target_map and not target_spawn:
            continue
        if not target_map or not target_spawn:
            raise ValueError(
                f"Warp object {object_.get('id')} needs non-empty 'map' and 'spawn' properties"
            )

        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Warp object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Warp object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Warp object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Warp object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"Warp object {object_id} must be exactly one tile (found {width}x{height})")
        placements.append((x, y, target_map, target_spawn))

    return placements


def spawn_placements(
    root: ET.Element,
    tile_width: int,
    tile_height: int,
) -> list[tuple[str, int, int, str]]:
    """Read safe arrival points from the optional Spawns object layer."""

    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Spawns"), None)
    if group is None:
        return []

    placements: list[tuple[str, int, int, str]] = []
    seen_ids: set[str] = set()
    for object_ in group.findall("object"):
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
        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Spawns object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Spawns object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Spawns object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Spawns object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"Spawns object {object_id} must be exactly one tile (found {width}x{height})")
        placements.append((spawn_id, x, y, facing))

    return placements


def portal_placements(root: ET.Element, tile_width: int, tile_height: int) -> list[dict[str, object]]:
    """Read paired portal endpoints using the same contract as interior maps."""

    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Portals"), None)
    if group is None:
        raise ValueError("Missing required object layer: Portals")
    default_directional_exit = properties(group).get("directionalExit", "false") == "true"
    placements: list[dict[str, object]] = []
    counts: dict[int, int] = {}
    for object_ in group.findall("object"):
        object_properties = merged_properties(group, object_)
        try:
            portal_id = int(object_properties["portal"])
        except (KeyError, ValueError) as error:
            raise ValueError(f"Portals object {object_.get('id')} needs an integer 'portal' property") from error
        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Portals object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Portals object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Portals object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Portals object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"Portals object {object_id} must be exactly one tile")
        directional_exit = object_properties.get("directionalExit", str(default_directional_exit).lower()) == "true"
        placements.append({"portalId": portal_id, "position": {"x": x, "y": y}, "directionalExit": directional_exit})
        counts[portal_id] = counts.get(portal_id, 0) + 1
    invalid = [portal_id for portal_id, count in counts.items() if count != 2]
    if invalid:
        raise ValueError(f"Each portal ID must have exactly two endpoints; invalid IDs: {invalid}")
    return placements


def actable_placements(
    root: ET.Element,
    tile_width: int,
    tile_height: int,
) -> list[dict[str, object]]:
    """Read the Actables layer: one talkable person or sign per object.

    Each object is identified by its Tiled object ID rather than by name, because
    several signs deliberately share the same ``name``.
    """

    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Actables"), None)
    if group is None:
        raise ValueError("Missing required object layer: Actables")

    placements: list[dict[str, object]] = []
    for object_ in group.findall("object"):
        object_id = object_.get("id", "?")
        object_properties = merged_properties(group, object_)

        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Actables object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Actables object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Actables object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Actables object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"Actables object {object_id} must be exactly one tile (found {width}x{height})")
        facing = object_properties.get("facing", "down")
        if facing not in {"up", "down", "left", "right"}:
            raise ValueError(f"Actables object {object_id} has invalid facing: {facing}")
        placement: dict[str, object] = {"id": int(object_id), "position": {"x": x, "y": y}, "facing": facing}
        trainer_id = object_properties.get("trainerId", "").strip()
        if trainer_id:
            placement["trainerId"] = trainer_id
        else:
            for required in ("name", "message"):
                if not object_properties.get(required, "").strip():
                    raise ValueError(f"Actables object {object_id} needs a non-empty {required!r} property")
            placement["name"] = object_properties["name"]
            placement["message"] = object_properties["message"]
        placements.append(placement)

    positions = [(placement["position"]["x"], placement["position"]["y"]) for placement in placements]
    duplicate = next((position for position in positions if positions.count(position) > 1), None)
    if duplicate is not None:
        raise ValueError(f"Multiple Actables objects share tile {duplicate[0]},{duplicate[1]}")

    return sorted(placements, key=lambda placement: int(placement["id"]))


def ts_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def encounter_zones(root: ET.Element, tile_width: int, tile_height: int) -> list[tuple[int, int, int, int]]:
    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Wild"), None)
    if group is None:
        return []

    zones: list[tuple[int, int, int, int]] = []
    for object_ in group.findall("object"):
        if merged_properties(group, object_).get("wild") != "true":
            continue
        object_id = object_.get("id", "?")
        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Wild object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Wild object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Wild object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Wild object {object_id} height")
        if width <= 0 or height <= 0:
            raise ValueError(f"Wild object {object_id} must cover at least one tile")
        zones.append((x, y, width, height))
    return zones


def visible_tile_checker(root: ET.Element):
    """Return whether a TMX GID contains any visible pixels.

    Tiled permits placement of fully transparent tiles. They are useful while
    editing but must not become invisible walls merely because their layer is
    marked ``walkable = false``.
    """

    tilesets = []
    for tileset_ref in root.findall("tileset"):
        source = tileset_ref.get("source")
        if source is None:
            raise ValueError("Embedded tilesets are not supported by the overworld exporter")
        tileset_path = SOURCE_PATH.parent / source
        tileset = ET.parse(tileset_path).getroot()
        image_element = tileset.find("image")
        if image_element is None or image_element.get("source") is None:
            raise ValueError(f"Tileset {source!r} has no image source")
        image = Image.open(tileset_path.parent / image_element.get("source")).convert("RGBA")
        tilesets.append(
            {
                "first_gid": int(tileset_ref.get("firstgid", "0")),
                "tile_width": int(tileset.get("tilewidth", "0")),
                "tile_height": int(tileset.get("tileheight", "0")),
                "columns": int(tileset.get("columns", "0")),
                "spacing": int(tileset.get("spacing", "0")),
                "margin": int(tileset.get("margin", "0")),
                "image": image,
            }
        )
    tilesets.sort(key=lambda tileset: tileset["first_gid"])
    cache: dict[int, bool] = {0: False}

    def is_visible(gid: int) -> bool:
        # Tiled stores flip flags in the high bits of a GID.
        gid &= 0x1FFFFFFF
        if gid in cache:
            return cache[gid]
        tileset = next((candidate for candidate in reversed(tilesets) if candidate["first_gid"] <= gid), None)
        if tileset is None:
            raise ValueError(f"Tile GID {gid} does not belong to a registered tileset")
        tile_id = gid - tileset["first_gid"]
        columns = tileset["columns"]
        if columns <= 0:
            raise ValueError(f"Tileset containing GID {gid} has no column count")
        x = tileset["margin"] + (tile_id % columns) * (tileset["tile_width"] + tileset["spacing"])
        y = tileset["margin"] + (tile_id // columns) * (tileset["tile_height"] + tileset["spacing"])
        tile = tileset["image"].crop((x, y, x + tileset["tile_width"], y + tileset["tile_height"]))
        cache[gid] = tile.getchannel("A").getbbox() is not None
        return cache[gid]

    return is_visible


def collision_rectangles(root: ET.Element, width: int) -> tuple[list[tuple[int, int, int, int, str]], int]:
    rectangles: list[tuple[int, int, int, int, str]] = []
    transparent_tile_count = 0
    is_visible = visible_tile_checker(root)
    for layer in root.findall("layer"):
        if properties(layer).get("walkable") != "false":
            continue
        data = layer.find("data")
        if data is None or data.get("encoding") != "csv":
            raise ValueError(f"Collision layer {layer.get('name')!r} must use CSV encoding")
        gids = [int(value.strip()) for value in (data.text or "").split(",") if value.strip()]
        expected_tiles = width * int(layer.get("height", "0"))
        if len(gids) != expected_tiles:
            raise ValueError(f"Collision layer {layer.get('name')!r} has {len(gids)} tiles; expected {expected_tiles}")
        label = layer.get("name", "Obstacle").lower()
        for y in range(int(layer.get("height", "0"))):
            row = gids[y * width : (y + 1) * width]
            blocking = []
            for gid in row:
                if gid == 0:
                    blocking.append(False)
                    continue
                visible = is_visible(gid)
                blocking.append(visible)
                if not visible:
                    transparent_tile_count += 1
            x = 0
            while x < width:
                if not blocking[x]:
                    x += 1
                    continue
                start = x
                while x < width and blocking[x]:
                    x += 1
                rectangles.append((start, y, x - start, 1, label))
    return rectangles, transparent_tile_count


def main() -> None:
    root = ET.parse(SOURCE_PATH).getroot()
    width = int(root.get("width", "0"))
    height = int(root.get("height", "0"))
    tile_width = int(root.get("tilewidth", "0"))
    tile_height = int(root.get("tileheight", "0"))
    if width <= 0 or height <= 0 or tile_width <= 0 or tile_height <= 0:
        raise ValueError("TMX map must have positive width, height, tilewidth, and tileheight")

    doors = object_placements(root, "Warp", "door", tile_width, tile_height)
    warps = warp_placements(root, tile_width, tile_height)
    spawns = spawn_placements(root, tile_width, tile_height)
    actables = actable_placements(root, tile_width, tile_height)
    wild_zones = encounter_zones(root, tile_width, tile_height)
    portals = portal_placements(root, tile_width, tile_height)
    rectangles, transparent_tile_count = collision_rectangles(root, width)

    lines = [
        "// Generated from Overworld.tmx by scripts/build-tiled-overworld.py. Do not edit.",
        'import { MapActableDef, MapCollisionRect, MapEncounterZone, MapPoint, MapPortalDef, MapSpawnDef, MapWarpDef } from "./OverworldMapTypes";',
        "",
        "export const TILED_COLLISION_RECTS: MapCollisionRect[] = [",
        *[f'\t{{ x: {x}, y: {y}, width: {rect_width}, height: {rect_height}, label: "{label}" }},' for x, y, rect_width, rect_height, label in rectangles],
        "];",
        "",
        "export const TILED_DOORS: Record<number, MapPoint> = {",
        *[f"\t{door_id}: {{ x: {x}, y: {y} }}," for door_id, x, y in doors],
        "};",
        "",
        "export const TILED_WARPS: MapWarpDef[] = [",
        *[f'\t{{ position: {{ x: {x}, y: {y} }}, targetMapId: "{target_map}", targetSpawnId: "{target_spawn}" }},' for x, y, target_map, target_spawn in warps],
        "];",
        "",
        "export const TILED_SPAWNS: MapSpawnDef[] = [",
        *[f'\t{{ id: "{spawn_id}", position: {{ x: {x}, y: {y} }}, facing: "{facing}" }},' for spawn_id, x, y, facing in spawns],
        "];",
        "",
        "export const TILED_WILD_ZONES: MapEncounterZone[] = [",
        *[f"\t{{ x: {x}, y: {y}, width: {zone_width}, height: {zone_height} }}," for x, y, zone_width, zone_height in wild_zones],
        "];",
        "",
        "export const TILED_PORTALS: MapPortalDef[] = " + json.dumps(portals) + ";",
        "",
        "export const TILED_ACTABLES: MapActableDef[] = " + json.dumps(actables) + ";",
        "",
    ]
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)} "
        f"({len(rectangles)} collision rectangles, {len(doors)} doors, {len(actables)} actables; "
        f"{len(wild_zones)} wild zones; ignored {transparent_tile_count} transparent obstacle tiles)"
    )


if __name__ == "__main__":
    main()
