import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { AppShell } from './components/layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppRoutes } from './App';

/**
 * Unit tests for AppShell component
 * Validates: Requirements 8.1, 8.3
 */
describe('AppShell Component', () => {
  it('should render navigation bar with Labyricorn title', () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    // Check that navigation contains the app name
    const appName = screen.getByText('Labyricorn');
    expect(appName).toBeInTheDocument();
    expect(appName).toHaveClass('text-purple-400');
  });

  it('should render children content', () => {
    const testContent = 'This is test content';
    render(
      <AppShell>
        <div>{testContent}</div>
      </AppShell>
    );

    // Check that children are rendered
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('should apply cyberpunk theme colors', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // Check for cyberpunk background color
    const mainContainer = container.querySelector('.bg-slate-950');
    expect(mainContainer).toBeInTheDocument();

    // Check for glassmorphism effect on nav
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('backdrop-blur-md');
    expect(nav).toHaveClass('bg-slate-900/80');
  });
});

/**
 * Unit tests for NotFoundPage component
 * Validates: Requirements 8.3
 */
describe('NotFoundPage Component', () => {
  it('should render 404 heading', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const heading = screen.getByText('404');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('text-purple-500');
  });

  it('should render "Page Not Found" message', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('should render descriptive error message', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/vanished into the digital void/i)).toBeInTheDocument();
  });

  it('should render "Return Home" link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const homeLink = screen.getByText('Return Home');
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('should render error code in cyberpunk style', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/ERROR_CODE: 0x404_NOT_FOUND/i)).toBeInTheDocument();
  });
});

/**
 * Feature: base-site-setup, Property 12: Route handling completeness
 * Validates: Requirements 15.3
 * 
 * For any URL path that is not defined in the React Router configuration,
 * the application should render the 404 NotFound page.
 */
describe('Property 12: Route handling completeness', () => {
  it('should render NotFoundPage for any undefined route', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    fc.assert(
      fc.property(
        // Generate random URL paths that are not defined routes
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
            fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
            fc.constant('-'),
            fc.constant('_')
          ),
          { minLength: 1, maxLength: 20 }
        ).map(chars => '/' + chars.join('')),
        (randomPath) => {
          // Skip defined routes
          if (randomPath === '/' || randomPath === '/login' || randomPath.startsWith('/projects/')) {
            return true;
          }

          // Render AppRoutes with MemoryRouter for testing
          const { container } = render(
            <QueryClientProvider client={queryClient}>
              <MemoryRouter initialEntries={[randomPath]}>
                <AppShell>
                  <AppRoutes />
                </AppShell>
              </MemoryRouter>
            </QueryClientProvider>
          );

          // Check that the 404 page is rendered
          const notFoundHeading = screen.queryByText('404');
          const pageNotFoundText = screen.queryByText('Page Not Found');

          // Both elements should be present for a 404 page
          expect(notFoundHeading).toBeInTheDocument();
          expect(pageNotFoundText).toBeInTheDocument();

          // Clean up
          container.remove();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
