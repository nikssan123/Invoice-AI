# OCR Service

Standalone FastAPI service for extracting plain text from invoice documents (PDF and images) using PaddleOCR.

## Features

- Accept PDF, PNG, JPG uploads
- Convert PDFs to images and run OCR per page
- Return clean, structured plain text per page
- Angle classification enabled (handles rotated text)
- Multilingual support (English, Bulgarian via `OCR_LANG` env)
- Stateless, no persistence

## Prerequisites

- Python 3.10+
- [Poppler](https://poppler.freedesktop.org/) (required for PDF conversion)

### Installing Poppler

- **Ubuntu/Debian:** `sudo apt-get install poppler-utils`
- **macOS:** `brew install poppler`
- **Windows:** Download from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases), extract, and add the `bin/` folder to your PATH

## Run Locally

```bash
cd ocr-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## Run via Docker

```bash
cd ocr-service
docker build -t ocr-service .
docker run -p 8000:8000 ocr-service
```

## API

### Health Check

```bash
curl http://localhost:8000/health
```

**Response:**

```json
{"status": "ok"}
```

### Extract Text (POST /ocr)

```bash
curl -X POST "http://localhost:8000/ocr" \
  -F "file=@/path/to/invoice.pdf"
```

**Response:**

```json
{
  "documentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pages": [
    {
      "page": 1,
      "text": "INVOICE Invoice #12345 Date: 2025-01-15 Acme Corp 123 Main St..."
    },
    {
      "page": 2,
      "text": "Additional terms and conditions..."
    }
  ]
}
```

**With an image:**

```bash
curl -X POST "http://localhost:8000/ocr" \
  -F "file=@/path/to/receipt.png"
```

### Rule-based Extraction (POST /extract)

Extracts structured fields from Bulgarian invoice OCR text using **deterministic rules only** (regex + keywords). No LLM or external API calls.

**Request:** `ocrText` (string) or `lines` (array of strings); optional `documentId`.

```bash
curl -X POST "http://localhost:8000/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "ocrText": "Номер на фактура 12345 Дата 15.01.2024 Доставчик ЕООД Пример гр. София ЕИК 123456789 ДДС: BG123456789 Клиент Друго ЕООД ЕИК 987654321 Услуга: Консултантски услуги 1 бр. 40.00 лв Счетоводна Сметка 602 Данъчна основа 100.00 лв ДДС 20.00 лв Всичко 120.00 лв"
  }'
```

**Example response (Bulgarian invoice):**

```json
{
  "invoiceNumber": "12345",
  "invoiceDate": "15.01.2024",
  "supplier": {
    "name": "ЕООД Пример",
    "address": "гр. София",
    "eik": "123456789",
    "vat": "BG123456789"
  },
  "client": {
    "name": "Друго ЕООД",
    "eik": "987654321",
    "vat": null
  },
  "service": {
    "description": "Консултантски услуги",
    "quantity": "1 бр.",
    "unitPrice": 40.0,
    "total": 40.0
  },
  "accountingAccount": "602",
  "amounts": {
    "subtotal": 100.0,
    "vat": 20.0,
    "total": 120.0,
    "currency": "BGN"
  },
  "confidenceScores": {
    "invoiceNumber": 1.0,
    "invoiceDate": 1.0,
    "supplier.name": 1.0,
    "supplier.address": 1.0,
    "supplier.eik": 0.7,
    "supplier.vat": 0.7,
    "client.name": 1.0,
    "amounts.subtotal": 0.7,
    "amounts.vat": 0.7,
    "amounts.total": 0.7,
    "amounts.currency": 0.4
  }
}
```

Missing fields are `null`; extraction never fails the request (returns empty/null on error). Confidence: 1.0 = keyword + regex, 0.7 = regex only, 0.4 = inferred, 0.0 = not found.

### LLM-based Extraction (POST /extract-llm and POST /extract-invoice)

These endpoints take plain OCR text and return structured invoice fields using an **LLM** (plus validation and confidence). Use `/extract-llm` or `/extract-invoice` (kept for backward compatibility).

```bash
curl -X POST "http://localhost:8000/extract-invoice" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ocrText": "INVOICE Invoice #12345 Date: 2025-01-15 Acme Corp 123 Main St..."
  }'
```

**Response:**

```json
{
  "documentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "fields": {
    "supplierName": "Acme Corp",
    "supplierVat": "BG123456789",
    "invoiceNumber": "12345",
    "invoiceDate": "2025-01-15",
    "currency": "EUR",
    "netAmount": 1000.0,
    "vatAmount": 200.0,
    "totalAmount": 1200.0
  },
  "confidence": {
    "supplierName": 0.9,
    "invoiceNumber": 0.85,
    "totalAmount": 0.95
  },
  "validation": {
    "isConsistent": true,
    "issues": []
  }
}
```

Behind the scenes:

- The service uses a pluggable LLM client (currently a dummy implementation by default)
  to extract raw invoice fields from OCR text.
- A deterministic validator checks mathematical consistency (e.g. `netAmount + vatAmount ≈ totalAmount`),
  VAT rate, currency, and required fields, producing human-readable issues.
- A confidence module computes simple, interpretable confidence scores per field based on
  presence and validation results.

## Environment Variables

| Variable  | Default | Description                                      |
|-----------|---------|--------------------------------------------------|
| `OCR_LANG` | `en`    | PaddleOCR language: `en` (English), `bg` (Bulgarian) |

Example for Bulgarian:

```bash
OCR_LANG=bg uvicorn app.main:app --port 8000
```

## Error Responses

- **400** – Unsupported file type or empty file
- **422** – No file provided
- **500** – OCR processing failed

## Project Structure

```
ocr-service/
├── app/
│   ├── main.py          # FastAPI app, routes (OCR, /extract, /extract-llm, /extract-invoice)
│   ├── ocr.py           # PaddleOCR logic
│   ├── pdf_utils.py     # PDF to image conversion
│   ├── rule_extractor.py # Rule-based Bulgarian invoice extraction (no LLM)
│   ├── schemas.py       # Request/response models (LLM + rule-based)
│   ├── extractor.py     # LLM client and extract_invoice_fields
│   ├── confidence.py    # Confidence scoring for LLM response
│   └── validator.py     # Validation for LLM response
├── Dockerfile
├── requirements.txt
└── README.md
```
