"""Remove the background color from a PNG image, making it transparent."""

import os
import sys
import shutil
from collections import deque
from PIL import Image

def remove_background(input_path, tolerance=30):
    """
    Remove the background color from a PNG.

    Backs up the original to an 'original' subfolder, then saves the
    transparent version in place of the original file.

    Args:
        input_path: Path to input PNG
        tolerance: Color distance threshold (0=exact match, higher=more removal)
    """
    directory = os.path.dirname(input_path) or "."
    filename = os.path.basename(input_path)
    backup_dir = os.path.join(directory, "original")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, filename)

    shutil.copy2(input_path, backup_path)
    print(f"Backup: {backup_path}")

    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Sample background color from top-left corner
    bg = pixels[0, 0][:3]

    # Flood-fill from all edge pixels to only remove connected background
    visited = set()
    queue = deque()

    # Seed with all edge pixels
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(1, h - 1):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        visited.add((x, y))

        r, g, b, a = pixels[x, y]
        distance = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        if distance <= tolerance:
            pixels[x, y] = (r, g, b, 0)
            queue.append((x + 1, y))
            queue.append((x - 1, y))
            queue.append((x, y + 1))
            queue.append((x, y - 1))

    img.save(input_path, "PNG")
    print(f"Saved: {input_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remove_bg.py <input.png> [tolerance]")
        print("  Backs up original to ./original/ subfolder, saves transparent version in place")
        print("  tolerance: 0=exact color match, 30=default, higher=more aggressive")
        sys.exit(1)

    input_file = sys.argv[1]
    tol = int(sys.argv[2]) if len(sys.argv) > 2 else 30

    remove_background(input_file, tol)
