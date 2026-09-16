# SuretySeven Document Processing Pipeline

A simplified document processing service built for the SuretySeven SDE-1 take-home assignment. A user can upload a PDF, the system processes it asynchronously with a mock extractor, validates the result, and exposes status, history, and extracted fields through an API and a React UI.

This is a **modular monolith**: one Express API, one Node worker process, PostgreSQL, Redis/BullMQ, and local file storage. It is intentionally not a microservice platform.

## Features

- PDF upload with document type and optional JSON metadata
- Asynchronous processing (`UPLOADED` → `PROCESSING` → `PROCESSED` or `FAILED`)
- Mock document processor with deterministic scenarios (`SUCCESS`, `TIMEOUT`, `ERROR`, `INVALID_RESULT`)
- Zod validation of extracted fields
- Retry of transient processor failures (max 3 attempts)
- SHA-256 duplicate detection with a unique database constraint
- Document details, processing history, list + filters + pagination
- React UI with upload, list, details, polling, timeline, and dashboard stats
- Structured JSON logs, Docker Compose, and automated tests

## Architecture

```
React UI
   ↓
Express API
   ↓                 ↓                    ↓
PostgreSQL     Local file storage     Redis / BullMQ
                                          ↓
                                  Document Worker
                                          ↓
                                   Mock Processor
                                          ↓
                                   Zod validation
                                          ↓
                                      PostgreSQL
```

See [docs/architecture.png](docs/architecture.png) and [docs/architecture.svg](docs/architecture.svg).

The API accepts uploads, stores the file and database row, writes an `UPLOADED` history event, enqueues a BullMQ job, and returns immediately. A separate worker consumes the job, calls the mock processor, validates extracted data, and updates status/history.

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | Node.js, Express.js |
| Frontend | React, Vite |
| Database | PostgreSQL |
| Queue | Redis, BullMQ |
| Validation | Zod |
| Uploads | Multer (memory → local disk) |
| Tests | Jest, Supertest |
| Containers | Docker Compose |

## Project structure

```
suretyseven-document-processing-pipeline/
  backend/          API, worker, migrations, Jest tests
  frontend/         React UI
  tests/            Pointer to backend tests
  docs/             Architecture diagrams
  docker-compose.yml
  README.md
  AI_USAGE.md
  REQUIREMENTS_CHECKLIST.md
```

## Prerequisites

- Node.js 20+
- Docker Desktop (recommended) **or** local PostgreSQL 16 and Redis 7
- npm

## Environment variables

Copy `.env.example` to `.env`. Important values:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://surety:surety@localhost:5432/suretyseven` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `CORS_ORIGIN` | Allowed browser origins (comma-separated) | `http://localhost:5173` |
| `UPLOAD_DIR` | Local PDF storage directory | `./uploads` |
| `MAX_FILE_SIZE_MB` | Upload size limit | `10` |
| `PROCESSOR_SCENARIO` | Default mock outcome | `SUCCESS` |
| `PROCESSOR_DELAY_MS` | Simulated processing delay | `400` |
| `MAX_PROCESSING_ATTEMPTS` | Retry budget (including first try) | `3` |
| `RETRY_BACKOFF_MS` | BullMQ backoff base delay | `1000` |
| `VITE_API_URL` | Frontend API base. Empty uses `/api` (Vite/nginx proxy). Direct API is `http://localhost:3000` | `/api` |

No production secrets are committed. `.env` is gitignored.

## Setup instructions (local)

```bash
cp .env.example .env
docker compose up -d postgres redis

cd backend
npm install
npm start

# second terminal
cd backend
npm run start:worker

# third terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the Express API (`/documents`, `/health`).

## Docker instructions

From the repository root:

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, the API, the worker, and the frontend.

- UI: http://localhost:5173
- API: http://localhost:3000
- Health: http://localhost:3000/health

Stop with `docker compose down`.

## API documentation

Base URL: `http://localhost:3000`

