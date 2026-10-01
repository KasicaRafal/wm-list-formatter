"""Find damage grids inside Warmachine Health Only card bitmaps.

Warjack entries are a lattice of boxes (open, solid gray, or a system letter).
Warbeast entries are a spiral of outlined cells whose stroke color is the branch.
Entries that are only an HP badge, a caption, or the faint card ruling are skipped.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import cv2
import numpy as np
import pymupdf
import pytesseract
from PIL import Image

from dmg_app.letters import read_system_letters

# A real lattice divider stays strong across the grid. The faint full-width
# ruling on every card tops out lower, so it does not become a grid by itself.
_VLINE_FRACTION = 0.58
# Letter ink inside a row peaks near 0.25. Real box edges sit near 0.8.
_HLINE_FRACTION = 0.35


@dataclass
class Cell:
    row: int
    col: int
    x0: int
    y0: int
    x1: int
    y1: int
    kind: str  # open, gray, letter
    letter: str = ""
    color: tuple[int, int, int] | None = None


@dataclass
class Grid:
    kind: str  # lattice or spiral
    name: str
    cells: list[Cell]
    rows: int
    cols: int
    source_index: int
    note: str = ""

    @property
    def bbox(self) -> tuple[int, int, int, int]:
        x0 = min(c.x0 for c in self.cells)
        y0 = min(c.y0 for c in self.cells)
        x1 = max(c.x1 for c in self.cells)
        y1 = max(c.y1 for c in self.cells)
        return x0, y0, x1, y1


@dataclass
class Skipped:
    name: str
    reason: str
    source_index: int


@dataclass
class Analysis:
    kept: list[Grid] = field(default_factory=list)
    skipped: list[Skipped] = field(default_factory=list)


def extract_card_images(pdf_bytes: bytes) -> list[Image.Image]:
    """Return column bitmaps in reading order (page, then left to right)."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    cards: list[Image.Image] = []
    try:
        for page in doc:
            placed = []
            seen: set[int] = set()
            for info in page.get_image_info(xrefs=True):
                xref = int(info.get("xref") or 0)
                if xref <= 0 or xref in seen:
                    continue
                if int(info.get("width") or 0) < 400 or int(info.get("height") or 0) < 400:
                    continue
                seen.add(xref)
                placed.append(info)
            placed.sort(key=lambda item: item["bbox"][0])
            for info in placed:
                raw = doc.extract_image(int(info["xref"]))
                if raw.get("colorspace") == 1:
                    continue
                image = Image.open(io.BytesIO(raw["image"])).convert("RGB")
                cards.append(image)
    finally:
        doc.close()
    return cards


def analyze_pdf(pdf_bytes: bytes) -> Analysis:
    analysis = Analysis()
    for index, image in enumerate(extract_card_images(pdf_bytes)):
        rgb = np.asarray(image)
        for grid, skipped in _analyze_card(rgb, index):
            if grid is not None:
                analysis.kept.append(grid)
            if skipped is not None:
                analysis.skipped.append(skipped)
    return analysis


def _analyze_card(rgb: np.ndarray, source_index: int):
    headers = _header_bands(rgb)
    if not headers:
        yield None, Skipped("(no header)", "no model header found", source_index)
        return
    height = rgb.shape[0]
    for i, (y0, y1) in enumerate(headers):
        body_end = headers[i + 1][0] if i + 1 < len(headers) else height
        name = _read_name(rgb, y0, y1)
        body_top = y1
        if body_end - body_top < 40:
            yield None, Skipped(name or "(blank)", "no room below the name for a grid", source_index)
            continue
        spiral = _find_spiral(rgb, body_top, body_end)
        lattice = _find_lattice(rgb, body_top, body_end)
        if spiral is not None and (lattice is None or len(spiral) >= 8):
            # A colored spiral is the beast grid. Do not also keep the card ruling.
            grid = Grid(
                kind="spiral",
                name=name or "Warbeast",
                cells=spiral,
                rows=0,
                cols=0,
                source_index=source_index,
            )
            yield grid, None
            continue
        if lattice is not None:
            lattice.name = name or "Warjack"
            lattice.source_index = source_index
            yield lattice, None
            continue
        reason = "no damage grid (HP badge, caption, or empty ruling)"
        if _looks_partial(rgb, body_top, body_end):
            reason = "uncertain marks, skipped rather than guessing cells"
        yield None, Skipped(name or "(unnamed)", reason, source_index)


