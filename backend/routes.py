from fastapi import APIRouter, HTTPException, Depends, Header, Query, Response, Cookie
import os
import asyncpg
import re
import time
from db import get_db
from auth import verify_token
from models.models import (
    Task,
    TeamMember,
    TeamMemberCreate,
    CommentCreate,
    UserCreate,
    TaskCreate,
    TeamCreate,
    UserLogin,
    TaskUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResendConfirmationRequest,
    UserProfileUpdateRequest,
)
from supabase import create_client


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
)

router = APIRouter()
ACCESS_TOKEN_COOKIE = os.getenv("ACCESS_TOKEN_COOKIE", "access_token")
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true" if APP_ENV == "production" else "false").lower() in {"1", "true", "yes", "on"}
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "none" if APP_ENV == "production" else "lax")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")

PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

AUTH_WINDOW_SECONDS = int(os.getenv("AUTH_WINDOW_SECONDS", "60"))
LOGIN_RATE_LIMIT = int(os.getenv("LOGIN_RATE_LIMIT", "10"))
REGISTER_RATE_LIMIT = int(os.getenv("REGISTER_RATE_LIMIT", "6"))
FORGOT_PASSWORD_RATE_LIMIT = int(os.getenv("FORGOT_PASSWORD_RATE_LIMIT", "5"))
INVITE_RATE_LIMIT = int(os.getenv("INVITE_RATE_LIMIT", "20"))
MAX_LOGIN_FAILURES = int(os.getenv("MAX_LOGIN_FAILURES", "5"))
LOGIN_LOCKOUT_SECONDS = int(os.getenv("LOGIN_LOCKOUT_SECONDS", "300"))

_rate_limit_buckets: dict[str, list[float]] = {}
_login_failures: dict[str, list[float]] = {}
_login_lockouts: dict[str, float] = {}


def get_client_ip(x_forwarded_for: str | None) -> str:
    if not x_forwarded_for:
        return "unknown"
    return x_forwarded_for.split(",")[0].strip() or "unknown"


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not email or not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return email


def normalize_name(value: str, field_name: str = "Name") -> str:
    normalized = re.sub(r"\s+", " ", value.strip())
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")
    if len(normalized) > 120:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return normalized


def enforce_rate_limit(key: str, limit: int, window_seconds: int, message: str) -> None:
    now = time.time()
    bucket = _rate_limit_buckets.get(key, [])
    bucket = [timestamp for timestamp in bucket if now - timestamp < window_seconds]
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail=message)
    bucket.append(now)
    _rate_limit_buckets[key] = bucket


def enforce_login_lockout(identity_key: str) -> None:
    now = time.time()
    locked_until = _login_lockouts.get(identity_key)
    if locked_until and now < locked_until:
        remaining = int(locked_until - now)
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {remaining} seconds.",
        )
    if locked_until and now >= locked_until:
        _login_lockouts.pop(identity_key, None)


def record_login_failure(identity_key: str) -> None:
    now = time.time()
    attempts = _login_failures.get(identity_key, [])
    attempts = [timestamp for timestamp in attempts if now - timestamp < AUTH_WINDOW_SECONDS]
    attempts.append(now)
    _login_failures[identity_key] = attempts
    if len(attempts) >= MAX_LOGIN_FAILURES:
        _login_lockouts[identity_key] = now + LOGIN_LOCKOUT_SECONDS
        _login_failures.pop(identity_key, None)


def clear_login_failures(identity_key: str) -> None:
    _login_failures.pop(identity_key, None)
    _login_lockouts.pop(identity_key, None)

def validate_password_strength(password: str) -> None:
    if not PASSWORD_PATTERN.match(password):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, number, and special character."
            ),
        )


# ========================= TASKS =========================

