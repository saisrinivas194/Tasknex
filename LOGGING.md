# Log tracker — where errors occur

Structured logging and error tracking are set up so you can see where errors happen (backend, frontend, and which request).

## What’s in place

### Backend

- **Structured JSON logs** — Every log line is one JSON object: `timestamp`, `level`, `logger`, `message`, and optional `request_id`, `method`, `path`, `status_code`, `duration_ms`, `exception`, etc.
- **Request ID** — Every request gets a unique `request_id` (or uses `X-Request-ID` if the client sends it). All log lines for that request include `request_id` so you can grep or filter by it. The response includes `X-Request-ID` in headers.
- **Request/response logging** — Each request logs `request_started` (method, path) and `request_finished` (method, path, status_code, duration_ms).
- **Unhandled exceptions** — Any uncaught exception is logged with full traceback and `request_id`, and the API returns 500 with `request_id` in the body and header.
- **Client error endpoint** — `POST /api/log/client-error` accepts frontend-reported errors (message, stack, url) and logs them with the same structure so you can see client errors in the same log stream.

### Frontend

- **Error boundary** — React render errors are caught, reported to the backend via `/api/log/client-error`, and a fallback UI is shown.
- **Global handlers** — `window.error` and `window.unhandledrejection` are hooked to report to the backend.
- **`reportClientError`** — Exported from `@/lib/api`; call it from catch blocks or custom handlers to report errors.

## How to use it

### 1. View backend logs (Railway)

- Open your **backend** service in Railway → **Deployments** → select a deployment → **View Logs**.
- You’ll see one JSON object per line. Example:
  ```json
  {"timestamp":"2025-03-16T12:00:00.000Z","level":"INFO","logger":"app.middleware.request_logging","message":"request_started","request_id":"abc-123","method":"GET","path":"/api/health"}
  {"timestamp":"2025-03-16T12:00:00.001Z","level":"INFO","logger":"app.middleware.request_logging","message":"request_finished","request_id":"abc-123","method":"GET","path":"/api/health","status_code":200,"duration_ms":1.23}
  ```

### 2. Find all logs for one request

Use `request_id` from the 500 response or from the `X-Request-ID` response header:

- **Railway:** In the logs view, use the search/filter to search for that `request_id` (e.g. `abc-123`).
- **Local / grep:**  
  `cat backend.log | grep '"request_id":"abc-123"'`

### 3. Find errors only

- **Railway:** Filter logs by level or text, e.g. search for `"level":"ERROR"` or `unhandled_exception` or `client_error`.
- **grep:**  
  `grep '"level":"ERROR"' backend.log`  
  `grep 'client_error\|unhandled_exception' backend.log`

### 4. Correlate frontend and backend

- When the frontend reports a client error, it sends it to `POST /api/log/client-error`. That request gets its own `request_id` and is logged like any other request; the body is also logged as `client_error` with `message`, `stack`, `url`.
- So in the same log stream you see server errors (with traceback) and client errors (with message/stack/url). Use `request_id` to tie multiple log lines to the same request.

### 5. Optional: log level

Backend uses `INFO` by default. To change it (e.g. `DEBUG`), set env `LOG_LEVEL=DEBUG` and ensure your startup reads it (you can add `LOG_LEVEL` to `app.config.settings` and pass it to `setup_logging(log_level=settings.log_level)` if you add it).

## Quick reference

| Item | Where |
|------|--------|
| Request ID | Response header `X-Request-ID`; every backend log line for that request |
| Server exception | Log message `unhandled_exception` + `traceback` in JSON |
| Client error | Log message `client_error` + `message`, `stack`, `url` |
| Request timing | Log message `request_finished` + `duration_ms` |