def _low_chroma_dark(rgb: np.ndarray, max_v: int = 85, max_chroma: int = 36) -> np.ndarray:
    peak = rgb.max(axis=2)
    chroma = peak.astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    return (peak < max_v) & (chroma < max_chroma)


def _header_bands(rgb: np.ndarray) -> list[tuple[int, int]]:
    """Model-name blocks.

    The icon bridges the name and the type line into one tall dark band.
    Spiral ink is dark too, but it is colored, so the band only counts when
    a row of it is actually black text. The bottom is trimmed to the last
    text row so the first grid rule is not swallowed by the header.
    """
    gray = rgb.mean(axis=2)
    row = (gray < 100).mean(axis=1)
    low = _low_chroma_dark(rgb, max_v=95, max_chroma=50).mean(axis=1)
    active = row > 0.004
    runs: list[tuple[int, int]] = []
    start = None
    for y, on in enumerate(active):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start > 8:
                runs.append((start, y))
            start = None
    if start is not None and len(active) - start > 8:
        runs.append((start, len(active)))
    merged: list[tuple[int, int]] = []
    for band in runs:
        if merged and band[0] - merged[-1][1] < 12:
            merged[-1] = (merged[-1][0], band[1])
        else:
            merged.append(band)
    headers = []
    for y0, y1 in merged:
        if y1 - y0 < 100 or float(low[y0:y1].max()) < 0.06:
            continue
        text_rows = np.where(low[y0:y1] > 0.02)[0]
        if len(text_rows):
            y1 = min(y1, y0 + int(text_rows[-1]) + 12)
        headers.append((y0, y1))
    return headers


def _read_name(rgb: np.ndarray, y0: int, y1: int) -> str:
    x0, x1 = 200, min(rgb.shape[1] - 4, 960)
    slab = rgb[y0:y1, x0:x1]
    row = _low_chroma_dark(slab, max_v=95, max_chroma=50).mean(axis=1)
    start = None
    line = None
    for y, value in enumerate(row > 0.02):
        if value and start is None:
            start = y
        elif not value and start is not None:
            if y - start >= 8:
                line = (start, y)
                break
            start = None
    if line is None:
        return ""
    # Pad so ascenders and descenders are not clipped. A clipped bowl turns d into a.
    y_a = max(0, y0 + line[0] - 6)
    y_b = min(rgb.shape[0], y0 + line[1] + 10)
    crop = Image.fromarray(rgb[y_a:y_b, x0:x1])
    crop = crop.resize((crop.width * 4, crop.height * 4), Image.Resampling.LANCZOS)
    text = pytesseract.image_to_string(crop, config="--oem 1 --psm 7")
    return _clean_name(text)


def _clean_name(text: str) -> str:
    if not text or not text.strip():
        return ""
    line = text.strip().splitlines()[0]
    line = line.replace("|", " ").replace("•", " ")
    line = re.sub(r"[^0-9A-Za-z'’,.\- ]+", " ", line)
    line = re.sub(r"\s+", " ", line).strip(" .,;-")
    # Drop a dangling single glyph the icon sometimes leaves behind.
    line = re.sub(r"^[A-Za-z]\s+(?=[A-Z])", "", line)
    return line.strip()


def _strokes(profile: np.ndarray, threshold: float, merge_gap: int = 8) -> list[tuple[int, int]]:
    indexes = np.where(profile >= threshold)[0]
    if len(indexes) == 0:
        return []
    groups: list[list[int]] = []
    start = prev = int(indexes[0])
    for raw in indexes[1:]:
        x = int(raw)
        if x - prev > 3:
            groups.append([start, prev])
            start = x
        prev = x
    groups.append([start, prev])
    merged: list[list[int]] = []
    for group in groups:
        if merged and group[0] - merged[-1][1] <= merge_gap:
            merged[-1][1] = group[1]
        else:
            merged.append(group)
    return [(a, b) for a, b in merged if b - a <= 40]