@router.get("/tasks")
async def get_tasks_for_user(
    user_id: str = Depends(verify_token),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    db = await get_db()

    total = await db.fetchval("""
        SELECT COUNT(*)
        FROM tasks t
        WHERE t.team_id IN (
            SELECT team_id FROM team_members WHERE user_id = $1
        )
    """, user_id)

    rows = await db.fetch("""
        SELECT
            t.*,
            u.name AS created_by_name,
            te.name AS team_name,
            au.name AS assigned_to_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.created_by
        LEFT JOIN teams te ON te.id = t.team_id
        LEFT JOIN team_members atm ON atm.id = t.assigned_to
        LEFT JOIN users au ON au.id = atm.user_id
        WHERE t.team_id IN (
            SELECT team_id FROM team_members WHERE user_id = $1
        )
        ORDER BY t.created_at DESC
        LIMIT $2
        OFFSET $3
    """, user_id, limit, offset)

    await db.close()
    return {"tasks": rows, "total": total, "limit": limit, "offset": offset}


@router.post("/tasks")
async def create_task(task: TaskCreate, user_id: str = Depends(verify_token)):
    db = await get_db()
    title = normalize_name(task.title, field_name="Title")
    description = None
    if task.description is not None:
        cleaned_description = task.description.strip()
        description = cleaned_description if cleaned_description else None

    # Check if the user is a member of the team
    is_member = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
        )
    """, task.team_id, user_id)

    if not is_member:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this team"
        )

    # Insert task without assigned_to
    row = await db.fetchrow("""
        INSERT INTO tasks (
            title,
            description,
            status,
            priority,
            team_id,
            due_date,
            created_by,
            assigned_to
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    """,
        title,
        description,
        task.status.value,
        task.priority.value,
        task.team_id,
        task.due_date,
        user_id,
        task.assigned_to
    )

    await db.close()
    return {"task": row}


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate, user_id: str = Depends(verify_token)):
    db = await get_db()

    provided_fields = getattr(task, "model_fields_set", set())
    if not provided_fields:
        provided_fields = getattr(task, "__fields_set__", set())

    if not provided_fields:
        await db.close()
        raise HTTPException(status_code=400, detail="No fields provided for update")

    if "assigned_to" in provided_fields and task.assigned_to is not None:
        assignee_is_member = await db.fetchval("""
            SELECT EXISTS (
                SELECT 1
                FROM tasks t
                JOIN team_members tm ON tm.team_id = t.team_id
                WHERE t.id = $1
                  AND tm.id = $2
            )
        """, task_id, task.assigned_to)

        if not assignee_is_member:
            await db.close()
            raise HTTPException(
                status_code=400,
                detail="Assigned member must belong to the task's team"
            )

    set_clauses = []
    args = []

    if "title" in provided_fields:
        args.append(normalize_name(task.title or "", field_name="Title") if task.title is not None else None)
        set_clauses.append(f"title = ${len(args)}")
    if "description" in provided_fields:
        cleaned_description = task.description.strip() if task.description is not None else None
        args.append(cleaned_description if cleaned_description else None)
        set_clauses.append(f"description = ${len(args)}")
    if "status" in provided_fields:
        args.append(task.status.value if task.status else None)
        set_clauses.append(f"status = ${len(args)}")
    if "priority" in provided_fields:
        args.append(task.priority.value if task.priority else None)
        set_clauses.append(f"priority = ${len(args)}")
    if "due_date" in provided_fields:
        args.append(task.due_date)
        set_clauses.append(f"due_date = ${len(args)}")
    if "assigned_to" in provided_fields:
        args.append(task.assigned_to)
        set_clauses.append(f"assigned_to = ${len(args)}")

    args.extend([task_id, user_id])
    task_id_idx = len(args) - 1
    user_id_idx = len(args)

    query = f"""
        UPDATE tasks
        SET {", ".join(set_clauses)}
        WHERE id = ${task_id_idx}
          AND team_id IN (
              SELECT team_id FROM team_members WHERE user_id = ${user_id_idx}
          )
        RETURNING *
    """

    try:
        row = await db.fetchrow(query, *args)
    except asyncpg.ForeignKeyViolationError:
        await db.close()
        raise HTTPException(
            status_code=400,
            detail="Invalid assignee. Use a team member ID from /teams/{team_id}/members."
        )

    await db.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Task not found or you don't have permission"
        )

    return {"task": row}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    row = await db.fetchrow("""
        DELETE FROM tasks
        WHERE id = $1
          AND (
              created_by = $2
              OR team_id IN (
                  SELECT team_id FROM team_members WHERE user_id = $2
              )
          )
        RETURNING *
    """, task_id, user_id)

    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Task not found or you don't have permission")

    return {"detail": "Task deleted successfully"}


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    row = await db.fetchrow("""
        SELECT
            t.*,
            u.name AS created_by_name,
            te.name AS team_name,
            au.name AS assigned_to_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.created_by
        LEFT JOIN teams te ON te.id = t.team_id
        LEFT JOIN team_members atm ON atm.id = t.assigned_to
        LEFT JOIN users au ON au.id = atm.user_id
        WHERE t.id = $1
          AND t.team_id IN (
              SELECT team_id FROM team_members WHERE user_id = $2
          )
    """, task_id, user_id)

    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"task": row}


# ========================= COMMENTS =========================

@router.get("/tasks/{task_id}/comments")
async def get_task_comments(task_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    has_access = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM tasks t
            JOIN team_members tm ON tm.team_id = t.team_id
            WHERE t.id = $1
              AND tm.user_id = $2
        )
    """, task_id, user_id)

    if not has_access:
        await db.close()
        raise HTTPException(status_code=403, detail="Task not found or you don't have access")

    try:
        rows = await db.fetch("""
            SELECT
                c.*,
                u.name AS author_name,
                u.email AS author_email
            FROM task_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.task_id = $1
            ORDER BY c.created_at DESC
        """, task_id)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Comments table is missing. Restart backend to initialize schema.")

    await db.close()
    return {"comments": rows}


