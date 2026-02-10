"""OCR logic using PaddleOCR for text extraction from images."""

import json
import logging
import os
import re
import time

import numpy as np
from paddleocr import PaddleOCR
from PIL import Image

logger = logging.getLogger(__name__)

_ocr_engine: PaddleOCR | None = None


def _get_ocr_engine() -> PaddleOCR:
    """Lazy-initialize PaddleOCR engine (loaded once per process)."""
    global _ocr_engine
    if _ocr_engine is None:
        # TODO: make this dynamic
        lang = os.environ.get("OCR_LANG", "bg")
        logger.info("Initializing PaddleOCR engine with lang=%s", lang)
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="bg",
        )
        logger.info("PaddleOCR engine initialized with lang=%s", lang)
    return _ocr_engine


def _normalize_whitespace(text: str) -> str:
    """Collapse multiple spaces/newlines to single space and strip."""
    return re.sub(r"\s+", " ", text).strip()


def _parse_box(segment: tuple) -> tuple[float, float, float, float] | None:
    """
    Parse segment [box, (text, conf)] to (min_x, min_y, max_x, max_y).
    Returns None if box is missing or invalid. Handles list/ndarray points.
    """
    if not segment or len(segment) < 1:
        return None
    box = segment[0]
    if box is None or not isinstance(box, (list, tuple, np.ndarray)) or len(box) == 0:
        return None
    xs, ys = [], []
    for p in box:
        if isinstance(p, (list, tuple, np.ndarray)) and len(p) >= 2:
            try:
                xs.append(float(p[0]))
                ys.append(float(p[1]))
            except (TypeError, ValueError):
                pass
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def _segment_geometry(segment: tuple) -> tuple[float, float, float] | None:
    """
    For a segment [box, (text, conf)], return (center_x, center_y, height).
    Used for line grouping and ordering. Returns None if box invalid.
    """
    b = _parse_box(segment)
    if b is None:
        return None
    min_x, min_y, max_x, max_y = b
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    height = max_y - min_y
    return (center_x, center_y, height)


def _sort_by_reading_order(lines: list) -> list:
    """
    Sort OCR lines by reading order (top-to-bottom, left-to-right).

    Each line is [[box], (text, conf)]. Box is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]].
    Use top-left y then x for ordering. Defensive for PaddleOCR 3.x result shape variations.
    """
    def sort_key(item: tuple) -> tuple[float, float]:
        b = _parse_box(item)
        if b is None:
            return (0.0, 0.0)
        min_x, min_y, max_x, max_y = b
        return (min_y, min_x)

    return sorted(lines, key=sort_key)


def _result_dict_to_lines(d: dict) -> list:
    """Convert PaddleOCR 3.x dict result to list of [box, (text, conf)] for compatibility."""
    # Common 3.x keys: dt_polys / dt_boxes for boxes, rec_texts for text, rec_scores for confidence
    polys = d.get("dt_polys") or d.get("dt_boxes") or d.get("boxes")
    texts = d.get("rec_texts") or d.get("texts")
    scores = d.get("rec_scores") or d.get("scores")
    if not polys or not texts:
        return []
    if not isinstance(polys, (list, tuple)) or not isinstance(texts, (list, tuple)):
        return []
    n = min(len(polys), len(texts))
    lines = []
    for i in range(n):
        text = texts[i] if i < len(texts) else ""
        conf = float(scores[i]) if scores and i < len(scores) else 0.0
        lines.append([polys[i], (text, conf)])
    return lines


def _group_into_lines(segments: list) -> list[list]:
    """
    Group segments into logical lines by similar y-coordinate.
    Each segment is [box, (text, conf)]. Returns list of lines, each line a list of segments.
    Defensive: invalid/missing boxes are still included (e.g. in current line).
    """
    if not segments:
        return []
    # (center_x, center_y, height) per segment; None if invalid
    geoms = []
    for seg in segments:
        g = _segment_geometry(seg)
        geoms.append(g)
    heights = [g[2] for g in geoms if g is not None]
    line_height = float(max(np.median(heights), 5.0)) if heights else 10.0
    y_threshold = 0.4 * line_height
    # Sort by (center_y, center_x)
    def sort_key(i: int) -> tuple[float, float]:
        g = geoms[i]
        if g is None:
            return (0.0, 0.0)
        return (geoms[i][1], geoms[i][0])
    indices = sorted(range(len(segments)), key=sort_key)
    lines: list[list] = []
    current_line: list = []
    current_y: float | None = None
    for i in indices:
        seg = segments[i]
        g = geoms[i]
        if g is None:
            if current_line:
                current_line.append(seg)
            else:
                lines.append([seg])
                current_y = None
            continue
        cy = g[1]
        if current_y is None or abs(cy - current_y) <= y_threshold:
            current_line.append(seg)
            if current_y is None:
                current_y = cy
        else:
            if current_line:
                lines.append(current_line)
            current_line = [seg]
            current_y = cy
    if current_line:
        lines.append(current_line)
    return lines


def extract_text_from_image(image: Image.Image) -> str:
    """
    Extract plain text from a single image using PaddleOCR.

    Args:
        image: PIL Image to process.

    Returns:
        Extracted text in reading order, one line per visual line (newlines preserved);
        spaces normalized within each line.
    """
    logger.info("Extracting text from image")
    engine = _get_ocr_engine()
    img_array = np.array(image)

    try:
        result = engine.ocr(img_array)
    except Exception as e:
        logger.exception("PaddleOCR failed")
        raise RuntimeError(f"OCR processing failed: {e}") from e

    if not result or result[0] is None:
        return ""

    raw = result[0]
    if raw is None:
        return ""

    # PaddleOCR 3.x may return a dict (e.g. dt_polys + rec_texts) instead of list of [box, (text, conf)]
    if isinstance(raw, dict):
        lines = _result_dict_to_lines(raw)
        if not lines:
            return ""
    else:
        lines = raw if isinstance(raw, (list, tuple)) else []
    if not lines:
        return ""

    # #region agent log
    def _safe(v):
        if isinstance(v, (list, tuple)) and len(v) > 5:
            return str(v)[:200] + "..."
        return str(v)[:150]
    lines_slice = lines[:15] if isinstance(lines, (list, tuple)) else list(lines)[:15]
    sample = []
    for i, line in enumerate(lines_slice):
        if isinstance(line, (list, tuple)) and len(line) >= 2:
            part = line[1]
            sample.append({"i": i, "part_type": type(part).__name__, "part": _safe(part), "part0": _safe(part[0]) if part and isinstance(part, (list, tuple)) and len(part) > 0 else None})
    # #endregion

    sorted_lines = _sort_by_reading_order(lines)

    def _segment_text(seg):
        if len(seg) < 2:
            return ""
        part = seg[1]
        if isinstance(part, str):
            return part
        if part and isinstance(part, (list, tuple)) and len(part) > 0:
            return part[0] if isinstance(part[0], str) else str(part[0])
        return ""

    try:
        grouped = _group_into_lines(sorted_lines)
        if not grouped and sorted_lines:
            raise ValueError("grouping produced no lines")
        line_strings = []
        for line_segments in grouped:
            parts = [_segment_text(seg) for seg in line_segments]
            line_strings.append(" ".join(parts))
        normalized_lines = [_normalize_whitespace(s) for s in line_strings]
        return "\n".join(normalized_lines)
    except Exception:
        logger.debug("Line grouping failed, using flat join", exc_info=True)
        texts = [_segment_text(line) for line in sorted_lines]
        return _normalize_whitespace(" ".join(texts))
