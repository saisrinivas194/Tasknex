from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Workflow, Step, Task, TaskStatus, TaskPriority, WorkflowShare, TeamMember, Team
from app.schemas import (
    WorkflowCreate,
    WorkflowResponse,
    WorkflowListItem,
    StepCreate,
    StepOrderUpdate,
    StepResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    GenerateWorkflowRequest,
    AIAssistantRequest,
    WorkflowShareRequest,
    WorkflowShareResponse,
)
from app.auth import get_current_user
from app.services.ai_workflow import generate_workflow_from_goal, ai_assistant_add_tasks
from app.workflow_access import get_workflow_and_access

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("/generate", response_model=WorkflowResponse)
async def generate_workflow(
    body: GenerateWorkflowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await generate_workflow_from_goal(body.goal)
    title = data.get("title", body.goal[:200])
    workflow = Workflow(user_id=current_user.id, title=title, goal=body.goal)
    db.add(workflow)
    await db.flush()
    for phase in sorted(data.get("phases", []), key=lambda p: p.get("order", 0)):
        step = Step(
            workflow_id=workflow.id,
            title=phase.get("title", "Phase"),
            step_order=phase.get("order", 0),
        )
        db.add(step)
        await db.flush()
        for t in phase.get("tasks", []):
            task = Task(
                step_id=step.id,
                title=t.get("title", "Task"),
                description=t.get("description", ""),
                document_url=None,
                status=TaskStatus.planned,
                priority=TaskPriority.medium,
                due_date=None,
                labels=None,
            )
            db.add(task)
    await db.commit()
    await db.refresh(workflow)
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow.id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one()
    return WorkflowResponse.model_validate(workflow)


@router.get("", response_model=list[WorkflowListItem])
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    # Owned workflows
    owned = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == current_user.id)
        .order_by(Workflow.created_at.desc())
    )
    owned_list = list(owned.scalars().all())
    # Shared with me (direct user or via team)
    team_ids = await db.execute(select(TeamMember.team_id).where(TeamMember.user_id == current_user.id))
    team_id_list = [r[0] for r in team_ids.all()]
    shared_ids = set()
    if team_id_list:
        shared_result = await db.execute(
            select(WorkflowShare.workflow_id, WorkflowShare.role).where(
                WorkflowShare.team_id.in_(team_id_list)
            )
        )
        for row in shared_result.all():
            shared_ids.add((row[0], row[1]))
    user_shared = await db.execute(
        select(WorkflowShare.workflow_id, WorkflowShare.role).where(WorkflowShare.user_id == current_user.id)
    )
    for row in user_shared.all():
        shared_ids.add((row[0], row[1]))
    owned_ids = {w.id for w in owned_list}
    shared_only = [(wid, role) for (wid, role) in shared_ids if wid not in owned_ids]
    role_map = {w.id: "owner" for w in owned_list}
    if not shared_only:
        workflows_to_list = owned_list
    else:
        shared_wids = [w[0] for w in shared_only]
        shared_workflows = await db.execute(
            select(Workflow).where(Workflow.id.in_(shared_wids)).order_by(Workflow.created_at.desc())
        )
        shared_list = list(shared_workflows.scalars().all())
        role_map = {w.id: "owner" for w in owned_list}
        for wid, role in shared_only:
            role_map[wid] = role
        workflows_to_list = owned_list + shared_list
        workflows_to_list.sort(key=lambda w: w.created_at, reverse=True)
    workflows_to_list = workflows_to_list[skip : skip + limit]
    out = []
    for w in workflows_to_list:
        tasks_result = await db.execute(
            select(func.count(Task.id), func.count(Task.id).filter(Task.status == TaskStatus.completed))
            .join(Step)
            .where(Step.workflow_id == w.id)
        )
        total, completed = tasks_result.one()
        out.append(
            WorkflowListItem(
                id=w.id,
                title=w.title,
                goal=w.goal,
                created_at=w.created_at,
                total_tasks=total or 0,
                completed_tasks=completed or 0,
                role=role_map.get(w.id, "owner"),
            )
        )
    return out


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or not role:
        raise HTTPException(status_code=404, detail="Workflow not found")
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one()
    return WorkflowResponse.model_validate(workflow).model_copy(update={"role": role})


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: int,
    body: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Cannot edit this workflow")
    workflow.title = body.title
    workflow.goal = body.goal
    await db.commit()
    await db.refresh(workflow)
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    return WorkflowResponse.model_validate(result.scalar_one())


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or role != "owner":
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Only the owner can delete the workflow")
    await db.delete(workflow)
    await db.commit()


