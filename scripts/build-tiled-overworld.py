"""Export Portalmon overworld gameplay data from the Tiled TMX source.

The game deliberately renders the precomposed Overworld.png at runtime.  This
script turns the non-visual information in Overworld.tmx into TypeScript:

* every non-empty tile in a layer whose ``walkable`` property is false blocks;
* objects in the Warp layer become numbered door locations;
* objects in the Actables layer become talkable people and signs, carrying the
  ``name`` and ``message`` authored in Tiled.

Run ``npm run map:tiled`` after editing the TMX in Tiled.
"""

from __future__ import annotations

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


def actable_placements(
    root: ET.Element,
    tile_width: int,
    tile_height: int,
) -> list[tuple[int, str, str, int, int]]:
    """Read the Actables layer: one talkable person or sign per object.

    Each object is identified by its Tiled object ID rather than by name, because
    several signs deliberately share the same ``name``.
    """

    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Actables"), None)
    if group is None:
        raise ValueError("Missing required object layer: Actables")

    placements: list[tuple[int, str, str, int, int]] = []
    for object_ in group.findall("object"):
        object_id = object_.get("id", "?")
        object_properties = properties(object_)
        for required in ("name", "message"):
            if not object_properties.get(required, "").strip():
                raise ValueError(
                    f"Actables object {object_id} needs a non-empty {required!r} property "
                    f"(found {sorted(object_properties)})"
                )

        x = exact_tile(float(object_.get("x", "0")), tile_width, f"Actables object {object_id} X")
        y = exact_tile(float(object_.get("y", "0")), tile_height, f"Actables object {object_id} Y")
        width = exact_tile(float(object_.get("width", "0")), tile_width, f"Actables object {object_id} width")
        height = exact_tile(float(object_.get("height", "0")), tile_height, f"Actables object {object_id} height")
        if width != 1 or height != 1:
            raise ValueError(f"Actables object {object_id} must be exactly one tile (found {width}x{height})")
        placements.append((int(object_id), object_properties["name"], object_properties["message"], x, y))

    positions = [(x, y) for _, _, _, x, y in placements]
    duplicate = next((position for position in positions if positions.count(position) > 1), None)
    if duplicate is not None:
        raise ValueError(f"Multiple Actables objects share tile {duplicate[0]},{duplicate[1]}")

    return sorted(placements)


def ts_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def encounter_zones(root: ET.Element, tile_width: int, tile_height: int) -> list[tuple[int, int, int, int]]:
    group = next((candidate for candidate in root.findall("objectgroup") if candidate.get("name") == "Wild"), None)
    if group is None:
        return []

    zones: list[tuple[int, int, int, int]] = []
    for object_ in group.findall("object"):
        if properties(object_).get("wild") != "true":
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
    actables = actable_placements(root, tile_width, tile_height)
    wild_zones = encounter_zones(root, tile_width, tile_height)
    rectangles, transparent_tile_count = collision_rectangles(root, width)

    lines = [
        "// Generated from Overworld.tmx by scripts/build-tiled-overworld.py. Do not edit.",
        'import { MapCollisionRect, MapEncounterZone, MapPoint } from "./OverworldMapTypes";',
        "",
        "export interface TiledActable",
        "{",
        "\t/** Tiled object ID; names are not unique, several signs share one. */",
        "\tid: number;",
        "\tname: string;",
        "\tmessage: string;",
        "\tposition: MapPoint;",
        "}",
        "",
        "export const TILED_COLLISION_RECTS: MapCollisionRect[] = [",
        *[f'\t{{ x: {x}, y: {y}, width: {rect_width}, height: {rect_height}, label: "{label}" }},' for x, y, rect_width, rect_height, label in rectangles],
        "];",
        "",
        "export const TILED_DOORS: Record<number, MapPoint> = {",
        *[f"\t{door_id}: {{ x: {x}, y: {y} }}," for door_id, x, y in doors],
        "};",
        "",
		"export const TILED_WILD_ZONES: MapEncounterZone[] = [",
		*[f"\t{{ x: {x}, y: {y}, width: {zone_width}, height: {zone_height} }}," for x, y, zone_width, zone_height in wild_zones],
		"];",
		"",
        "export const TILED_ACTABLES: TiledActable[] = [",
        *[
            f"\t{{ id: {actable_id}, name: {ts_string(name)}, message: {ts_string(message)},"
            f" position: {{ x: {x}, y: {y} }} }},"
            for actable_id, name, message, x, y in actables
        ],
        "];",
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
