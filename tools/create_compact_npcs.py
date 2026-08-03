"""Create a compact, original 16x16 NPC tileset for the 16x16 overworld."""

from pathlib import Path

from PIL import Image, ImageDraw


OUTLINE = "#20283b"
SKIN = "#f4bd86"
SKIN_SHADOW = "#d9825c"
WHITE = "#f4f1dc"
BLACK = "#18202c"

NPCS = [
    ("ranger", "#6c8e43", "#315f48", "#d9c46b", "cap"),
    ("shopkeeper", "#68413c", "#c27d44", "#f3d397", "apron"),
    ("nurse", "#d97393", "#f3f0df", "#e56b87", "nurse"),
    ("fisher", "#466f9b", "#3d7195", "#d5b65e", "cap"),
    ("scientist", "#bac2c9", "#e8e9e3", "#5c87a0", "coat"),
    ("student", "#9a553f", "#e2c453", "#586d9a", "hair"),
    ("gardener", "#5f8d4e", "#61a052", "#ddad50", "hat"),
    ("elder", "#a6a4ae", "#7c6688", "#9b7a56", "hair"),
    ("mechanic", "#c7633d", "#486f9a", "#d39e4e", "cap"),
    ("traveler", "#78578f", "#9b689c", "#574160", "hood"),
]


def rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str) -> None:
    draw.rectangle(box, fill=color)


def person(name: str, hair: str, shirt: str, accent: str, accessory: str) -> Image.Image:
    image = Image.new("RGBA", (16, 16))
    draw = ImageDraw.Draw(image)

    # Head and face.  The dark outline keeps every small figure legible over
    # bright terrain, while the compact proportions fit one 16x16 map cell.
    rect(draw, (4, 1, 11, 7), OUTLINE)
    rect(draw, (5, 2, 10, 6), SKIN)
    rect(draw, (5, 6, 10, 7), SKIN_SHADOW)
    rect(draw, (6, 4, 6, 4), BLACK)
    rect(draw, (9, 4, 9, 4), BLACK)

    if accessory == "hood":
        rect(draw, (3, 0, 12, 6), OUTLINE)
        rect(draw, (4, 1, 11, 5), hair)
        rect(draw, (5, 3, 10, 6), SKIN)
        rect(draw, (6, 4, 6, 4), BLACK)
        rect(draw, (9, 4, 9, 4), BLACK)
    elif accessory == "nurse":
        rect(draw, (4, 0, 11, 2), OUTLINE)
        rect(draw, (5, 0, 10, 1), WHITE)
        rect(draw, (7, 0, 8, 2), accent)
        rect(draw, (3, 2, 4, 6), hair)
        rect(draw, (11, 2, 12, 6), hair)
    elif accessory in {"cap", "hat"}:
        rect(draw, (3, 0, 12, 3), OUTLINE)
        rect(draw, (4, 0, 11, 2), hair)
        rect(draw, (2, 3, 13, 3), OUTLINE)
        rect(draw, (3, 3, 12, 3), hair)
        if accessory == "hat":
            rect(draw, (6, 0, 9, 1), accent)
    else:
        rect(draw, (4, 0, 11, 3), OUTLINE)
        rect(draw, (5, 0, 10, 2), hair)
        rect(draw, (4, 3, 5, 5), hair)
        rect(draw, (10, 3, 11, 5), hair)

    # Body, hands, and feet all reach the lower edge so placement on a map is
    # visually unambiguous—there is no tall-sprite anchor to configure.
    rect(draw, (3, 8, 12, 13), OUTLINE)
    rect(draw, (4, 8, 11, 12), shirt)
    rect(draw, (4, 13, 6, 15), OUTLINE)
    rect(draw, (9, 13, 11, 15), OUTLINE)
    rect(draw, (5, 13, 6, 14), accent)
    rect(draw, (9, 13, 10, 14), accent)
    rect(draw, (2, 9, 3, 12), OUTLINE)
    rect(draw, (12, 9, 13, 12), OUTLINE)
    rect(draw, (2, 10, 2, 11), SKIN)
    rect(draw, (13, 10, 13, 11), SKIN)

    if accessory == "apron":
        rect(draw, (5, 9, 10, 12), accent)
        rect(draw, (6, 9, 9, 9), WHITE)
    elif accessory == "coat":
        rect(draw, (5, 8, 10, 12), WHITE)
        rect(draw, (7, 9, 8, 12), accent)
    elif accessory == "nurse":
        rect(draw, (7, 8, 8, 12), accent)
    elif accessory == "hood":
        rect(draw, (4, 8, 11, 9), hair)
    elif name == "fisher":
        rect(draw, (4, 9, 11, 10), accent)
    elif name == "elder":
        rect(draw, (12, 8, 12, 14), accent)

    return image


def main() -> None:
    sheet = Image.new("RGBA", (16 * len(NPCS), 16))
    manifest = []
    for tile_id, npc in enumerate(NPCS):
        image = person(*npc)
        sheet.alpha_composite(image, (tile_id * 16, 0))
        manifest.append((tile_id, npc[0]))

    sheet.save("npcs-compact-16.png")
    Path("npcs-compact-16.tsx").write_text(
        "\n".join(
            [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<tileset version="1.10" tiledversion="1.12.2" name="npcs-compact-16" tilewidth="16" tileheight="16" tilecount="10" columns="10">',
                ' <image source="npcs-compact-16.png" width="160" height="16"/>',
                '</tileset>',
                '',
            ]
        ),
        encoding="utf-8",
    )
    Path("npcs-compact-16.txt").write_text("\n".join(f"{tile_id}: {name}" for tile_id, name in manifest) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
