from datetime import datetime, date
from sqlalchemy import String, Text, Integer, DateTime, Date, ForeignKey, Enum as SQLEnum, Column
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class TaskStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    goal = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="workflows")
    steps = relationship("Step", back_populates="workflow", order_by="Step.step_order", cascade="all, delete-orphan")


class Step(Base):
    __tablename__ = "steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    step_order = Column(Integer, nullable=False, default=0)

    workflow = relationship("Workflow", back_populates="steps")
    tasks = relationship("Task", back_populates="step", order_by="Task.id", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    step_id = Column(Integer, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    document_url = Column(String(2000), nullable=True)  # link to doc (Google Doc, Notion, etc.)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.planned, nullable=False)
    priority = Column(String(20), default=TaskPriority.medium.value, nullable=False)
    due_date = Column(Date, nullable=True)
    labels = Column(Text, nullable=True)  # comma-separated labels (Jira-style)
    created_at = Column(DateTime, default=datetime.utcnow)

    step = relationship("Step", back_populates="tasks")
