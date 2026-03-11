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
    display_name = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    token_version = Column(Integer, default=0, nullable=False)  # unused; kept for migration compat

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")
    owned_teams = relationship("Team", back_populates="owner", foreign_keys="Team.owner_id")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    workflow_shares = relationship("WorkflowShare", back_populates="user", foreign_keys="WorkflowShare.user_id")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    label = Column(String(255), nullable=True)  # e.g. "Chrome on Mac"

    user = relationship("User", back_populates="sessions")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_teams", foreign_keys=[owner_id])
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    workflow_shares = relationship("WorkflowShare", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")


class WorkflowShareRole(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"


class WorkflowShare(Base):
    __tablename__ = "workflow_shares"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    role = Column(String(20), default=WorkflowShareRole.viewer.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    workflow = relationship("Workflow", back_populates="shares")
    user = relationship("User", back_populates="workflow_shares")
    team = relationship("Team", back_populates="workflow_shares")


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    goal = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Jira-style: custom column labels and defaults
    status_planned_label = Column(String(100), nullable=True)      # e.g. "To Do", "Backlog"
    status_in_progress_label = Column(String(100), nullable=True)  # e.g. "In Progress"
    status_completed_label = Column(String(100), nullable=True)    # e.g. "Done"
    default_issue_type = Column(String(20), default="task", nullable=False)
    default_priority = Column(String(20), nullable=True)  # override for new tasks

    user = relationship("User", back_populates="workflows")
    steps = relationship("Step", back_populates="workflow", order_by="Step.step_order", cascade="all, delete-orphan")
    shares = relationship("WorkflowShare", back_populates="workflow", cascade="all, delete-orphan")


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
    issue_type = Column(String(20), default="task", nullable=False)  # task | bug | story | subtask
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    step = relationship("Step", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id])
