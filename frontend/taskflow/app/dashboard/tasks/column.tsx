"use client"

import { Task } from "@/api/taskProvider"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AssigneeOption {
  member_id: string
  name: string
}

interface TableMeta {
  onDeleteTask?: (taskId: string) => void
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onOpenComments?: (task: Task) => void
  onLoadAssignees?: (teamId: string) => Promise<void>
  assigneesByTeam?: Record<string, AssigneeOption[]>
  assigneesLoadingByTeam?: Record<string, boolean>
}

export const columns: ColumnDef<Task>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const task = row.original
      const meta = table.options.meta as TableMeta
      const assignees = meta?.assigneesByTeam?.[task.team_id] || []
      const assigneesLoading = meta?.assigneesLoadingByTeam?.[task.team_id] || false

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(task.id)}>
              Copy task ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => meta?.onDeleteTask?.(task.id)}
              className="text-red-600"
            >
              Delete task
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => meta?.onOpenComments?.(task)}
            >
              View comments
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const newStatus =
                  task.status === "todo"
                    ? "in_progress"
                    : task.status === "in_progress"
                      ? "done"
                      : "todo"
                meta?.onUpdateTask?.(task.id, { status: newStatus })
              }}
            >
              Change status
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const newPriority =
                  task.priority === "low"
                    ? "medium"
                    : task.priority === "medium"
                      ? "high"
                      : "low"
                meta?.onUpdateTask?.(task.id, { priority: newPriority })
              }}
            >
              Change priority
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                onClick={() => void meta?.onLoadAssignees?.(task.team_id)}
                onPointerEnter={() => void meta?.onLoadAssignees?.(task.team_id)}
              >
                Assign to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() =>
                    meta?.onUpdateTask?.(task.id, {
                      assigned_to: null,
                      assigned_to_name: null,
                    })
                  }
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {assigneesLoading ? (
                  <DropdownMenuItem disabled>Loading members...</DropdownMenuItem>
                ) : assignees.length > 0 ? (
                  assignees.map((member) => (
                    <DropdownMenuItem
                      key={member.member_id}
                      onClick={() =>
                        meta?.onUpdateTask?.(task.id, {
                          assigned_to: member.member_id,
                          assigned_to_name: member.name,
                        })
                      }
                    >
                      {member.name}
                      {task.assigned_to === member.member_id ? " (current)" : ""}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No team members</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "-",
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Priority
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "team_name",
    header: "Team",
    cell: ({ row }) => row.original.team_name || row.original.team_id,
  },
  {
    accessorKey: "created_by_name",
    header: "Created By",
    cell: ({ row }) => row.original.created_by_name || row.original.created_by,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Created At
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "due_date",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Due Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => row.original.due_date || "-",
  },
  {
    accessorKey: "assigned_to",
    header: "Assigned To",
    cell: ({ row }) => row.original.assigned_to_name || row.original.assigned_to || "-",
  },
]