def _regular_runs(dividers: list[tuple[int, int]]) -> list[list[tuple[int, int, int, int]]]:
    """Turn divider strokes into runs of similar cell interiors (x0, x1, pitch)."""
    if len(dividers) < 4:
        return []
    cells = []
    for (a0, a1), (b0, b1) in zip(dividers, dividers[1:]):
        width = b0 - a1
        if width < 22 or width > 130:
            continue
        pitch = ((b0 + b1) / 2) - ((a0 + a1) / 2)
        cells.append((a1, b0, width, pitch))
    if len(cells) < 3:
        return []
    runs: list[list[tuple[int, int, int, int]]] = []
    current: list[tuple[int, int, int, int]] = [cells[0]]
    for cell in cells[1:]:
        prev = current[-1]
        # Consecutive cells share a divider, so the next interior starts at the previous end.
        contiguous = abs(cell[0] - prev[1]) < 8 or abs(cell[0] - (prev[1] + (prev[3] - prev[2]))) < 24
        similar = abs(cell[2] - prev[2]) <= max(8, 0.28 * prev[2])
        if contiguous and similar:
            current.append(cell)
        else:
            if len(current) >= 3:
                runs.append(current)
            current = [cell]
    if len(current) >= 3:
        runs.append(current)
    return runs


def _find_lattice(rgb: np.ndarray, y0: int, y1: int) -> Grid | None:
    gray = rgb.mean(axis=2)
    region = gray[y0:y1].astype(np.float32)
    if region.shape[0] < 40:
        return None
    gx = np.abs(np.diff(region, axis=1))
    row_edges = (gx > 12).sum(axis=1)
    on = row_edges >= 8
    spans = _true_spans(on, merge_gap=16, min_height=50)
    if not spans:
        return None
    # The damage grid is the span that yields a lattice with real marks.
    best: Grid | None = None
    best_score = 0
    for s, e in spans:
        grid = _lattice_in_span(gray, y0 + s, y0 + e)
        if grid is None:
            continue
        score = sum(1 for cell in grid.cells if cell.kind in {"gray", "letter"})
        if score > best_score:
            best = grid
            best_score = score
    if best is None or best_score < 1:
        return None
    return best


def _true_spans(mask: np.ndarray, merge_gap: int, min_height: int) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start = None
    for i, value in enumerate(mask):
        if value and start is None:
            start = i
        elif not value and start is not None:
            spans.append((start, i))
            start = None
    if start is not None:
        spans.append((start, len(mask)))
    merged: list[tuple[int, int]] = []
    for span in spans:
        if merged and span[0] - merged[-1][1] <= merge_gap:
            merged[-1] = (merged[-1][0], span[1])
        else:
            merged.append(span)
    return [(a, b) for a, b in merged if b - a >= min_height]


def _lattice_in_span(gray: np.ndarray, y0: int, y1: int) -> Grid | None:
    region = gray[y0:y1].astype(np.float32)
    gx = np.abs(np.diff(region, axis=1))
    vprofile = (gx > 12).mean(axis=0)
    vdiv = _strokes(vprofile, _VLINE_FRACTION, merge_gap=10)
    runs = _regular_runs(vdiv)
    if not runs:
        return None
    # Prefer the run whose cells actually contain gray fills or letters.
    chosen = None
    chosen_cells: list[Cell] = []
    chosen_score = -1
    for run in runs:
        x_left = run[0][0]
        x_right = run[-1][1]
        hprofile = _horizontal_profile(region, x_left, x_right)
        hdiv = _strokes(hprofile, _HLINE_FRACTION, merge_gap=10)
        hruns = _regular_runs(hdiv)
        if not hruns:
            continue
        hrun = max(hruns, key=len)
        cells = _cells_from_runs(gray, y0, run, hrun)
        if cells is None:
            continue
        score = sum(1 for cell in cells if cell.kind in {"gray", "letter"})
        if score > chosen_score:
            chosen = (run, hrun)
            chosen_cells = cells
            chosen_score = score
    if chosen is None or chosen_score < 1:
        return None
    rows = max(cell.row for cell in chosen_cells) + 1
    cols = max(cell.col for cell in chosen_cells) + 1
    if rows < 3 or cols < 3:
        return None
    widths = [cell.x1 - cell.x0 for cell in chosen_cells]
    heights = [cell.y1 - cell.y0 for cell in chosen_cells]
    if np.std(widths) > 0.3 * np.mean(widths) or np.std(heights) > 0.3 * np.mean(heights):
        return None
    return Grid(kind="lattice", name="", cells=chosen_cells, rows=rows, cols=cols, source_index=-1)


