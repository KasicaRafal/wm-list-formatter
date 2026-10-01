"""Draw detected grids onto MTG-sized cards and impose them for print."""

from __future__ import annotations

import io

import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFont

from dmg_app.detect import Analysis, Grid, analyze_pdf

_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_DPI = 300
_CARD_MM = (63.0, 88.0)


def _px(mm: float) -> int:
    return int(round(mm * _DPI / 25.4))


def _pt(mm: float) -> float:
    return mm * 72.0 / 25.4


def build_pdf(pdf_bytes: bytes, image_bytes: bytes, paper: str = "a4") -> tuple[bytes, Analysis]:
    analysis = analyze_pdf(pdf_bytes)
    if not analysis.kept:
        raise ValueError("W tym PDF nie ma siatek obrażeń do druku.")
    background = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    cards = [render_card(background, grid) for grid in analysis.kept]
    return impose(cards, paper), analysis


def render_card(background: Image.Image, grid: Grid) -> Image.Image:
    width, height = _px(_CARD_MM[0]), _px(_CARD_MM[1])
    card = _cover(background, width, height).convert("RGBA")
    draw = ImageDraw.Draw(card)
    name_bottom = _draw_name(draw, card.size, grid.name)
    _draw_grid(card, draw, grid, name_bottom + 12, width - 28, height - 22)
    return card.convert("RGB")


def _cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (max(width, int(round(image.width * scale))), max(height, int(round(image.height * scale)))),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def _draw_name(draw: ImageDraw.ImageDraw, size: tuple[int, int], name: str) -> int:
    width, _height = size
    text = name.strip() or "Model"
    font = _fit_font(draw, text, width - 48, 46)
    bar_h = font.size + 36
    draw.rectangle((0, 0, width, bar_h), fill=(20, 22, 26, 210))
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) / 2
    y = (bar_h - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=(248, 246, 240, 255))
    return bar_h


