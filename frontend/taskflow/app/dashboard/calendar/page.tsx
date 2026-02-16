"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getTasks, Task } from "@/api/taskProvider"
import { BUTTON_ICON } from "@/lib/buttonStyles"

const monthName = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function parseDueDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {}

    tasks.forEach((task) => {
      const due = parseDueDate(task.due_date)
      if (!due) return
      const key = dateKey(due)
      if (!map[key]) map[key] = []
      map[key].push(task)
    })

    Object.values(map).forEach((list) => {
      list.sort((a, b) => {
        const aPriority = a.priority === "high" ? 3 : a.priority === "medium" ? 2 : 1
        const bPriority = b.priority === "high" ? 3 : b.priority === "medium" ? 2 : 1
        return bPriority - aPriority
      })
    })

    return map
  }, [tasks])

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    const leadDays = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()

    const cells: Array<{ date: Date; inCurrentMonth: boolean }> = []

    for (let i = leadDays - 1; i >= 0; i -= 1) {
      cells.push({ date: new Date(year, month, -i), inCurrentMonth: false })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day), inCurrentMonth: true })
    }

    while (cells.length % 7 !== 0) {
      const nextIndex = cells.length - (leadDays + daysInMonth) + 1
      cells.push({ date: new Date(year, month + 1, nextIndex), inCurrentMonth: false })
    }

    return cells
  }, [currentMonth])

  const selectedTasks = selectedDate ? tasksByDay[selectedDate] || [] : []

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background p-6 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">Calendar</h1>
              <p className="mt-1 text-sm text-muted-foreground">View deadlines and upcoming work by date.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={BUTTON_ICON}
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[170px] text-center text-sm font-semibold text-foreground">
                {monthName[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <button
                className={BUTTON_ICON}
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:col-span-3">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {weekDays.map((day) => (
                <div key={day} className="rounded-md bg-muted py-2">
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="min-h-[420px] flex items-center justify-center text-sm text-muted-foreground">
                Loading calendar...
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map(({ date, inCurrentMonth }) => {
                  const key = dateKey(date)
                  const dayTasks = tasksByDay[key] || []
                  const isSelected = selectedDate === key

                  return (
                    <button
                      key={`${key}-${inCurrentMonth ? "current" : "adjacent"}`}
                      onClick={() => setSelectedDate(key)}
                      className={`min-h-[112px] rounded-xl border p-2 text-left transition ${
                        isSelected
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:bg-accent"
                      } ${inCurrentMonth ? "" : "opacity-45"}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{date.getDate()}</span>
                        {dayTasks.length > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayTasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className={`truncate rounded px-2 py-1 text-[11px] font-medium ${
                              task.priority === "high"
                                ? "bg-red-100 text-red-800"
                                : task.priority === "medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                            }`}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-[11px] text-muted-foreground">+{dayTasks.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Selected Date</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedDate || "Select a day on the calendar"}
            </p>

            <div className="mt-4 space-y-2">
              {selectedDate && selectedTasks.length > 0 ? (
                selectedTasks.map((task) => (
                  <Link
                    href="/dashboard/tasks"
                    key={task.id}
                    className="block rounded-lg border border-border bg-muted p-3 hover:bg-accent"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.team_name || task.team_id}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No due tasks for this date.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
