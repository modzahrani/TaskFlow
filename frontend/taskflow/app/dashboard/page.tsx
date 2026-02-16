"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Calendar, ChevronRight, Clock3, Layers3, ListChecks, UserCircle2 } from "lucide-react"
import { getTasks, Task } from "@/api/taskProvider"
import { ModeToggle } from "@/components/ThemeToggler"
import { PriorityBadge } from "@/components/badge"

const statusLabel: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
}

const priorityWeight: Record<Task["priority"], number> = {
  low: 1,
  medium: 2,
  high: 3,
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isWithinThisWeek(date: Date): boolean {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(now.getDate() - now.getDay())

  const end = new Date(start)
  end.setDate(start.getDate() + 7)

  return date >= start && date < end
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTasks(): Promise<void> {
      try {
        const response = await getTasks({ limit: 100, offset: 0 })

        if (Array.isArray(response.data)) {
          setTasks(response.data)
        } else if (Array.isArray(response.data?.tasks)) {
          setTasks(response.data.tasks)
        } else {
          setTasks([])
        }
      } catch (error) {
        console.error("Error fetching tasks:", error)
        setTasks([])
      } finally {
        setLoading(false)
      }
    }

    void fetchTasks()
  }, [])

  const metrics = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const todo = tasks.filter((task) => task.status === "todo")
    const inProgress = tasks.filter((task) => task.status === "in_progress")
    const done = tasks.filter((task) => task.status === "done")

    let overdue = 0
    let dueToday = 0
    let dueThisWeek = 0

    tasks.forEach((task) => {
      const due = parseDate(task.due_date)
      if (!due) return

      if (due < now && task.status !== "done") overdue += 1
      if (isSameDay(due, now)) dueToday += 1
      if (isWithinThisWeek(due)) dueThisWeek += 1
    })

    return {
      total: tasks.length,
      todo: todo.length,
      inProgress: inProgress.length,
      done: done.length,
      overdue,
      dueToday,
      dueThisWeek,
    }
  }, [tasks])

  const topPriorityTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task.status !== "done")
      .sort((a, b) => {
        const byPriority = priorityWeight[b.priority] - priorityWeight[a.priority]
        if (byPriority !== 0) return byPriority

        const aDue = parseDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
        const bDue = parseDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
      .slice(0, 6)
  }, [tasks])

  const statusGroups = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "todo").slice(0, 4),
      in_progress: tasks.filter((task) => task.status === "in_progress").slice(0, 4),
      done: tasks.filter((task) => task.status === "done").slice(0, 4),
    }
  }, [tasks])

  const statCards = [
    {
      title: "Total Tasks",
      value: metrics.total,
      subtitle: `${metrics.inProgress} active now`,
      href: "/dashboard/tasks",
      icon: Layers3,
    },
    {
      title: "Due Today",
      value: metrics.dueToday,
      subtitle: `${metrics.overdue} overdue`,
      href: "/dashboard/calendar",
      icon: Clock3,
    },
    {
      title: "Completed",
      value: metrics.done,
      subtitle: `${metrics.todo} still to do`,
      href: "/dashboard/tasks",
      icon: ListChecks,
    },
    {
      title: "This Week",
      value: metrics.dueThisWeek,
      subtitle: "Upcoming deadlines",
      href: "/dashboard/calendar",
      icon: Calendar,
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background p-6 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">Overview</h1>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Track priorities, deadlines, and progress across your teams.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <UserCircle2 className="h-4 w-4" />
                Profile
              </Link>
              <ModeToggle />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold">{card.value}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 flex items-center text-xs text-muted-foreground">
                  View details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </div>
              </Link>
            )
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Focus Tasks</h2>
              <Link href="/dashboard/tasks" className="text-sm font-medium text-primary hover:underline">
                Open Task Board
              </Link>
            </div>

            {topPriorityTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No active tasks right now.
              </p>
            ) : (
              <div className="space-y-3">
                {topPriorityTasks.map((task) => (
                  <Link
                    key={task.id}
                    href="/dashboard/tasks"
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3 transition hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {statusLabel[task.status]} • {task.team_name || task.team_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Status Snapshot</h2>
            <div className="mt-4 space-y-3">
              {([
                ["To Do", metrics.todo, "todo"],
                ["In Progress", metrics.inProgress, "in_progress"],
                ["Done", metrics.done, "done"],
              ] as const).map(([label, count]) => (
                <Link
                  key={label}
                  href="/dashboard/tasks"
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-accent"
                >
                  <span className="text-sm text-foreground">{label}</span>
                  <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                    {count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          {([
            ["To Do", statusGroups.todo],
            ["In Progress", statusGroups.in_progress],
            ["Done", statusGroups.done],
          ] as const).map(([title, items]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <Link href="/dashboard/tasks" className="text-xs text-primary hover:underline">
                  See all
                </Link>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks in this status.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((task) => (
                    <li key={task.id} className="rounded-lg bg-muted px-3 py-2">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.team_name || task.team_id}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
