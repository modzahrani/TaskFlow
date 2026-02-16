"use client"

import { useCallback, useEffect, useState } from "react"
import { columns } from "./column"
import { DataTable } from "./data-table"
import { Task, createTask, deleteTask, getTasks, updateTask } from "@/api/taskProvider"
import { Team, TeamMember, createTeam, getTeamMembers, getTeams } from "@/api/teamProvider"
import { TaskComment, createTaskComment, deleteTaskComment, getTaskComments } from "@/api/commentProvider"
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/lib/buttonStyles"
import axios from "axios"

interface TaskFormData {
  title: string
  description: string
  status: "todo" | "in_progress" | "done" | ""
  priority: "low" | "medium" | "high" | ""
  due_date: string
  team_id: string
}

interface AssigneeOption {
  member_id: string
  user_id: string
  name: string
}

const PAGE_SIZE = 25
export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Task[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [assigneesByTeam, setAssigneesByTeam] = useState<Record<string, AssigneeOption[]>>({})
  const [assigneesLoadingByTeam, setAssigneesLoadingByTeam] = useState<Record<string, boolean>>({})
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [creatingComment, setCreatingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)

  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    status: "",
    priority: "",
    due_date: "",
    team_id: "",
  })

  const formatDateTime = (value?: string | null): string => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const h = String(date.getHours()).padStart(2, "0")
    const min = String(date.getMinutes()).padStart(2, "0")

    return `${y}-${m}-${d} ${h}:${min}`
  }

  const formatDueDate = (value?: string | null): string => {
    if (!value) return ""

    // Handle multiple backend formats safely without timezone shifting.
    const datePart = value.includes("T")
      ? value.split("T")[0]
      : value.includes(" ")
        ? value.split(" ")[0]
        : value

    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""

    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, "0")
    const d = String(parsed.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const formatCommentDate = (value?: string | null): string => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString()
  }

  const fetchTeamMembersForTeam = useCallback(async (teamId: string): Promise<void> => {
    if (!teamId || assigneesByTeam[teamId] || assigneesLoadingByTeam[teamId]) {
      return
    }

    setAssigneesLoadingByTeam((prev) => ({ ...prev, [teamId]: true }))
    try {
      const response = await getTeamMembers(teamId)

      let members: TeamMember[] = []
      if (Array.isArray(response.data)) {
        members = response.data
      } else if (Array.isArray(response.data?.members)) {
        members = response.data.members
      }

      const normalizedMembers: AssigneeOption[] = members.map((member) => ({
        member_id: member.id,
        user_id: member.user_id,
        name: member.name || member.user_id,
      }))

      setAssigneesByTeam((prev) => ({ ...prev, [teamId]: normalizedMembers }))
    } catch (error) {
      console.error("Error fetching team members:", error)
    } finally {
      setAssigneesLoadingByTeam((prev) => ({ ...prev, [teamId]: false }))
    }
  }, [assigneesByTeam, assigneesLoadingByTeam])

  const fetchTasks = useCallback(async (page: number): Promise<void> => {
    try {
      const response = await getTasks({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })

      let tasksArray: Task[] = []
      if (Array.isArray(response.data)) {
        tasksArray = response.data
      } else if (Array.isArray(response.data?.tasks)) {
        tasksArray = response.data.tasks
      }

      const normalizedTasks = tasksArray.map((task) => ({
        ...task,
        created_at: formatDateTime(task.created_at),
        due_date: formatDueDate(task.due_date),
        created_by_name: task.created_by_name || task.created_by,
        team_name: task.team_name || task.team_id,
        assigned_to_name:
          task.assigned_to_name ||
          task.assigned_to ||
          null,
      }))

      setData(normalizedTasks)
      if (typeof response.data?.total === "number") {
        setTotalTasks(response.data.total)
      } else {
        setTotalTasks(normalizedTasks.length)
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
      setData([])
      setTotalTasks(0)
    }
  }, [])

  const fetchTeams = useCallback(async (): Promise<void> => {
    try {
      const response = await getTeams()

      let allTeams: Team[] = []
      if (Array.isArray(response.data)) {
        allTeams = response.data
      } else if (Array.isArray(response.data?.teams)) {
        allTeams = response.data.teams
      }

      setTeams(allTeams)

      if (allTeams.length > 0) {
        setTaskFormData((prev) => ({ ...prev, team_id: allTeams[0].id }))
      }
    } catch (error) {
      console.error("Error fetching teams:", error)
      setTeams([])
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async (): Promise<void> => {
      await Promise.all([fetchTasks(0), fetchTeams()])
      setLoading(false)
    }

    void loadInitialData()
  }, [fetchTasks, fetchTeams])

  useEffect(() => {
    if (loading) return
    void fetchTasks(currentPage)
  }, [currentPage, fetchTasks, loading])

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    if (!taskFormData.title.trim()) {
      alert("Title is required")
      return
    }
    if (!taskFormData.status) {
      alert("Status is required")
      return
    }
    if (!taskFormData.priority) {
      alert("Priority is required")
      return
    }
    if (!taskFormData.team_id) {
      alert("Team is required")
      return
    }

    try {
      const response = await createTask({
        title: taskFormData.title.trim(),
        description: taskFormData.description || null,
        status: taskFormData.status,
        priority: taskFormData.priority,
        due_date: taskFormData.due_date || null,
        team_id: taskFormData.team_id,
      })
      const createdTask: Task | undefined =
        response.data?.task || (response.data as Task | undefined)

      if (createdTask) {
        setTotalTasks((prev) => prev + 1)
        if (currentPage !== 0) {
          setCurrentPage(0)
          setShowCreateTaskModal(false)
          return
        }

        setData((prev) => [
          {
            ...createdTask,
            created_at: formatDateTime(createdTask.created_at),
            due_date: formatDueDate(createdTask.due_date),
            created_by_name: createdTask.created_by_name || createdTask.created_by,
            team_name:
              createdTask.team_name ||
              teams.find((team) => team.id === createdTask.team_id)?.name ||
              createdTask.team_id,
            assigned_to_name: createdTask.assigned_to_name || createdTask.assigned_to || null,
          },
          ...prev,
        ].slice(0, PAGE_SIZE))
      } else {
        await fetchTasks(currentPage)
      }

      setTaskFormData({
        title: "",
        description: "",
        status: "",
        priority: "",
        due_date: "",
        team_id: teams[0]?.id || "",
      })

      setShowCreateTaskModal(false)
    } catch (error) {
      console.error("Error creating task:", error)
      alert("Failed to create task")
    }
  }

  const handleDeleteTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      await deleteTask(taskId)
      setTotalTasks((prev) => Math.max(0, prev - 1))
      setData((prev) => {
        const next = prev.filter((task) => task.id !== taskId)
        if (next.length === 0 && currentPage > 0) {
          setCurrentPage((page) => Math.max(0, page - 1))
        }
        return next
      })
    } catch (error) {
      console.error("Error deleting task:", error)
      alert("Failed to delete task")
    }
  }, [currentPage])

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<Task>): Promise<void> => {
      try {
        await updateTask(taskId, {
          title: updates.title,
          description: updates.description ?? undefined,
          status: updates.status,
          priority: updates.priority,
          due_date: updates.due_date ?? undefined,
          assigned_to: updates.assigned_to !== undefined ? updates.assigned_to : undefined,
        })

        setData((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...updates,
                }
              : task
          )
        )
      } catch (error) {
        console.error("Error updating task:", error)
        const message = axios.isAxiosError(error)
          ? error.response?.data?.detail
            ? (error.response.data.detail as string)
            : "Network error: backend is unreachable. Make sure API is running on http://localhost:8000."
          : "Failed to update task"
        alert(message)
      }
    },
    []
  )

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!newTeamName.trim()) {
      alert("Team name is required")
      return
    }

    try {
      setIsCreatingTeam(true)
      const response = await createTeam({ name: newTeamName.trim() })
      const created: Team | undefined = response.data?.team || response.data

      if (created) {
        setTeams((prev) => [...prev, created])
        setTaskFormData((prev) => ({
          ...prev,
          team_id: prev.team_id || created.id,
        }))
      } else {
        await fetchTeams()
      }

      setNewTeamName("")
      setShowCreateTeamModal(false)
    } catch (error) {
      console.error("Error creating team:", error)
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to create team"
      alert(message)
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const loadComments = useCallback(async (taskId: string): Promise<void> => {
    try {
      setCommentsLoading(true)
      const response = await getTaskComments(taskId)
      const nextComments: TaskComment[] = Array.isArray(response.data?.comments)
        ? response.data.comments
        : Array.isArray(response.data)
          ? response.data
          : []
      setComments(nextComments)
    } catch (error) {
      console.error("Error fetching comments:", error)
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  const handleOpenComments = useCallback((task: Task): void => {
    setSelectedTaskForComments(task)
    setShowCommentsModal(true)
    void loadComments(task.id)
  }, [loadComments])

  const handleCreateComment = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!selectedTaskForComments) return
    if (!newComment.trim()) {
      alert("Comment cannot be empty")
      return
    }

    try {
      setCreatingComment(true)
      const response = await createTaskComment(selectedTaskForComments.id, { content: newComment.trim() })
      const created: TaskComment | undefined = response.data?.comment || response.data
      if (created) {
        setComments((prev) => [created, ...prev])
      } else {
        await loadComments(selectedTaskForComments.id)
      }
      setNewComment("")
    } catch (error) {
      console.error("Error creating comment:", error)
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to add comment"
      alert(message)
    } finally {
      setCreatingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string): Promise<void> => {
    try {
      setDeletingCommentId(commentId)
      await deleteTaskComment(commentId)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
    } catch (error) {
      console.error("Error deleting comment:", error)
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to delete comment"
      alert(message)
    } finally {
      setDeletingCommentId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-foreground">Tasks</h1>
        <div className="flex items-center gap-2">
          <button
            className={BUTTON_SECONDARY}
            onClick={() => setShowCreateTeamModal(true)}
          >
            Create Team
          </button>
          <button
            className={BUTTON_PRIMARY}
            onClick={() => setShowCreateTaskModal(true)}
          >
            Create Task
          </button>
        </div>
      </header>

      <div className="container mx-auto py-6">
        <DataTable
          columns={columns}
          data={data}
          teams={teams}
          onLoadAssignees={fetchTeamMembersForTeam}
          assigneesByTeam={assigneesByTeam}
          assigneesLoadingByTeam={assigneesLoadingByTeam}
          pageIndex={currentPage}
          pageSize={PAGE_SIZE}
          totalRows={totalTasks}
          onPreviousPage={() => setCurrentPage((page) => Math.max(0, page - 1))}
          onNextPage={() => setCurrentPage((page) => page + 1)}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
          onOpenComments={handleOpenComments}
        />
      </div>

      {showCreateTaskModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card text-card-foreground p-6 border border-border shadow-xl">
            <h2 className="text-2xl font-bold text-foreground">Create Task</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              Add task details, deadline, and assign it to a team.
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="e.g. Prepare sprint demo slides"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={taskFormData.description}
                  onChange={(e) =>
                    setTaskFormData({ ...taskFormData, description: e.target.value })
                  }
                  placeholder="Optional details about this task"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={taskFormData.status}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        status: e.target.value as "todo" | "in_progress" | "done" | "",
                      })
                    }
                  >
                    <option value="">Select status</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Priority</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={taskFormData.priority}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        priority: e.target.value as "low" | "medium" | "high" | "",
                      })
                    }
                  >
                    <option value="">Select priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Due Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={taskFormData.due_date}
                    onChange={(e) =>
                      setTaskFormData({ ...taskFormData, due_date: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Team</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={taskFormData.team_id}
                    onChange={(e) =>
                      setTaskFormData({ ...taskFormData, team_id: e.target.value })
                    }
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={BUTTON_SECONDARY}
                  onClick={() => setShowCreateTaskModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={BUTTON_PRIMARY}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateTeamModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-card text-card-foreground p-6 border border-border shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Create Team</h2>

            <form onSubmit={handleCreateTeam}>
              <div className="mb-4">
                <label className="block text-sm text-muted-foreground">Team Name</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-background p-2 text-foreground"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Product Team"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={BUTTON_SECONDARY}
                  onClick={() => {
                    setShowCreateTeamModal(false)
                    setNewTeamName("")
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeam}
                  className={BUTTON_PRIMARY}
                >
                  {isCreatingTeam ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCommentsModal && selectedTaskForComments && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card text-card-foreground p-6 border border-border shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Comments</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTaskForComments.title}
                </p>
              </div>
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => {
                  setShowCommentsModal(false)
                  setSelectedTaskForComments(null)
                  setComments([])
                  setNewComment("")
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateComment} className="mt-4 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="submit" className={BUTTON_PRIMARY} disabled={creatingComment}>
                {creatingComment ? "Posting..." : "Post"}
              </button>
            </form>

            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
              {commentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {comment.author_name || comment.author_email || comment.user_id}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatCommentDate(comment.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(comment.id)}
                        disabled={deletingCommentId === comment.id}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {deletingCommentId === comment.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
