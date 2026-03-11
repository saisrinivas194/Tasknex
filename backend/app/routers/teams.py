from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Team, TeamMember
from app.schemas import TeamCreate, TeamResponse, TeamWithMembersResponse, TeamMemberResponse, AddTeamMemberRequest
from app.auth import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Team).where(
            (Team.owner_id == current_user.id) | (Team.id.in_(select(TeamMember.team_id).where(TeamMember.user_id == current_user.id)))
        ).order_by(Team.created_at.desc())
    )
    return [TeamResponse.model_validate(t) for t in result.scalars().all()]


@router.post("", response_model=TeamResponse)
async def create_team(
    body: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = Team(name=body.name.strip(), owner_id=current_user.id)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return TeamResponse.model_validate(team)


@router.get("/{team_id}", response_model=TeamWithMembersResponse)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Team).where(Team.id == team_id).options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        member = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id))
        if not member.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not a member of this team")
    members_out = [
        TeamMemberResponse(id=m.id, user_id=m.user_id, email=m.user.email, display_name=m.user.display_name)
        for m in team.members
    ]
    return TeamWithMembersResponse(
        id=team.id,
        name=team.name,
        owner_id=team.owner_id,
        created_at=team.created_at,
        members=members_out,
    )


@router.post("/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    team_id: int,
    body: AddTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can add members")
    user_result = await db.execute(select(User).where(User.email == body.email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No user found with that email")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already the owner")
    existing = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")
    member = TeamMember(team_id=team_id, user_id=user.id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return TeamMemberResponse(id=member.id, user_id=member.user_id, email=user.email, display_name=user.display_name)


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_team_member(
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can remove members")
    member_result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id))
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can delete the team")
    await db.delete(team)
    await db.commit()
