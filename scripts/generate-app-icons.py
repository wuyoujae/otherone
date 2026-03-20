#!/usr/bin/env python3

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE_SVG = ROOT / "otherone-icon.svg"
RESOURCES_DIR = ROOT / "resources"
ICONSET_DIR = RESOURCES_DIR / "icon.iconset"
LEGACY_SOURCE_PNG = RESOURCES_DIR / "icon-source.png"


def ensure_resources_dir() -> None:
    RESOURCES_DIR.mkdir(exist_ok=True)
    if LEGACY_SOURCE_PNG.exists():
        LEGACY_SOURCE_PNG.unlink()
    if ICONSET_DIR.exists():
        shutil.rmtree(ICONSET_DIR)
    ICONSET_DIR.mkdir()

def render_master_png() -> Path:
    master_png = RESOURCES_DIR / "icon-1024.png"
    quicklook_output = RESOURCES_DIR / f"{SOURCE_SVG.name}.png"

    if quicklook_output.exists():
        quicklook_output.unlink()

    subprocess.run(
        ["qlmanage", "-t", "-s", "1024", "-o", str(RESOURCES_DIR), str(SOURCE_SVG)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    if not quicklook_output.exists():
        raise RuntimeError(f"Failed to render {SOURCE_SVG.name} with qlmanage")

    quicklook_output.replace(master_png)
    return master_png


def build_base_images() -> None:
    master_png = render_master_png()

    with Image.open(master_png) as image:
        image.save(RESOURCES_DIR / "icon.png", format="PNG")
        image.save(
            RESOURCES_DIR / "icon.ico",
            format="ICO",
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )


def build_icns() -> None:
    sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }

    with Image.open(RESOURCES_DIR / "icon-1024.png") as image:
        for filename, size in sizes.items():
            resized = image.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(ICONSET_DIR / filename, format="PNG")

    subprocess.run(
        ["iconutil", "-c", "icns", str(ICONSET_DIR), "-o", str(RESOURCES_DIR / "icon.icns")],
        check=True,
    )


def main() -> None:
    ensure_resources_dir()
    build_base_images()
    build_icns()
    shutil.rmtree(ICONSET_DIR)
    print(f"Generated app icons in {RESOURCES_DIR}")


if __name__ == "__main__":
    main()
