from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models import User, Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt only uses first 72 bytes; passlib/bcrypt compatibility
_MAX_BCRYPT_BYTES = 72


def _truncate_for_bcrypt(s: str) -> str:
    b = s.encode("utf-8")
    if len(b) <= _MAX_BCRYPT_BYTES:
        return s
    return b[:_MAX_BCRYPT_BYTES].decode("utf-8", errors="replace")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate_for_bcrypt(password))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_truncate_for_bcrypt(plain), hashed)


def create_access_token(data: dict, session_id: str | None = None) -> str:
    to_encode = data.copy()
    if session_id:
        to_encode["sid"] = session_id
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    sid = payload.get("sid")
    if sid:
        session_result = await db.execute(
            select(Session).where(Session.id == sid, Session.user_id == user.id)
        )
        if not session_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return user


async def get_current_session_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
) -> str | None:
    """Return the session id from the JWT if present (for marking current session in list)."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload.get("sid")
    except JWTError:
        return None
