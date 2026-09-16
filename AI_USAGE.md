# AI usage

AI tools were allowed by the assignment and were used as a force multiplier, not as an unreviewed source of truth.

## Tools used

- **Cursor** (agent session in this repository): implementation, file scaffolding, test writing, Docker files, and documentation.
- **ChatGPT / Cursor Grok**: architecture brainstorming and turning the assignment PDF plus the requested Node/Express/React stack into a scoped modular-monolith design.

No code was submitted without human/agent review against the PDF requirements.

## What AI was used for

- **Architecture brainstorming**: choosing a modular monolith (Express API + worker) instead of microservices, PostgreSQL schema (`documents`, `processing_history`), SHA-256 uniqueness, and BullMQ retries with `UnrecoverableError` for permanent failures.
- **Boilerplate generation**: Express app wiring, Dockerfiles, docker-compose, Vite/React page shells, nginx reverse proxy.
- **Implementation**: upload flow, repositories, mock processor, Zod schemas, worker job handler, React UI (upload/list/details/dashboard).
- **Debugging**: expected during verification (test failures, Compose health, polling bugs). Fixes were applied after running the suite, not assumed from generated code.
- **Test generation**: Jest + Supertest cases for the six mandatory scenarios plus API validation. Processor behavior is injected; random outcomes were rejected.
- **Code review**: checking error shape, no stack traces, no logging of extracted PII, duplicate hash races, retry vs non-retry paths.
- **Documentation assistance**: README sections required by the assignment and this `AI_USAGE.md` file.

## Significant AI-generated output that was changed or rejected

- Rejected a “random mock processor” for automated tests. The assignment (and good engineering) requires deterministic tests; randomness is only a demo option via `metadata.simulateOutcome`.
- Rejected extra tables/services (Kafka, S3, Kubernetes, processing_attempts as a separate product). A history table plus `attempt` on events is enough.
- Rejected returning `PROCESSED` when Zod fails. Invalid extraction is `FAILED` + structured errors.
- Tightened duplicate handling: lookup first, then UNIQUE constraint for races, and **do not enqueue** a second job.
- Frontend must not dump raw backend errors; mapping to user-facing copy was added on purpose.

## What I learned while reviewing AI output

- Generated workers often retry *every* error. Permanent cases (`INVALID_RESULT`, `VALIDATION_FAILED`) need an explicit non-retry path.
- Generated upload handlers often wait for processing or use `Math.random()` in tests; both violate the assignment’s async + confidence goals.
- Health checks that open real Redis connections can make Jest hang unless Redis is mocked or `forceExit` is used carefully.

Generated code was reviewed, tested, modified, and rejected where it did not match the PDF or the requested stack.
