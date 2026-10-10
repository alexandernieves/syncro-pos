#!/usr/bin/env python3
"""
Illustrative animated GIFs for the demo landing pages (local development only).

They are built from the product photos (slow zoom, pans and crossfades with a
caption), not real usage footage: merchants replace them with their own videos.

Usage: python3 make_gifs.py <out_dir> < spec.json
spec.json: [{"key": "licuadora", "images": [url, ...], "steps": ["Agrega...", ...]}]
"""
from __future__ import annotations

import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 420
FPS_MS = 85
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
BRAND = (228, 87, 46)


def load(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "syncro-dev-content"})
    with urllib.request.urlopen(req, timeout=30) as res:
        img = Image.open(io.BytesIO(res.read())).convert("RGBA")
    # Flatten on white and fit in a square canvas
    bg = Image.new("RGB", img.size, "white")
    bg.paste(img, mask=img.split()[3])
    bg.thumbnail((SIZE, SIZE), Image.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), "white")
    canvas.paste(bg, ((SIZE - bg.width) // 2, (SIZE - bg.height) // 2))
    return canvas


def zoom(img: Image.Image, scale: float, dx: float = 0.0, dy: float = 0.0) -> Image.Image:
    """Crop the center (shifted by dx/dy, -1..1) at `scale` and resize back."""
    w = SIZE / scale
    cx = SIZE / 2 + dx * (SIZE - w) / 2
    cy = SIZE / 2 + dy * (SIZE - w) / 2
    box = (cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2)
    return img.crop(tuple(int(v) for v in box)).resize((SIZE, SIZE), Image.LANCZOS)


def caption(frame: Image.Image, text: str, number: int | None) -> Image.Image:
    frame = frame.copy()
    draw = ImageDraw.Draw(frame, "RGBA")
    font = ImageFont.truetype(FONT, 22)
    bar_h = 64
    draw.rectangle((0, SIZE - bar_h, SIZE, SIZE), fill=(17, 24, 39, 215))
    x = 18
    if number is not None:
        draw.ellipse((x, SIZE - bar_h + 14, x + 36, SIZE - bar_h + 50), fill=BRAND)
        n = str(number)
        tw = draw.textlength(n, font=font)
        draw.text((x + 18 - tw / 2, SIZE - bar_h + 19), n, font=font, fill="white")
        x += 50
    # Shrink long captions to fit one line
    size = 22
    while draw.textlength(text, font=font) > SIZE - x - 16 and size > 14:
        size -= 1
        font = ImageFont.truetype(FONT, size)
    draw.text((x, SIZE - bar_h + (bar_h - size) / 2 - 2), text, font=font, fill="white")
    return frame


def save(frames: list[Image.Image], path: Path) -> None:
    palette_frames = [f.convert("P", palette=Image.ADAPTIVE, colors=96) for f in frames]
    palette_frames[0].save(path, save_all=True, append_images=palette_frames[1:], duration=FPS_MS, loop=0, optimize=True, disposal=2)


def showcase(images: list[Image.Image]) -> list[Image.Image]:
    """Slow zoom on each photo with a crossfade to the next one."""
    frames = []
    for i, img in enumerate(images):
        steps = 12
        for t in range(steps):
            frames.append(zoom(img, 1.0 + 0.18 * t / steps, dx=0.25 * (1 if i % 2 else -1) * t / steps))
        if len(images) > 1:
            nxt = images[(i + 1) % len(images)]
            last = frames[-1]
            for t in range(1, 5):
                frames.append(Image.blend(last, nxt, t / 5))
    return frames


def step_clip(img: Image.Image, text: str, number: int, motion: int) -> list[Image.Image]:
    """Short move over the photo (zoom in, pan or zoom out) with the step caption."""
    frames = []
    for t in range(18):
        p = t / 17
        if motion == 0:
            f = zoom(img, 1.0 + 0.35 * p)
        elif motion == 1:
            f = zoom(img, 1.3, dx=-0.9 + 1.8 * p, dy=0.1)
        else:
            f = zoom(img, 1.35 - 0.35 * p, dy=-0.4 + 0.4 * p)
        frames.append(caption(f, text, number))
    return frames + [frames[-1]] * 6  # short pause on the last frame


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    result = {}
    for item in json.load(sys.stdin):
        images = [load(u) for u in item["images"]]
        files = {"showcase": str(out / f"{item['key']}-showcase.gif")}
        save(showcase(images), Path(files["showcase"]))
        for n, text in enumerate(item["steps"], start=1):
            path = out / f"{item['key']}-paso-{n}.gif"
            save(step_clip(images[(n - 1) % len(images)], text, n, (n - 1) % 3), path)
            files[f"step{n}"] = str(path)
        result[item["key"]] = files
        print(f"✓ {item['key']}: {len(files)} GIFs", file=sys.stderr)
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