@router.post("/tasks/{task_id}/comments")
async def create_task_comment(task_id: str, payload: CommentCreate, user_id: str = Depends(verify_token)):
    db = await get_db()

    content = payload.content.strip()
    if not content:
        await db.close()
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    if len(content) > 5000:
        await db.close()
        raise HTTPException(status_code=400, detail="Comment is too long")

    has_access = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM tasks t
            JOIN team_members tm ON tm.team_id = t.team_id
            WHERE t.id = $1
              AND tm.user_id = $2
        )
    """, task_id, user_id)

    if not has_access:
        await db.close()
        raise HTTPException(status_code=403, detail="Task not found or you don't have access")

    try:
        row = await db.fetchrow("""
            INSERT INTO task_comments (task_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        """, task_id, user_id, content)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Comments table is missing. Restart backend to initialize schema.")

    comment = await db.fetchrow("""
        SELECT
            c.*,
            u.name AS author_name,
            u.email AS author_email
        FROM task_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
    """, row["id"])

    await db.close()
    return {"comment": comment}


@router.delete("/comments/{comment_id}")
async def delete_task_comment(comment_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    try:
        row = await db.fetchrow("""
            DELETE FROM task_comments c
            WHERE c.id = $1
              AND c.user_id = $2
            RETURNING c.*
        """, comment_id, user_id)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Comments table is missing. Restart backend to initialize schema.")

    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Comment not found or you don't have permission")

    return {"detail": "Comment deleted successfully"}



# ========================= TEAM MEMBERS =========================

@router.get("/teams/{team_id}/members")
async def get_team_members(team_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    has_access = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
        )
    """, team_id, user_id)

    if not has_access:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="Team not found or you don't have access"
        )

    rows = await db.fetch("""
        SELECT tm.*, u.name, u.email
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
    """, team_id)

    await db.close()
    return {"members": rows}


