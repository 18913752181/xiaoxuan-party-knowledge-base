"""Convert the approved generated rise sheet into a true-alpha sprite sheet."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def background_alpha(red: int, green: int, blue: int) -> int:
    darkest = min(red, green, blue)
    chroma = max(red, green, blue) - darkest
    # The generated backdrop is a neutral 249-254 checkerboard. Dimmo's cream
    # details are warmer and darker, so chroma protects the eyes, whiskers and
    # forehead mark while neutral near-white pixels become transparent.
    if chroma >= 12 or darkest <= 235:
        return 255
    if darkest >= 247 and chroma <= 6:
        return 0
    darkness_alpha = round((247 - darkest) / 12 * 255)
    chroma_alpha = round(chroma / 12 * 255)
    return max(0, min(255, max(darkness_alpha, chroma_alpha)))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare-dimmo-rise-sheet.py SOURCE DESTINATION")
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    image = Image.open(source).convert("RGB")
    rgba = Image.new("RGBA", image.size)
    rgba.putdata([
        (red, green, blue, background_alpha(red, green, blue))
        for red, green, blue in image.getdata()
    ])
    destination.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(destination, optimize=True)
    print(destination)


if __name__ == "__main__":
    main()
