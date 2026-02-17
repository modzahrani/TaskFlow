from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional

# Enums
class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class StatusLevel(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"

class TeamRole(str, Enum):
    MEMBER = "member"
    ADMIN = "admin"

# Task Models
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: StatusLevel
    priority: PriorityLevel
    team_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[UUID] = None
        
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[StatusLevel] = None
    priority: Optional[PriorityLevel] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[UUID] = None

class Task(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: StatusLevel
    priority: PriorityLevel
    team_id: Optional[UUID] = None
    created_by: UUID  
    assigned_to: Optional[UUID] = None
    created_at: datetime
    due_date: Optional[datetime] = None
    
# Team Member Models
class TeamMemberCreate(BaseModel):
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    role: TeamRole = TeamRole.MEMBER

class TeamMember(BaseModel):
    id: UUID
    user_id: UUID  
    team_id: UUID  
    role: TeamRole

# Comment Models
class CommentCreate(BaseModel):
    content: str

class Comment(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Team Models
class TeamCreate(BaseModel):
    name: str

class Team(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    

# User Models
class UserCreate(BaseModel):
    email: str
    name: str
    password: str

class User(BaseModel):
    id: UUID
    email: str
    name: str
    created_at: datetime

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    new_password: str

class ResendConfirmationRequest(BaseModel):
    email: str

class UserProfileUpdateRequest(BaseModel):
    name: str
   
