import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ArchivedCards = components['schemas']['ArchivedCardsSchema'];

/**
 * Custom hook for fetching archived DONE cards with infinite scroll pagination
 * Uses TanStack Query's useInfiniteQuery for efficient pagination
 * 
 * @param projectSlug - URL-friendly project identifier
 * @returns Infinite query result with pages array, fetchNextPage function, and loading states
 */
export function useArchivedCards(projectSlug: string) {
  return useInfiniteQuery<ArchivedCards, Error>({
    queryKey: ['kanban-archived', projectSlug],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const response = await apiClient.get<ArchivedCards>(
          `/projects/${projectSlug}/kanban/archived`,
          { params: { offset: pageParam, limit: 50 } }
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
        throw new Error('Failed to fetch archived cards. Please try again.');
      }
    },
    initialPageParam: 0, // Start with offset 0
    getNextPageParam: (lastPage, pages) => {
      // If there are more cards, return the next offset
      if (lastPage.has_more) {
        return pages.length * 50;
      }
      // No more pages available
      return undefined;
    },
    enabled: !!projectSlug, // Only run query if slug is provided
    retry: 2, // Retry failed requests 2 times
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes (archived cards change less frequently)
  });
}
