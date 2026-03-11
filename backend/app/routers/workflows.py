from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Workflow, Step, Task, TaskStatus, TaskPriority
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
)
from app.auth import get_current_user
from app.services.ai_workflow import generate_workflow_from_goal, ai_assistant_add_tasks

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
    result = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == current_user.id)
        .order_by(Workflow.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    workflows = result.scalars().all()
    out = []
    for w in workflows:
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
            )
        )
    return out


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse.model_validate(workflow)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: int,
    body: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)
    await db.commit()


@router.post("/{workflow_id}/duplicate", response_model=WorkflowResponse)
async def duplicate_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
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
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == body.workflow_id, Workflow.user_id == current_user.id)
        .options(selectinload(Workflow.steps).selectinload(Step.tasks))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
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
