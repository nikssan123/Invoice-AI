"""Convert PDF documents to PIL Images for OCR processing."""

import logging
from typing import TYPE_CHECKING

from pdf2image import convert_from_bytes
from pdf2image.exceptions import PDFInfoNotInstalledError

if TYPE_CHECKING:
    from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_DPI = 200


def pdf_to_images(pdf_bytes: bytes, dpi: int = DEFAULT_DPI) -> list["Image.Image"]:
    """
    Convert a PDF document to a list of PIL Images, one per page.

    Args:
        pdf_bytes: Raw PDF file content as bytes.
        dpi: Resolution for rendering (default 200, balance of quality and speed).

    Returns:
        List of PIL Image objects, one per page.

    Raises:
        PDFInfoNotInstalledError: If poppler is not installed on the system.
        ValueError: If PDF is invalid or cannot be converted.
    """
    try:
        images = convert_from_bytes(pdf_bytes, dpi=dpi)
    except PDFInfoNotInstalledError as e:
        logger.error("Poppler is not installed. Install poppler-utils (apt-get install poppler-utils)")
        raise RuntimeError(
            "PDF conversion requires poppler. Install it: apt-get install poppler-utils (Linux), "
            "brew install poppler (macOS), or use the poppler-windows release (Windows)."
        ) from e
    except Exception as e:
        logger.exception("Failed to convert PDF to images")
        raise ValueError(f"Invalid or corrupted PDF: {e}") from e

    return list(images)
