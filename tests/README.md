Automated tests live in `backend/tests` so they can import application modules directly.

From the repository root:

```bash
docker compose up -d postgres redis
cd backend
npm install
npm test
```

The suite covers upload, validation failure, successful processing, processor failure, retry-then-success, duplicate uploads, filtering, history, and API error cases.