@router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, member: TeamMemberCreate,
                          user_id: str = Depends(verify_token)):
    enforce_rate_limit(
        key=f"invite:{user_id}",
        limit=INVITE_RATE_LIMIT,
        window_seconds=AUTH_WINDOW_SECONDS,
        message="Too many invites in a short period. Please wait and try again.",
    )
    db = await get_db()

    admin_check = await db.fetchrow("""
        SELECT 1 FROM team_members
        WHERE team_id = $1 AND user_id = $2 AND role = 'admin'
    """, team_id, user_id)

    if not admin_check:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to add members"
        )

    target_user_id = member.user_id
    normalized_email = normalize_email(member.email) if member.email else None
    invite_email_sent = False

    if target_user_id is None and normalized_email:
        target_user = await db.fetchrow("""
            SELECT id, email, name
            FROM users
            WHERE LOWER(email) = $1
        """, normalized_email)
        if target_user:
            target_user_id = target_user["id"]
        else:
            redirect_to = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/login"
            try:
                invite_response = supabase.auth.admin.invite_user_by_email(
                    normalized_email,
                    {"redirect_to": redirect_to},
                )
                invited_user = getattr(invite_response, "user", None)
                if invited_user is None:
                    await db.close()
                    raise HTTPException(status_code=500, detail="Failed to send invite email")

                invited_name = (normalized_email.split("@")[0] or "User").replace(".", " ").replace("_", " ").strip().title()
                created_user = await db.fetchrow("""
                    INSERT INTO users (id, email, name)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id) DO UPDATE SET
                        email = EXCLUDED.email
                    RETURNING id
                """, invited_user.id, normalized_email, invited_name or "User")
                target_user_id = created_user["id"]
                invite_email_sent = True
            except HTTPException:
                raise
            except Exception as e:
                error_message = str(e).lower()
                if "already registered" in error_message:
                    existing_user_id = await db.fetchval("""
                        SELECT id
                        FROM users
                        WHERE LOWER(email) = $1
                    """, normalized_email)
                    if not existing_user_id:
                        await db.close()
                        raise HTTPException(status_code=404, detail="User exists in auth but not in app users table")
                    target_user_id = existing_user_id
                else:
                    await db.close()
                    raise HTTPException(status_code=500, detail="Failed to invite user by email")

    if target_user_id is None:
        await db.close()
        raise HTTPException(
            status_code=400,
            detail="Provide a valid user_id or email for the member"
        )

    target_user = await db.fetchrow("""
        SELECT id, email, name
        FROM users
        WHERE id = $1
    """, target_user_id)

    if not target_user:
        await db.close()
        raise HTTPException(status_code=404, detail="User not found")

    if str(target_user_id) == user_id:
        await db.close()
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    already_member = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
        )
    """, team_id, target_user_id)

    if already_member:
        await db.close()
        raise HTTPException(status_code=409, detail="User is already a team member")

    pending_invite = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM team_invites
            WHERE team_id = $1
              AND invited_user_id = $2
              AND status = 'pending'
        )
    """, team_id, target_user_id)

    if pending_invite:
        await db.close()
        raise HTTPException(status_code=409, detail="An invite is already pending for this user")

    try:
        row = await db.fetchrow("""
            INSERT INTO team_invites (team_id, invited_user_id, invited_by, role)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        """, team_id, target_user_id, user_id, member.role.value)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Invites table is missing. Restart backend to initialize schema.")

    await db.close()
    detail = "Invite created. User must accept before joining the team."
    if invite_email_sent:
        detail = "Invite email sent. User must accept before joining the team."
    return {"invite": row, "detail": detail}


@router.get("/users/me/team-invites")
async def get_my_team_invites(user_id: str = Depends(verify_token)):
    db = await get_db()

    try:
        rows = await db.fetch("""
            SELECT
                ti.*,
                t.name AS team_name,
                u.name AS invited_by_name,
                u.email AS invited_by_email
            FROM team_invites ti
            JOIN teams t ON t.id = ti.team_id
            JOIN users u ON u.id = ti.invited_by
            WHERE ti.invited_user_id = $1
              AND ti.status = 'pending'
            ORDER BY ti.created_at DESC
        """, user_id)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Invites table is missing. Restart backend to initialize schema.")

    await db.close()
    return {"invites": rows}


