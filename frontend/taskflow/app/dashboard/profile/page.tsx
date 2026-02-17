"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, PenSquare, Users2 } from "lucide-react"
import { getTasks, Task } from "@/api/taskProvider"
import { getTeams } from "@/api/teamProvider"
import { getCurrentUser, updateProfile, User } from "@/api/userProvider"
import { BUTTON_PRIMARY } from "@/lib/buttonStyles"
import axios from "axios"

function parseDueDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatJoinedDate(value?: string): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamCount, setTeamCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nameDraft, setNameDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData(): Promise<void> {
      const [userResult, tasksResult, teamsResult] = await Promise.allSettled([
        getCurrentUser(),
        getTasks({ limit: 100, offset: 0 }),
        getTeams(),
      ])

      if (userResult.status === "fulfilled") {
        const loadedUser: User | null = userResult.value.data?.user || userResult.value.data || null
        setUser(loadedUser)
        setNameDraft(loadedUser?.name || "")
      } else {
        console.error("Error loading profile user:", userResult.reason)
      }

      if (tasksResult.status === "fulfilled") {
        if (Array.isArray(tasksResult.value.data)) {
          setTasks(tasksResult.value.data)
        } else if (Array.isArray(tasksResult.value.data?.tasks)) {
          setTasks(tasksResult.value.data.tasks)
        } else {
          setTasks([])
        }
      } else {
        console.error("Error loading profile tasks:", tasksResult.reason)
        setTasks([])
      }

      if (teamsResult.status === "fulfilled") {
        if (Array.isArray(teamsResult.value.data)) {
          setTeamCount(teamsResult.value.data.length)
        } else if (Array.isArray(teamsResult.value.data?.teams)) {
          setTeamCount(teamsResult.value.data.teams.length)
        } else {
          setTeamCount(0)
        }
      } else {
        console.error("Error loading profile teams:", teamsResult.reason)
        setTeamCount(0)
      }

      setLoading(false)
    }

    void loadData()
  }, [])

  const stats = useMemo(() => {
    const done = tasks.filter((task) => task.status === "done").length
    const inProgress = tasks.filter((task) => task.status === "in_progress").length
    const overdue = tasks.filter((task) => {
      const due = parseDueDate(task.due_date)
      if (!due) return false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return due < today && task.status !== "done"
    }).length

    return {
      total: tasks.length,
      done,
      inProgress,
      overdue,
    }
  }, [tasks])

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const aDate = new Date(a.created_at).getTime()
        const bDate = new Date(b.created_at).getTime()
        return bDate - aDate
      })
      .slice(0, 6)
  }, [tasks])

  const initials = useMemo(() => {
    if (!user?.name) return "U"
    return user.name
      .split(" ")
      .map((chunk) => chunk[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }, [user])

  async function handleSaveName(): Promise<void> {
    if (!nameDraft.trim() || !user) return

    try {
      setSaving(true)
      const response = await updateProfile({ name: nameDraft.trim() })
      const updated = response.data?.user || response.data || null
      if (updated) {
        setUser(updated)
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to update profile"
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background p-6 md:p-8 flex items-center justify-center">
      <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm xl:col-span-1">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {initials}
          </div>
          <h1 className="mt-4 text-center text-2xl font-bold text-foreground">{user?.name || "User"}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{user?.email || "No email"}</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display Name</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className={`${BUTTON_PRIMARY} gap-1 px-3`}
                >
                  <PenSquare className="h-4 w-4" />
                  {saving ? "Saving" : "Save"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
              Member since: <span className="font-medium text-foreground">{formatJoinedDate(user?.created_at)}</span>
            </div>
          </div>
        </section>

        <section className="space-y-6 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm">
              <p className="text-xs text-muted-foreground">Total Tasks</p>
              <p className="mt-2 text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="mt-2 text-3xl font-bold">{stats.done}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="mt-2 text-3xl font-bold">{stats.inProgress}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="mt-2 text-3xl font-bold">{stats.overdue}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Users2 className="h-4 w-4" />
                <span className="text-sm font-medium">Teams</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{teamCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Clock3 className="h-4 w-4" />
                <span className="text-sm font-medium">Open Work</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.total - stats.done}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Tasks</h2>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks created yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentTasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-border bg-muted px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{task.team_name || task.team_id}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-xs font-medium text-foreground border border-border">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
