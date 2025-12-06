import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface HealthCheckResponse {
  status: string;
  version: string;
}

/**
 * Custom hook for fetching health check status from the API
 * Uses TanStack Query for caching and automatic refetching
 * 
 * @returns Query result with health check data, loading state, and error
 */
export function useHealthCheck() {
  return useQuery<HealthCheckResponse, Error>({
    queryKey: ['health'],
    queryFn: async () => {
      return await api.health();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
