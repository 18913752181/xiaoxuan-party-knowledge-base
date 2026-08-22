"""Recover transparent Dimmo frames from the locally generated checkerboard MP4.

The source animation contains a baked light checkerboard rather than real alpha.
Dimmo is consistently dark, so a deterministic luminance mask is more stable
than per-frame AI matting and keeps the approved flat illustration colors intact.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def frame_paths(folder: Path) -> list[Path]:
    return sorted(folder.glob("frame_*.png"))


def dimmo_mask(rgb: np.ndarray) -> np.ndarray:
    linear = rgb.astype(np.float32)
    luminance = (
        linear[..., 0] * 0.2126
        + linear[..., 1] * 0.7152
        + linear[..., 2] * 0.0722
    )

    # The baked checkerboard is >= 233 in the source. A conservative threshold
    # keeps Dimmo's cream eyes and white whiskers while rejecting the backdrop.
    candidates = luminance < 229
    labels, count = ndimage.label(candidates)
    if count == 0:
        raise RuntimeError("No foreground component found")

    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    component = labels == int(np.argmax(sizes))

    # Close codec pinholes and fill only enclosed, small facial/detail holes.
    component = ndimage.binary_closing(component, iterations=1)
    filled = ndimage.binary_fill_holes(component)
    hole_labels, hole_count = ndimage.label(filled & ~component)
    if hole_count:
        hole_sizes = np.bincount(hole_labels.ravel())
        small_holes = np.isin(hole_labels, np.flatnonzero(hole_sizes < 2_500))
        component |= small_holes

    # A one-pixel signed-distance feather preserves anti-aliased edges without
    # retaining the bright checkerboard halo.
    inside = ndimage.distance_transform_edt(component)
    outside = ndimage.distance_transform_edt(~component)
    signed_distance = inside - outside
    return np.clip((signed_distance + 1.0) * 127.5, 0, 255).astype(np.uint8)


def square_crop(boxes: list[tuple[int, int, int, int]], size: tuple[int, int], padding: int) -> tuple[int, int, int, int]:
    left = min(box[0] for box in boxes) - padding
    top = min(box[1] for box in boxes) - padding
    right = max(box[2] for box in boxes) + padding
    bottom = max(box[3] for box in boxes) + padding
    width, height = size
    side = max(right - left, bottom - top)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    left = round(center_x - side / 2)
    top = round(center_y - side / 2)
    right = left + side
    bottom = top + side

    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > width:
        left -= right - width
        right = width
    if bottom > height:
        top -= bottom - height
        bottom = height
    return max(0, left), max(0, top), min(width, right), min(height, bottom)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--cell", type=int, default=360)
    parser.add_argument("--padding", type=int, default=28)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    paths = frame_paths(args.input)
    if not paths:
        raise SystemExit(f"No frame_*.png files in {args.input}")

    images: list[Image.Image] = []
    masks: list[np.ndarray] = []
    boxes: list[tuple[int, int, int, int]] = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        mask = dimmo_mask(np.asarray(image))
        box = Image.fromarray(mask, "L").getbbox()
        if box is None:
            raise RuntimeError(f"Empty foreground mask: {path}")
        images.append(image)
        masks.append(mask)
        boxes.append(box)

    crop = square_crop(boxes, images[0].size, args.padding)
    args.output.mkdir(parents=True, exist_ok=True)
    for index, (image, mask) in enumerate(zip(images, masks, strict=True), start=1):
        rgba = image.convert("RGBA")
        rgba.putalpha(Image.fromarray(mask, "L"))
        rgba = rgba.crop(crop).resize((args.cell, args.cell), Image.Resampling.LANCZOS)
        rgba.save(args.output / f"frame_{index:05d}.png", optimize=True)

    report = {
        "source": str(args.input.resolve()),
        "output": str(args.output.resolve()),
        "frameCount": len(paths),
        "sourceSize": list(images[0].size),
        "crop": list(crop),
        "cell": [args.cell, args.cell],
        "backgroundRecovery": "largest dark connected component with one-pixel feather",
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
