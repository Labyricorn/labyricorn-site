import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMoveCard } from './useMoveCard';
import { apiClient } from '../services/api';

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}));

describe('useMoveCard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should successfully move a card', async () => {
    const mockCard = {
      id: 1,
      title: 'Test Card',
      status: 'DOING',
      votes: 5,
      allow_voting: true,
      order: 2,
      user_has_voted: false,
      completed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: mockCard,
    });

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'DOING',
      order: 2,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith('/kanban/cards/1/move', {
      status: 'DOING',
      order: 2,
    });
    expect(result.current.data).toEqual(mockCard);
  });

  it('should handle validation errors (400)', async () => {
    const errorResponse = {
      response: {
        status: 400,
        data: { detail: 'Invalid status. Must be one of: TODO, DOING, DONE' },
      },
    };

    vi.mocked(apiClient.patch).mockRejectedValueOnce(errorResponse);

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'INVALID',
      order: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      'Invalid status. Must be one of: TODO, DOING, DONE'
    );
  });

  it('should handle authentication errors (401)', async () => {
    const errorResponse = {
      response: {
        status: 401,
        data: { detail: 'Authentication required' },
      },
    };

    vi.mocked(apiClient.patch).mockRejectedValueOnce(errorResponse);

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'TODO',
      order: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('You must be logged in to move cards.');
  });

  it('should handle authorization errors (403)', async () => {
    const errorResponse = {
      response: {
        status: 403,
        data: { detail: 'Admin access required' },
      },
    };

    vi.mocked(apiClient.patch).mockRejectedValueOnce(errorResponse);

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'TODO',
      order: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      'You do not have permission to move cards.'
    );
  });

  it('should handle not found errors (404)', async () => {
    const errorResponse = {
      response: {
        status: 404,
        data: { detail: 'Card not found' },
      },
    };

    vi.mocked(apiClient.patch).mockRejectedValueOnce(errorResponse);

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 999,
      status: 'TODO',
      order: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Card not found.');
  });

  it('should handle generic errors', async () => {
    const errorResponse = {
      response: {
        status: 500,
        data: {},
      },
    };

    vi.mocked(apiClient.patch).mockRejectedValueOnce(errorResponse);

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'TODO',
      order: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to move card. Please try again.');
  });

  it('should invalidate kanban query on success', async () => {
    const mockCard = {
      id: 1,
      title: 'Test Card',
      status: 'DONE',
      votes: 5,
      allow_voting: true,
      order: 0,
      user_has_voted: false,
      completed_at: '2024-01-01T12:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
    };

    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: mockCard,
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'DONE',
      order: 0,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['kanban', 'test-project'],
    });
  });

  it('should send correct request body format', async () => {
    const mockCard = {
      id: 1,
      title: 'Test Card',
      status: 'TODO',
      votes: 0,
      allow_voting: true,
      order: 5,
      user_has_voted: false,
      completed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: mockCard,
    });

    const { result } = renderHook(() => useMoveCard('test-project'), { wrapper });

    result.current.mutate({
      cardId: 1,
      status: 'TODO',
      order: 5,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith('/kanban/cards/1/move', {
      status: 'TODO',
      order: 5,
    });
  });
});
