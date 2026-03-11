from datetime import datetime, date
from pydantic import BaseModel, EmailStr, field_validator
from app.models import TaskStatus, TaskPriority


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TaskBase(BaseModel):
    title: str
    description: str = ""
    document_url: str | None = None
    priority: TaskPriority = TaskPriority.medium
    due_date: date | None = None
    labels: list[str] = []


class TaskCreate(TaskBase):
    step_id: int
    status: TaskStatus = TaskStatus.planned


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    document_url: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    labels: list[str] | None = None


class TaskResponse(BaseModel):
    id: int
    step_id: int
    title: str
    description: str
    document_url: str | None = None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None = None
    labels: list[str]
    created_at: datetime

    class Config:
        from_attributes = True

    @field_validator("priority", mode="before")
    @classmethod
    def priority_default(cls, v: TaskPriority | str | None) -> TaskPriority:
        if v is None:
            return TaskPriority.medium
        if isinstance(v, TaskPriority):
            return v
        try:
            return TaskPriority(str(v).lower())
        except ValueError:
            return TaskPriority.medium

    @field_validator("labels", mode="before")
    @classmethod
    def labels_from_orm(cls, v: str | list[str] | None) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return v
        s = (v or "").strip()
        return [x.strip() for x in s.split(",") if x.strip()]


class StepBase(BaseModel):
    title: str
    step_order: int = 0


class StepCreate(StepBase):
    workflow_id: int


class StepOrderUpdate(BaseModel):
    step_order: int


class StepResponse(BaseModel):
    id: int
    workflow_id: int
    title: str
    step_order: int
    tasks: list[TaskResponse] = []

    class Config:
        from_attributes = True


class WorkflowBase(BaseModel):
    title: str
    goal: str


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowResponse(BaseModel):
    id: int
    user_id: int
    title: str
    goal: str
    created_at: datetime
    steps: list[StepResponse] = []

    class Config:
        from_attributes = True


class WorkflowListItem(BaseModel):
    id: int
    title: str
    goal: str
    created_at: datetime
    total_tasks: int = 0
    completed_tasks: int = 0

    class Config:
        from_attributes = True


class GenerateWorkflowRequest(BaseModel):
    goal: str


class AIAssistantRequest(BaseModel):
    workflow_id: int
    prompt: str
