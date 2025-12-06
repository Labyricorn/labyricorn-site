import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ProjectListResponse = components['schemas']['ProjectListResponse'];

/**
 * Custom hook for fetching paginated projects list
 * Uses TanStack Query for caching and automatic refetching
 * 
 * @param page - Page number (default: 1)
 * @param pageSize - Number of items per page (default: 20)
 * @returns Query result with projects data, loading state, and error
 */
export function useProjects(page: number = 1, pageSize: number = 20) {
  return useQuery<ProjectListResponse, Error>({
    queryKey: ['projects', page, pageSize],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ProjectListResponse>('/projects', {
          params: { page, page_size: pageSize }
        });
        return response.data;
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.status === 500) {
          throw new Error('Server error. Please try again later.');
        }
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Failed to fetch projects. Please try again.');
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    placeholderData: (previousData) => previousData, // Keep previous page data while loading next (replaces keepPreviousData)
    retry: 2, // Retry failed requests 2 times
  });
}
