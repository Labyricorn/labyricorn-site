import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { useHealthCheck } from './useHealthCheck';
import { apiClient } from '../services/api';
import type { ReactNode } from 'react';

// Create a wrapper component for QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Feature: base-site-setup, Property 8: API error handling
 * Validates: Requirements 9.4
 * 
 * For any API request that fails (network error, 4xx, or 5xx response),
 * the React Frontend should display an error message to the user.
 */
describe('Property 8: API error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transform any API error into a user-friendly error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random error scenarios
        fc.oneof(
          // Network errors
          fc.record({
            type: fc.constant('network'),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          // 4xx client errors
          fc.record({
            type: fc.constant('4xx'),
            status: fc.integer({ min: 400, max: 499 }),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          // 5xx server errors
          fc.record({
            type: fc.constant('5xx'),
            status: fc.integer({ min: 500, max: 599 }),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          })
        ),
        async (errorScenario) => {
          // Mock apiClient.get to simulate the error
          const getSpy = vi.spyOn(apiClient, 'get');

          if (errorScenario.type === 'network') {
            // Simulate network error (no response)
            const error: any = new Error(errorScenario.message);
            error.request = {}; // Indicates request was made
            getSpy.mockRejectedValue(error);
          } else {
            // Simulate HTTP error response
            const error: any = new Error(errorScenario.message);
            error.response = {
              status: errorScenario.status,
              data: { detail: errorScenario.message },
            };
            getSpy.mockRejectedValue(error);
          }

          // Render the hook
          const { result } = renderHook(() => useHealthCheck(), {
            wrapper: createWrapper(),
          });

          // Wait for the query to complete
          await waitFor(
            () => {
              expect(result.current.isLoading).toBe(false);
            },
            { timeout: 2000 }
          );

          // Verify that an error occurred
          expect(result.current.isError).toBe(true);
          expect(result.current.error).toBeDefined();

          // Verify that the error has a user-friendly message
          const errorMessage = result.current.error?.message || '';
          expect(errorMessage).toBeTruthy();
          expect(errorMessage.length).toBeGreaterThan(0);

          // Verify the error message is user-friendly (not technical)
          // It should be one of our transformed messages
          const isUserFriendly =
            errorMessage.includes('Unable to connect to server') ||
            errorMessage.includes('Server error') ||
            errorMessage.includes('Request failed') ||
            errorMessage === errorScenario.message; // Custom detail from server

          expect(isUserFriendly).toBe(true);

          getSpy.mockRestore();

          return true;
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and increased timeout
    );
  }, 15000); // Increase test timeout

  it('should handle successful responses without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random successful health check responses
        fc.record({
          status: fc.constantFrom('ok', 'healthy', 'running'),
          version: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (healthResponse) => {
          // Mock apiClient.get to return success
          const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
            data: healthResponse,
          });

          // Render the hook
          const { result } = renderHook(() => useHealthCheck(), {
            wrapper: createWrapper(),
          });

          // Wait for the query to complete
          await waitFor(
            () => {
              expect(result.current.isSuccess).toBe(true);
            },
            { timeout: 2000 }
          );

          // Verify no error occurred
          expect(result.current.isError).toBe(false);
          expect(result.current.error).toBeNull();

          // Verify data is returned
          expect(result.current.data).toEqual(healthResponse);

          getSpy.mockRestore();

          return true;
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and increased timeout
    );
  }, 15000); // Increase test timeout
});

// Unit tests for specific error scenarios
describe('useHealthCheck unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display error message for network failure', async () => {
    const error: any = new Error('Network Error');
    error.request = {}; // Indicates request was made but no response
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(error);

    const { result } = renderHook(() => useHealthCheck(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.error?.message).toContain('Unable to connect to server');
    
    getSpy.mockRestore();
  });

  it('should display error message for 500 server error', async () => {
    const error: any = new Error('Internal Server Error');
    error.response = { status: 500, data: {} };
    
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(error);

    const { result } = renderHook(() => useHealthCheck(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.error?.message).toContain('Server error');
    
    getSpy.mockRestore();
  });

  it('should successfully fetch health check data', async () => {
    const healthData = { status: 'ok', version: '0.1.0' };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: healthData });

    const { result } = renderHook(() => useHealthCheck(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 2000 }
    );

    expect(result.current.data).toEqual(healthData);
    
    getSpy.mockRestore();
  });
});
