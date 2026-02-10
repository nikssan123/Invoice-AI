import asyncio
import base64
import io
import json
import logging
import os
from typing import Protocol, runtime_checkable

from PIL import Image

from app.schemas import ExtractResponse, InvoiceFields

logger = logging.getLogger(__name__)


@runtime_checkable
class LLMClient(Protocol):
    """Protocol for pluggable LLM clients used for invoice extraction."""

    async def extract_invoice_json(self, prompt: str) -> str:
        """Return a JSON string with invoice fields extracted from OCR text."""
        ...


class DummyLLMClient:
    """Fallback LLM client used when no real provider is configured.

    Returns an object where all fields are null. This keeps the API contract
    while allowing the service to run self-hosted without an LLM.
    """

    async def extract_invoice_json(self, prompt: str) -> str:
        logger.warning("DummyLLMClient in use; returning empty invoice fields")
        payload = {
            "supplierName": None,
            "supplierVat": None,
            "invoiceNumber": None,
            "invoiceDate": None,
            "currency": None,
            "netAmount": None,
            "vatAmount": None,
            "totalAmount": None,
        }
        return json.dumps(payload)


class OpenAILLMClient:
    """OpenAI-based LLM client for invoice extraction.

    Uses the official OpenAI Python SDK. Configuration via env vars:
    - OPENAI_API_KEY: required API key.
    - OPENAI_MODEL: optional model for text (default: gpt-4.1-mini).
    - OPENAI_VISION_MODEL: optional model for vision (default: gpt-5.2).
    """

    def __init__(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set; cannot use OpenAILLMClient")

        try:
            from openai import OpenAI  # type: ignore
        except ImportError as exc:  # pragma: no cover - import error path
            raise RuntimeError(
                "openai package is not installed. "
                "Install it with 'pip install openai' inside the ocr-service env."
            ) from exc

        self._client = OpenAI(api_key=api_key)
        self._model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        self._vision_model = os.environ.get("OPENAI_VISION_MODEL", "gpt-5.2")
        logger.info("Initialized OpenAILLMClient with model %s, vision %s", self._model, self._vision_model)

    async def extract_invoice_json(self, prompt: str) -> str:
        """Call OpenAI chat completion API and return the raw content string."""

        def _call() -> str:
            # Local import to avoid paying import cost at module import time if unused
            from openai import OpenAI  # type: ignore  # noqa: F401

            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an invoice extraction engine. "
                            "Follow the user's instructions exactly and return ONLY valid JSON."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_completion_tokens=512,
            )
            content = response.choices[0].message.content or ""
            return content.strip()

        # Run the blocking OpenAI call in a thread so we don't block the event loop
        return await asyncio.to_thread(_call)

    async def extract_invoice_json_from_images(
        self, image_parts: list[tuple[bytes, str]], prompt: str
    ) -> str:
        """Call OpenAI vision API: user message with text + image_url parts; return raw JSON string."""
        content: list[dict] = [{"type": "text", "text": prompt}]
        for img_bytes, mime in image_parts:
            b64 = base64.standard_b64encode(img_bytes).decode("ascii")
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
            )

        def _call() -> str:
            from openai import OpenAI  # type: ignore  # noqa: F401
            logger.info("Extracting invoice fields from images with model %s", self._vision_model)
            response = self._client.chat.completions.create(
                model=self._vision_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an invoice extraction engine. "
                            "Follow the user's instructions exactly and return ONLY valid JSON."
                        ),
                    },
                    {"role": "user", "content": content},
                ],
                temperature=0.0,
                max_completion_tokens=1024,
            )
            raw = response.choices[0].message.content or ""
            return raw.strip()

        return await asyncio.to_thread(_call)


def get_llm_client() -> LLMClient:
    """Factory for LLM client instances.

    If OPENAI_API_KEY is set (and optionally LLM_PROVIDER=openai), use OpenAI;
    otherwise fall back to the dummy implementation.
    """
    provider = os.environ.get("LLM_PROVIDER") or (
        "openai" if os.environ.get("OPENAI_API_KEY") else "dummy"
    )
    logger.info("Using LLM provider %s", provider)

    if provider.lower() == "openai":
        return OpenAILLMClient()

    return DummyLLMClient()


PROMPT_TEMPLATE = """You are an AI assistant extracting invoice fields from OCR text.

Requirements:
- Return STRICT JSON only, no explanation or additional text.
- Use null for missing or unknown fields.
- Do NOT invent or guess values not explicitly present in the text.
- Normalize:
  - Dates: use YYYY-MM-DD or null.
  - Numbers: use digits with optional decimal point, no thousands separators.
  - Currency: use ISO codes like EUR, USD, BGN when present, otherwise null.

Expected JSON format:
{{
  "supplierName": string|null,
  "supplierVat": string|null,
  "invoiceNumber": string|null,
  "invoiceDate": string|null,
  "currency": string|null,
  "netAmount": number|null,
  "vatAmount": number|null,
  "totalAmount": number|null
}}

OCR text:
\"\"\"{ocr_text}\"\"\""""

