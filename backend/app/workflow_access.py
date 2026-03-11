"""Resolve workflow access: owner, editor (share), viewer (share), or no access."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models import Workflow, WorkflowShare, TeamMember


async def get_workflow_and_access(
    db: AsyncSession, user_id: int, workflow_id: int
) -> tuple[Workflow | None, str | None]:
    """
    Returns (workflow, role) where role is "owner", "editor", "viewer", or None (no access).
    """
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        return None, None
    if workflow.user_id == user_id:
        return workflow, "owner"
    # Direct user share
    user_share = await db.execute(
        select(WorkflowShare).where(
            WorkflowShare.workflow_id == workflow_id,
            WorkflowShare.user_id == user_id,
        )
    )
    s = user_share.scalar_one_or_none()
    if s:
        return workflow, "editor" if s.role == "editor" else "viewer"
    # Team share: user must be in the team
    team_ids = await db.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user_id)
    )
    team_id_list = [r[0] for r in team_ids.all()]
    if not team_id_list:
        return workflow, None
    team_share = await db.execute(
        select(WorkflowShare).where(
            WorkflowShare.workflow_id == workflow_id,
            WorkflowShare.team_id.in_(team_id_list),
        )
    )
    ts = team_share.scalar_one_or_none()
    if ts:
        return workflow, "editor" if ts.role == "editor" else "viewer"
    return workflow, None
