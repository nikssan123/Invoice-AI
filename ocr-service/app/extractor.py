import asyncio
import json
import logging
import os
from typing import Protocol, runtime_checkable

from app.schemas import InvoiceFields

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
    - OPENAI_MODEL: optional model name (default: gpt-4.1-mini).
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
        logger.info("Initialized OpenAILLMClient with model %s", self._model)

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
                max_tokens=512,
            )
            content = response.choices[0].message.content or ""
            return content.strip()

        # Run the blocking OpenAI call in a thread so we don't block the event loop
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

