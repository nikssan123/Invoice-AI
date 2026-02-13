from datetime import date
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, model_validator


class ExtractInvoiceRequest(BaseModel):
    """Request body for /extract-invoice."""

    documentId: str
    ocrText: str


class InvoiceFields(BaseModel):
    """Structured invoice fields extracted from OCR text."""

    supplierName: Optional[str] = None
    supplierVat: Optional[str] = None
    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[date] = None
    currency: Optional[str] = None
    netAmount: Optional[float] = None
    vatAmount: Optional[float] = None
    totalAmount: Optional[float] = None


class InvoiceConfidence(BaseModel):
    """Per-field confidence scores in the range [0.0, 1.0]."""

    supplierName: float = 0.0
    invoiceNumber: float = 0.0
    totalAmount: float = 0.0


class InvoiceValidation(BaseModel):
    """Deterministic validation results for extracted invoice fields."""

    isConsistent: bool
    issues: List[str] = Field(default_factory=list)


class ExtractInvoiceResponse(BaseModel):
    """Response body for /extract-invoice."""

    documentId: str
    fields: InvoiceFields
    confidence: InvoiceConfidence
    validation: InvoiceValidation


# ---- Rule-based extraction (POST /extract) ----


class ExtractRequest(BaseModel):
    """Request body for POST /extract (rule-based). At least one of ocrText or lines must be present."""

    ocrText: Optional[str] = None
    lines: Optional[List[str]] = None
    documentId: Optional[str] = None

    @model_validator(mode="after")
    def require_ocr_input(self) -> "ExtractRequest":
        if not self.ocrText and not self.lines:
            raise ValueError("At least one of ocrText or lines must be provided")
        if self.lines is not None and len(self.lines) == 0:
            raise ValueError("lines must not be empty when provided")
        return self


class RuleSupplier(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    eik: Optional[str] = None
    vat: Optional[str] = None


class RuleClient(BaseModel):
    name: Optional[str] = None
    eik: Optional[str] = None
    vat: Optional[str] = None


class RuleService(BaseModel):
    description: Optional[str] = None
    quantity: Optional[str] = None
    unitPrice: Optional[float] = None
    total: Optional[float] = None


class RuleAmounts(BaseModel):
    subtotal: Optional[float] = None
    vat: Optional[float] = None
    total: Optional[float] = None
    currency: Optional[str] = None


class ExtractResponse(BaseModel):
    """Response body for POST /extract (rule-based Bulgarian invoice extraction)."""

    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[str] = None
    supplier: Optional[RuleSupplier] = None
    client: Optional[RuleClient] = None
    service: Optional[RuleService] = None
    accountingAccount: Optional[str] = None
    amounts: Optional[RuleAmounts] = None
    confidenceScores: Optional[Dict[str, float]] = None


# ---- Vision extraction (POST /extract-vision) extended response ----


class AdditionalFieldItem(BaseModel):
    """Single additional extracted field (dynamic schema)."""

    key: str
    label: str
    value: Union[str, int, float, bool]
    confidence: float = 0.0
    type: Literal["text", "number", "date", "boolean"]


class VisionExtractResponse(BaseModel):
    """Response body for POST /extract-vision: required fields + additional fields."""

    requiredFields: ExtractResponse
    additionalFields: List[AdditionalFieldItem] = Field(default_factory=list)

