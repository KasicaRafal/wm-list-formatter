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


def _build_templates() -> dict[str, list[np.ndarray]]:
    templates: dict[str, list[np.ndarray]] = {ch: [] for ch in ALPHABET}
    for path in _FONT_CANDIDATES:
        try:
            for size in (42, 52, 64):
                font = _load_font(size, path)
                for ch in ALPHABET:
                    vec = _render_char(ch, font)
                    if vec is not None:
                        templates[ch].append(vec)
        except OSError:
            continue
    if not any(templates.values()):
        raise RuntimeError("No fonts available for system-letter templates")
    return templates


TEMPLATES = _build_templates()


def _score(vec: np.ndarray) -> tuple[str, float]:
    best_ch = ""
    best = -1.0
    second = -1.0
    for ch, variants in TEMPLATES.items():
        score = max(float(vec @ variant) for variant in variants)
        if score > best:
            second = best
            best = score
            best_ch = ch
        elif score > second:
            second = score
    if best < 0.50 or best - second < 0.05:
        return "", best
    return best_ch, best


def _match_binary(binary: np.ndarray) -> tuple[str, float]:
    vec = _glyph_vector(binary)
    if vec is None:
        return "", 0.0
    return _score(vec)


def read_system_letters(interior: np.ndarray) -> tuple[str, float]:
    """Return (letters, score) for one cell. Empty string if there is no confident glyph."""
    dark = interior < 85
    if int(dark.sum()) < 14:
        return "", 0.0
    ys, xs = np.where(dark)
    binary = dark[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    height, width = binary.shape
    if width > height * 1.35 and width >= 14:
        column = binary.mean(axis=0)
        left = max(2, width // 6)
        right = min(width - 2, width - width // 6)
        window = column[left:right]
        if window.size and float(window.min()) < 0.08:
            cut = left + int(np.argmin(window))
            left_ch, left_score = _match_binary(binary[:, :cut])
            right_ch, right_score = _match_binary(binary[:, cut:])
            if left_ch and right_ch and min(left_score, right_score) >= 0.50:
                return left_ch + right_ch, min(left_score, right_score)
    return _match_binary(binary)