def _horizontal_profile(region: np.ndarray, x0: int, x1: int) -> np.ndarray:
    # np.diff along axis 0 shortens Y by 1. Keep the profile aligned to source rows.
    slab = region[:, max(0, x0) : max(x0 + 1, x1)]
    gy = np.abs(np.diff(slab, axis=0))
    profile = (gy > 12).mean(axis=1)
    pad = np.zeros(region.shape[0], dtype=np.float32)
    pad[: profile.shape[0]] = profile
    return pad


def _cells_from_runs(gray, y_origin, vrun, hrun) -> list[Cell] | None:
    cells: list[Cell] = []
    for row, (top, bottom, _width, _pitch) in enumerate(hrun):
        y0 = y_origin + int(top)
        y1 = y_origin + int(bottom)
        if y1 - y0 < 18:
            continue
        for col, (left, right, _w, _p) in enumerate(vrun):
            x0 = int(left)
            x1 = int(right)
            if x1 - x0 < 18:
                continue
            kind, letter = _classify_box(gray[y0:y1, x0:x1])
            cells.append(Cell(row, col, x0, y0, x1, y1, kind, letter))
    if len(cells) < 9:
        return None
    return cells


def _classify_box(patch: np.ndarray) -> tuple[str, str]:
    if patch.size == 0:
        return "open", ""
    height, width = patch.shape
    iy = max(2, height // 7)
    ix = max(2, width // 7)
    interior = patch[iy : height - iy or None, ix : width - ix or None]
    if interior.size == 0:
        interior = patch
    dark_n = int((interior < 85).sum())
    gray_frac = float((interior < 178).mean())
    if dark_n >= 16:
        letter, score = read_system_letters(interior)
        if letter and score >= 0.50:
            return "letter", letter
        # Ink is there, but the glyph is not a confident system letter.
        # Leave the box open rather than inventing a character.
        return "open", ""
    if gray_frac > 0.55:
        return "gray", ""
    return "open", ""


def _find_spiral(rgb: np.ndarray, y0: int, y1: int) -> list[Cell] | None:
    roi = rgb[y0:y1]
    if roi.shape[0] < 40:
        return None
    hsv = cv2.cvtColor(roi, cv2.COLOR_RGB2HSV)
    wall = ((hsv[:, :, 1] > 48) & (hsv[:, :, 2] > 25)).astype(np.uint8) * 255
    if int(wall.sum()) < 800:
        return None
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    wall = cv2.morphologyEx(wall, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(wall, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, hierarchy = cv2.findContours(closed, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return None
    found: list[tuple[int, int, int, int, tuple[int, int, int]]] = []
    for index, node in enumerate(hierarchy[0]):
        parent = int(node[3])
        if parent < 0:
            continue
        area = float(cv2.contourArea(contours[index]))
        x, y, w, h = cv2.boundingRect(contours[index])
        if area < 280 or area > 9000 or w < 16 or h < 16 or w > 110 or h > 110:
            continue
        aspect = w / float(h)
        if aspect < 0.72 or aspect > 1.40:
            continue
        ring = np.zeros(closed.shape, np.uint8)
        cv2.drawContours(ring, contours, index, 255, 2)
        ring = cv2.dilate(ring, kernel, iterations=2) & wall
        colors = roi[ring > 0]
        if len(colors) < 8:
            continue
        median = tuple(int(v) for v in np.median(colors, axis=0))
        if _saturation(median) < 35:
            continue
        found.append((x, y, w, h, median))
    if len(found) < 8:
        return None
    areas = np.array([w * h for _x, _y, w, h, _c in found], dtype=np.float32)
    median_area = float(np.median(areas))
    kept = [item for item in found if 0.45 * median_area <= item[2] * item[3] <= 1.9 * median_area]
    kept = _keep_branch_colors(kept)
    if len(kept) < 8:
        return None
    cells: list[Cell] = []
    for index, (x, y, w, h, color) in enumerate(sorted(kept, key=lambda item: (item[1], item[0]))):
        pad = 3
        cells.append(
            Cell(
                row=0,
                col=index,
                x0=x + 0,  # replaced below in source coords
                y0=y0 + y,
                x1=x + w,
                y1=y0 + y + h,
                kind="spiral",
                color=color,
            )
        )
        cells[-1].x0 = x
        cells[-1].x1 = x + w
        # Expand a hair so the drawn stroke covers the source outline.
        cells[-1].x0 = max(0, x - pad)
        cells[-1].y0 = max(0, y0 + y - pad)
        cells[-1].x1 = x + w + pad
        cells[-1].y1 = y0 + y + h + pad
    return cells


def _saturation(color: tuple[int, int, int]) -> int:
    return max(color) - min(color)


def _hue(color: tuple[int, int, int]) -> float:
    pixel = np.uint8([[list(color)]])
    return float(cv2.cvtColor(pixel, cv2.COLOR_RGB2HSV)[0, 0, 0])


def _keep_branch_colors(items):
    """Drop one-off colors that are not a real branch. Keep each branch's own RGB."""
    if not items:
        return []
    hues = [_hue(item[4]) for item in items]
    # 12 bins around the wheel. Red wraps, so bin 0 and bin 11 are joined later.
    bins: dict[int, list[int]] = {}
    for index, hue in enumerate(hues):
        bucket = int(hue // 15) % 12
        bins.setdefault(bucket, []).append(index)
    # Join red wrap-around.
    if 0 in bins and 11 in bins:
        bins[0].extend(bins.pop(11))
    strong = {bucket for bucket, members in bins.items() if len(members) >= 3}
    if not strong:
        return items
    kept = []
    for bucket, members in bins.items():
        if bucket not in strong:
            continue
        for index in members:
            kept.append(items[index])
    return kept


def _looks_partial(rgb: np.ndarray, y0: int, y1: int) -> bool:
    """True when there is colored or boxed ink we still refused to call a grid."""
    roi = rgb[y0:y1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_RGB2HSV)
    colored = int(((hsv[:, :, 1] > 48) & (hsv[:, :, 2] > 25)).sum())
    return colored > 2500


def branch_summary(grid: Grid) -> list[tuple[str, tuple[int, int, int], int]]:
    groups: dict[tuple[int, int, int], int] = {}
    for cell in grid.cells:
        if cell.color is None:
            continue
        key = cell.color
        groups[key] = groups.get(key, 0) + 1
    named = []
    for color, count in sorted(groups.items(), key=lambda item: -item[1]):
        named.append((_branch_label(color), color, count))
    return named


def _branch_label(color: tuple[int, int, int]) -> str:
    r, g, b = color
    if r > g + 25 and r > b + 25:
        return "red"
    if g > r + 12 and g >= b - 8:
        return "green"
    if b > r + 12 and b >= g - 20:
        return "blue"
    return "other"


def lattice_map(grid: Grid) -> list[str]:
    table = [["." for _ in range(grid.cols)] for _ in range(grid.rows)]
    for cell in grid.cells:
        if cell.kind == "gray":
            token = "#"
        elif cell.kind == "letter" and cell.letter:
            token = cell.letter
        else:
            token = "."
        table[cell.row][cell.col] = token
    return [" ".join(row) for row in table]
