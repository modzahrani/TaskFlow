import apiClient from '@/api/clientProvider';
import { ENDPOINTS } from '@/constants/endpoints';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  new_password: string;
  token: string;
}

export interface UpdateProfileData {
  name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// ==================== AUTH OPERATIONS ====================

// Register a new user
export const register = async (userData: RegisterData) => {
  const res = await apiClient.post(ENDPOINTS.AUTH.REGISTER, userData);
  return res;
};

// Login user
export const login = async (credentials: LoginData) => {
  const res = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);
  return res;
};

// Logout user
export const logout = async () => {
  const res = await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
  return res;
};

export const forgotPassword = async (payload: ForgotPasswordData) => {
  const res = await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, payload);
  return res;
};

export const resetPassword = async (payload: ResetPasswordData) => {
  const res = await apiClient.post(
    ENDPOINTS.AUTH.RESET_PASSWORD,
    { new_password: payload.new_password },
    {
      headers: {
        Authorization: `Bearer ${payload.token}`,
      },
    }
  );
  return res;
};

export const resendConfirmation = async (payload: ForgotPasswordData) => {
  const res = await apiClient.post(ENDPOINTS.AUTH.RESEND_CONFIRMATION, payload);
  return res;
};

// ==================== USER OPERATIONS ====================

// Get current user profile
export const getCurrentUser = async () => {
  const res = await apiClient.get(ENDPOINTS.USERS.ME);
  return res;
};

// Update user profile
export const updateProfile = async (profileData: UpdateProfileData) => {
  const res = await apiClient.put(ENDPOINTS.USERS.UPDATE, profileData);
  return res;
};
