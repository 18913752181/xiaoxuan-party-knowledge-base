"""Build compositor-friendly Dimmo transition assets from the approved key poses."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "public" / "images"
FRAME_RATE = 60
LAST_FRAME_HOLD_MS = 1_000


def extract_frames(path: Path, count: int) -> list[Image.Image]:
    strip = Image.open(path).convert("RGBA")
    frame_size = strip.height
    return [
        strip.crop((index * frame_size, 0, (index + 1) * frame_size, frame_size))
        for index in range(count)
    ]


def premultiplied_mix(first: Image.Image, second: Image.Image, amount: float) -> Image.Image:
    """Interpolate RGBA without losing opacity or producing pale edge halos."""
    left = np.asarray(first, dtype=np.float32) / 255.0
    right = np.asarray(second, dtype=np.float32) / 255.0

    left_alpha = left[..., 3:4]
    right_alpha = right[..., 3:4]
    alpha = left_alpha * (1.0 - amount) + right_alpha * amount
    premultiplied = (
        left[..., :3] * left_alpha * (1.0 - amount)
        + right[..., :3] * right_alpha * amount
    )
    color = np.divide(
        premultiplied,
        alpha,
        out=np.zeros_like(premultiplied),
        where=alpha > 1e-6,
    )
    rgba = np.concatenate((color, alpha), axis=2)
    return Image.fromarray(np.clip(np.rint(rgba * 255.0), 0, 255).astype(np.uint8), "RGBA")


def densify(keyframes: list[Image.Image], duration_ms: int) -> list[Image.Image]:
    interval_count = max(1, int(duration_ms * FRAME_RATE / 1_000))
    output: list[Image.Image] = []

    for output_index in range(interval_count + 1):
        position = output_index / interval_count * (len(keyframes) - 1)
        first_index = min(len(keyframes) - 1, int(position))
        second_index = min(len(keyframes) - 1, first_index + 1)
        amount = position - first_index
        output.append(premultiplied_mix(keyframes[first_index], keyframes[second_index], amount))

    return output


def frame_durations(frame_count: int, duration_ms: int) -> list[int]:
    """Land on the final pose just before React swaps to the exact approved still."""
    interval_count = frame_count - 1
    active_duration = max(interval_count, duration_ms - 8)
    base, remainder = divmod(active_duration, interval_count)
    durations = [base + (1 if index < remainder else 0) for index in range(interval_count)]
    return durations + [LAST_FRAME_HOLD_MS]


def save_animation(name: str, frames: list[Image.Image], duration_ms: int) -> None:
    destination = IMAGE_DIR / name
    frames[0].save(
        destination,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=frame_durations(len(frames), duration_ms),
        loop=0,
        lossless=True,
        quality=100,
        method=3,
        minimize_size=False,
    )
    print(f"{destination.name}: {len(frames)} frames")


def main() -> None:
    rise_duration = 720
    yawn_open_duration = 440
    yawn_close_duration = 360

    rise = densify(extract_frames(IMAGE_DIR / "dimmo-rise-transition-v2.png", 8), rise_duration)
    yawn_open = densify(
        extract_frames(IMAGE_DIR / "dimmo-yawn-open-transition-v2.png", 5),
        yawn_open_duration,
    )
    yawn_close = densify(
        extract_frames(IMAGE_DIR / "dimmo-yawn-close-transition-v2.png", 4),
        yawn_close_duration,
    )

    save_animation("dimmo-rise-motion.webp", rise, rise_duration)
    save_animation("dimmo-settle-motion.webp", list(reversed(rise)), rise_duration)
    save_animation("dimmo-yawn-open-motion.webp", yawn_open, yawn_open_duration)
    save_animation("dimmo-yawn-close-motion.webp", yawn_close, yawn_close_duration)


if __name__ == "__main__":
    main()