# Sharing (owner only)
@router.get("/{workflow_id}/shares", response_model=list[WorkflowShareResponse])
async def list_workflow_shares(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or role != "owner":
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Only the owner can manage sharing")
    result = await db.execute(select(WorkflowShare).where(WorkflowShare.workflow_id == workflow_id))
    return [WorkflowShareResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/{workflow_id}/shares", response_model=WorkflowShareResponse)
async def share_workflow(
    workflow_id: int,
    body: WorkflowShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or role != "owner":
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Only the owner can share")
    role_val = "editor" if body.role == "editor" else "viewer"
    if body.share_with_user_email:
        user_result = await db.execute(select(User).where(User.email == body.share_with_user_email))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="No user found with that email")
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot share with yourself")
        existing = await db.execute(
            select(WorkflowShare).where(
                WorkflowShare.workflow_id == workflow_id,
                WorkflowShare.user_id == user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Already shared with this user")
        share = WorkflowShare(workflow_id=workflow_id, user_id=user.id, team_id=None, role=role_val)
    elif body.share_with_team_id:
        team_result = await db.execute(select(Team).where(Team.id == body.share_with_team_id))
        team = team_result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        if team.owner_id != current_user.id:
            member_check = await db.execute(
                select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == current_user.id)
            )
            if not member_check.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="You can only share with teams you own or belong to")
        existing = await db.execute(
            select(WorkflowShare).where(
                WorkflowShare.workflow_id == workflow_id,
                WorkflowShare.team_id == team.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Already shared with this team")
        share = WorkflowShare(workflow_id=workflow_id, user_id=None, team_id=team.id, role=role_val)
    else:
        raise HTTPException(status_code=400, detail="Provide share_with_user_email or share_with_team_id")
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return WorkflowShareResponse.model_validate(share)


@router.delete("/{workflow_id}/shares/{share_id}", status_code=204)
async def unshare_workflow(
    workflow_id: int,
    share_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or role != "owner":
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Only the owner can manage sharing")
    result = await db.execute(
        select(WorkflowShare).where(WorkflowShare.id == share_id, WorkflowShare.workflow_id == workflow_id)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    await db.delete(share)
    await db.commit()


@router.post("/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not workflow or not role:
        raise HTTPException(status_code=404, detail="Workflow not found")
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one()
    new_workflow = Workflow(
        user_id=current_user.id,
        title=workflow.title + " (copy)",
        goal=workflow.goal,
    )
    db.add(new_workflow)
    await db.flush()
    for step in workflow.steps:
        new_step = Step(
            workflow_id=new_workflow.id,
            title=step.title,
            step_order=step.step_order,
        )
        db.add(new_step)
        await db.flush()
        for task in step.tasks:
            db.add(Task(
                step_id=new_step.id,
                title=task.title,
                description=task.description or "",
                document_url=task.document_url,
                status=TaskStatus.planned,
                priority=task.priority,
                due_date=task.due_date,
                labels=task.labels,
            ))
    await db.commit()
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == new_workflow.id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    return WorkflowResponse.model_validate(result.scalar_one())


# Steps
@router.post("/{workflow_id}/steps", response_model=StepResponse)
async def add_step(
    workflow_id: int,
    body: StepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not role or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not role else 403, detail="Workflow not found" if not role else "Cannot edit this workflow")
    step = Step(workflow_id=workflow_id, title=body.title, step_order=body.step_order)
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return StepResponse.model_validate(step)


@router.patch("/{workflow_id}/steps/{step_id}", response_model=StepResponse)
async def update_step_order(
    workflow_id: int,
    step_id: int,
    body: StepOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not role or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not role else 403, detail="Workflow not found" if not role else "Cannot edit this workflow")
    step_result = await db.execute(
        select(Step).where(Step.id == step_id, Step.workflow_id == workflow_id)
    )
    step = step_result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    step.step_order = body.step_order
    await db.commit()
    await db.refresh(step)
    return StepResponse.model_validate(step)


# Tasks
@router.post("/{workflow_id}/tasks", response_model=TaskResponse)
async def add_task(
    workflow_id: int,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not role or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not role else 403, detail="Workflow not found" if not role else "Cannot edit this workflow")
    step_result = await db.execute(select(Step).where(Step.id == body.step_id, Step.workflow_id == workflow_id))
    if not step_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Step not found")
    labels_str = ",".join(x.strip() for x in (body.labels or []) if x.strip()) or None
    task = Task(
        step_id=body.step_id,
        title=body.title,
        description=body.description or "",
        document_url=body.document_url,
        status=body.status,
        priority=body.priority.value,
        due_date=body.due_date,
        labels=labels_str,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.patch("/{workflow_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    workflow_id: int,
    task_id: int,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not role or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not role else 403, detail="Workflow not found" if not role else "Cannot edit this workflow")
    task_result = await db.execute(
        select(Task).join(Step).where(Task.id == task_id, Step.workflow_id == workflow_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.document_url is not None:
        task.document_url = body.document_url or None
    if body.status is not None:
        task.status = body.status
    if body.priority is not None:
        task.priority = body.priority.value
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.labels is not None:
        task.labels = ",".join(x.strip() for x in body.labels if x.strip()) or None
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.delete("/{workflow_id}/tasks/{task_id}", status_code=204)
async def delete_task(
    workflow_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, role = await get_workflow_and_access(db, current_user.id, workflow_id)
    if not role or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not role else 403, detail="Workflow not found" if not role else "Cannot edit this workflow")
    task_result = await db.execute(
        select(Task).join(Step).where(Task.id == task_id, Step.workflow_id == workflow_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()


# AI Assistant: add tasks/phases from a prompt
@router.post("/ai-assistant", response_model=WorkflowResponse)
async def ai_assistant(
    body: AIAssistantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow, role = await get_workflow_and_access(db, current_user.id, body.workflow_id)
    if not workflow or role not in ("owner", "editor"):
        raise HTTPException(status_code=404 if not workflow else 403, detail="Workflow not found" if not workflow else "Cannot edit this workflow")
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == body.workflow_id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one()
    summary = ", ".join(f"{s.title}: {len(s.tasks)} tasks" for s in workflow.steps)
    data = await ai_assistant_add_tasks(workflow.goal, summary, body.prompt)
    max_order = max((s.step_order for s in workflow.steps), default=0)
    for phase in data.get("phases", []):
        max_order += 1
        step = Step(
            workflow_id=workflow.id,
            title=phase.get("title", "New Phase"),
            step_order=phase.get("order", max_order),
        )
        db.add(step)
        await db.flush()
        for t in phase.get("tasks", []):
            task = Task(
                step_id=step.id,
                title=t.get("title", "Task"),
                description=t.get("description", ""),
                document_url=None,
                status=TaskStatus.planned,
                priority=TaskPriority.medium,
                due_date=None,
                labels=None,
            )
            db.add(task)
    await db.commit()
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == body.workflow_id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    return WorkflowResponse.model_validate(result.scalar_one())
