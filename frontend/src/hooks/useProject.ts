import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ProjectSchema = components['schemas']['ProjectSchema'];

/**
 * Custom hook for fetching a single project by slug
 * Uses TanStack Query for caching and automatic refetching
 * 
 * @param slug - URL-friendly project identifier
 * @returns Query result with project data, loading state, and error
 */
export function useProject(slug: string) {
  return useQuery<ProjectSchema, Error>({
    queryKey: ['project', slug],
    queryFn: async () => {
      try {
        const response = await apiClient.get<ProjectSchema>(`/projects/${slug}`);
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
        throw new Error('Failed to fetch project. Please try again.');
      }
    },
    enabled: !!slug, // Only run query if slug is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors
      if (error.response?.status === 404) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });
}
