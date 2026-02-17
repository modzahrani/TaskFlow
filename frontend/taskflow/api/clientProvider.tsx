import { API_BASE_URL } from '../constants/endpoints';
import axios from 'axios';

const SESSION_TOKEN_KEY = 'taskflow_session_token';
let inMemoryAccessToken: string | null = null;

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  inMemoryAccessToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export const setSessionAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (!isBrowser) return;

  if (token) {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      setSessionAccessToken(null);
      window.location.href = '/login';
    }
    
    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
