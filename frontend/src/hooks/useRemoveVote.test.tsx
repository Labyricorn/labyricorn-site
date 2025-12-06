import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRemoveVote } from './useRemoveVote';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];
type VoteResponse = components['schemas']['VoteResponseSchema'];

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    delete: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
      mutations: {
        retry: false, // Disable retries in tests
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRemoveVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should remove vote from a card successfully', async () => {
    const mockResponse: VoteResponse = {
      id: 1,
      votes: 4,
      user_has_voted: false,
    };

    vi.mocked(apiClient.delete).mockResolvedValue({ data: mockResponse });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Set initial board data with a voted card
    const initialBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [{ 
        id: 1, 
        title: 'Test Card', 
        status: 'TODO', 
        votes: 5, 
        allow_voting: true, 
        order: 0, 
        user_has_voted: true, // User has already voted
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    queryClient.setQueryData(['kanban', 'test-project'], initialBoard);

    const { result } = renderHook(() => useRemoveVote('test-project'), {
      wrapper,
    });

    // Execute remove vote mutation
    result.current.mutate(1);

    // Wait for mutation to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.delete).toHaveBeenCalledWith('/kanban/cards/1/vote');
  });

  it('should handle 404 not voted errors', async () => {
    const error = {
      response: { 
        status: 404,
        data: { detail: 'User has not voted on this card' }
      },
    };
    vi.mocked(apiClient.delete).mockRejectedValue(error);

    const { result } = renderHook(() => useRemoveVote('test-project'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('You have not voted on this card.');
  });

  it('should handle 403 voting disabled errors', async () => {
    const error = {
      response: { 
        status: 403,
        data: { detail: 'Voting disabled' }
      },
    };
    vi.mocked(apiClient.delete).mockRejectedValue(error);

    const { result } = renderHook(() => useRemoveVote('test-project'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Voting is disabled for this card.');
  });

  it('should optimistically decrement vote count', async () => {
    const mockResponse: VoteResponse = {
      id: 1,
      votes: 4,
      user_has_voted: false,
    };

    vi.mocked(apiClient.delete).mockResolvedValue({ data: mockResponse });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Set initial board data with a voted card
    const initialBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [{ 
        id: 1, 
        title: 'Test Card', 
        status: 'TODO', 
        votes: 5, 
        allow_voting: true, 
        order: 0, 
        user_has_voted: true,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    queryClient.setQueryData(['kanban', 'test-project'], initialBoard);

    const { result } = renderHook(() => useRemoveVote('test-project'), {
      wrapper,
    });

    // Execute remove vote mutation
    result.current.mutate(1);

    // Wait for optimistic update
    await waitFor(() => {
      const board = queryClient.getQueryData<KanbanBoard>(['kanban', 'test-project']);
      return board?.todo_cards[0]?.votes === 4;
    });

    // Verify optimistic update
    const optimisticBoard = queryClient.getQueryData<KanbanBoard>(['kanban', 'test-project']);
    expect(optimisticBoard?.todo_cards[0]?.votes).toBe(4);
    expect(optimisticBoard?.todo_cards[0]?.user_has_voted).toBe(false);

    // Wait for mutation to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should revert optimistic update on error', async () => {
    const error = {
      response: { 
        status: 404,
        data: { detail: 'User has not voted on this card' }
      },
    };
    vi.mocked(apiClient.delete).mockRejectedValue(error);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Set initial board data with a voted card
    const initialBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [{ 
        id: 1, 
        title: 'Test Card', 
        status: 'TODO', 
        votes: 5, 
        allow_voting: true, 
        order: 0, 
        user_has_voted: true,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    queryClient.setQueryData(['kanban', 'test-project'], initialBoard);

    const { result } = renderHook(() => useRemoveVote('test-project'), {
      wrapper,
    });

    // Execute remove vote mutation
    result.current.mutate(1);

    // Wait for mutation to fail
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Verify the board was reverted to original state
    const revertedBoard = queryClient.getQueryData<KanbanBoard>(['kanban', 'test-project']);
    expect(revertedBoard?.todo_cards[0]?.votes).toBe(5);
    expect(revertedBoard?.todo_cards[0]?.user_has_voted).toBe(true);
  });
});
