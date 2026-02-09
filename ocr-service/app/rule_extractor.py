"""
Rule-based invoice extraction for Bulgarian invoices.
No LLM or external API calls. Uses regex and keyword proximity only.
"""

import re
from typing import Optional

from app.schemas import (
    ExtractResponse,
    RuleAmounts,
    RuleClient,
    RuleService,
    RuleSupplier,
)

# Confidence: 1.0 = keyword + regex, 0.7 = regex only, 0.4 = inferred, 0.0 = not found
CONF_KEYWORD_REGEX = 1.0
CONF_REGEX_ONLY = 0.7
CONF_INFERRED = 0.4
CONF_NOT_FOUND = 0.0


def normalize_text(text: str) -> str:
    """Lowercase and normalize whitespace (single spaces, strip)."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip()).lower()


def _parse_decimal(s: Optional[str]) -> Optional[float]:
    """Parse Bulgarian-style number (comma or dot as decimal separator). Returns None on failure."""
    if s is None or not s.strip():
        return None
    s = s.strip().replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _first_match(pattern: str, text: str, group: int = 1) -> tuple[Optional[str], float]:
    """Return (capture group, confidence). Confidence CONF_REGEX_ONLY for regex-only match."""
    m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if m and m.lastindex >= group:
        return (m.group(group).strip(), CONF_REGEX_ONLY)
    return (None, CONF_NOT_FOUND)


def _last_match(pattern: str, text: str, group: int = 1) -> tuple[Optional[str], float]:
    """Return (last capture group, confidence)."""
    matches = list(re.finditer(pattern, text, re.IGNORECASE | re.DOTALL))
    if not matches:
        return (None, CONF_NOT_FOUND)
    m = matches[-1]
    if m.lastindex >= group:
        return (m.group(group).strip(), CONF_REGEX_ONLY)
    return (None, CONF_NOT_FOUND)


def _keyword_line(keyword: str, text: str, next_line_as_value: bool = True) -> tuple[Optional[str], float]:
    """Find keyword and return first line after it as value (e.g. Доставчик -> first line). CONF_KEYWORD_REGEX."""
    pattern = re.escape(keyword) + r"[:\s]*\n?\s*([^\n]+)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return (m.group(1).strip(), CONF_KEYWORD_REGEX)
    return (None, CONF_NOT_FOUND)


def extract_invoice_rules(ocr_text: str) -> ExtractResponse:
    """
    Extract structured fields from Bulgarian invoice OCR text using deterministic rules.
    Never raises: on any exception returns response with nulls and zero confidence.
    """
    try:
        return _extract_invoice_rules_impl(ocr_text)
    except Exception:
        return _empty_response()


def _empty_response() -> ExtractResponse:
    return ExtractResponse(
        invoiceNumber=None,
        invoiceDate=None,
        supplier=RuleSupplier(),
        client=RuleClient(),
        service=RuleService(),
        accountingAccount=None,
        amounts=RuleAmounts(),
        confidenceScores={},
    )


def _extract_invoice_rules_impl(ocr_text: str) -> ExtractResponse:
    raw = ocr_text or ""
    text = normalize_text(raw)
    if not text:
        return _empty_response()

    scores: dict[str, float] = {}

    # Invoice number: (номер\s*(на\s*фактура)?[:\s]*)([0-9]+)
    inv_num, c1 = _first_match(r"(?:номер\s*(?:на\s*фактура)?[:\s]*)([0-9]+)", text)
    scores["invoiceNumber"] = c1

    # Invoice date: (дата[:\s]*)(\d{2}\.\d{2}\.\d{4})
    inv_date, c2 = _first_match(r"дата[:\s]*(\d{2}\.\d{2}\.\d{4})", text)
    scores["invoiceDate"] = c2

    # Supplier: Доставчик – first line
    supplier_name, c_sn = _keyword_line("доставчик", text)
    if supplier_name is None:
        supplier_name, c_sn = _first_match(r"доставчик[:\s]*([^\n]+)", text)
    scores["supplier.name"] = c_sn

    # Address: line starting with "гр."
    addr_m = re.search(r"\bгр\.\s*[^\n]+", text)
    supplier_address = addr_m.group(0).strip() if addr_m else None
    scores["supplier.address"] = CONF_KEYWORD_REGEX if supplier_address else CONF_NOT_FOUND

    # Supplier EIK: ЕИК[:\s]*([0-9]{9,13}) – first occurrence
    supplier_eik, c_eik = _first_match(r"еик[:\s]*([0-9]{9,13})", text)
    scores["supplier.eik"] = c_eik

    # Supplier VAT: ДДС[:\s]*(BG[0-9]{9,13})
    supplier_vat, c_sv = _first_match(r"ддс[:\s]*(bg[0-9]{9,13})", text)
    if supplier_vat:
        supplier_vat = supplier_vat.upper()
    scores["supplier.vat"] = c_sv

    # Client: Клиент – first line
    client_name, c_cn = _keyword_line("клиент", text)
    if client_name is None:
        client_name, c_cn = _first_match(r"клиент[:\s]*([^\n]+)", text)
    scores["client.name"] = c_cn

    # Client EIK: second ЕИК (after first we already used for supplier)
    eik_matches = list(re.finditer(r"еик[:\s]*([0-9]{9,13})", text))
    client_eik = eik_matches[1].group(1).strip() if len(eik_matches) >= 2 else None
    scores["client.eik"] = CONF_REGEX_ONLY if client_eik else CONF_NOT_FOUND

    # Client VAT: optional second BG...
    vat_matches = list(re.finditer(r"ддс[:\s]*(bg[0-9]{9,13})", text, re.IGNORECASE))
    client_vat = vat_matches[1].group(1).strip().upper() if len(vat_matches) >= 2 else None
    scores["client.vat"] = CONF_REGEX_ONLY if client_vat else CONF_NOT_FOUND

    # Service: Услуга[:\s]*(.+)
    service_desc, c_sd = _first_match(r"услуга[:\s]*([^\n]+)", text)
    scores["service.description"] = c_sd

    # Quantity × price: (\d+)\s*бр.*?([\d.,]+)\s*лв
    qty_price_m = re.search(r"(\d+)\s*бр\.?\s*.*?([\d.,]+)\s*лв", text)
    quantity = qty_price_m.group(1) + " бр." if qty_price_m else None
    unit_price_val = _parse_decimal(qty_price_m.group(2)) if qty_price_m else None
    scores["service.quantity"] = CONF_REGEX_ONLY if quantity else CONF_NOT_FOUND
    scores["service.unitPrice"] = CONF_REGEX_ONLY if unit_price_val is not None else CONF_NOT_FOUND

    # Service total: often same as unit price for 1 бр., or separate line; use unit_price as fallback
    service_total = unit_price_val
    scores["service.total"] = CONF_REGEX_ONLY if service_total is not None else CONF_NOT_FOUND

    # Accounting account: Счетоводна\s+Сметка[:\s]*(\d+)
    acc_account, c_acc = _first_match(r"счетоводна\s+сметка[:\s]*(\d+)", text)
    scores["accountingAccount"] = c_acc

    # Subtotal: Данъчна\s+основа[:\s]*([\d.,]+)\s*лв
    subtotal_s, c_sub = _first_match(r"данъчна\s+основа[:\s]*([\d.,]+)\s*лв", text)
    subtotal = _parse_decimal(subtotal_s)
    scores["amounts.subtotal"] = c_sub if subtotal is not None else CONF_NOT_FOUND

    # VAT amount: ДДС[:\s]*([\d.,]+)\s*лв – use LAST match
    vat_s, c_vat = _last_match(r"ддс[:\s]*([\d.,]+)\s*лв", text)
    vat_amount = _parse_decimal(vat_s)
    scores["amounts.vat"] = c_vat if vat_amount is not None else CONF_NOT_FOUND

    # Total: Всичко[:\s]*([\d.,]+)\s*лв
    total_s, c_tot = _first_match(r"всичко[:\s]*([\d.,]+)\s*лв", text)
    total_amount = _parse_decimal(total_s)
    scores["amounts.total"] = c_tot if total_amount is not None else CONF_NOT_FOUND

    # Currency: BGN if "лв" present
    currency = "BGN" if "лв" in text else None
    scores["amounts.currency"] = CONF_INFERRED if currency else CONF_NOT_FOUND

    return ExtractResponse(
        invoiceNumber=inv_num,
        invoiceDate=inv_date,
        supplier=RuleSupplier(
            name=supplier_name,
            address=supplier_address,
            eik=supplier_eik,
            vat=supplier_vat,
        ),
        client=RuleClient(
            name=client_name,
            eik=client_eik,
            vat=client_vat,
        ),
        service=RuleService(
            description=service_desc,
            quantity=quantity,
            unitPrice=unit_price_val,
            total=service_total,
        ),
        accountingAccount=acc_account,
        amounts=RuleAmounts(
            subtotal=subtotal,
            vat=vat_amount,
            total=total_amount,
            currency=currency,
        ),
        confidenceScores=scores,
    )
