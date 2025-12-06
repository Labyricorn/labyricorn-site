import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LoginRequest, type LoginResponse, type UserResponse } from '../services/api';

// Extended user response with additional fields from Django
interface CurrentUserResponse extends UserResponse {
  is_superuser?: boolean;
  is_staff?: boolean;
}

/**
 * Custom hook for authentication operations
 * Provides login, logout, and getCurrentUser functionality
 * Includes error handling with user-friendly messages
 */
export function useAuth() {
  const queryClient = useQueryClient();

  /**
   * Login mutation
   * Authenticates user with username and password
   */
  const loginMutation = useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: async (credentials: LoginRequest) => {
      try {
        return await api.auth.login(credentials);
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.status === 401) {
          throw new Error('Invalid username or password');
        }
        if (error.response?.status === 403) {
          throw new Error('Access forbidden. Please check your credentials.');
        }
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Login failed. Please try again.');
      }
    },
    onSuccess: () => {
      // Invalidate current user query to refetch after login
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  /**
   * Logout mutation
   * Destroys the current session
   */
  const logoutMutation = useMutation<void, Error>({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Logout failed. Please try again.');
      }
    },
    onSuccess: () => {
      // Clear current user query after logout
      queryClient.setQueryData(['currentUser'], null);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  /**
   * Get current user query
   * Fetches information about the currently authenticated user
   */
  const currentUserQuery = useQuery<CurrentUserResponse | null, Error>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const data = await api.auth.me();
        return data as CurrentUserResponse;
      } catch (error: any) {
        // If not authenticated, return null instead of throwing
        if (error.response?.status === 401 || error.response?.status === 403) {
          return null;
        }
        // For other errors, throw user-friendly message
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Failed to fetch user information');
      }
    },
    retry: false, // Don't retry if user is not authenticated
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  return {
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    logoutError: logoutMutation.error,
    
    currentUser: currentUserQuery.data,
    isLoadingUser: currentUserQuery.isLoading,
    userError: currentUserQuery.error,
    
    isAuthenticated: !!currentUserQuery.data,
  };
}
