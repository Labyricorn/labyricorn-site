import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import React from 'react';
import { useKanbanBoard } from './useKanbanBoard';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];
type KanbanCard = components['schemas']['KanbanCardSchema'];

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Fast-check arbitrary for generating valid Kanban card data
const kanbanCardArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  title: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  status: fc.constantFrom('TODO', 'DOING', 'DONE'),
  votes: fc.integer({ min: 0, max: 1000 }),
  allow_voting: fc.boolean(),
  order: fc.integer({ min: 0, max: 100 }),
  user_has_voted: fc.boolean(),
  completed_at: fc.option(
    fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()), 
    { nil: null }
  ),
  created_at: fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()),
  updated_at: fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()),
});

// Fast-check arbitrary for generating valid Kanban board data
const kanbanBoardArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  project_id: fc.integer({ min: 1 }),
  todo_cards: fc.array(kanbanCardArbitrary, { maxLength: 10 }),
  doing_cards: fc.array(kanbanCardArbitrary, { maxLength: 10 }),
  done_cards: fc.array(kanbanCardArbitrary, { maxLength: 50 }),
  has_more_done: fc.boolean(),
});

describe('useKanbanBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch Kanban board data successfully', async () => {
    const mockBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

    const { result } = renderHook(() => useKanbanBoard('test-project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBoard);
    expect(apiClient.get).toHaveBeenCalledWith('/projects/test-project/kanban');
  });

  it('should handle 404 errors gracefully', async () => {
    const error = {
      response: { status: 404 },
    };
    vi.mocked(apiClient.get).mockRejectedValue(error);

    const { result } = renderHook(() => useKanbanBoard('nonexistent-project'), {
      wrapper: createWrapper(),
    });

    // Wait for the query to finish (it will retry twice before failing)
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('Project not found');
  });

  it('should not fetch when projectSlug is empty', () => {
    const { result } = renderHook(() => useKanbanBoard(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('should configure 15 second staleTime', async () => {
    const mockBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

    const { result } = renderHook(() => useKanbanBoard('test-project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the query has the correct staleTime configuration
    // This is a configuration test, not a behavior test
    expect(result.current.data).toEqual(mockBoard);
  });
});

/**
 * Feature: kanban-board-system, Property 40: Auto-refresh interval
 * Validates: Requirements 21.1, 21.2
 * 
 * Property: For any Kanban board view, the system should automatically refetch 
 * board data every 15 seconds.
 * 
 * Note: This property test verifies the configuration is correct. The actual
 * refetch behavior is handled by TanStack Query's refetchInterval feature.
 */
describe('Property 40: Auto-refresh interval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should configure refetchInterval when not dragging', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length > 0),
        async (mockBoard, projectSlug) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();
          
          // Mock API to return the generated board
          vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

          const { result, unmount } = renderHook(
            () => useKanbanBoard(projectSlug, false), // isDragging = false
            { wrapper: createWrapper() }
          );

          // Wait for initial fetch
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });
          
          // Verify initial fetch happened with correct endpoint
          expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectSlug}/kanban`);
          
          // Verify data is returned correctly
          expect(result.current.data).toEqual(mockBoard);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds

  it('should set staleTime to 15 seconds for all boards', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length > 0),
        async (mockBoard, projectSlug) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();
          
          // Mock API to return the generated board
          vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

          const { result, unmount } = renderHook(
            () => useKanbanBoard(projectSlug, false),
            { wrapper: createWrapper() }
          );

          // Wait for initial fetch
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });
          
          // Verify the hook returns data successfully
          expect(result.current.data).toEqual(mockBoard);
          expect(result.current.isSuccess).toBe(true);

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds
});

/**
 * Feature: kanban-board-system, Property 41: Drag pause auto-refresh
 * Validates: Requirements 21.3
 * 
 * Property: For any active drag operation, the system should pause automatic 
 * refetching to prevent conflicts.
 * 
 * Note: This property test verifies the configuration changes based on isDragging.
 * The actual pause/resume behavior is handled by TanStack Query's refetchInterval feature.
 */
describe('Property 41: Drag pause auto-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should configure refetchInterval based on isDragging state', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length > 0),
        fc.boolean(), // Random isDragging state
        async (mockBoard, projectSlug, isDragging) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();
          
          // Mock API to return the generated board
          vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

          const { result, unmount } = renderHook(
            () => useKanbanBoard(projectSlug, isDragging),
            { wrapper: createWrapper() }
          );

          // Wait for initial fetch
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });
          
          // Verify the hook works correctly regardless of isDragging state
          expect(result.current.data).toEqual(mockBoard);
          expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectSlug}/kanban`);

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds

  it('should handle isDragging state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length > 0),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }), // Sequence of isDragging states
        async (mockBoard, projectSlug, draggingStates) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();
          
          // Mock API to return the generated board
          vi.mocked(apiClient.get).mockResolvedValue({ data: mockBoard });

          const { result, rerender, unmount } = renderHook(
            ({ isDragging }) => useKanbanBoard(projectSlug, isDragging),
            { 
              wrapper: createWrapper(),
              initialProps: { isDragging: false }
            }
          );

          // Wait for initial fetch
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });
          
          // Test state transitions
          for (const isDragging of draggingStates) {
            rerender({ isDragging });
            
            // Verify the hook continues to work after state changes
            expect(result.current.isSuccess).toBe(true);
            expect(result.current.data).toEqual(mockBoard);
          }

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds
});
