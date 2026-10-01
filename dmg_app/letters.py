"""Match tiny warjack system glyphs (L, R, M, C, H, S, A) by template."""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFont

_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)
ALPHABET = "LMRCHSA"
DIGITS = "123456789"


def _load_font(size: int, path: str) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def _glyph_vector(binary: np.ndarray) -> np.ndarray | None:
    if binary.size == 0 or int(binary.sum()) < 6:
        return None
    ys, xs = np.where(binary)
    sub = binary[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    if sub.shape[0] < 3 or sub.shape[1] < 2:
        return None
    pil = Image.fromarray((sub.astype(np.uint8) * 255))
    pil = pil.resize((24, 24), Image.Resampling.BOX)
    v = (np.asarray(pil) > 128).astype(np.float32).ravel()
    v -= v.mean()
    norm = float(np.linalg.norm(v))
    if norm < 1e-3:
        return None
    return v / norm


def _render_char(ch: str, font: ImageFont.FreeTypeFont) -> np.ndarray | None:
    canvas = Image.new("L", (96, 96), 255)
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), ch, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    draw.text(
        ((96 - width) / 2 - bbox[0], (96 - height) / 2 - bbox[1]),
        ch,
        font=font,
        fill=0,
    )
    dark = np.asarray(canvas) < 140
    return _glyph_vector(dark)


def _build_templates(alphabet: str) -> dict[str, list[np.ndarray]]:
    templates: dict[str, list[np.ndarray]] = {ch: [] for ch in alphabet}
    for path in _FONT_CANDIDATES:
        try:
            for size in (42, 52, 64):
                font = _load_font(size, path)
                for ch in alphabet:
                    vec = _render_char(ch, font)
                    if vec is not None:
                        templates[ch].append(vec)
        except OSError:
            continue
    if not any(templates.values()):
        raise RuntimeError("No fonts available for glyph templates")
    return templates


TEMPLATES = _build_templates(ALPHABET)
DIGIT_TEMPLATES = _build_templates(DIGITS)


def _score_against(vec: np.ndarray, templates: dict[str, list[np.ndarray]], minimum: float) -> tuple[str, float]:
    best_ch = ""
    best = -1.0
    second = -1.0
    for ch, variants in templates.items():
        score = max(float(vec @ variant) for variant in variants)
        if score > best:
            second = best
            best = score
            best_ch = ch
        elif score > second:
            second = score
    if best < minimum or best - second < 0.05:
        return "", best
    return best_ch, best


def _score(vec: np.ndarray) -> tuple[str, float]:
    return _score_against(vec, TEMPLATES, 0.50)


def _match_binary(binary: np.ndarray) -> tuple[str, float]:
    vec = _glyph_vector(binary)
    if vec is None:
        return "", 0.0
    return _score(vec)


def read_digit(binary: np.ndarray) -> tuple[str, float]:
    """Read one column number. The glyph stays above its own column."""
    height, width = binary.shape[:2]
    # The printed "1" is a narrow stem with a small flag. A proportional
    # font template scores it like a "3", so the shape decides it.
    if height >= 16 and 6 <= width <= height * 0.55 and int(binary.sum()) > 20:
        return "1", 0.8
    vec = _glyph_vector(binary)
    if vec is None:
        return "", 0.0
    return _score_against(vec, DIGIT_TEMPLATES, 0.42)


def _components(binary: np.ndarray) -> list[np.ndarray]:
    """Side-by-side ink blobs inside one cell, left to right. Never a new column."""
    import cv2

    mask = binary.astype(np.uint8)
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, 8)
    blobs = []
    for index in range(1, count):
        if int(stats[index, cv2.CC_STAT_AREA]) < 12:
            continue
        x = int(stats[index, cv2.CC_STAT_LEFT])
        y = int(stats[index, cv2.CC_STAT_TOP])
        w = int(stats[index, cv2.CC_STAT_WIDTH])
        h = int(stats[index, cv2.CC_STAT_HEIGHT])
        blobs.append((x, binary[y : y + h, x : x + w]))
    blobs.sort(key=lambda item: item[0])
    return [blob for _x, blob in blobs]


def read_system_letters(interior: np.ndarray) -> tuple[str, float]:
    """Read the glyph or glyphs that sit inside this one cell.

    Two marks in the same box (LM, RR) stay on that cell. They are not
    assigned to the neighboring column.
    """
    dark = interior < 85
    if int(dark.sum()) < 14:
        return "", 0.0
    ys, xs = np.where(dark)
    binary = dark[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    parts = _components(binary)
    if len(parts) >= 2:
        letters = []
        scores = []
        for part in parts:
            letter, score = _match_binary(part)
            if letter:
                letters.append(letter)
                scores.append(score)
        if len(letters) >= 2:
            return "".join(letters), min(scores)
    return _match_binary(binary)