@router.post("/users/me/team-invites/{invite_id}/accept")
async def accept_team_invite(invite_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    try:
        invite = await db.fetchrow("""
            UPDATE team_invites
            SET status = 'accepted', responded_at = NOW()
            WHERE id = $1
              AND invited_user_id = $2
              AND status = 'pending'
            RETURNING *
        """, invite_id, user_id)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Invites table is missing. Restart backend to initialize schema.")

    if not invite:
        await db.close()
        raise HTTPException(status_code=404, detail="Invite not found")

    existing_member = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
        )
    """, invite["team_id"], user_id)

    if not existing_member:
        await db.execute("""
            INSERT INTO team_members (user_id, team_id, role)
            VALUES ($1, $2, $3)
        """, user_id, invite["team_id"], invite["role"])

    await db.close()
    return {"detail": "Invite accepted"}


@router.post("/users/me/team-invites/{invite_id}/decline")
async def decline_team_invite(invite_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    try:
        invite = await db.fetchrow("""
            UPDATE team_invites
            SET status = 'declined', responded_at = NOW()
            WHERE id = $1
              AND invited_user_id = $2
              AND status = 'pending'
            RETURNING *
        """, invite_id, user_id)
    except asyncpg.UndefinedTableError:
        await db.close()
        raise HTTPException(status_code=500, detail="Invites table is missing. Restart backend to initialize schema.")

    await db.close()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    return {"detail": "Invite declined"}


@router.delete("/teams/{team_id}/members/{member_id}")
async def remove_team_member(team_id: str, member_id: str,
                             user_id: str = Depends(verify_token)):
    db = await get_db()

    admin_check = await db.fetchrow("""
        SELECT 1 FROM team_members
        WHERE team_id = $1 AND user_id = $2 AND role = 'admin'
    """, team_id, user_id)

    if not admin_check:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to remove members"
        )

    row = await db.fetchrow("""
        DELETE FROM team_members
        WHERE id = $1 AND team_id = $2
        RETURNING *
    """, member_id, team_id)

    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Member not found")

    return {"detail": "Member removed successfully"}


# ========================= TEAMS =========================

@router.post("/teams")
async def create_team(team: TeamCreate, user_id: str = Depends(verify_token)):
    """Create a new team and add the creator as admin"""
    db = await get_db()
    team_name = normalize_name(team.name, field_name="Team name")

    try:
        team = await db.fetchrow("""
            INSERT INTO teams (name,owner_id)
            VALUES ($1,$2)
            RETURNING *
        """, team_name, user_id)

        await db.fetchrow("""
            INSERT INTO team_members (user_id, team_id, role)
            VALUES ($1, $2, 'admin')
        """, user_id, team["id"])

        await db.close()

        return {
            "team": {
                "id": team["id"],
                "name": team["name"],
                "created_at": team["created_at"]
            }
        }

    except Exception as e:
        await db.close()

        if "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="Team name already exists"
            )

        raise HTTPException(status_code=500, detail="Failed to create team")


@router.get("/teams")
async def get_user_teams(user_id: str = Depends(verify_token)):
    """Get all teams the current user is a member of"""
    db = await get_db()

    rows = await db.fetch("""
        SELECT t.id, t.name, t.created_at, tm.role
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = $1
        ORDER BY t.name
    """, user_id)

    await db.close()
    return {"teams": rows}


@router.get("/teams/{team_id}")
async def get_team(team_id: str, user_id: str = Depends(verify_token)):
    db = await get_db()

    is_member = await db.fetchval("""
        SELECT EXISTS(
            SELECT 1 FROM team_members
            WHERE team_id = $1 AND user_id = $2
        )
    """, team_id, user_id)

    if not is_member:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this team"
        )

    team = await db.fetchrow("""
        SELECT * FROM teams WHERE id = $1
    """, team_id)

    await db.close()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    return {"team": team}


@router.put("/teams/{team_id}")
async def update_team(team_id: str, team: TeamCreate,
                      user_id: str = Depends(verify_token)):
    """Update team name (admin only)"""
    db = await get_db()

    is_admin = await db.fetchval("""
        SELECT EXISTS(
            SELECT 1 FROM team_members
            WHERE team_id = $1 AND user_id = $2 AND role = 'admin'
        )
    """, team_id, user_id)

    if not is_admin:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="Only admins can update team"
        )

    updated_team = await db.fetchrow("""
        UPDATE teams
        SET name = $1
        WHERE id = $2
        RETURNING *
    """, normalize_name(team.name, field_name="Team name"), team_id)

    await db.close()

    if not updated_team:
        raise HTTPException(status_code=404, detail="Team not found")

    return {"team": updated_team}


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user_id: str = Depends(verify_token)):
    """Delete team (admin only)"""
    db = await get_db()

    is_admin = await db.fetchval("""
        SELECT EXISTS(
            SELECT 1 FROM team_members
            WHERE team_id = $1 AND user_id = $2 AND role = 'admin'
        )
    """, team_id, user_id)

    if not is_admin:
        await db.close()
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete team"
        )

    deleted = await db.fetchrow("""
        DELETE FROM teams
        WHERE id = $1
        RETURNING *
    """, team_id)

    await db.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Team not found")

    return {"detail": "Team deleted successfully"}


# ========================= USERS =========================

@router.get("/users/me")
async def get_current_user(user_id: str = Depends(verify_token)):
    db = await get_db()

    user = await db.fetchrow("""
        SELECT id, email, name, created_at
        FROM users
        WHERE id = $1
    """, user_id)

    await db.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"user": user}


@router.put("/users/me")
async def update_user_profile(payload: UserProfileUpdateRequest, user_id: str = Depends(verify_token)):
    db = await get_db()

    new_name = normalize_name(payload.name)

    user = await db.fetchrow("""
        UPDATE users
        SET name = $1
        WHERE id = $2
        RETURNING id, email, name, created_at
    """, new_name, user_id)

    await db.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"user": user}


# ========================= AUTH =========================

@router.post("/register")
async def create_user(user: UserCreate, x_forwarded_for: str | None = Header(default=None)):
    email = normalize_email(user.email)
    name = normalize_name(user.name)
    validate_password_strength(user.password)

    try:
        auth_user = supabase.auth.sign_up({
            "email": email,
            "password": user.password,
            "options": {
                "data": {
                    "name": name
                }
            }
        })

        if auth_user.user is None:
            raise HTTPException(status_code=400, detail="Registration failed")

        user_id = auth_user.user.id

        db = await get_db()
        row = await db.fetchrow("""
            INSERT INTO users (id, email, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name
            RETURNING *
        """, user_id, email, name)

        await db.close()

        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "detail": "Registration successful. Check your email to confirm your account."
        }

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e).lower()
        if "already registered" in error_message or "user already registered" in error_message:
            raise HTTPException(status_code=409, detail="Email already exists")
        if "rate limit" in error_message:
            raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
        if "invalid email" in error_message:
            raise HTTPException(status_code=400, detail="Invalid email address")

        print(f"Register error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@router.get("/check-email")
async def check_email_exists(email: str = Query(..., min_length=3)):
    normalized_email = normalize_email(email)

    db = await get_db()
    exists = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM users
            WHERE LOWER(email) = $1
        )
    """, normalized_email)
    await db.close()

    return {"available": not exists}


