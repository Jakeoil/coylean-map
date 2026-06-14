#!/usr/bin/env python3
"""Calibrate the font->block transform from the existing AlphabetBlocks.svg.

Measures where the existing letters sit inside their block (scale + baseline,
in block-local coords) and compares to the font glyphs, so newly generated
blocks match the original 36. Uses straight-edged caps (E F H I L T) whose
bounding boxes are exact even with serif brackets.
"""
import re
import json

from fontTools.ttLib import TTFont

SVG = "../AlphabetBlocks.svg"
FONT = "../News 706 Bold.otf"

ID_TO_CHAR = {
    "XMLID_306_": "A", "XMLID_1_": "B", "XMLID_2_": "C", "XMLID_4_": "D",
    "XMLID_14_": "E", "XMLID_7_": "F", "XMLID_10_": "G", "XMLID_11_": "H",
    "XMLID_16_": "I", "XMLID_28_": "J", "XMLID_24_": "K", "XMLID_22_": "L",
    "XMLID_20_": "M", "XMLID_26_": "N", "XMLID_18_": "O", "XMLID_40_": "P",
    "XMLID_38_": "Q", "XMLID_36_": "R", "XMLID_34_": "S", "XMLID_32_": "T",
    "XMLID_21_": "U", "XMLID_52_": "V", "XMLID_50_": "W", "XMLID_68_": "X",
    "XMLID_46_": "Y", "XMLID_31_": "Z", "XMLID_42_": "0", "XMLID_66_": "1",
    "XMLID_64_": "2", "XMLID_62_": "3", "XMLID_60_": "4", "XMLID_56_": "5",
    "XMLID_58_": "6", "XMLID_54_": "7", "XMLID_72_": "8", "XMLID_70_": "9",
}

NUM = re.compile(r"[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?")
CMD = re.compile(r"([MmLlHhVvCcSsQqTtZz])")


def split_subpaths(d):
    """Split path data into subpaths at each M/m."""
    out, cur = [], ""
    for ch in d:
        if ch in "Mm" and cur.strip():
            out.append(cur)
            cur = ""
        cur += ch
    if cur.strip():
        out.append(cur)
    return out


def is_outline(sp):
    return bool(re.search(r"[vhVH]-?1(8|5)3\.\d", sp))


def tokenize(d):
    """Yield (command, [floats]) honoring implicit repeated commands."""
    parts = CMD.split(d)
    for i in range(1, len(parts), 2):
        cmd = parts[i]
        nums = [float(x) for x in NUM.findall(parts[i + 1])]
        yield cmd, nums


def bbox_of_path(d):
    """Bounding box over on-curve + control points (abs coords)."""
    x = y = 0.0
    sx = sy = 0.0
    xs, ys = [], []

    def add(px, py):
        xs.append(px)
        ys.append(py)

    for cmd, n in tokenize(d):
        i = 0
        if cmd in "Zz":
            x, y = sx, sy
            continue
        # number of args per command
        while i < len(n) or cmd in "Mm" and i == 0:
            if cmd in "Mm":
                if cmd == "m":
                    x += n[i]; y += n[i + 1]
                else:
                    x, y = n[i], n[i + 1]
                sx, sy = x, y
                add(x, y); i += 2
                cmd = "l" if cmd == "m" else "L"  # subsequent pairs are lineto
            elif cmd in "Ll":
                if cmd == "l": x += n[i]; y += n[i + 1]
                else: x, y = n[i], n[i + 1]
                add(x, y); i += 2
            elif cmd in "Hh":
                x = x + n[i] if cmd == "h" else n[i]
                add(x, y); i += 1
            elif cmd in "Vv":
                y = y + n[i] if cmd == "v" else n[i]
                add(x, y); i += 1
            elif cmd in "Cc":
                pts = n[i:i + 6]
                if cmd == "c":
                    add(x + pts[0], y + pts[1]); add(x + pts[2], y + pts[3])
                    x += pts[4]; y += pts[5]
                else:
                    add(pts[0], pts[1]); add(pts[2], pts[3])
                    x, y = pts[4], pts[5]
                add(x, y); i += 6
            elif cmd in "SsQqTt":
                step = {"S": 4, "Q": 4, "T": 2}[cmd.upper()]
                pts = n[i:i + step]
                rel = cmd.islower()
                for k in range(0, step, 2):
                    px = x + pts[k] if rel else pts[k]
                    py = y + pts[k + 1] if rel else pts[k + 1]
                    add(px, py)
                if rel: x += pts[step - 2]; y += pts[step - 1]
                else: x, y = pts[step - 2], pts[step - 1]
                i += step
            else:
                i += 1
            if not n:
                break
    return min(xs), min(ys), max(xs), max(ys)


def outer_origin(outline_d):
    """Top-left (ox,oy) of the outer 183.5 rect."""
    m = re.search(r"M([\d.]+),([\d.]+)v183\.\d+", outline_d)
    ox, oy = float(m.group(1)), float(m.group(2))
    after = outline_d[m.end():]
    h = re.match(r"h(-?[\d.]+)", after)
    if h and float(h.group(1)) < 0:
        ox += float(h.group(1))
    return ox, oy


# --- parse existing blocks ---
svg = open(SVG).read()
blocks = {}
for pid, cls, d in re.findall(
    r'<path id="(XMLID_\d+_)"\s+class="(st\d)"\s+d="([^"]+)"', svg, re.S
):
    ch = ID_TO_CHAR.get(pid)
    if not ch:
        continue
    subs = split_subpaths(d.replace("\n", "").replace("\t", " "))
    outline = "".join(s for s in subs if is_outline(s))
    letter = "".join(s for s in subs if not is_outline(s))
    ox, oy = outer_origin(outline)
    lx0, ly0, lx1, ly1 = bbox_of_path(letter)
    blocks[ch] = dict(ox=ox, oy=oy, cls=cls,
                      lbbox=(lx0 - ox, ly0 - oy, lx1 - ox, ly1 - oy))

# --- font metrics ---
font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm
fl = json.load(open("font-letters.json"))
from io import StringIO


def font_bbox(ch):
    return bbox_of_path(fl[ch])  # already y-down, baseline at y=upm


print(f"{'ch':>2} {'blkCapH':>8} {'fontCapH':>9} {'scale':>7} "
      f"{'capTopY':>8} {'baseY':>8} {'cx':>7}")
cal = "EFHILT"
s_list, capTop_list, base_list = [], [], []
for ch in cal:
    b = blocks[ch]
    lx0, ly0, lx1, ly1 = b["lbbox"]
    blk_capH = ly1 - ly0
    fx0, fy0, fx1, fy1 = font_bbox(ch)
    font_capH = fy1 - fy0
    s = blk_capH / font_capH
    # font baseline at y=upm; cap top at fy0. block baseline (local) = ?
    # block cap bottom = ly1 (baseline for flat caps). map: s*upm + ty = ly1
    base_local = ly1
    ty = base_local - s * upm
    capTop_local = ly0
    cx = (lx0 + lx1) / 2
    s_list.append(s); base_list.append(base_local)
    print(f"{ch:>2} {blk_capH:8.2f} {font_capH:9.1f} {s:7.4f} "
          f"{ly0:8.2f} {ly1:8.2f} {cx:7.2f}")

import statistics as st
print("\nmean scale  :", round(st.mean(s_list), 5),
      " stdev:", round(st.pstdev(s_list), 5))
print("mean baseY  :", round(st.mean(base_list), 3),
      " stdev:", round(st.pstdev(base_list), 4))
print("inner square: x,y in [15, 168.54], center 91.77")
print("block size  : 183.5395508, border 15")
