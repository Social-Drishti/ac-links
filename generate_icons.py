"""
AstroChitra — PWA Icon Generator
==================================
Renders the SVG logo in a headless browser — zero system libraries needed.
Playwright downloads its own self-contained Chromium (~150 MB, one-time).

Step 1 — install:
    pip install playwright Pillow
    playwright install chromium

Step 2 — run from inside the  links/  folder:
    python generate_icons.py
"""

import os
import sys
import io

# ── dependency check ──────────────────────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit(
        "\n[ERROR] playwright not found.\n"
        "Run:\n"
        "    pip install playwright\n"
        "    playwright install chromium\n"
    )

try:
    from PIL import Image
except ImportError:
    sys.exit(
        "\n[ERROR] Pillow not found.\n"
        "Run:  pip install Pillow\n"
    )

# ── config ────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_PATH   = os.path.join(SCRIPT_DIR, "Astrochitra-color-logo.svg")

# All icons that need to be generated
# (output filename, width, height)
ICONS = [
    ("favicon-16x16.png",           16,  16),
    ("favicon-32x32.png",           32,  32),
    ("apple-touch-icon.png",       180, 180),
    ("android-chrome-192x192.png", 192, 192),
    ("android-chrome-512x512.png", 512, 512),
]

ICO_SIZES = [16, 32, 48]   # bundled into favicon.ico


# ── SVG renderer ──────────────────────────────────────────────
def render_svg_to_png_bytes(svg_path: str, size: int) -> bytes:
    """
    Open the SVG in a headless Chromium page at `size`×`size`
    and return the screenshot as raw PNG bytes.
    """
    svg_url = "file:///" + svg_path.replace("\\", "/")

    # Minimal HTML: full-bleed SVG centred on a transparent background
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {size}px; height: {size}px; background: transparent; overflow: hidden; }}
  img {{ width: {size}px; height: {size}px; object-fit: contain; display: block; }}
</style>
</head>
<body>
  <img src="{svg_url}" />
</body>
</html>"""

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": size, "height": size},
        )
        page.set_content(html, wait_until="networkidle")
        # Give the SVG a moment to fully paint
        page.wait_for_timeout(200)
        png_bytes = page.screenshot(
            type="png",
            clip={"x": 0, "y": 0, "width": size, "height": size},
            omit_background=True,   # transparent background
        )
        browser.close()

    return png_bytes


def bytes_to_pil(png_bytes: bytes) -> Image.Image:
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


# ── main ──────────────────────────────────────────────────────
def main():
    if not os.path.isfile(SVG_PATH):
        sys.exit(
            f"\n[ERROR] SVG not found:\n  {SVG_PATH}\n"
            "Run this script from the  links/  folder.\n"
        )

    print(f"\n  Source : {SVG_PATH}")
    print(f"  Output : {SCRIPT_DIR}")
    print(f"\n  Launching headless Chromium …\n")

    # ── PNG icons ─────────────────────────────────────────────
    # Render at largest size first, downscale — faster + better quality
    max_size = max(max(w, h) for _, w, h in ICONS)
    print(f"  Rendering master at {max_size}×{max_size} px …")
    master_bytes = render_svg_to_png_bytes(SVG_PATH, max_size)
    master       = bytes_to_pil(master_bytes)

    for filename, w, h in ICONS:
        out_path = os.path.join(SCRIPT_DIR, filename)

        if w == h == max_size:
            img = master.copy()
        else:
            img = master.resize((w, h), Image.LANCZOS)

        img.save(out_path, "PNG", optimize=True)
        print(f"  ✓  {filename:<35} {w}×{h}")

    # ── favicon.ico (multi-size) ──────────────────────────────
    ico_frames = []
    for s in ICO_SIZES:
        frame = master.resize((s, s), Image.LANCZOS)
        ico_frames.append(frame)

    ico_path = os.path.join(SCRIPT_DIR, "favicon.ico")
    ico_frames[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=ico_frames[1:],
    )
    print(f"  ✓  {'favicon.ico':<35} 16 / 32 / 48  (multi-size)")

    print("\n  All icons generated successfully!\n")


if __name__ == "__main__":
    main()