Error shape (all failures):

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document not found"
  }
}
```

Stack traces are never returned to clients.

### `POST /documents`

Multipart form:

- `file` (PDF, required)
- `documentType` (required): `FINANCIAL_STATEMENT`, `BANK_STATEMENT`, `INVOICE`, `COMPANY_REGISTRATION`, `OTHER`
- `metadata` (optional JSON object). For demos, `{"simulateOutcome":"TIMEOUT"}` selects a mock processor scenario.

Success:

```json
{
  "documentId": "DOC-A1B2C3D4",
  "status": "UPLOADED"
}
```

HTTP 201 for a new document. The handler does **not** wait for processing.

If the same file bytes were uploaded before, the API returns HTTP 200 with the **existing** document and `"duplicate": true`. No second processing job is created.

### `GET /documents/:documentId`

Returns `documentId`, `filename`, `documentType`, `status`, `createdAt`, `updatedAt`, `result`, and `error` when applicable.

### `GET /documents/:documentId/history`

```json
[
  { "status": "UPLOADED", "timestamp": "2026-09-16T08:00:00.000Z" },
  { "status": "PROCESSING", "timestamp": "...", "attempt": 1 },
  { "status": "FAILED", "timestamp": "...", "attempt": 1, "reason": "TIMEOUT" },
  { "status": "PROCESSING", "timestamp": "...", "attempt": 2 },
  { "status": "PROCESSED", "timestamp": "...", "attempt": 2 }
]
```

### `GET /documents`

Query params: `page`, `limit`, `status`, `documentType`, `search`, `from`, `to`. Filters combine with AND.

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### `GET /documents/stats`

Dashboard counts: `total`, `uploaded`, `processing`, `processed`, `failed`.

### `GET /documents/:documentId/file`

Streams the stored PDF for preview.

### `GET /health`

```json
{
  "status": "ok",
  "checks": { "database": "ok", "redis": "ok" }
}
```

## Processing lifecycle

1. File saved under `uploads/`
2. `documents` row inserted with status `UPLOADED`
3. History event `UPLOADED`
4. BullMQ job queued
5. Worker sets `PROCESSING` and records the attempt
6. Mock processor runs
7. Zod validates extracted data
8. Status becomes `PROCESSED` or `FAILED`

## Retry strategy

Maximum attempts: **3** (first try + two retries). BullMQ exponential backoff is used.

| Outcome | Retry? |
| --- | --- |
| `TIMEOUT` | Yes |
| `PROCESSOR_ERROR` | Yes |
| `INVALID_RESULT` | No |
| `VALIDATION_FAILED` | No |

After the last failed attempt the document status is `FAILED`, the attempt number and failure reason are stored, and a history row is written.

While retries are still in progress the **current** status stays `PROCESSING` so the UI can keep polling. Each failed attempt still writes a `FAILED` history event with a reason.

## Duplicate detection strategy

Every upload computes **SHA-256 of the file contents**.

1. Hash the buffer
2. Look up `file_hash`
3. If found and already queued/processed, return the existing document and skip enqueue. If the previous attempt failed with `QUEUE_UNAVAILABLE`, re-queue that same document.
4. Insert with a **UNIQUE** constraint on `file_hash`

Concurrent double-uploads are handled by catching PostgreSQL unique-violation `23505` and returning the winner row. Filename is not used; two different names with identical bytes are duplicates.

## Validation strategy

Extracted payload is parsed with Zod:

- `companyName`: required non-empty string
- `registrationNumber`: required non-empty string
- `annualRevenue`: number `>= 0`
- `documentDate`: parseable date
- `address`: optional

Invalid data is **not** marked `PROCESSED`. Status becomes `FAILED` with:

```json
{
  "code": "VALIDATION_FAILED",
  "errors": [
    { "field": "annualRevenue", "message": "Must be greater than or equal to 0" }
  ]
}
```

## Testing instructions

PostgreSQL must be running (`docker compose up -d postgres redis` is enough; Redis is mocked in API tests).

```bash
cd backend
npm install
npm test
```

Frontend build:

```bash
cd frontend
npm install
npm run build
```

Tests inject the mock processor. They never rely on random outcomes.

With Docker Compose running, a live API/worker/UI check is:

```bash
python scripts/e2e_verify.py
```

## Design decisions

- **Modular monolith** instead of microservices: the assignment is a single product; extra network hops would hide the design rather than improve it.
- **PostgreSQL** for relational integrity (unique hash, foreign keys, filtered indexes).
- **BullMQ** so the HTTP request never waits on processing and retries are visible.
- **SHA-256** rather than filename+size: content identity is what “same document” means here.
- **Dependency-injected mock processor** so tests are deterministic; the UI can still pass `metadata.simulateOutcome` for demos.
- **Local disk** for files: cloud object storage is unnecessary for the assignment scope.

## Failure handling

- Missing/invalid uploads return 400/413/415 with stable error codes
- Unknown documents return 404 `DOCUMENT_NOT_FOUND`
- Transient processor errors retry; permanent errors fail immediately
- Queue enqueue failure after insert marks the document `FAILED` with `QUEUE_UNAVAILABLE`, writes history, and returns 503. Uploading the same file again re-queues that document instead of leaving it `UPLOADED`.
- Unexpected exceptions become 500 `INTERNAL_ERROR` without internals
- API and worker shut down on SIGINT/SIGTERM, closing HTTP, Redis, and the pool

If the process crashes mid-job, BullMQ will retry the job (unless it was an `UnrecoverableError`). History may show another `PROCESSING` attempt.

## Scalability discussion

This design is fine for a take-home and for low thousands of documents per day.

If the system had to process **1 million documents per day**:

- Store files in object storage, not a shared Docker volume
- Run many worker replicas consuming the same queue
- Move large list queries behind read replicas / search for filename search
- Partition or archive `processing_history`
- Rate-limit uploads and keep HTTP traffic off the worker process

The current code already separates HTTP from processing, which is the main scaling seam.

## Limitations

- Processor is mocked; there is no real OCR
- Files live on local disk
- Duplicate detection is exact-hash only (not near-duplicate / visual similarity)
- Single-region, single Compose stack
- Demo `simulateOutcome` metadata is not something a production extractor would honor

## Future improvements

- Real extraction service behind the same processor interface
- Object storage (S3-compatible)
- Idempotency-Key header in addition to content hash
- Authentication and tenant isolation
- Dead-letter inspection UI
- OpenTelemetry traces alongside structured logs
