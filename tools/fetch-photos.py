#!/usr/bin/env python3
"""
Replace the placeholder illustrations with real, freely-licensed photographs.

Photos come from Wikimedia Commons, which needs no API key and states the
licence and author for every file, so the credits can be recorded properly.

    python3 tools/fetch-photos.py              # download into assets/img/destinations/
    python3 tools/fetch-photos.py --apply      # download, then point the HTML at them
    python3 tools/fetch-photos.py --apply --only goa,bali
    python3 tools/fetch-photos.py --dry-run    # just show what would be searched

Already have your own photos? Drop them in as
assets/img/destinations/<slug>.jpg and run:

    python3 tools/fetch-photos.py --apply --skip-download

Standard library only. Pillow is used to resize/compress when it happens to be
installed, and skipped when it is not.
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_DIR = os.path.join(ROOT, "assets", "img", "destinations")
PAGES = ["index.html", "destinations.html", "packages.html", "about.html", "contact.html"]
API = "https://commons.wikimedia.org/w/api.php"
UA = "UniqueHolidays-site-setup/1.0 (static site placeholder images)"
TARGET_WIDTH = 1600

# Search terms chosen to bias towards wide, recognisable landscape shots.
# Name the actual place, not the scenery: "beach palm sunset" will happily
# return a beach on the wrong continent.
QUERIES = {
    "kashmir":     "Dal Lake Srinagar shikara",
    "kerala":      "Kerala backwaters houseboat Alleppey",
    "goa":         "Palolem Beach Goa India",
    "ladakh":      "Pangong Tso Ladakh landscape",
    "rajasthan":   "Jaisalmer fort Rajasthan desert",
    "andaman":     "Radhanagar Beach Havelock Andaman",
    "himachal":    "Manali Himachal Pradesh mountains valley",
    "meghalaya":   "Living root bridge Cherrapunji Meghalaya",
    "dubai":       "Dubai skyline Burj Khalifa",
    "maldives":    "Maldives overwater bungalow lagoon",
    "bali":        "Bali rice terrace Tegallalang",
    "thailand":    "Railay Beach Krabi Thailand limestone",
    "singapore":   "Gardens by the Bay Singapore skyline",
    "switzerland": "Jungfrau Interlaken Swiss Alps",
    "vietnam":     "Ha Long Bay Vietnam junk boat",
    "turkey":      "Cappadocia hot air balloons Goreme",
    "europe":      "Paris Eiffel Tower skyline",
    "srilanka":    "Nine Arch Bridge Ella Sri Lanka",
}

BAD_EXT = (".svg", ".pdf", ".tif", ".tiff", ".ogv", ".webm", ".gif")


def api_get(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode("utf-8"))


def plain(html):
    """Commons metadata arrives as small HTML fragments."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(html))
    text = (text.replace("&amp;", "&").replace("&quot;", '"')
                .replace("&#039;", "'").replace("&lt;", "<").replace("&gt;", ">"))
    return " ".join(text.split())


def find_photo(query):
    """Return the first usable landscape photo for a search term."""
    data = api_get({
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",          # File:
        "gsrlimit": "12",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size|mime",
        "iiurlwidth": str(TARGET_WIDTH),
    })
    pages = (data.get("query") or {}).get("pages") or []
    for page in pages:
        info = (page.get("imageinfo") or [None])[0]
        if not info:
            continue
        title = page.get("title", "")
        if title.lower().endswith(BAD_EXT) or not str(info.get("mime", "")).startswith("image/"):
            continue
        width, height = info.get("width") or 0, info.get("height") or 0
        if width < 1200 or height == 0 or width / height < 1.2:
            continue                  # skip portraits and small files
        meta = info.get("extmetadata") or {}
        return {
            "title": title,
            "url": info.get("thumburl") or info.get("url"),
            "page": info.get("descriptionurl", ""),
            "author": plain((meta.get("Artist") or {}).get("value")) or "Unknown",
            "licence": plain((meta.get("LicenseShortName") or {}).get("value")) or "See source",
        }
    return None


def optimise(path):
    """Resize and recompress when Pillow is available; otherwise leave as-is."""
    try:
        from PIL import Image
    except ImportError:
        return
    try:
        im = Image.open(path)
        im = im.convert("RGB")
        if im.width > TARGET_WIDTH:
            im = im.resize((TARGET_WIDTH, round(im.height * TARGET_WIDTH / im.width)),
                           Image.LANCZOS)
        im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    except Exception as exc:                      # never fail the run over this
        print("      (could not optimise: %s)" % exc)


