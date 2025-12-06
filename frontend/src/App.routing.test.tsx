import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { AppRoutes } from './App';

// Mock the API client
vi.mock('./services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

/**
 * Routing tests for the application
 * Validates: Requirements 15.1, 15.2, 15.3
 */
describe('Application Routing', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderWithRouter = (initialRoute: string) => {
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

  it('should render HomePage at root path', () => {
    renderWithRouter('/');
    
    // HomePage should render with the welcome message
    expect(screen.getByText('Welcome to Labyricorn')).toBeInTheDocument();
  });

  it('should render LoginPage at /login path', () => {
    renderWithRouter('/login');
    
    // LoginPage should render with login form
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should render ProjectDetailPage at /projects/:slug path', async () => {
    renderWithRouter('/projects/test-project');
    
    // ProjectDetailPage should render (initially with loading state)
    await waitFor(() => {
      // Check for loading skeleton or error state (since API is mocked)
      const loadingOrError = document.querySelector('.animate-pulse') || screen.queryByText('404');
      expect(loadingOrError).toBeTruthy();
    });
  });

  it('should render NotFoundPage for undefined routes', () => {
    renderWithRouter('/this-route-does-not-exist');
    
    // NotFoundPage should render
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('should wrap all routes with AppShell', () => {
    const { container } = renderWithRouter('/');
    
    // AppShell should be present (check for nav with Labyricorn title)
    expect(screen.getByText('Labyricorn')).toBeInTheDocument();
    
    // Check for AppShell's characteristic classes
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('backdrop-blur-md');
  });
});
