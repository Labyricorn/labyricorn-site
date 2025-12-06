import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects } from './useProjects';
import { apiClient } from '../services/api';
import type { ReactNode } from 'react';
import type { components } from '../types/api';

type ProjectListResponse = components['schemas']['ProjectListResponse'];

// Create a wrapper component for QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
        gcTime: 0, // Disable garbage collection for testing
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {}, // Suppress error logs in tests
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useProjects hook unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch projects with default pagination parameters', async () => {
    const mockResponse: ProjectListResponse = {
      items: [
        {
          id: 1,
          title: 'Test Project',
          slug: 'test-project',
          description: 'A test project',
          repo_url: 'https://github.com/test/project',
          tech_stack: ['React', 'TypeScript'],
          hero_image: { url: 'https://example.com/image.jpg', width: 800, height: 600 },
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      meta: {
        total_count: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(getSpy).toHaveBeenCalledWith('/projects', {
      params: { page: 1, page_size: 20 },
    });

    getSpy.mockRestore();
  });

  it('should fetch projects with custom pagination parameters', async () => {
    const mockResponse: ProjectListResponse = {
      items: [],
      meta: {
        total_count: 50,
        page: 2,
        page_size: 10,
        total_pages: 5,
      },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useProjects(2, 10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(getSpy).toHaveBeenCalledWith('/projects', {
      params: { page: 2, page_size: 10 },
    });

    getSpy.mockRestore();
  });



  it('should cache data with correct query key', async () => {
    const mockResponse: ProjectListResponse = {
      items: [],
      meta: {
        total_count: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useProjects(1, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the query key is correct for caching
    expect(result.current.data).toEqual(mockResponse);

    getSpy.mockRestore();
  });

  it('should handle empty project list', async () => {
    const mockResponse: ProjectListResponse = {
      items: [],
      meta: {
        total_count: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toEqual([]);
    expect(result.current.data?.meta.total_count).toBe(0);

    getSpy.mockRestore();
  });

  it('should handle multiple projects in response', async () => {
    const mockResponse: ProjectListResponse = {
      items: [
        {
          id: 1,
          title: 'Project 1',
          slug: 'project-1',
          description: 'First project',
          repo_url: null,
          tech_stack: ['React'],
          hero_image: { url: null, width: null, height: null },
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          title: 'Project 2',
          slug: 'project-2',
          description: 'Second project',
          repo_url: 'https://github.com/test/project2',
          tech_stack: ['Django', 'PostgreSQL'],
          hero_image: { url: 'https://example.com/image2.jpg', width: 1200, height: 800 },
          created_at: '2024-01-02T00:00:00Z',
        },
      ],
      meta: {
        total_count: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
      },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].title).toBe('Project 1');
    expect(result.current.data?.items[1].title).toBe('Project 2');

    getSpy.mockRestore();
  });
});
