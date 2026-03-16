import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.log_config import get_logger, get_request_id, setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware
from app.routers import auth, workflows, teams, log

# Structured JSON logs; easy to grep and parse in Railway or any aggregator
setup_logging(log_level=settings.log_level, json_logs=True)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Tasknex API",
    description="Turn goals into executable workflows with AI",
    version="1.0.0",
    lifespan=lifespan,
)

# Logging middleware first (outermost): assigns request_id, logs every request/response
app.add_middleware(RequestLoggingMiddleware)

# CORS: always allow localhost for local dev; add CORS_ORIGINS for production frontend
_localhost_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_origins = list(dict.fromkeys(_localhost_origins + _extra))  # localhost first, then custom, no dupes
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.railway\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log unhandled exceptions with full traceback and request_id, then return 500."""
    request_id = get_request_id()
    tb = traceback.format_exc()
    logger.exception(
        "unhandled_exception",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "error": str(exc),
            "traceback": tb,
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
        headers={"X-Request-ID": request_id or ""},
    )

@app.get("/")
def root():
    return {"message": "Tasknex API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "openai_configured": bool(settings.openai_api_key and settings.openai_api_key.strip()),
    }


app.include_router(auth.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(log.router, prefix="/api")
