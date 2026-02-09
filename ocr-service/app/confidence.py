import logging

from app.schemas import InvoiceConfidence, InvoiceFields, InvoiceValidation

logger = logging.getLogger(__name__)


def _clamp(value: float) -> float:
    """Clamp confidence values to [0.0, 1.0]."""
    return max(0.0, min(1.0, value))


def compute_confidence(fields: InvoiceFields, validation: InvoiceValidation) -> InvoiceConfidence:
    """Compute simple, interpretable confidence scores per field."""

    def baseline(present: bool) -> float:
        return 0.6 if present else 0.2

    supplier_present = bool(fields.supplierName)
    invoice_present = bool(fields.invoiceNumber)
    total_present = fields.totalAmount is not None

    supplier_conf = baseline(supplier_present)
    invoice_conf = baseline(invoice_present)
    total_conf = baseline(total_present)

    # Supplier name heuristics: non-numeric, some length
    if supplier_present and not fields.supplierName.isdigit():
        supplier_conf += 0.1

    # Invoice number heuristics: mix of letters + digits
    if invoice_present and fields.invoiceNumber:
        has_letters = any(c.isalpha() for c in fields.invoiceNumber)
        has_digits = any(c.isdigit() for c in fields.invoiceNumber)
        if has_letters and has_digits:
            invoice_conf += 0.1

    # Validation-based adjustments
    has_math_issue = any(
        "netAmount + vatAmount does not equal totalAmount" in issue for issue in validation.issues
    )
    if total_present and not has_math_issue:
        total_conf += 0.2
    if has_math_issue:
        total_conf -= 0.3

    # Penalize missing key fields
    if "Invoice number missing" in validation.issues:
        invoice_conf -= 0.2
    if "Supplier name missing" in validation.issues:
        supplier_conf -= 0.2

    supplier_conf = _clamp(supplier_conf)
    invoice_conf = _clamp(invoice_conf)
    total_conf = _clamp(total_conf)

    return InvoiceConfidence(
        supplierName=supplier_conf,
        invoiceNumber=invoice_conf,
        totalAmount=total_conf,
    )

