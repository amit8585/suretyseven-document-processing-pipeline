# Requirements checklist

Source of truth: *SuretySeven SDE-1 Take-Home Assignment* PDF.

Status is **COMPLETE** only after verification in this final QA pass (Jest, Vite build, clean `docker compose down -v && docker compose up --build`, `python scripts/e2e_verify.py`, log inspection, code review).

| Requirement | Implementation | Status | How verified |
| --- | --- | --- | --- |
| `POST /documents` with file, document type, optional metadata | Multer + Zod, `documentService.uploadDocument` | COMPLETE | Jest 201; live `DOC-79FBF66B` 201 `{"status":"UPLOADED"}` |
| Support at least PDF | MIME, `.pdf` extension, `%PDF-` magic bytes, 10MB limit | COMPLETE | Jest rejects `notes.txt` 415; live PDFs accepted |
| Response `{ documentId, status: "UPLOADED" }` without waiting | Enqueue BullMQ then return | COMPLETE | Live upload returned UPLOADED; PROCESSED ~800ms later |
| Async lifecycle UPLOADED → PROCESSING → PROCESSED | Worker + history | COMPLETE | Live history for `DOC-79FBF66B` |
| PROCESSING → FAILED | Terminal FAILED after permanent error or 3 attempts | COMPLETE | `DOC-A356AFBE` INVALID_RESULT; `DOC-9881C840` TIMEOUT attempt 3 |
| Mock processor (no OCR) | `MockDocumentProcessor` | COMPLETE | SUCCESS / TIMEOUT / ERROR / INVALID_RESULT / VALIDATION_FAILED |
| Example extracted fields | Hard-coded SUCCESS payload from PDF | COMPLETE | Live `companyName` ABC Construction Pvt Ltd, revenue 12500000 |
| Deterministic tests | Injected processor / sequence; no random | COMPLETE | Jest retry `['TIMEOUT','SUCCESS']` |
| `GET /documents/{id}` with status, type, timestamps, result, errors | `GET /documents/:documentId` | COMPLETE | Jest + live details |
| Failure information on GET | `error.code`, `message`, `attempt`, optional `errors` | COMPLETE | Live VALIDATION_FAILED field errors; TIMEOUT attempt 3 |
| Validate companyName, registrationNumber, annualRevenue ≥ 0, documentDate | Zod | COMPLETE | Live `DOC-E3B84423` FAILED VALIDATION_FAILED, 1 PROCESSING event (no retry) |
| Invalid extraction is not PROCESSED | `markFailed` + `UnrecoverableError` | COMPLETE | Jest + live |
| Retry policy: 3 attempts; retry TIMEOUT / PROCESSOR_ERROR | BullMQ attempts + UnrecoverableError | COMPLETE | Live `DOC-DFFB6EBD` TIMEOUT then PROCESSED attempt 2 |
| Do not retry INVALID_RESULT / VALIDATION_FAILED | UnrecoverableError | COMPLETE | Live both FAILED attempt 1 |
| After retries exhausted: FAILED + reason + attempt + history | Worker | COMPLETE | Live TIMEOUT history 3 FAILED rows, attempt 3 |
| Duplicate detection | SHA-256 + UNIQUE `file_hash` + 23505 race handling | COMPLETE | Live same bytes → 200, same id, `duplicate: true`, history length unchanged |
| `GET /documents/{id}/history` | status, timestamp, attempt, reason | COMPLETE | Live retry timeline matches PDF example |
| UI upload (file, type, success/error) | `UploadPage.jsx` | COMPLETE | Docker UI `/upload`; user-facing error map |
| UI list (id, filename, type, status, date) + filters | `DocumentsPage.jsx` | COMPLETE | `/documents` is SPA (nginx `/api` proxy); filters in UI + API |
| UI details: info, extracted data, history, validation errors | `DocumentDetailsPage.jsx` | COMPLETE | Previously verified in browser; API payloads confirmed live |
| UI loading / empty / error / success; no raw stack traces | `States.jsx`, toasts | COMPLETE | Code + 404 `{error:{code,message}}` without stack |
| Auto-refresh while UPLOADED/PROCESSING | `usePolling` 2.5s; current status stays PROCESSING during retries | COMPLETE | Code review + live retry did not terminal-FAIL early |
| `GET /documents?status=` and documentType; pagination | Query + indexes | COMPLETE | Live PROCESSED+FINANCIAL_STATEMENT; FAILED total 3; INVOICE total 2; page/limit 1 → totalPages 2 |
| Observability logs: documentId, attempt, status, failureReason, timestamp; no contents | JSON logger with sensitive-key strip | COMPLETE | Worker logs inspected: those fields only, no extracted values |
| Tests: upload, invalid data, success, failure, retry-then-success, duplicate, queue-after-insert failure | `backend/tests/documents.test.js` | COMPLETE | **16/16 passed** |
| Architecture diagram | `docs/architecture.png` | COMPLETE | File present |
| Engineering questions | README | COMPLETE | Architecture, DB, async, retry, duplicates, crash, scale, limitations |
| `AI_USAGE.md` | Root file | COMPLETE | Cursor + ChatGPT; rejected random processor in tests |
| Easy local run | `docker compose up --build` | COMPLETE | Clean `down -v` then up; 5 services started |
| `GET /health` | DB + Redis checks | COMPLETE | Live `{status:ok}`; API container **healthy** |
| Centralized errors | `errorHandler.js` | COMPLETE | Live 404 DOCUMENT_NOT_FOUND |
| PostgreSQL migrations + indexes | `001_init.sql` | COMPLETE | Applied on API/worker start |
| Redis + BullMQ worker | Separate process | COMPLETE | Worker processed all E2E jobs |
| `.env` not committed | `.gitignore` includes `.env` | COMPLETE | `.env` gitignored; compose uses env vars, not committed secrets |
| File serving confined to upload dir | `isInsideDirectory` | COMPLETE | Code review |
| Idempotent re-delivery if already PROCESSED | Worker early return | COMPLETE | Code review |

## Final QA commands (this pass)

```bash
cd backend && npm test          # 16 passed
cd frontend && npm run build    # Vite build succeeded
docker compose down -v
docker compose up --build -d    # postgres/redis/api healthy; worker + frontend up
python scripts/e2e_verify.py    # E2E PASS
```

## Remaining limitations (not incomplete requirements)

- Processor is mocked (allowed by the PDF).
- Files live on a Docker volume, not object storage.
- Duplicates are exact SHA-256 only.
- `simulateOutcome` metadata is for demo/tests only.
- If enqueue fails after insert, the document is marked `FAILED` with `QUEUE_UNAVAILABLE` (history recorded, HTTP 503). Uploading the same file again re-queues that document.
- No git remote in this workspace; `.env` is gitignored for when git is initialized.
