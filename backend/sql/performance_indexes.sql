-- Taskflow performance indexes
-- Run this once on your Postgres database.

CREATE INDEX IF NOT EXISTS idx_tasks_team_created_at
ON tasks (team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
ON tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_team_members_user_team
ON team_members (user_id, team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team_user
ON team_members (team_id, user_id);
