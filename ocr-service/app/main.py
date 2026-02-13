"""FastAPI OCR service - extract plain text from PDF and image uploads."""

from pathlib import Path

from dotenv import load_dotenv

# Load .env from ocr-service directory when running locally
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import asyncio
import io
import json
import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

from app.confidence import compute_confidence
from app.extractor import extract_invoice_fields, extract_invoice_fields_from_images
from app.pdf_utils import pdf_to_images
from app.rule_extractor import extract_invoice_rules
from app.schemas import (
    ExtractInvoiceRequest,
    ExtractInvoiceResponse,
    ExtractRequest,
    ExtractResponse,
    VisionExtractResponse,
)
from app.ocr import extract_text_from_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
# Ensure app loggers emit INFO even if uvicorn overrides root logger level
logging.getLogger("app").setLevel(logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OCR Service",
    description="Extract plain text from PDF and image documents",
    version="1.0.0",
)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


class PageResult(BaseModel):
    """Single page OCR result."""

    page: int
    text: str


class OCRResponse(BaseModel):
    """Response model for POST /ocr."""

    documentId: str
    pages: list[PageResult]


def _get_file_extension(filename: str | None) -> str:
    """Extract lowercase extension from filename."""
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def _is_allowed_file(filename: str | None, content_type: str | None) -> bool:
    """Check if file type is supported (validates extension; content_type is advisory)."""
    ext = _get_file_extension(filename)
    return ext in ALLOWED_EXTENSIONS


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/ocr", response_model=OCRResponse)
async def ocr_extract(file: UploadFile = File(...)) -> OCRResponse:
    """
    Extract plain text from an uploaded PDF or image file.

    Supports: PDF, PNG, JPG
    """
    request_id = str(uuid.uuid4())[:8]

    if not file.filename:
        logger.warning("[%s] No filename provided", request_id)
        raise HTTPException(status_code=422, detail="No file provided")

    if not _is_allowed_file(file.filename, file.content_type):
        logger.warning("[%s] Unsupported file type: %s", request_id, file.filename)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: PDF, PNG, JPG",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    document_id = str(uuid.uuid4())
    ext = _get_file_extension(file.filename)
    pages: list[PageResult] = []

    try:
        if ext == ".pdf":
            images = pdf_to_images(content)
            logger.info("[%s] PDF converted to %d pages", request_id, len(images))

            for i, img in enumerate(images):
                text = extract_text_from_image(img)
                pages.append(PageResult(page=i + 1, text=text))
        else:
            img = Image.open(io.BytesIO(content))
            if img.mode != "RGB":
                img = img.convert("RGB")
            text = extract_text_from_image(img)
            pages.append(PageResult(page=1, text=text))
            logger.info("[%s] Image processed", request_id)

    except (ValueError, RuntimeError, OSError) as e:
        logger.exception("[%s] OCR processing failed: %s", request_id, e)
        return JSONResponse(
            status_code=500,
            content={"detail": "OCR processing failed", "documentId": document_id},
        )

    return OCRResponse(documentId=document_id, pages=pages)


async def _extract_invoice_llm(payload: ExtractInvoiceRequest) -> ExtractInvoiceResponse:
    """Shared LLM-based extraction: fields, validation, confidence. Used by /extract-invoice and /extract-llm."""
    from app.validator import validate_invoice  # local import to avoid cycles

    fields = await extract_invoice_fields(payload.ocrText)
    validation = validate_invoice(fields)
    confidence = compute_confidence(fields, validation)
    return ExtractInvoiceResponse(
        documentId=payload.documentId,
        fields=fields,
        confidence=confidence,
        validation=validation,
    )


@app.post("/extract-llm", response_model=ExtractInvoiceResponse)
async def extract_llm(payload: ExtractInvoiceRequest) -> ExtractInvoiceResponse:
    """Extract structured invoice fields from plain OCR text using an LLM."""
    request_id = str(uuid.uuid4())[:8]
    logger.info("[%s] Extract-LLM for document %s", request_id, payload.documentId)
    response = await _extract_invoice_llm(payload)
    logger.info("[%s] Extract-LLM completed for %s (issues=%d)", request_id, payload.documentId, len(response.validation.issues))
    return response


