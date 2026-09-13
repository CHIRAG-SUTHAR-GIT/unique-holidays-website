#!/usr/bin/env python3
"""Build phone-sized copies of the full-bleed scene photographs.

The scenes are 2400px wide so they hold up on a desktop. A phone shows them
about 412 CSS px wide, and decoding a 2400x1600 JPEG costs roughly 15MB of
memory and a visible pause before the scroll can move again. These 1000px
copies are what the phone gets through srcset; the originals stay for wide
screens. Re-run after replacing anything in assets/img/scenes/.

    python3 tools/make-mobile-scenes.py
"""

import pathlib
import sys

from PIL import Image

WIDTH = 1000
SRC = pathlib.Path(__file__).resolve().parent.parent / "assets" / "img" / "scenes"


def main():
    if not SRC.is_dir():
        sys.exit("no %s" % SRC)
    made = []
    for path in sorted(SRC.glob("*.jpg")):
        if path.stem.endswith("-sm"):
            continue
        out = path.with_name(path.stem + "-sm.jpg")
        with Image.open(path) as im:
            if im.width <= WIDTH:
                continue
            im = im.convert("RGB")
            h = round(im.height * WIDTH / im.width)
            im.resize((WIDTH, h), Image.LANCZOS).save(out, "JPEG", quality=80, optimize=True, progressive=True)
        made.append("%s  %dKB -> %dKB" % (out.name, path.stat().st_size // 1024, out.stat().st_size // 1024))
    print("\n".join(made) if made else "nothing to do")


if __name__ == "__main__":
    main()