VISION_PROMPT = """The following image(s) show an invoice document. Extract the requested fields from the image(s).

Requirements:
- Return STRICT JSON only, no explanation or additional text.
- Use null for missing or unknown fields. Use null for any entire nested object if all its fields are missing.
- Do NOT invent or guess values not explicitly present in the document.
- Normalize: dates as YYYY-MM-DD; numbers with optional decimal point, no thousands separators; currency as ISO codes (EUR, USD, BGN).
- confidenceScores: For each extracted value you are confident about, add a key to confidenceScores with a number from 0.0 (not confident) to 1.0 (very confident). Use keys such as: supplierName, supplierAddress, supplierEik, supplierVat, clientName, clientEik, clientVat, invoiceNumber, invoiceDate, serviceDescription, quantity, unitPrice, serviceTotal, accountingAccount, subtotal, vat, total, currency. Only include keys for fields you actually extracted; use 1.0 when the value was clearly visible and unambiguous, lower values when unclear or partially legible.

Expected JSON format (use exactly these keys):
{{
  "invoiceNumber": string|null,
  "invoiceDate": string|null,
  "supplier": {{ "name": string|null, "address": string|null, "eik": string|null, "vat": string|null }} | null,
  "client": {{ "name": string|null, "eik": string|null, "vat": string|null }} | null,
  "service": {{ "description": string|null, "quantity": string|null, "unitPrice": number|null, "total": number|null }} | null,
  "accountingAccount": string|null,
  "amounts": {{ "subtotal": number|null, "vat": number|null, "total": number|null, "currency": string|null }} | null,
  "confidenceScores": {{ string: number }} (e.g. "supplierName": 0.95, "invoiceNumber": 1.0, "total": 0.9; 0.0-1.0, only for fields you extracted)
}}"""


def _strip_markdown_json(raw: str) -> str:
    """If raw is wrapped in ```json ... ``` or ``` ... ```, return the inner content; else return stripped raw."""
    s = raw.strip()
    if s.startswith("```"):
        # Remove opening fence (```json or ```)
        first_nl = s.find("\n")
        if first_nl != -1:
            s = s[first_nl + 1 :]
        # Remove closing ```
        if s.rstrip().endswith("```"):
            s = s[: s.rstrip().rfind("```")].rstrip()
        return s.strip()
    return s


def _pil_to_base64_parts(images: list[Image.Image]) -> list[tuple[bytes, str]]:
    """Convert PIL images to (bytes, mime) for vision API. Uses PNG."""
    parts: list[tuple[bytes, str]] = []
    buf = io.BytesIO()
    for img in images:
        buf.seek(0)
        buf.truncate(0)
        if getattr(img, "mode", None) != "RGB":
            img = img.convert("RGB")
        img.save(buf, format="PNG")
        parts.append((buf.getvalue(), "image/png"))
    return parts


async def extract_invoice_fields_from_images(
    images: list[Image.Image], document_id: str | None = None
) -> ExtractResponse:
    """
    Extract invoice fields by sending image(s) to OpenAI vision API.
    Returns rule-style ExtractResponse (supplier, client, service, amounts, etc.).
    Requires OPENAI_API_KEY; callers should return 503 when not set.
    """
    if not images:
        return ExtractResponse()
    image_parts = _pil_to_base64_parts(images)
    prompt = VISION_PROMPT
    client = get_llm_client()
    method = getattr(client, "extract_invoice_json_from_images", None)
    if method is None:
        raise RuntimeError("Vision extraction requires OpenAI (set OPENAI_API_KEY).")
    try:
        raw = await method(image_parts, prompt)
        parsed = _strip_markdown_json(raw)
        data = json.loads(parsed)
        return ExtractResponse(**data)
    except Exception as exc:
        logger.exception("Vision extraction failed: %s", exc)
        raise


async def extract_invoice_fields(ocr_text: str) -> InvoiceFields:
    """Call the configured LLM to extract structured invoice fields from OCR text."""
    client = get_llm_client()
    prompt = PROMPT_TEMPLATE.format(ocr_text=ocr_text)
    try:
        raw = await client.extract_invoice_json(prompt)
        data = json.loads(raw)
        return InvoiceFields(**data)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.exception("LLM extraction failed; returning empty fields: %s", exc)
        # Fallback to an all-null structure to keep response deterministic
        return InvoiceFields()

