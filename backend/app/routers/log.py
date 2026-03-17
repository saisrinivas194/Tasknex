"""Endpoint for frontend to report client-side errors; logs them with the same structure as server logs."""
from fastapi import APIRouter, Request
from fastapi.responses import Response
from pydantic import BaseModel

from app.log_config import get_logger, get_request_id

router = APIRouter(prefix="/log", tags=["logging"])


@router.get("/ping")
@router.post("/ping")
def ping() -> dict:
    """No-auth ping for diagnostics (e.g. verify POST + CORS from frontend)."""
    return {"ok": True}


class ClientErrorPayload(BaseModel):
    message: str
    stack: str | None = None
    url: str | None = None
    user_agent: str | None = None
    level: str = "error"


@router.post("/client-error")
async def report_client_error(payload: ClientErrorPayload, request: Request) -> Response:
    """Accept client-side errors from the frontend and log them with request_id for correlation."""
    logger = get_logger(__name__)
    request_id = get_request_id()
    logger.error(
        "client_error",
        extra={
            "request_id": request_id,
            "message": payload.message,
            "stack": payload.stack,
            "url": payload.url,
            "user_agent": payload.user_agent or request.headers.get("user-agent"),
            "level": payload.level,
        },
    )
    return Response(status_code=204)
