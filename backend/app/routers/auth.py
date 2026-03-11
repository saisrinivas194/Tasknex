import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import User, Session
from app.schemas import UserCreate, UserResponse, Token, ProfileUpdate, SessionResponse
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_session_id,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """One account per email: store and compare in lowercase."""
    return email.strip().lower()


@router.post("/signup", response_model=Token)
async def signup(data: UserCreate, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(data.email)
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Log in instead.",
        )
    user = User(email=email, password_hash=hash_password(data.password))
    db.add(user)
    await db.flush()
    session = Session(id=str(uuid.uuid4()), user_id=user.id)
    db.add(session)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(data={"sub": str(user.id)}, session_id=session.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(data: UserCreate, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(data.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    session = Session(id=str(uuid.uuid4()), user_id=user.id)
    db.add(session)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(data={"sub": str(user.id)}, session_id=session.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        current_user.display_name = data.display_name.strip() or None
    if data.bio is not None:
        current_user.bio = data.bio.strip() or None
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# Sessions: multiple logins allowed; list and revoke
@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_sid: str | None = Depends(get_current_session_id),
):
    result = await db.execute(
        select(Session).where(Session.user_id == current_user.id).order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()
    return [
        SessionResponse(
            id=s.id,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            label=s.label,
            current=(s.id == current_sid),
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.post("/sessions/revoke-others", status_code=204)
async def revoke_other_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_sid: str | None = Depends(get_current_session_id),
):
    if not current_sid:
        return
    await db.execute(delete(Session).where(Session.user_id == current_user.id, Session.id != current_sid))
    await db.commit()
