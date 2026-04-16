#!/usr/bin/env python3
"""
Fancy QR code generator with logo overlay.
Supports multiple dot styles: circles, flowers.

Usage:
    python3 qr_generator.py --url "https://example.com" --logo logo.png
    python3 qr_generator.py --url "https://example.com" --style flowers --logo logo.png
    python3 qr_generator.py                                       # uses hardcoded defaults below

Hardcoded defaults (edit these if you prefer not to use CLI args):
"""

# ── Hardcoded defaults ──────────────────────────────────────────────────────
DEFAULT_URL   = "https://example.com"
DEFAULT_LOGO  = ""          # leave empty string for no logo
DEFAULT_OUT   = "qr_output.png"
DEFAULT_STYLE = "circles"   # "circles" or "flowers"
# ───────────────────────────────────────────────────────────────────────────

import argparse
import math
import sys
from pathlib import Path

import qrcode
import qrcode.constants
from PIL import Image, ImageColor, ImageDraw, ImageFilter


# ── helpers ──────────────────────────────────────────────────────────────────

def rounded_rect(draw: ImageDraw.ImageDraw,
                 xy: tuple, radius: int, fill: str) -> None:
    """Draw a filled rounded rectangle."""
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius * 2, y0 + radius * 2], fill=fill)
    draw.ellipse([x1 - radius * 2, y0, x1, y0 + radius * 2], fill=fill)
    draw.ellipse([x0, y1 - radius * 2, x0 + radius * 2, y1], fill=fill)
    draw.ellipse([x1 - radius * 2, y1 - radius * 2, x1, y1], fill=fill)


def draw_finder(draw: ImageDraw.ImageDraw,
                origin_x: int, origin_y: int,
                cell: int, fg: str, bg: str) -> None:
    """
    Draw a single 7×7 finder pattern using concentric rounded rectangles.
    origin_x/y are pixel coordinates of the top-left cell of the pattern.
    """
    r = int(cell * 0.35)

    outer = (origin_x, origin_y,
             origin_x + 7 * cell - 1, origin_y + 7 * cell - 1)
    rounded_rect(draw, outer, r, fg)

    mid = (origin_x + cell, origin_y + cell,
           origin_x + 6 * cell - 1, origin_y + 6 * cell - 1)
    rounded_rect(draw, mid, r, bg)

    inner = (origin_x + 2 * cell, origin_y + 2 * cell,
             origin_x + 5 * cell - 1, origin_y + 5 * cell - 1)
    rounded_rect(draw, inner, r, fg)


def is_in_finder(row: int, col: int, size: int) -> bool:
    """Return True if (row, col) falls inside one of the three finder patterns."""
    return (
        (row < 7 and col < 7) or
        (row < 7 and col >= size - 7) or
        (row >= size - 7 and col < 7)
    )


def make_leaf_stamp(cell_px: int, dot_ratio: float, fg: str,
                    angle_deg: float = 25.0, n_pts: int = 60) -> Image.Image:
    """
    Pre-render a single pointed leaf as an RGBA stamp image sized cell_px × cell_px.
    angle_deg controls the tilt of the leaf.
    """
    fg_rgba = ImageColor.getrgb(fg) + (255,)

    r       = (cell_px * dot_ratio) / 2
    half_h  = r * 0.92   # leaf half-length (tall)
    half_w  = r * 0.55   # leaf half-width  (wider so shape is visible at small sizes)

    # Build leaf polygon points centred at origin
    # Uses a sharpened cosine (exponent < 1) for pointed tips
    pts = []
    for i in range(n_pts):
        t     = 2 * math.pi * i / n_pts
        x     = half_w * math.sin(t)
        cos_t = math.cos(t)
        y     = half_h * math.copysign(abs(cos_t) ** 0.60, cos_t)
        pts.append((x, y))

    # Render on a large canvas (2× cell) so rotation never clips
    stamp_size = cell_px * 2
    canvas = Image.new("RGBA", (stamp_size, stamp_size), (0, 0, 0, 0))
    cx = cy = stamp_size / 2
    shifted = [(x + cx, y + cy) for x, y in pts]
    ImageDraw.Draw(canvas).polygon(shifted, fill=fg_rgba)

    # Rotate to the desired tilt angle
    rotated = canvas.rotate(-angle_deg, resample=Image.BICUBIC, expand=False)

    # Crop back to cell_px × cell_px (centred)
    margin = (stamp_size - cell_px) // 2
    stamp  = rotated.crop((margin, margin, margin + cell_px, margin + cell_px))
    return stamp


