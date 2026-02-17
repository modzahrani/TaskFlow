import apiClient from '@/api/clientProvider';
import { ENDPOINTS } from '@/constants/endpoints';

// Types
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  team_id?: string | null;
  created_by: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at?: string;
  due_date?: string | null;
  created_by_name?: string | null;
  team_name?: string | null;
  assigned_to_name?: string | null;
}

export interface CreateTaskData {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  team_id?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigned_to?: string | null;
}

export interface GetTasksParams {
  limit?: number;
  offset?: number;
}

// Get all tasks for the authenticated user
export const getTasks = async (params?: GetTasksParams) => {
  const res = await apiClient.get(ENDPOINTS.TASKS.LIST, { params });
  return res;
};

// Get a single task by ID
export const getTask = async (taskId: string) => {
  const res = await apiClient.get(ENDPOINTS.TASKS.GET(taskId));
  return res;
};

// Create a new task
export const createTask = async (taskData: CreateTaskData) => {
  const res = await apiClient.post(ENDPOINTS.TASKS.CREATE, taskData);
  return res;
};

// Update an existing task
export const updateTask = async (taskId: string, taskData: UpdateTaskData) => {
  const res = await apiClient.put(ENDPOINTS.TASKS.UPDATE(taskId), taskData);
  return res;
};

// Delete a task
export const deleteTask = async (taskId: string) => {
  const res = await apiClient.delete(ENDPOINTS.TASKS.DELETE(taskId));
  return res;
};
