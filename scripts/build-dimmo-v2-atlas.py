"""Build the Dimmo V2 alpha atlas from the three approved character images.

Generated sprite sheets provide semantic in-between poses. The approved resting,
awake and yawning PNGs replace every segment endpoint so the site always lands
on the exact supplied character artwork.
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / "motion" / "dimmo-v2"
PILOT = MOTION / "pilot"
FRAMES = MOTION / "frames" / "final"
NATIVE = MOTION / "frames" / "native"
BUILD = MOTION / "build"
PUBLIC = ROOT / "public" / "images"
EXACT = ROOT / "local-preview" / "dimmo-v2-transparent-exact"

FPS = 60
CELL = 256
BOTTOM = 244
COLUMNS = 12

# Match the pacing of the earlier approved animation. FFmpeg's minterpolate
# trims roughly one source interval at each edge, so these build durations are
# slightly longer than the visible targets (2.08s / 0.75s / 0.75s / 0.54s).
RISE_BUILD_MS = 2420
YAWN_OPEN_BUILD_MS = 940
YAWN_CLOSE_BUILD_MS = 940
SETTLE_BUILD_MS = 620


def split_sheet(path: Path, columns: int, rows: int) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    frames: list[Image.Image] = []
    for row in range(rows):
        top = round(row * sheet.height / rows)
        bottom = round((row + 1) * sheet.height / rows)
        for column in range(columns):
            left = round(column * sheet.width / columns)
            right = round((column + 1) * sheet.width / columns)
            frames.append(sheet.crop((left, top, right, bottom)))
    return frames


def normalize(frame: Image.Image, target_height: float) -> Image.Image:
    rgba = frame.convert("RGBA")
    # Optical flow can leave extremely faint pixels far from the subject. They
    # must not participate in geometry normalization or the cat will pulse.
    geometry_alpha = rgba.getchannel("A").point(lambda value: 255 if value >= 32 else 0)
    bbox = geometry_alpha.getbbox()
    if bbox is None:
        raise ValueError("Empty sprite frame")
    subject = rgba.crop(bbox)
    scale = target_height / subject.height
    if subject.width * scale > 238:
        scale = 238 / subject.width
    size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    x = round((CELL - subject.width) / 2)
    y = BOTTOM - subject.height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def flow_interpolate(keyframes: list[Image.Image], duration_ms: int) -> list[Image.Image]:
    """Create real moving in-betweens while preserving the RGBA channel."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to build the Dimmo V2 atlas")
    input_fps = (len(keyframes) - 1) / (duration_ms / 1000)
    with tempfile.TemporaryDirectory(prefix="dimmo-v2-flow-") as temp:
        directory = Path(temp)
        inputs = directory / "input"
        outputs = directory / "output"
        inputs.mkdir()
        outputs.mkdir()
        for index, frame in enumerate(keyframes):
            frame.save(inputs / f"frame-{index:04d}.png")
        subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-framerate",
                f"{input_fps:.8f}",
                "-i",
                str(inputs / "frame-%04d.png"),
                "-vf",
                f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
                "-pix_fmt",
                "rgba",
                str(outputs / "frame-%04d.png"),
            ],
            check=True,
        )
        result = [Image.open(path).convert("RGBA").copy() for path in sorted(outputs.glob("*.png"))]
    if not result:
        raise RuntimeError("Optical-flow interpolation produced no frames")
    result[0] = keyframes[0]
    result.append(keyframes[-1])
    return result


def normalized_sequence(frames: list[Image.Image], start_height: float, end_height: float) -> list[Image.Image]:
    count = max(1, len(frames) - 1)
    return [
        normalize(frame, start_height + (end_height - start_height) * index / count)
        for index, frame in enumerate(frames)
    ]