def make_flower_stamp(cell_px: int, dot_ratio: float, fg: str,
                      n_petals: int = 5) -> Image.Image:
    """
    Pre-render a single flower as an RGBA stamp image sized cell_px × cell_px.
    Each petal is an elongated ellipse rotated around the centre.
    Stamped once per dark cell — much faster than re-drawing each time.
    """
    fg_rgba = ImageColor.getrgb(fg) + (255,)

    r         = (cell_px * dot_ratio) / 2   # overall flower radius
    petal_w   = r * 0.52                    # short axis of each petal ellipse
    petal_h   = r * 1.00                    # long axis of each petal ellipse
    petal_off = r * 0.52                    # distance from centre to petal centre
    center_r  = r * 0.40                    # radius of the central circle

    # Canvas big enough that a rotated petal never clips
    stamp_size = cell_px * 2
    stamp = Image.new("RGBA", (stamp_size, stamp_size), (0, 0, 0, 0))
    cx = stamp_size / 2
    cy = stamp_size / 2

    for i in range(n_petals):
        angle_deg = i * 360 / n_petals
        angle_rad = math.radians(angle_deg)

        # Build upright petal on its own tiny canvas then rotate
        pw = int(petal_w * 2) + 2
        ph = int(petal_h * 2) + 2
        petal_canvas = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        ImageDraw.Draw(petal_canvas).ellipse(
            [1, 1, pw - 2, ph - 2], fill=fg_rgba
        )
        rotated = petal_canvas.rotate(-angle_deg, resample=Image.BICUBIC, expand=True)

        # Centre of this petal on the stamp
        ox = petal_off * math.sin(angle_rad)
        oy = -petal_off * math.cos(angle_rad)
        paste_x = int(cx + ox - rotated.width / 2)
        paste_y = int(cy + oy - rotated.height / 2)
        stamp.paste(rotated, (paste_x, paste_y), rotated)

    # Central circle on top so petals don't look disconnected
    drw = ImageDraw.Draw(stamp)
    drw.ellipse(
        [cx - center_r, cy - center_r, cx + center_r, cy + center_r],
        fill=fg_rgba,
    )

    # Crop stamp back to cell_px × cell_px (centred)
    margin = (stamp_size - cell_px) // 2
    stamp = stamp.crop((margin, margin, margin + cell_px, margin + cell_px))
    return stamp


# ── main ─────────────────────────────────────────────────────────────────────

