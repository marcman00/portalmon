"""Create Atlas's compact 16x16 directional walking sprite sheet.

The sheet is 32x64 pixels: two walk frames across and rows ordered down, left,
right, up.  Its transparent background and fixed 16x16 cells let the overworld
renderer draw Atlas at exactly one logical map tile.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "Areas/Portalmon/Content/Images/Overworld/atlas-walk-16.png"

OUTLINE = "#1b2430"
METAL = "#68727d"
SHADOW = "#aeb7bd"
SHELL = "#f4f5eb"
HIGHLIGHT = "#ffffff"
EYE_DARK = "#123a71"
EYE = "#14a9ff"
EYE_HIGHLIGHT = "#d8ffff"


def rectangle(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str) -> None:
    draw.rectangle(box, fill=color)


def antenna(draw: ImageDraw.ImageDraw) -> None:
    rectangle(draw, (7, 0, 8, 1), OUTLINE)
    rectangle(draw, (7, 0, 7, 0), HIGHLIGHT)
    rectangle(draw, (7, 2, 8, 3), METAL)


def legs(draw: ImageDraw.ImageDraw, step: int) -> None:
    # Each foot stays on row 15 so the renderer can use one consistent anchor.
    left_x = 4 + step
    right_x = 10 - step
    rectangle(draw, (left_x, 11, left_x + 2, 14), OUTLINE)
    rectangle(draw, (left_x + 1, 12, left_x + 2, 13), METAL)
    rectangle(draw, (left_x - 1, 14, left_x + 2, 15), OUTLINE)
    rectangle(draw, (left_x, 14, left_x + 1, 14), SHADOW)
    rectangle(draw, (right_x, 11, right_x + 2, 14), OUTLINE)
    rectangle(draw, (right_x, 12, right_x + 1, 13), METAL)
    rectangle(draw, (right_x, 14, right_x + 3, 15), OUTLINE)
    rectangle(draw, (right_x + 1, 14, right_x + 2, 14), HIGHLIGHT)


def body(draw: ImageDraw.ImageDraw, offset_x: int = 0) -> None:
    rectangle(draw, (4 + offset_x, 3, 11 + offset_x, 11), OUTLINE)
    rectangle(draw, (3 + offset_x, 5, 12 + offset_x, 9), OUTLINE)
    rectangle(draw, (5 + offset_x, 3, 10 + offset_x, 11), SHELL)
    rectangle(draw, (4 + offset_x, 5, 11 + offset_x, 9), SHELL)
    rectangle(draw, (5 + offset_x, 3, 6 + offset_x, 4), HIGHLIGHT)
    rectangle(draw, (4 + offset_x, 9, 5 + offset_x, 10), SHADOW)
    rectangle(draw, (10 + offset_x, 9, 11 + offset_x, 10), SHADOW)


def arms(draw: ImageDraw.ImageDraw, offset_x: int = 0) -> None:
    rectangle(draw, (2 + offset_x, 7, 3 + offset_x, 11), OUTLINE)
    rectangle(draw, (12 + offset_x, 7, 13 + offset_x, 11), OUTLINE)
    rectangle(draw, (2 + offset_x, 8, 2 + offset_x, 10), METAL)
    rectangle(draw, (13 + offset_x, 8, 13 + offset_x, 10), METAL)


def front(draw: ImageDraw.ImageDraw, step: int) -> None:
    antenna(draw)
    body(draw)
    arms(draw)
    rectangle(draw, (5, 6, 10, 9), OUTLINE)
    rectangle(draw, (6, 6, 9, 8), EYE_DARK)
    rectangle(draw, (7, 6, 8, 8), EYE)
    rectangle(draw, (7, 6, 7, 6), EYE_HIGHLIGHT)
    legs(draw, step)


def side(draw: ImageDraw.ImageDraw, facing_right: bool, step: int) -> None:
    antenna(draw)
    body(draw)
    arms(draw)
    eye_x = 10 if facing_right else 4
    rectangle(draw, (eye_x, 6, eye_x + 1, 9), OUTLINE)
    rectangle(draw, (eye_x, 7, eye_x, 8), EYE)
    # Dark cable on the back edge clarifies the silhouette at this size.
    cable_x = 4 if facing_right else 10
    rectangle(draw, (cable_x, 4, cable_x + 1, 10), OUTLINE)
    rectangle(draw, (cable_x, 5, cable_x, 9), METAL)
    legs(draw, step)


def back(draw: ImageDraw.ImageDraw, step: int) -> None:
    antenna(draw)
    body(draw)
    arms(draw)
    rectangle(draw, (7, 4, 8, 10), OUTLINE)
    rectangle(draw, (7, 5, 7, 9), METAL)
    rectangle(draw, (8, 5, 8, 9), SHADOW)
    legs(draw, step)


def frame(direction: str, step: int) -> Image.Image:
    image = Image.new("RGBA", (16, 16))
    draw = ImageDraw.Draw(image)
    if direction == "down":
        front(draw, step)
    elif direction == "left":
        side(draw, facing_right=False, step=step)
    elif direction == "right":
        side(draw, facing_right=True, step=step)
    else:
        back(draw, step)
    return image


def main() -> None:
    sheet = Image.new("RGBA", (32, 64))
    for row, direction in enumerate(("down", "left", "right", "up")):
        for column, step in enumerate((-1, 1)):
            sheet.alpha_composite(frame(direction, step), (column * 16, row * 16))
    sheet.save(OUTPUT)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