@app.post("/extract-vision", response_model=VisionExtractResponse)
async def extract_vision(file: UploadFile = File(...)) -> VisionExtractResponse:
    """
    Extract structured invoice fields by sending the uploaded image or PDF
    directly to the OpenAI vision API. Returns requiredFields + additionalFields.
    """
    request_id = str(uuid.uuid4())[:8]
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Vision extraction requires OpenAI. Set OPENAI_API_KEY.",
        )
    if not file.filename:
        raise HTTPException(status_code=422, detail="No file provided")
    if not _is_allowed_file(file.filename, file.content_type):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, PNG, JPG",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    ext = _get_file_extension(file.filename)
    images: list[Image.Image] = []

    try:
        if ext == ".pdf":
            images = pdf_to_images(content)
            logger.info("[%s] Extract-vision: PDF converted to %d pages", request_id, len(images))
        else:
            img = Image.open(io.BytesIO(content))
            if img.mode != "RGB":
                img = img.convert("RGB")
            images = [img]
            logger.info("[%s] Extract-vision: image upload", request_id)
    except (ValueError, RuntimeError, OSError) as e:
        logger.exception("[%s] File conversion failed: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Failed to convert file to images") from e

    if not images:
        raise HTTPException(status_code=400, detail="No pages to process")

    try:
        return await extract_invoice_fields_from_images(images)
    except RuntimeError as e:
        if "OPENAI" in str(e) or "vision" in str(e).lower():
            raise HTTPException(status_code=503, detail=str(e)) from e
        raise HTTPException(status_code=500, detail="Vision extraction failed") from e
    except Exception as e:
        logger.exception("[%s] Vision extraction failed: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Vision extraction failed") from e



@app.post("/extract-invoice", response_model=ExtractResponse)
async def extract_rules(payload: ExtractRequest) -> ExtractResponse:
    """Extract structured invoice fields from OCR text using rule-based extraction only (no LLM). Bulgarian invoices."""
    request_id = str(uuid.uuid4())[:8]
    ocr_text = payload.ocrText if payload.ocrText else "\n".join(payload.lines or [])
    logger.info("[%s] Rule-based extract (len=%d)", request_id, len(ocr_text))
    return extract_invoice_rules(ocr_text)


# ---- Invoice chat (accountant Q&A over extraction JSON) ----

class ChatHistoryItem(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class InvoiceChatRequest(BaseModel):
    extraction: dict[str, Any]
    message: str
    history: list[ChatHistoryItem] = []
    plan: str = "starter"  # "starter" | "pro" | "enterprise"


class InvoiceChatResponse(BaseModel):
    content: str


STARTER_SYSTEM_PROMPT = (
    "You are a professional accountant. Answer only questions about the provided invoice's data and basic accounting. "
    "Use only the extraction JSON you are given as context. "
    "If the user asks generic accounting or other questions beyond this invoice, "
    "explain what can and cannot be concluded from the available data, and what typical accounting treatment would be, "
    "but do NOT tell the user to consult another accountant—you are the accountant in this conversation."
)

PRO_ENTERPRISE_SYSTEM_PROMPT = (
    "You are a professional accountant. You have extracted data for a specific invoice as structured JSON. "
    "You may answer questions about this invoice AND general accounting questions (e.g. VAT rules, typical treatments), "
    "using the extraction JSON as context when it is relevant. "
    "If the question is unrelated to accounting or invoices, politely refuse to answer. "
    "Do NOT tell the user to consult another accountant—you are the accountant in this conversation."
)


async def _invoice_chat_openai(
    extraction: dict[str, Any],
    message: str,
    history: list[ChatHistoryItem],
    plan: str,
) -> str:
    """Call OpenAI chat with a cheaper model; system prompt enforces accountant-only, invoice-only."""
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set; cannot use invoice chat.")
    model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    client = OpenAI(api_key=api_key)
    context = json.dumps(extraction, ensure_ascii=False, indent=2)
    plan_normalized = (plan or "starter").lower()
    if plan_normalized == "pro" or plan_normalized == "enterprise":
        system_prompt = PRO_ENTERPRISE_SYSTEM_PROMPT
    else:
        system_prompt = STARTER_SYSTEM_PROMPT
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt + "\n\nExtracted invoice data (JSON):\n" + context},
    ]
    for h in history:
        if h.role in ("user", "assistant"):
            messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": message})

    def _call() -> str:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
        return (response.choices[0].message.content or "").strip()

    return await asyncio.to_thread(_call)


@app.post("/invoice-chat", response_model=InvoiceChatResponse)
async def invoice_chat(payload: InvoiceChatRequest) -> InvoiceChatResponse:
    """
    Answer a question about an invoice using extracted JSON as context.
    Uses a cheaper OpenAI model and a strict accountant-only system prompt.
    """
    request_id = str(uuid.uuid4())[:8]
    logger.info(
        "[%s] Invoice-chat request (plan=%s, history=%d)",
        request_id,
        payload.plan,
        len(payload.history),
    )
    try:
        content = await _invoice_chat_openai(payload.extraction, payload.message, payload.history, payload.plan)
        logger.info("[%s] Invoice-chat completed", request_id)
        return InvoiceChatResponse(content=content)
    except RuntimeError as e:
        if "OPENAI" in str(e) or "not set" in str(e).lower():
            raise HTTPException(status_code=503, detail=str(e)) from e
        raise HTTPException(status_code=500, detail="Invoice chat failed") from e
    except Exception as e:
        logger.exception("[%s] Invoice chat failed: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Invoice chat failed") from e