def dimensions(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def download(slug, query, force):
    out = os.path.join(DEST_DIR, slug + ".jpg")
    if os.path.exists(out) and not force:
        print("  %-12s already present, skipping (use --force to replace)" % slug)
        return None
    hit = find_photo(query)
    if not hit:
        print("  %-12s NO RESULT for %r — edit QUERIES and retry" % (slug, query))
        return None
    req = urllib.request.Request(hit["url"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(out, "wb") as f:
        f.write(r.read())
    optimise(out)
    size = os.path.getsize(out) // 1024
    print("  %-12s %s  (%s, %s KB)" % (slug, hit["title"][:52], hit["licence"], size))
    return hit


def write_credits(credits):
    if not credits:
        return
    path = os.path.join(DEST_DIR, "CREDITS.md")
    lines = ["# Photo credits", "",
             "Destination photographs from Wikimedia Commons. Each entry lists the",
             "author and licence; keep this file with the images if you publish them.",
             "", "| File | Source | Author | Licence |", "| --- | --- | --- | --- |"]
    for slug in sorted(credits):
        c = credits[slug]
        lines.append("| `%s.jpg` | [%s](%s) | %s | %s |"
                     % (slug, c["title"], c["page"], c["author"], c["licence"]))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\nWrote %s" % os.path.relpath(path, ROOT))


def apply_html(slugs):
    """Point the markup at the photos: src, intrinsic size and alt text."""
    have = [s for s in slugs if os.path.exists(os.path.join(DEST_DIR, s + ".jpg"))]
    if not have:
        print("\nNo .jpg files found — nothing to rewrite.")
        return
    changed = 0
    img_re = re.compile(r"<img\b[^>]*>")

    def fix_tag(match):
        """Only touch <img> tags that now point at a photo."""
        tag = match.group(0)
        m = re.search(r"destinations/([A-Za-z0-9_-]+)\.jpg", tag)
        if not m:
            return tag                      # still an illustration: leave alt alone
        size = dimensions(os.path.join(DEST_DIR, m.group(1) + ".jpg"))
        if size:
            tag = re.sub(r'width="\d+" height="\d+"',
                         'width="%d" height="%d"' % size, tag)
        return re.sub(r'alt="Illustration of ([^"]*)"', r'alt="\1"', tag)

    for page in PAGES:
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            html = f.read()
        before = html
        for slug in have:
            html = html.replace("destinations/%s.svg" % slug, "destinations/%s.jpg" % slug)
        html = img_re.sub(fix_tag, html)
        if html != before:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            changed += 1
    print("\nRewrote %d page(s) to use .jpg photos for: %s" % (changed, ", ".join(have)))
    print("The .svg illustrations are left in place, so `git checkout -- *.html` reverts this.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="rewrite the HTML to use the photos")
    ap.add_argument("--skip-download", action="store_true", help="use photos already on disk")
    ap.add_argument("--force", action="store_true", help="re-download files that already exist")
    ap.add_argument("--only", help="comma-separated slugs, e.g. goa,bali")
    ap.add_argument("--dry-run", action="store_true", help="show the search terms and stop")
    args = ap.parse_args()

    slugs = list(QUERIES)
    if args.only:
        wanted = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [s for s in wanted if s not in QUERIES]
        if unknown:
            sys.exit("Unknown slug(s): %s\nKnown: %s" % (", ".join(unknown), ", ".join(slugs)))
        slugs = wanted

    if args.dry_run:
        print("Would search Wikimedia Commons for:\n")
        for s in slugs:
            print("  %-12s %s" % (s, QUERIES[s]))
        print("\nDestination: %s" % os.path.relpath(DEST_DIR, ROOT))
        return

    os.makedirs(DEST_DIR, exist_ok=True)

    if not args.skip_download:
        print("Fetching %d photo(s) from Wikimedia Commons...\n" % len(slugs))
        credits = {}
        for slug in slugs:
            try:
                hit = download(slug, QUERIES[slug], args.force)
                if hit:
                    credits[slug] = hit
            except Exception as exc:
                print("  %-12s FAILED: %s" % (slug, exc))
        write_credits(credits)

    if args.apply:
        apply_html(slugs)
    else:
        print("\nRun again with --apply to point the pages at these photos.")


if __name__ == "__main__":
    main()
