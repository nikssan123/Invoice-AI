# Invoice Intake & Review – MVP

Full-stack PoC for uploading invoices (PDF/images), extracting fields with mock AI/OCR, reviewing/editing, and approving. Backend is **Node.js (Express)** in **TypeScript** with **PostgreSQL** and **Prisma ORM**; frontend is **React (Vite)** in **TypeScript**.

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** (local install or Docker)
- npm or yarn

## Database setup (local without Docker)

1. Create a database, e.g.:

   ```bash
   createdb invoice_mvp
   ```

   Or with Docker only for Postgres (from project root), see `docker-compose.yml`.

2. In `backend/`, copy env and set the URL:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `.env` and set (for non-Docker local dev):

   ```env
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

## Running the full stack with Docker Compose

To run Postgres, backend, OCR service, and frontend together with persistent storage:

1. **Create env files (recommended)**:

   - `backend/.env` – copy from `.env.example` and set at least:

     ```env
     PORT=3001
     DATABASE_URL="postgresql://invoicedesk:changeme@db:5432/invoicedesk?schema=public"
     OCR_SERVICE_URL="http://ocr-service:8000"
     UPLOAD_DIR="/app/uploads"
     APP_URL="http://localhost:4173"
     JWT_SECRET="change_me"
     # SMTP_*, STRIPE_*, OPENAI_* etc. as needed
     ```

   - `ocr-service/.env` – set your OpenAI / model configuration, for example:

     ```env
     OPENAI_API_KEY=sk-...
     ```

2. **Start the stack** from the project root:

   ```bash
   docker compose up --build
   ```

   This will start:

   - `db` (Postgres) on port `5432` with data stored in the `db_data` volume.
   - `ocr-service` (FastAPI + uvicorn) on port `8000`.
   - `backend` (Express API) on port `3001`, storing uploads in the `uploads` volume at `/app/uploads`.
   - `frontend` (Vite preview) on port `4173`.

3. **Run Prisma migrations** inside the backend container:

   ```bash
   docker compose exec backend npx prisma migrate deploy
   ```

   or, for initial development migrations:

   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```

4. Open the app in your browser:

   - Frontend: `http://localhost:4173`
   - API health: `http://localhost:3001/health`
   - OCR health: `http://localhost:8000/health`

## Synology NAS + Cloudflare Tunnel deployment (overview)

For hosting on a Synology NAS behind Cloudflare Tunnel:

- Run the full stack with Docker Compose on the NAS:
  - `db` (Postgres) and `ocr-service` are internal-only (no host ports).
  - `frontend` and `backend` run behind an `nginx` reverse proxy container (see `docker-compose.yml` and `deploy/nginx.conf`).
  - Expose only `nginx:80` on a host port (e.g. `8080:80`), and point your Cloudflare Tunnel origin at `http://NAS_LAN_IP:8080`.
- The backend container uses `backend/docker-entrypoint.sh` as its CMD:
  - Waits for `db:5432` to be reachable.
  - Runs `npx prisma migrate deploy` to apply pending Prisma migrations.
  - Starts `node dist/index.js`.
- Store production secrets in `backend/.env` and `ocr-service/.env` on the NAS and reference them via `env_file` in `docker-compose.yml`.
- Configure your Cloudflare Tunnel DNS (e.g. `invoice.yourdomain.com`) to point at the tunnel, which forwards to the NGINX host port on the NAS.

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
│   ├── uploads/          # created at runtime, gitignored (backed by Docker volume when using compose)
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
