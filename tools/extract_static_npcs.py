from pathlib import Path

from PIL import Image


SOURCE = Path("npcs.png")
OUTPUT = Path("npcs-static.png")

# The source is laid out on a 16 px-wide grid with one-pixel columns between
# frames.  Each NPC occupies a nine-pose strip; the front-facing idle is the
# lead frame.  Strips start every ten grid columns.
FRAME_WIDTH = 16
FRAME_HEIGHT = 24
FRAME_PITCH_X = 17
FRAME_PITCH_Y = 24
GROUP_COLUMNS = range(0, 50, 10)

# Decorative attribution in the original sheet, not a character sprite.
CREDIT_BOUNDS = (594, 510, 756, 582)


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    return pixel[:3] in {(115, 197, 165), (115, 199, 165)}


def intersects(bounds: tuple[int, int, int, int], other: tuple[int, int, int, int]) -> bool:
    left, top, right, bottom = bounds
    other_left, other_top, other_right, other_bottom = other
    return left < other_right and right > other_left and top < other_bottom and bottom > other_top


def foreground_count(frame: Image.Image) -> int:
    return sum(not is_background(pixel) for pixel in frame.get_flattened_data())


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    frames: list[Image.Image] = []

    for row in range(source.height // FRAME_PITCH_Y):
        top = row * FRAME_PITCH_Y
        for column in GROUP_COLUMNS:
            left = 1 + column * FRAME_PITCH_X
            bounds = (left, top, left + FRAME_WIDTH, top + FRAME_HEIGHT)
            if bounds[2] > source.width or intersects(bounds, CREDIT_BOUNDS):
                continue

            frame = source.crop(bounds)
            if foreground_count(frame) < 25:
                continue

            transparent = Image.new("RGBA", frame.size)
            transparent.putdata(
                [
                    (0, 0, 0, 0) if is_background(pixel) else pixel
                    for pixel in frame.get_flattened_data()
                ]
            )
            frames.append(transparent)

    columns = 16
    rows = (len(frames) + columns - 1) // columns
    output = Image.new("RGBA", (columns * FRAME_WIDTH, rows * FRAME_HEIGHT))
    for index, frame in enumerate(frames):
        x = (index % columns) * FRAME_WIDTH
        y = (index // columns) * FRAME_HEIGHT
        output.alpha_composite(frame, (x, y))

    output.save(OUTPUT)
    print(f"Wrote {len(frames)} candidate NPCs to {OUTPUT}")


if __name__ == "__main__":
    main()