@router.post("/login")
async def login_user(
    user: UserLogin,
    response: Response,
    x_forwarded_for: str | None = Header(default=None),
):
    client_ip = get_client_ip(x_forwarded_for)
    enforce_rate_limit(
        key=f"login:{client_ip}",
        limit=LOGIN_RATE_LIMIT,
        window_seconds=AUTH_WINDOW_SECONDS,
        message="Too many login requests. Please slow down and try again.",
    )

    email = normalize_email(user.email)
    login_identity_key = f"{email}:{client_ip}"
    enforce_login_lockout(login_identity_key)

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": user.password
        })
    except Exception as e:
        error_message = str(e).lower()
        if "email not confirmed" in error_message:
            record_login_failure(login_identity_key)
            raise HTTPException(
                status_code=403,
                detail="Email not confirmed. Please confirm your email before login."
            )
        if "invalid login credentials" in error_message:
            record_login_failure(login_identity_key)
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=500, detail="Login failed")
    
    if auth_response.user is None or auth_response.session is None:
        record_login_failure(login_identity_key)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not getattr(auth_response.user, "email_confirmed_at", None):
        record_login_failure(login_identity_key)
        raise HTTPException(
            status_code=403,
            detail="Email not confirmed. Please confirm your email before login."
        )

    clear_login_failures(login_identity_key)
    
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=auth_response.session.access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
        max_age=60 * 60 * 24 * 7,
    )

    return {
        "access_token": auth_response.session.access_token,
        "token_type": "bearer"
    }


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    x_forwarded_for: str | None = Header(default=None),
):
    client_ip = get_client_ip(x_forwarded_for)
    enforce_rate_limit(
        key=f"forgot-password:{client_ip}",
        limit=FORGOT_PASSWORD_RATE_LIMIT,
        window_seconds=AUTH_WINDOW_SECONDS,
        message="Too many password reset attempts. Please try again later.",
    )

    email = normalize_email(payload.email)
    redirect_to = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset-password"
    try:
        if hasattr(supabase.auth, "reset_password_for_email"):
            supabase.auth.reset_password_for_email(email, {"redirect_to": redirect_to})
        else:
            supabase.auth.reset_password_email(email)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send reset email")

    return {"detail": "If the email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    authorization: str = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization token provided")

    validate_password_strength(payload.new_password)

    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
        if user_response.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired reset token")

        supabase.auth.admin.update_user_by_id(
            user_response.user.id,
            {"password": payload.new_password}
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to reset password")

    return {"detail": "Password has been reset successfully."}


@router.post("/resend-confirmation")
async def resend_confirmation(
    payload: ResendConfirmationRequest,
    x_forwarded_for: str | None = Header(default=None),
):
    client_ip = get_client_ip(x_forwarded_for)
    enforce_rate_limit(
        key=f"resend-confirmation:{client_ip}",
        limit=FORGOT_PASSWORD_RATE_LIMIT,
        window_seconds=AUTH_WINDOW_SECONDS,
        message="Too many confirmation requests. Please try again later.",
    )

    email = normalize_email(payload.email)
    try:
        if hasattr(supabase.auth, "resend"):
            supabase.auth.resend({
                "type": "signup",
                "email": email
            })
        else:
            raise HTTPException(status_code=501, detail="Resend confirmation is not supported by current auth client.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to resend confirmation email")

    return {"detail": "Confirmation email sent if account exists."}


@router.post("/logout")
async def logout_user(
    response: Response,
    authorization: str = Header(None),
    access_token: str = Cookie(None, alias=ACCESS_TOKEN_COOKIE),
):
    token = authorization.replace("Bearer ", "").strip() if authorization else (access_token or "").strip()
    
    try:
        if token:
            supabase.auth.sign_out(token)
        response.delete_cookie(
            key=ACCESS_TOKEN_COOKIE,
            domain=COOKIE_DOMAIN,
            path="/",
            samesite=COOKIE_SAMESITE,
            secure=COOKIE_SECURE,
        )
        return {"detail": "Successfully logged out"}
        
    except Exception as e:
        print(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")
