"""
Structured logging for the API. Produces consistent, parseable logs so you can
track where errors occur (e.g. in Railway logs or any log aggregator).

- JSON format in production-friendly shape: timestamp, level, message, request_id, etc.
- request_id ties together all log lines for a single request.
- Unhandled exceptions are logged with full traceback and request_id.
"""
import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

# Bound to the current request in middleware; use get_log_extra() to add to log records.
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return request_id_ctx.get()


def get_log_extra() -> dict:
    """Extra fields to include in every log record (e.g. request_id)."""
    rid = get_request_id()
    if rid is None:
        return {}
    return {"request_id": rid}


# Standard LogRecord attributes; we skip these when copying record.__dict__ to JSON
_STANDARD_ATTRS = frozenset(
    {"name", "msg", "args", "created", "filename", "funcName", "levelname", "levelno",
     "lineno", "module", "msecs", "pathname", "process", "processName", "relativeCreated",
     "stack_info", "exc_info", "exc_text", "thread", "threadName", "message", "asctime", "taskName"}
)


class StructuredFormatter(logging.Formatter):
    """Format log records as one JSON object per line for easy parsing and filtering."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if get_request_id() is not None:
            log_obj["request_id"] = get_request_id()
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        for k, v in record.__dict__.items():
            if k not in _STANDARD_ATTRS and k not in log_obj:
                log_obj[k] = v
        return json.dumps(log_obj, default=str)


def setup_logging(log_level: str = "INFO", json_logs: bool = True) -> None:
    """Configure root logger and app loggers. Call once at startup."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    if root.handlers:
        for h in root.handlers:
            root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    if json_logs:
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
    root.addHandler(handler)
    # Reduce noise from third-party libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a logger that will include request_id when set (via middleware)."""
    return logging.getLogger(name)
