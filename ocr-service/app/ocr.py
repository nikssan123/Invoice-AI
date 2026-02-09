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


def _sort_by_reading_order(lines: list) -> list:
    """
    Sort OCR lines by reading order (top-to-bottom, left-to-right).

    Each line is [[box], (text, conf)]. Box is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]].
    Use top-left y then x for ordering. Defensive for PaddleOCR 3.x result shape variations.
    """
    def sort_key(item: tuple) -> tuple[float, float]:
        box = item[0] if len(item) > 0 else None
        if box is None:
            return (0.0, 0.0)
        if not isinstance(box, (list, tuple, np.ndarray)):
            return (0.0, 0.0)
        if len(box) == 0:
            return (0.0, 0.0)
        xs, ys = [], []
        for p in box:
            if isinstance(p, (list, tuple, np.ndarray)) and len(p) >= 2:
                try:
                    xs.append(float(p[0]))
                    ys.append(float(p[1]))
                except (TypeError, ValueError):
                    pass
        if not xs or not ys:
            return (0.0, 0.0)
        return (min(ys), min(xs))

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


def extract_text_from_image(image: Image.Image) -> str:
    """
    Extract plain text from a single image using PaddleOCR.

    Args:
        image: PIL Image to process.

    Returns:
        Extracted text with normalized whitespace, in reading order.
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
    texts = []
    for line in sorted_lines:
        if len(line) < 2:
            continue
        part = line[1]
        if isinstance(part, str):
            texts.append(part)
        elif part and (isinstance(part, (list, tuple)) and len(part) > 0):
            texts.append(part[0] if isinstance(part[0], str) else str(part[0]))
    combined = " ".join(texts)

    return _normalize_whitespace(combined)
