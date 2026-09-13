#!/usr/bin/env python3
"""Stamp a new build id across the site.

Three places have to agree or the cache guard in assets/js/boot.js either never
fires or fires forever: the ?v= stamps on every stylesheet and script link, the
BUILD constant inside boot.js, and version.json. This rewrites all three in one
go, so run it after any change to the CSS or JS and before pushing.

    python3 tools/bump-build.py            # today's date, next free letter
    python3 tools/bump-build.py 20260914a  # or name the id yourself

The id is YYYYMMDD plus a letter, so several builds a day stay in order.
"""

import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "version.json"
BOOT_FILE = ROOT / "assets" / "js" / "boot.js"
ID = re.compile(r"^\d{8}[a-z]$")


def next_id(current):
    today = datetime.date.today().strftime("%Y%m%d")
    if current[:8] == today and current[8:] < "z":
        return today + chr(ord(current[8]) + 1)
    return today + "a"


def main():
    current = json.loads(VERSION_FILE.read_text())["build"]
    new = sys.argv[1] if len(sys.argv) > 1 else next_id(current)
    if not ID.match(new):
        sys.exit("build id must look like 20260913a, got %r" % new)
    if new == current:
        sys.exit("build id is already %s" % new)

    touched = []
    for page in sorted(ROOT.glob("*.html")):
        text = page.read_text()
        stamped = text.replace("?v=" + current, "?v=" + new)
        if stamped != text:
            page.write_text(stamped)
            touched.append(page.name)

    boot = BOOT_FILE.read_text()
    stamped = boot.replace('var BUILD = "%s"' % current, 'var BUILD = "%s"' % new)
    if stamped == boot:
        sys.exit("did not find BUILD = %r in %s" % (current, BOOT_FILE))
    BOOT_FILE.write_text(stamped)
    VERSION_FILE.write_text('{"build": "%s"}\n' % new)

    print("%s -> %s" % (current, new))
    print("  " + ", ".join(touched + ["assets/js/boot.js", "version.json"]))


if __name__ == "__main__":
    main()
