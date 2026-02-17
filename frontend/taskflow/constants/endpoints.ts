export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/login",        
    REGISTER: "/register",  
    CHECK_EMAIL: "/check-email",
    LOGOUT: "/logout",      
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",
    RESEND_CONFIRMATION: "/resend-confirmation",
  },
  TASKS: {
    CREATE: "/tasks",
    LIST: "/tasks",
    GET: (taskId: string) => `/tasks/${taskId}`,
    UPDATE: (taskId: string) => `/tasks/${taskId}`,
    DELETE: (taskId: string) => `/tasks/${taskId}`,
    COMMENTS: {
      LIST: (taskId: string) => `/tasks/${taskId}/comments`,
      CREATE: (taskId: string) => `/tasks/${taskId}/comments`,
      DELETE: (commentId: string) => `/comments/${commentId}`,
    },
  },
  TEAMS: {
    CREATE: "/teams",
    LIST: "/teams",
    GET: (teamId: string) => `/teams/${teamId}`,
    UPDATE: (teamId: string) => `/teams/${teamId}`,
    DELETE: (teamId: string) => `/teams/${teamId}`,
    MEMBERS: {
      LIST: (teamId: string) => `/teams/${teamId}/members`,
      ADD: (teamId: string) => `/teams/${teamId}/members`,
      REMOVE: (teamId: string, memberId: string) => 
        `/teams/${teamId}/members/${memberId}`,
    },
    INVITES: {
      MY_PENDING: "/users/me/team-invites",
      ACCEPT: (inviteId: string) => `/users/me/team-invites/${inviteId}/accept`,
      DECLINE: (inviteId: string) => `/users/me/team-invites/${inviteId}/decline`,
    },
  },
  USERS: {
    ME: "/users/me",
    UPDATE: "/users/me",
  },
};