def generate(url: str, logo_path: str, output: str,
             style: str = "circles",
             cell_px: int = 20, quiet: int = 4,
             dot_ratio: float = 0.85,
             fg: str = "#1a1a2e", bg: str = "#ffffff") -> None:

    # 1. Build QR matrix
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    size   = len(matrix)

    # 2. Create canvas
    total_cells = size + 2 * quiet
    img_px      = total_cells * cell_px
    img  = Image.new("RGBA", (img_px, img_px), bg)
    draw = ImageDraw.Draw(img)

    dot_margin = cell_px * (1 - dot_ratio) / 2

    # 3. Pre-render stamps if needed (done once, reused for every cell)
    flower_stamp  = make_flower_stamp(cell_px, dot_ratio, fg) if style == "flowers" else None
    # Two leaf stamps, leaning opposite ways — alternated in a checkerboard pattern
    leaf_stamp_l  = make_leaf_stamp(cell_px, dot_ratio, fg, angle_deg= 25) if style == "leaves" else None
    leaf_stamp_r  = make_leaf_stamp(cell_px, dot_ratio, fg, angle_deg=-25) if style == "leaves" else None

    # 4. Draw finder patterns
    finder_origins = [
        (quiet * cell_px,               quiet * cell_px),
        (quiet * cell_px,               (quiet + size - 7) * cell_px),
        ((quiet + size - 7) * cell_px,  quiet * cell_px),
    ]
    for ox, oy in finder_origins:
        draw_finder(draw, ox, oy, cell_px, fg, bg)

    # 5. Draw dots (circles or flowers) for every non-finder dark cell
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if not dark or is_in_finder(r, c, size):
                continue

            cell_left = (quiet + c) * cell_px
            cell_top  = (quiet + r) * cell_px

            if style == "flowers":
                img.paste(flower_stamp, (cell_left, cell_top), flower_stamp)
            elif style == "leaves":
                stamp = leaf_stamp_l if (r + c) % 2 == 0 else leaf_stamp_r
                img.paste(stamp, (cell_left, cell_top), stamp)
            else:
                px = cell_left + dot_margin
                py = cell_top  + dot_margin
                draw.ellipse([px, py, px + cell_px * dot_ratio,
                                      py + cell_px * dot_ratio], fill=fg)

    # 6. Overlay logo (optional)
    if logo_path and Path(logo_path).exists():
        logo_raw = Image.open(logo_path).convert("RGBA")

        logo_max = int(img_px * 0.25)
        lw, lh   = logo_raw.size
        scale    = logo_max / max(lw, lh)
        new_lw   = int(lw * scale)
        new_lh   = int(lh * scale)
        logo_raw = logo_raw.resize((new_lw, new_lh), Image.LANCZOS)

        pad    = int(max(new_lw, new_lh) * 0.15)
        bg_dia = max(new_lw, new_lh) + 2 * pad
        bg_img = Image.new("RGBA", (bg_dia, bg_dia), (0, 0, 0, 0))
        ImageDraw.Draw(bg_img).ellipse(
            [0, 0, bg_dia - 1, bg_dia - 1], fill=(255, 255, 255, 255)
        )
        bg_img.paste(logo_raw, ((bg_dia - new_lw) // 2, (bg_dia - new_lh) // 2), logo_raw)

        bx = (img_px - bg_dia) // 2
        by = (img_px - bg_dia) // 2
        img.paste(bg_img, (bx, by), bg_img)

    elif logo_path and not Path(logo_path).exists():
        print(f"Warning: logo file '{logo_path}' not found — skipping logo.", file=sys.stderr)

    # 7. Save
    img.convert("RGB").save(output, "PNG", dpi=(300, 300))
    print(f"Saved → {output}  ({img_px}×{img_px} px,  {size}×{size} QR cells,  style={style})")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a fancy QR code.")
    parser.add_argument("--url",    default=DEFAULT_URL,   help="URL or text to encode")
    parser.add_argument("--logo",   default=DEFAULT_LOGO,  help="Path to logo image (PNG)")
    parser.add_argument("--output", default=DEFAULT_OUT,   help="Output PNG filename")
    parser.add_argument("--style",  default=DEFAULT_STYLE,
                        choices=["circles", "flowers", "leaves"],
                        help="Dot style (default: circles)")
    parser.add_argument("--cell",   type=int, default=20,  help="Pixels per QR cell (default 20)")
    parser.add_argument("--fg",     default="#1a1a2e",     help="Foreground colour (hex)")
    parser.add_argument("--bg",     default="#ffffff",     help="Background colour (hex)")
    args = parser.parse_args()

    generate(
        url       = args.url,
        logo_path = args.logo,
        output    = args.output,
        style     = args.style,
        cell_px   = args.cell,
        fg        = args.fg,
        bg        = args.bg,
    )


if __name__ == "__main__":
    main()
