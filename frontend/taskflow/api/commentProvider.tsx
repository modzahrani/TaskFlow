import apiClient from "@/api/clientProvider"
import { ENDPOINTS } from "@/constants/endpoints"

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string | null
  author_name?: string | null
  author_email?: string | null
}

export interface CreateCommentData {
  content: string
}

export const getTaskComments = async (taskId: string) => {
  const res = await apiClient.get(ENDPOINTS.TASKS.COMMENTS.LIST(taskId))
  return res
}

export const createTaskComment = async (taskId: string, payload: CreateCommentData) => {
  const res = await apiClient.post(ENDPOINTS.TASKS.COMMENTS.CREATE(taskId), payload)
  return res
}

export const deleteTaskComment = async (commentId: string) => {
  const res = await apiClient.delete(ENDPOINTS.TASKS.COMMENTS.DELETE(commentId))
  return res
}
