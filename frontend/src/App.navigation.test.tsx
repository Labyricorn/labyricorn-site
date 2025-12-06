import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { AppRoutes } from './App';
import { apiClient } from './services/api';

// Mock the API client
vi.mock('./services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

/**
 * Navigation integration tests
 * Validates: Requirements 15.1, 15.2, 15.3
 * 
 * Tests navigation from HomePage to ProjectDetailPage
 */
describe('Navigation Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderApp = (initialRoute = '/') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should navigate from HomePage to ProjectDetailPage when clicking a project card', async () => {
    const user = userEvent.setup();

    // Mock the projects list API call
    const mockProjects = {
      items: [
        {
          id: 1,
          title: 'Test Project',
          slug: 'test-project',
          description: 'A test project description',
          repo_url: 'https://github.com/test/repo',
          tech_stack: ['React', 'TypeScript'],
          hero_image: {
            url: 'https://example.com/image.jpg',
            width: 800,
            height: 600,
          },
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

    (apiClient.get as any).mockResolvedValueOnce({ data: mockProjects });

    // Render the app at the home page
    renderApp('/');

    // Wait for the project to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Mock the project detail API call
    (apiClient.get as any).mockResolvedValueOnce({
      data: mockProjects.items[0],
    });

    // Click on the project card
    const projectCard = screen.getByText('Test Project').closest('[role="button"]');
    expect(projectCard).toBeInTheDocument();
    
    await user.click(projectCard!);

    // Wait for navigation and project detail to load
    await waitFor(() => {
      // The project detail page should show the full description
      expect(screen.getByText('A test project description')).toBeInTheDocument();
    });
  });

  it('should show 404 page when navigating to invalid project slug', async () => {
    // Mock API to return 404 error
    (apiClient.get as any).mockRejectedValueOnce({
      response: {
        status: 404,
        data: { detail: 'Project not found' },
      },
    });

    // Render the app at an invalid project detail page
    renderApp('/projects/non-existent-project');

    // Wait for the 404 page to render
    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Project Not Found')).toBeInTheDocument();
    });
  });

  it('should maintain AppShell across all routes', async () => {
    const { container } = renderApp('/');

    // AppShell should be present on home page
    expect(screen.getByText('Labyricorn')).toBeInTheDocument();
    
    // Navigate to login page
    renderApp('/login');
    
    // AppShell should still be present
    expect(screen.getByText('Labyricorn')).toBeInTheDocument();
    
    // Check for AppShell's nav element
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('backdrop-blur-md');
  });
});
