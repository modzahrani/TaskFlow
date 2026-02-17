from dotenv import load_dotenv
import asyncpg
import os

load_dotenv()

async def get_db():
    return await asyncpg.connect(os.environ["DATABASE_URL"], ssl="require")


async def init_db():
    db = await get_db()
    try:
        await db.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'tasks'
                      AND column_name = 'team_id'
                      AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE tasks ALTER COLUMN team_id DROP NOT NULL;
                END IF;
            END $$;
        """)

        # Legacy schema fix: allow duplicate team names by removing unique
        # constraints/indexes that enforce uniqueness on teams.name.
        await db.execute("""
            DO $$
            DECLARE
                name_attnum SMALLINT;
                rec RECORD;
            BEGIN
                SELECT a.attnum
                INTO name_attnum
                FROM pg_attribute a
                WHERE a.attrelid = 'teams'::regclass
                  AND a.attname = 'name'
                  AND a.attnum > 0
                  AND NOT a.attisdropped;

                IF name_attnum IS NOT NULL THEN
                    FOR rec IN
                        SELECT c.conname
                        FROM pg_constraint c
                        WHERE c.conrelid = 'teams'::regclass
                          AND c.contype = 'u'
                          AND c.conkey = ARRAY[name_attnum]
                    LOOP
                        EXECUTE format('ALTER TABLE teams DROP CONSTRAINT %I', rec.conname);
                    END LOOP;

                    FOR rec IN
                        SELECT i.relname AS index_name
                        FROM pg_index ix
                        JOIN pg_class i ON i.oid = ix.indexrelid
                        JOIN pg_class t ON t.oid = ix.indrelid
                        WHERE t.oid = 'teams'::regclass
                          AND ix.indisunique
                          AND ix.indkey = ARRAY[name_attnum]::int2vector
                    LOOP
                        EXECUTE format('DROP INDEX IF EXISTS %I', rec.index_name);
                    END LOOP;
                END IF;
            END $$;
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS task_comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL CHECK (length(trim(content)) > 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_task_comments_task_id_created_at
            ON task_comments (task_id, created_at DESC)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_task_comments_user_id
            ON task_comments (user_id)
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS team_invites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                responded_at TIMESTAMPTZ
            )
        """)

        await db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_pending_unique
            ON team_invites (team_id, invited_user_id)
            WHERE status = 'pending'
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_team_invites_user_status
            ON team_invites (invited_user_id, status, created_at DESC)
        """)
    finally:
        await db.close()