def main() -> None:
    resting = normalize(Image.open(EXACT / "dimmo-resting-v2.png"), 120)
    awake = normalize(Image.open(EXACT / "dimmo-awake-v2.png"), 220)
    yawning = normalize(Image.open(EXACT / "dimmo-yawning-v2.png"), 220)

    rise_source = split_sheet(PILOT / "rise-sheet-alpha-v2.png", 4, 3)
    # The generated final cell drifts back into a seated pose. Keep the first
    # eleven clean progressive poses, then land on the exact approved awake PNG.
    rise_keys = normalized_sequence(rise_source[:11], 120, 220)
    rise_keys.append(awake)
    yawn_keys = normalized_sequence(split_sheet(PILOT / "yawn-sheet-alpha.png", 3, 2), 220, 220)
    settle_keys = normalized_sequence(split_sheet(PILOT / "settle-sheet-alpha.png", 4, 2), 220, 120)

    rise_keys[0], rise_keys[-1] = resting, awake
    yawn_keys[0], yawn_keys[-1] = awake, yawning
    settle_keys[0], settle_keys[-1] = awake, resting

    NATIVE.mkdir(parents=True, exist_ok=True)
    for old in NATIVE.glob("*.png"):
        old.unlink()
    for name, sequence in (
        ("rise", rise_keys),
        ("yawn", yawn_keys),
        ("settle", settle_keys),
    ):
        for index, frame in enumerate(sequence):
            frame.save(NATIVE / f"{name}-{index:03d}.png", optimize=True)

    rise = normalized_sequence(flow_interpolate(rise_keys, RISE_BUILD_MS), 120, 220)
    yawn_open = normalized_sequence(flow_interpolate(yawn_keys, YAWN_OPEN_BUILD_MS), 220, 220)
    yawn_close = normalized_sequence(
        flow_interpolate(list(reversed(yawn_keys)), YAWN_CLOSE_BUILD_MS), 220, 220
    )
    settle = normalized_sequence(flow_interpolate(settle_keys, SETTLE_BUILD_MS), 220, 120)
    rise[0], rise[-1] = resting, awake
    yawn_open[0], yawn_open[-1] = awake, yawning
    yawn_close[0], yawn_close[-1] = yawning, awake
    settle[0], settle[-1] = awake, resting

    frames = list(rise)
    awake_frame = len(frames) - 1
    frames.extend(yawn_open[1:])
    yawn_frame = len(frames) - 1
    frames.extend(yawn_close[1:])
    drowsy_frame = len(frames) - 1
    frames.extend(settle[1:])
    rest_end_frame = len(frames) - 1

    FRAMES.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("frame-*.png"):
        old.unlink()
    for index, frame in enumerate(frames):
        frame.save(FRAMES / f"frame-{index:04d}.png", optimize=True)

    rows = math.ceil(len(frames) / COLUMNS)
    atlas_image = Image.new("RGBA", (COLUMNS * CELL, rows * CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas_image.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))

    atlas_path = PUBLIC / "dimmo-motion-atlas-v2.webp"
    atlas_image.save(atlas_path, format="WEBP", lossless=True, method=6)
    manifest = {
        "schemaVersion": 1,
        "frameCount": len(frames),
        "columns": COLUMNS,
        "rows": rows,
        "frameWidth": CELL,
        "frameHeight": CELL,
    }
    (PUBLIC / "dimmo-motion-atlas-v2.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    def seconds(frame: int) -> float:
        return frame / FPS

    timeline = {
        "schemaVersion": 1,
        "fps": FPS,
        "frameDuration": 1 / FPS,
        "initialState": "resting-start",
        "states": [
            {"id": "resting-start", "hold": seconds(0)},
            {"id": "awake", "hold": seconds(awake_frame)},
            {"id": "yawning", "hold": seconds(yawn_frame)},
            {"id": "drowsy", "hold": seconds(drowsy_frame)},
            {"id": "resting-end", "hold": seconds(rest_end_frame)},
        ],
    }
    (BUILD / "timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({**manifest, "states": timeline["states"], "atlas": str(atlas_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
