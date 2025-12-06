import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];

/**
 * Custom hook for fetching a project's Kanban board with auto-refresh
 * Uses TanStack Query for caching and automatic refetching
 * 
 * @param projectSlug - URL-friendly project identifier
 * @param isDragging - Whether a card is currently being dragged (pauses auto-refresh)
 * @returns Query result with board data, loading state, and error
 */
export function useKanbanBoard(projectSlug: string, isDragging: boolean = false) {
  return useQuery<KanbanBoard, Error>({
    queryKey: ['kanban', projectSlug],
    queryFn: async () => {
      try {
        const response = await apiClient.get<KanbanBoard>(
          `/projects/${projectSlug}/kanban`
        );
        return response.data;
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.status === 404) {
          throw new Error('Project not found');
        }
        if (error.response?.status === 500) {
          throw new Error('Server error. Please try again later.');
        }
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Failed to fetch Kanban board. Please try again.');
      }
    },
    enabled: !!projectSlug, // Only run query if slug is provided
    staleTime: 15 * 1000, // Consider data fresh for 15 seconds
    refetchInterval: isDragging ? false : 15 * 1000, // Auto-refresh every 15s unless dragging
    refetchIntervalInBackground: false, // Don't refetch when tab is not visible
    retry: 2, // Retry failed requests 2 times
  });
}