def _fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int) -> ImageFont.FreeTypeFont:
    size = start
    while size > 22:
        font = ImageFont.truetype(_FONT, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(_FONT, 22)


def _draw_grid(card: Image.Image, draw: ImageDraw.ImageDraw, grid: Grid, top: int, right: int, bottom: int) -> None:
    label_band = 42 if any(grid.column_labels) else 0
    x0, y0, x1, y1 = grid.bbox
    source_w = max(1, x1 - x0)
    source_h = max(1, y1 - y0)
    area_w = right - 28
    area_h = bottom - top - label_band
    scale = min(area_w / source_w, area_h / source_h)
    drawn_w = source_w * scale
    drawn_h = source_h * scale
    origin_x = 28 + (area_w - drawn_w) / 2
    origin_y = top + label_band + (area_h - drawn_h) / 2

    def map_box(sx0: float, sy0: float, sx1: float, sy1: float) -> tuple[float, float, float, float]:
        return (
            origin_x + (sx0 - x0) * scale,
            origin_y + (sy0 - y0) * scale,
            origin_x + (sx1 - x0) * scale,
            origin_y + (sy1 - y0) * scale,
        )

    if grid.kind == "spiral" and grid.sprite is not None:
        _paste_sprite(card, grid.sprite, map_box(x0, y0, x1, y1))
        return

    for cell in grid.cells:
        box = map_box(cell.x0, cell.y0, cell.x1, cell.y1)
        if cell.kind == "gray":
            _fill_box(draw, box, (150, 152, 156, 255))
        else:
            _stroke_box(draw, box, (28, 30, 34, 255))
        if cell.glyph is not None:
            _paste_glyph(card, cell.glyph, box)
        elif cell.kind == "letter" and cell.letter:
            _draw_letter(draw, box, cell.letter)
    if any(grid.column_labels):
        _draw_column_labels(draw, grid, map_box, label_band, origin_y)


def _stroke_box(draw: ImageDraw.ImageDraw, box, color) -> None:
    # Light halo so the rule stays visible on a dark illustration.
    draw.rectangle(box, outline=(255, 255, 255, 230), width=5)
    draw.rectangle(box, outline=color, width=3)


def _fill_box(draw: ImageDraw.ImageDraw, box, color) -> None:
    draw.rectangle(box, fill=color, outline=(40, 42, 46, 255), width=3)


def _paste_sprite(card: Image.Image, sprite: np.ndarray, box: tuple[float, float, float, float]) -> None:
    """Place the source spiral, with a thin light halo so branches stay readable."""
    x0, y0, x1, y1 = box
    width = max(1, int(round(x1 - x0)))
    height = max(1, int(round(y1 - y0)))
    image = Image.fromarray(sprite, mode="RGBA")
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    halo = _halo(np.asarray(image))
    card.alpha_composite(Image.fromarray(halo, mode="RGBA"), (int(round(x0)), int(round(y0))))
    card.alpha_composite(image, (int(round(x0)), int(round(y0))))


def _halo(sprite: np.ndarray) -> np.ndarray:
    alpha = sprite[:, :, 3]
    dilated = cv2.dilate(alpha, np.ones((3, 3), np.uint8), iterations=1)
    halo = np.zeros_like(sprite)
    halo[:, :, :3] = 255
    halo[:, :, 3] = np.where(dilated > 20, 180, 0).astype(np.uint8)
    halo[:, :, 3] = np.minimum(halo[:, :, 3], 255 - alpha)
    return halo


def _paste_glyph(card: Image.Image, glyph: np.ndarray, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    cell_w = x1 - x0
    cell_h = y1 - y0
    target_h = max(8, int(cell_h * 0.62))
    aspect = glyph.shape[1] / max(1, glyph.shape[0])
    target_w = max(6, int(target_h * aspect))
    if target_w > cell_w * 0.9:
        target_w = int(cell_w * 0.9)
        target_h = max(8, int(target_w / max(aspect, 0.2)))
    image = Image.fromarray(glyph, mode="RGBA").resize((target_w, target_h), Image.Resampling.NEAREST)
    halo = _halo(np.asarray(image))
    left = int(round(x0 + (cell_w - target_w) / 2))
    top = int(round(y0 + (cell_h - target_h) / 2))
    card.alpha_composite(Image.fromarray(halo, mode="RGBA"), (left, top))
    card.alpha_composite(image, (left, top))


def _draw_column_labels(draw, grid: Grid, map_box, _band: int, origin_y: float) -> None:
    font = ImageFont.truetype(_FONT, 28)
    by_col: dict[int, list] = {}
    for cell in grid.cells:
        by_col.setdefault(cell.col, []).append(cell)
    for col, label in enumerate(grid.column_labels):
        if not label or col not in by_col:
            continue
        group = by_col[col]
        sx0 = min(cell.x0 for cell in group)
        sx1 = max(cell.x1 for cell in group)
        left, top, right, _bottom = map_box(sx0, group[0].y0, sx1, group[0].y1)
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (left + right - tw) / 2
        y = origin_y - th - 8
        draw.text((x + 1, y + 1), label, font=font, fill=(255, 255, 255, 230))
        draw.text((x, y), label, font=font, fill=(20, 20, 22, 255))


def _draw_letter(draw: ImageDraw.ImageDraw, box, letter: str) -> None:
    x0, y0, x1, y1 = box
    cell_h = y1 - y0
    size = max(14, int(cell_h * (0.46 if len(letter) == 1 else 0.36)))
    font = ImageFont.truetype(_FONT, size)
    bbox = draw.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = x0 + (x1 - x0 - tw) / 2 - bbox[0]
    y = y0 + (y1 - y0 - th) / 2 - bbox[1]
    draw.text((x, y), letter, font=font, fill=(12, 12, 14, 255))


def paper_size_mm(paper: str) -> tuple[float, float]:
    if paper == "letter":
        return 215.9, 279.4
    return 210.0, 297.0


def impose(cards: list[Image.Image], paper: str) -> bytes:
    page_w, page_h = paper_size_mm(paper if paper in {"a4", "letter"} else "a4")
    card_w, card_h = _CARD_MM
    cols, rows = 3, 3
    gutter = 4.0
    for candidate in (4.0, 3.0, 2.5):
        grid_w = cols * card_w + (cols - 1) * candidate
        grid_h = rows * card_h + (rows - 1) * candidate
        margin_x = (page_w - grid_w) / 2
        margin_y = (page_h - grid_h) / 2
        if margin_x >= 4.2 and margin_y >= 4.2:
            gutter = candidate
            break
    grid_w = cols * card_w + (cols - 1) * gutter
    grid_h = rows * card_h + (rows - 1) * gutter
    margin_x = (page_w - grid_w) / 2
    margin_y = (page_h - grid_h) / 2
    mark = max(2.0, min(3.2, margin_x - 1.0, margin_y - 1.0))

    doc = pymupdf.open()
    try:
        for start in range(0, len(cards), cols * rows):
            page = doc.new_page(width=_pt(page_w), height=_pt(page_h))
            chunk = cards[start : start + cols * rows]
            for index, card in enumerate(chunk):
                col = index % cols
                row = index // cols
                x = margin_x + col * (card_w + gutter)
                y = margin_y + row * (card_h + gutter)
                rect = pymupdf.Rect(_pt(x), _pt(y), _pt(x + card_w), _pt(y + card_h))
                buffer = io.BytesIO()
                card.save(buffer, format="PNG")
                page.insert_image(rect, stream=buffer.getvalue())
                _crop_marks(page, rect, _pt(mark))
        out = io.BytesIO()
        doc.save(out, deflate=True, garbage=4)
        return out.getvalue()
    finally:
        doc.close()


def _crop_marks(page: pymupdf.Page, rect: pymupdf.Rect, mark: float) -> None:
    gap = _pt(0.8)
    color = (0, 0, 0)
    width = 0.7
    corners = (
        (rect.x0, rect.y0, -1, -1),
        (rect.x1, rect.y0, 1, -1),
        (rect.x0, rect.y1, -1, 1),
        (rect.x1, rect.y1, 1, 1),
    )
    for x, y, sx, sy in corners:
        page.draw_line(
            pymupdf.Point(x + sx * gap, y),
            pymupdf.Point(x + sx * (gap + mark), y),
            color=color,
            width=width,
        )
        page.draw_line(
            pymupdf.Point(x, y + sy * gap),
            pymupdf.Point(x, y + sy * (gap + mark)),
            color=color,
            width=width,
        )
