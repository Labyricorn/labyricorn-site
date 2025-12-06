import axios, { AxiosResponse } from 'axios';
import type { paths, components } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Type helpers for API operations
export type ApiPaths = paths;
export type ApiComponents = components;

// Extract response types from operations
export type HealthCheckResponse = components['schemas']['LoginResponse']; // Placeholder - will be updated when health endpoint has schema
export type LoginRequest = components['schemas']['LoginRequest'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type UserResponse = components['schemas']['UserResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * Get CSRF token from cookie
 * Reads the csrftoken cookie set by Django
 */
export function getCsrfToken(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return null;
}

/**
 * Axios instance configured for Django backend communication
 * - Base URL from environment variable
 * - Credentials enabled for session cookies
 * - CSRF token automatically included in state-changing requests
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable session cookies and CSRF
});

/**
 * Request interceptor to add CSRF token to state-changing requests
 * CSRF token is required for POST, PUT, PATCH, DELETE requests
 */
apiClient.interceptors.request.use(
  (config) => {
    // Only add CSRF token for state-changing requests
    const stateMethods = ['post', 'put', 'patch', 'delete'];
    if (config.method && stateMethods.includes(config.method.toLowerCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor for error logging and transformation
 * Logs API errors to console and transforms them into user-friendly messages
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    // Transform error into user-friendly message for display
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const detail = error.response.data?.detail;
      
      if (detail) {
        error.message = detail;
      } else if (status >= 500) {
        error.message = 'Server error. Please try again later.';
      } else if (status >= 400) {
        error.message = 'Request failed. Please check your input.';
      }
    } else if (error.request) {
      // Request was made but no response received
      error.message = 'Unable to connect to server. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

/**
 * Initialize CSRF token by calling the /csrf endpoint
 * Should be called on application initialization
 */
export async function initializeCsrf(): Promise<void> {
  try {
    await apiClient.get('/csrf');
  } catch (error) {
    console.error('Failed to initialize CSRF token:', error);
    throw error;
  }
}

/**
 * Typed API helper functions using generated types
 */

export const api = {
  /**
   * Health check endpoint
   */
  health: async () => {
    const response = await apiClient.get<{ status: string; version: string }>('/health');
    return response.data;
  },

  /**
   * Authentication endpoints
   */
  auth: {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      return response.data;
    },

    logout: async (): Promise<void> => {
      await apiClient.post('/auth/logout');
    },

    me: async (): Promise<UserResponse> => {
      const response = await apiClient.get<UserResponse>('/auth/me');
      return response.data;
    },
  },
};
