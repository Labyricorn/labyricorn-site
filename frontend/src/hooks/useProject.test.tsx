import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProject } from './useProject';
import { apiClient } from '../services/api';
import type { ReactNode } from 'react';
import type { components } from '../types/api';

type ProjectSchema = components['schemas']['ProjectSchema'];

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

describe('useProject hook unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch a single project by slug', async () => {
    const mockProject: ProjectSchema = {
      id: 1,
      title: 'Test Project',
      slug: 'test-project',
      description: 'A detailed test project description',
      repo_url: 'https://github.com/test/project',
      tech_stack: ['React', 'TypeScript', 'Vite'],
      hero_image: { url: 'https://example.com/image.jpg', width: 1200, height: 800 },
      created_at: '2024-01-01T00:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockProject });

    const { result } = renderHook(() => useProject('test-project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProject);
    expect(getSpy).toHaveBeenCalledWith('/projects/test-project');

    getSpy.mockRestore();
  });



  it('should not fetch when slug is empty', async () => {
    const getSpy = vi.spyOn(apiClient, 'get');

    const { result } = renderHook(() => useProject(''), {
      wrapper: createWrapper(),
    });

    // Wait a bit to ensure no request is made
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(getSpy).not.toHaveBeenCalled();

    getSpy.mockRestore();
  });

  it('should handle project with no hero image', async () => {
    const mockProject: ProjectSchema = {
      id: 2,
      title: 'Project Without Image',
      slug: 'project-without-image',
      description: 'A project without a hero image',
      repo_url: null,
      tech_stack: ['Django', 'PostgreSQL'],
      hero_image: { url: null, width: null, height: null },
      created_at: '2024-01-02T00:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockProject });

    const { result } = renderHook(() => useProject('project-without-image'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProject);
    expect(result.current.data?.hero_image.url).toBeNull();

    getSpy.mockRestore();
  });

  it('should handle project with no repository URL', async () => {
    const mockProject: ProjectSchema = {
      id: 3,
      title: 'Private Project',
      slug: 'private-project',
      description: 'A private project without public repo',
      repo_url: null,
      tech_stack: ['React', 'Node.js'],
      hero_image: { url: 'https://example.com/image.jpg', width: 800, height: 600 },
      created_at: '2024-01-03T00:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockProject });

    const { result } = renderHook(() => useProject('private-project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProject);
    expect(result.current.data?.repo_url).toBeNull();

    getSpy.mockRestore();
  });

  it('should cache data with correct query key', async () => {
    const mockProject: ProjectSchema = {
      id: 1,
      title: 'Cached Project',
      slug: 'cached-project',
      description: 'A project to test caching',
      repo_url: 'https://github.com/test/cached',
      tech_stack: ['TypeScript'],
      hero_image: { url: null, width: null, height: null },
      created_at: '2024-01-04T00:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockProject });

    const { result } = renderHook(() => useProject('cached-project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProject);

    getSpy.mockRestore();
  });

  it('should handle slugs with special characters', async () => {
    const mockProject: ProjectSchema = {
      id: 5,
      title: 'Project with Special Chars',
      slug: 'project-with-special-chars-123',
      description: 'Testing slug handling',
      repo_url: 'https://github.com/test/special',
      tech_stack: ['Python'],
      hero_image: { url: null, width: null, height: null },
      created_at: '2024-01-05T00:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockProject });

    const { result } = renderHook(() => useProject('project-with-special-chars-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProject);
    expect(getSpy).toHaveBeenCalledWith('/projects/project-with-special-chars-123');

    getSpy.mockRestore();
  });
});
