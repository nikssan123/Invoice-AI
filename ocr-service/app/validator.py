import logging
from typing import List

from app.schemas import InvoiceFields, InvoiceValidation

logger = logging.getLogger(__name__)

_TOLERANCE = 0.02  # allowed rounding difference in amounts
_KNOWN_CURRENCIES = {"EUR", "USD", "GBP", "BGN"}


def validate_invoice(fields: InvoiceFields) -> InvoiceValidation:
    """Run deterministic validation checks on extracted invoice fields."""
    issues: List[str] = []

    net = fields.netAmount
    vat = fields.vatAmount
    total = fields.totalAmount

    # 1) Mathematical consistency: net + vat ~= total
    if net is not None and vat is not None and total is not None:
        diff = (net + vat) - total
        if abs(diff) > _TOLERANCE:
            issues.append(
                f"netAmount + vatAmount does not equal totalAmount (difference: {diff:.2f})"
            )

        # 2) VAT rate sanity check (around 20%)
        if net > 0:
            vat_rate = vat / net
            if not (0.15 <= vat_rate <= 0.25):
                issues.append(f"Unexpected VAT rate (computed ~{vat_rate * 100:.1f}%)")

    # 3) Invoice number presence
    if not fields.invoiceNumber:
        issues.append("Invoice number missing")

    # 4) Currency consistency
    if fields.currency is not None:
        code = fields.currency.upper()
        if code not in _KNOWN_CURRENCIES:
            issues.append(f"Unknown currency '{fields.currency}'")

    # 5) Missing / suspicious key fields
    if not fields.supplierName:
        issues.append("Supplier name missing")
    if fields.totalAmount is None:
        issues.append("Total amount missing")
    if fields.invoiceDate is None:
        issues.append("Invoice date missing")

    is_consistent = len(issues) == 0

    if issues:
        logger.warning("Invoice validation issues: %s", issues)

    return InvoiceValidation(isConsistent=is_consistent, issues=issues)

