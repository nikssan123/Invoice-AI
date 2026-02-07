# Invoice Intake & Review – MVP

Full-stack PoC for uploading invoices (PDF/images), extracting fields with mock AI/OCR, reviewing/editing, and approving. Backend is **Node.js (Express)** in **TypeScript** with **PostgreSQL** and **Prisma ORM**; frontend is **React (Vite)** in **TypeScript**.

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** (local install or Docker)
- npm or yarn

## Database setup

1. Create a database, e.g.:

   ```bash
   createdb invoice_mvp
   ```

   Or with Docker Compose (from project root):

   ```bash
   docker compose up -d
   ```

   Then use `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_mvp"` in `backend/.env`. Alternatively: `docker run -d --name postgres-invoice -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=invoice_mvp -p 5432:5432 postgres:16`

2. In `backend/`, copy env and set the URL:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   PORT=3001
   DATABASE_URL="postgresql://user:password@localhost:5432/invoice_mvp"
   ```

3. Install dependencies and run migrations:

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init   # or: npx prisma migrate deploy (if migrations already exist)
   ```

   This creates the `Invoice`, `InvoiceFields`, and `Approval` tables.

## Backend

From the project root:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init   # after DB is created and .env set (or migrate deploy)
npm run dev
```

Backend runs TypeScript with `tsx` in dev; for production run `npm run build` then `npm start` (runs compiled `dist/index.js`).

API runs at **http://localhost:3001**.

- `POST /api/invoices/upload` – upload files (multipart, field name `files`)
- `POST /api/invoices/:id/extract` – run mock extraction
- `GET /api/invoices/:id` – get invoice + extracted fields
- `GET /api/invoices/:id/file` – serve PDF/image file
- `PATCH /api/invoices/:id/fields` – update extracted fields (user edits)
- `POST /api/invoices/:id/approve` – approve or flag for review (body: `{ approvedBy, action: "approved" | "needs_review" }`)
- `GET /api/invoices` – list invoices (optional `?status=pending`)
- `GET /api/invoices/stats` – counts: total, approved, pending, needs_review

## Frontend

From the project root:

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**. Vite proxies `/api` to the backend, so no extra env is required for local dev. To point at another API:

```bash
# frontend/.env
VITE_API_URL=http://localhost:3001
```

## Flow

1. **Dashboard** – Summary (total / approved / pending / needs review) and list of invoices with links.
2. **Upload** – Select one or more PDF/image files; upload and run mock extraction; redirect to single invoice review or dashboard.
3. **Review** – Preview (PDF or image), structured form with extracted fields and confidence scores, save edits, then **Approve** or **Flag for review**. Approved invoices are locked from editing.

Extraction is **mock** (deterministic from filename/id); the backend service can be swapped for a real AI/OCR later without changing the API shape.

## Project structure

```
AI-Employee/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   ├── uploads/          # created at runtime, gitignored
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
└── README.md
```
