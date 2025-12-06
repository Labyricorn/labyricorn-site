import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { useAuth } from './useAuth';
import { apiClient } from '../services/api';
import type { ReactNode } from 'react';

// Create a wrapper component for QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
      },
      mutations: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Feature: base-site-setup, Property 8: API error handling (useAuth)
 * Validates: Requirements 9.4
 * 
 * For any API request that fails (network error, 4xx, or 5xx response),
 * the React Frontend should display an error message to the user.
 */
describe('Property 8: API error handling for useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transform any login error into a user-friendly error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random credentials
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }),
          password: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        // Generate random error scenarios
        fc.oneof(
          // 401 Unauthorized
          fc.record({
            type: fc.constant('401'),
            status: fc.constant(401),
          }),
          // 403 Forbidden
          fc.record({
            type: fc.constant('403'),
            status: fc.constant(403),
          }),
          // Network error
          fc.record({
            type: fc.constant('network'),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          // Other errors with detail (excluding 401 and 403)
          fc.record({
            type: fc.constant('other'),
            status: fc.integer({ min: 400, max: 599 }).filter(s => s !== 401 && s !== 403),
            detail: fc.string({ minLength: 1, maxLength: 50 }),
          })
        ),
        async (credentials, errorScenario) => {
          // Mock apiClient.post to simulate the error
          const postSpy = vi.spyOn(apiClient, 'post');

          if (errorScenario.type === 'network') {
            postSpy.mockRejectedValue(new Error(errorScenario.message));
          } else if (errorScenario.type === '401') {
            const error: any = new Error('Unauthorized');
            error.response = { status: 401, data: {} };
            postSpy.mockRejectedValue(error);
          } else if (errorScenario.type === '403') {
            const error: any = new Error('Forbidden');
            error.response = { status: 403, data: {} };
            postSpy.mockRejectedValue(error);
          } else {
            const error: any = new Error('Error');
            error.response = {
              status: errorScenario.status,
              data: { detail: errorScenario.detail },
            };
            postSpy.mockRejectedValue(error);
          }

          // Render the hook
          const { result } = renderHook(() => useAuth(), {
            wrapper: createWrapper(),
          });

          // Attempt login
          result.current.login(credentials);

          // Wait for the mutation to complete
          await waitFor(() => {
            expect(result.current.isLoggingIn).toBe(false);
          });

          // Verify that an error occurred
          expect(result.current.loginError).toBeDefined();

          // Verify that the error has a user-friendly message
          const errorMessage = result.current.loginError?.message || '';
          expect(errorMessage).toBeTruthy();
          expect(errorMessage.length).toBeGreaterThan(0);

          // Verify the error message is user-friendly based on error type
          if (errorScenario.type === '401') {
            expect(errorMessage).toContain('Invalid username or password');
          } else if (errorScenario.type === '403') {
            expect(errorMessage).toContain('Access forbidden');
          } else if (errorScenario.type === 'other') {
            expect(errorMessage).toContain(errorScenario.detail);
          } else {
            expect(errorMessage).toContain('Login failed');
          }

          postSpy.mockRestore();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should transform any logout error into a user-friendly error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random error scenarios
        fc.oneof(
          // Network error
          fc.record({
            type: fc.constant('network'),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          // Server error with detail
          fc.record({
            type: fc.constant('server'),
            status: fc.integer({ min: 400, max: 599 }),
            detail: fc.string({ minLength: 1, maxLength: 50 }),
          })
        ),
        async (errorScenario) => {
          // Mock apiClient.post to simulate the error
          const postSpy = vi.spyOn(apiClient, 'post');

          if (errorScenario.type === 'network') {
            postSpy.mockRejectedValue(new Error(errorScenario.message));
          } else {
            const error: any = new Error('Error');
            error.response = {
              status: errorScenario.status,
              data: { detail: errorScenario.detail },
            };
            postSpy.mockRejectedValue(error);
          }

          // Render the hook
          const { result } = renderHook(() => useAuth(), {
            wrapper: createWrapper(),
          });

          // Attempt logout
          result.current.logout();

          // Wait for the mutation to complete
          await waitFor(() => {
            expect(result.current.isLoggingOut).toBe(false);
          });

          // Verify that an error occurred
          expect(result.current.logoutError).toBeDefined();

          // Verify that the error has a user-friendly message
          const errorMessage = result.current.logoutError?.message || '';
          expect(errorMessage).toBeTruthy();
          expect(errorMessage.length).toBeGreaterThan(0);

          // Verify the error message is user-friendly
          if (errorScenario.type === 'server') {
            expect(errorMessage).toContain(errorScenario.detail);
          } else {
            expect(errorMessage).toContain('Logout failed');
          }

          postSpy.mockRestore();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle successful login without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random credentials
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }),
          password: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        // Generate random user response
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          username: fc.string({ minLength: 1, maxLength: 20 }),
          email: fc.emailAddress(),
        }),
        async (credentials, userResponse) => {
          // Mock apiClient.post to return success
          const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
            data: userResponse,
          });

          // Render the hook
          const { result } = renderHook(() => useAuth(), {
            wrapper: createWrapper(),
          });

          // Attempt login
          result.current.login(credentials);

          // Wait for the mutation to complete
          await waitFor(() => {
            expect(result.current.isLoggingIn).toBe(false);
          });

          // Verify no error occurred
          expect(result.current.loginError).toBeNull();

          postSpy.mockRestore();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for specific scenarios
describe('useAuth unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display "Invalid username or password" for 401 error', async () => {
    const error: any = new Error('Unauthorized');
    error.response = { status: 401, data: {} };
    
    const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    result.current.login({ username: 'test', password: 'test' });

    await waitFor(() => {
      expect(result.current.loginError).toBeDefined();
    });

    expect(result.current.loginError?.message).toBe('Invalid username or password');
    
    postSpy.mockRestore();
  });

  it('should display "Access forbidden" for 403 error', async () => {
    const error: any = new Error('Forbidden');
    error.response = { status: 403, data: {} };
    
    const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    result.current.login({ username: 'test', password: 'test' });

    await waitFor(() => {
      expect(result.current.loginError).toBeDefined();
    });

    expect(result.current.loginError?.message).toBe('Access forbidden. Please check your credentials.');
    
    postSpy.mockRestore();
  });

  it('should display custom error detail when provided', async () => {
    const customDetail = 'Account is locked';
    const error: any = new Error('Error');
    error.response = { status: 400, data: { detail: customDetail } };
    
    const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    result.current.login({ username: 'test', password: 'test' });

    await waitFor(() => {
      expect(result.current.loginError).toBeDefined();
    });

    expect(result.current.loginError?.message).toBe(customDetail);
    
    postSpy.mockRestore();
  });

  it('should successfully login and return user data', async () => {
    const userData = { id: 1, username: 'testuser', email: 'test@example.com' };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: userData });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    result.current.login({ username: 'test', password: 'test' });

    await waitFor(() => {
      expect(result.current.isLoggingIn).toBe(false);
    });

    expect(result.current.loginError).toBeNull();
    
    postSpy.mockRestore();
  });

  it('should return null for unauthenticated user without throwing error', async () => {
    const error: any = new Error('Unauthorized');
    error.response = { status: 401, data: {} };
    
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingUser).toBe(false);
    });

    expect(result.current.currentUser).toBeNull();
    expect(result.current.userError).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    
    getSpy.mockRestore();
  });
});
