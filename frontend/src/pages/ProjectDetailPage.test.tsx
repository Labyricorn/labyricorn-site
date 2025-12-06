import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { ProjectDetailPage } from './ProjectDetailPage';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ProjectSchema = components['schemas']['ProjectSchema'];

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

/**
 * Helper function to render ProjectDetailPage with all required providers
 */
function renderProjectDetailPage(slug: string) {
  // Create a new QueryClient for each test to avoid caching issues
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${slug}`]}>
        <Routes>
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...result, queryClient };
}

/**
 * Fast-check arbitrary for generating valid project data
 */
const projectArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  // Title must be non-empty and not just whitespace (Requirements 6.1)
  title: fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 50 })
    .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
    .filter(s => s.length > 0),
  // Description must be non-empty (Requirements 6.2)
  description: fc.string({ minLength: 1, maxLength: 5000 })
    .filter(s => s.trim().length > 0),
  repo_url: fc.option(fc.webUrl(), { nil: null }),
  tech_stack: fc.array(
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), 
    { maxLength: 10 }
  ),
  hero_image: fc.record({
    url: fc.option(fc.webUrl(), { nil: null }),
    width: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: null }),
    height: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: null }),
  }),
  created_at: fc.date().map(d => d.toISOString()),
});

describe('ProjectDetailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Unit tests for basic rendering
   */
  describe('Basic Rendering', () => {
    it('should render loading state initially', () => {
      vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
      
      renderProjectDetailPage('test-project');
      
      // Check for loading skeleton
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render 404 error for invalid slug', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { status: 404 },
      });
      
      renderProjectDetailPage('invalid-slug');
      
      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText('Project Not Found')).toBeInTheDocument();
      });
    });

    it('should render project title when loaded', async () => {
      const mockProject: ProjectSchema = {
        id: 1,
        title: 'Test Project',
        slug: 'test-project',
        description: 'Test description',
        repo_url: null,
        tech_stack: [],
        hero_image: { url: null, width: null, height: null },
        created_at: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockProject });
      
      renderProjectDetailPage('test-project');
      
      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });
    });
  });

  /**
   * Feature: projects-management, Property 20: Project detail rendering completeness
   * Validates: Requirements 9.2
   * 
   * For any project on the detail page, all elements should be rendered: 
   * hero image (if present), title, full description, tech stack, and 
   * repository link (if present).
   */
  describe('Property 20: Project detail rendering completeness', () => {
    it('should render all project elements for any valid project', async () => {
      await fc.assert(
        fc.asyncProperty(projectArbitrary, async (project) => {
          // Clear all mocks before each property test run
          vi.clearAllMocks();
          
          // Mock the API response
          vi.mocked(apiClient.get).mockResolvedValue({ data: project });
          
          // Render the component
          const { queryClient, unmount, container } = renderProjectDetailPage(project.slug);
          
          try {
            // Wait for the project to load
            await waitFor(() => {
              const title = container.querySelector('h1');
              expect(title).toBeInTheDocument();
              expect(title?.textContent).toBe(project.title);
            }, { timeout: 2000 });
            
            // Verify title is rendered as h1
            const title = container.querySelector('h1');
            expect(title).toBeInTheDocument();
            expect(title?.textContent).toBe(project.title);
            
            // Verify description is rendered
            const paragraphs = container.querySelectorAll('p');
            const descriptionElement = Array.from(paragraphs).find(p => 
              p.textContent === project.description && 
              p.className.includes('whitespace-pre-wrap')
            );
            expect(descriptionElement).toBeInTheDocument();
            
            // Verify hero image is rendered if present
            if (project.hero_image.url) {
              const images = container.querySelectorAll('img');
              const heroImage = Array.from(images).find(img => img.getAttribute('alt') === project.title);
              expect(heroImage).toBeInTheDocument();
              expect(heroImage?.getAttribute('src')).toBe(project.hero_image.url);
            }
            
            // Verify tech stack is rendered if present
            if (project.tech_stack.length > 0) {
              for (const tech of project.tech_stack) {
                const techBadges = container.querySelectorAll('span');
                const techBadge = Array.from(techBadges).find(span => span.textContent === tech);
                expect(techBadge).toBeInTheDocument();
              }
            }
            
            // Verify repository link is rendered if present
            if (project.repo_url) {
              const links = container.querySelectorAll('a');
              const repoLink = Array.from(links).find(a => a.textContent === 'View Repository');
              expect(repoLink).toBeInTheDocument();
              expect(repoLink?.getAttribute('href')).toBe(project.repo_url);
            }
            
            // Verify placeholder sections are rendered
            const headings = container.querySelectorAll('h2');
            const kanbanHeading = Array.from(headings).find(h => h.textContent === 'Kanban Board');
            const devlogsHeading = Array.from(headings).find(h => h.textContent === 'Development Logs');
            expect(kanbanHeading).toBeInTheDocument();
            expect(devlogsHeading).toBeInTheDocument();
          } finally {
            // Clean up
            unmount();
            queryClient.clear();
            cleanup();
          }
        }),
        { numRuns: 20 }
      );
    }, 30000); // 30 second timeout for property test
  });

  /**
   * Feature: projects-management, Property 21: Repository link rendering
   * Validates: Requirements 9.3
   * 
   * For any project with a repo_url, the detail page should render it 
   * as a clickable link element.
   */
  describe('Property 21: Repository link rendering', () => {
    it('should render repository URL as clickable link for any project with repo_url', async () => {
      await fc.assert(
        fc.asyncProperty(
          projectArbitrary.filter(p => p.repo_url !== null),
          async (project) => {
            // Clear all mocks before each property test run
            vi.clearAllMocks();
            
            // Mock the API response
            vi.mocked(apiClient.get).mockResolvedValue({ data: project });
            
            // Render the component
            const { queryClient, unmount, container } = renderProjectDetailPage(project.slug);
            
            try {
              // Wait for the project to load
              await waitFor(() => {
                const title = container.querySelector('h1');
                expect(title).toBeInTheDocument();
                expect(title?.textContent).toBe(project.title);
              }, { timeout: 2000 });
              
              // Verify repository link is rendered
              const links = container.querySelectorAll('a');
              const repoLink = Array.from(links).find(a => a.textContent === 'View Repository');
              expect(repoLink).toBeInTheDocument();
              
              // Verify it's a clickable link with correct href
              expect(repoLink?.tagName).toBe('A');
              expect(repoLink?.getAttribute('href')).toBe(project.repo_url);
              
              // Verify it opens in new tab
              expect(repoLink?.getAttribute('target')).toBe('_blank');
              expect(repoLink?.getAttribute('rel')).toBe('noopener noreferrer');
            } finally {
              // Clean up
              unmount();
              queryClient.clear();
              cleanup();
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // 30 second timeout for property test

    it('should not render repository link when repo_url is null', async () => {
      await fc.assert(
        fc.asyncProperty(
          projectArbitrary.filter(p => p.repo_url === null),
          async (project) => {
            // Clear all mocks before each property test run
            vi.clearAllMocks();
            
            // Mock the API response
            vi.mocked(apiClient.get).mockResolvedValue({ data: project });
            
            // Render the component
            const { queryClient, unmount, container } = renderProjectDetailPage(project.slug);
            
            try {
              // Wait for the project to load
              await waitFor(() => {
                const title = container.querySelector('h1');
                expect(title).toBeInTheDocument();
                expect(title?.textContent).toBe(project.title);
              }, { timeout: 2000 });
              
              // Verify repository link is NOT rendered
              const links = container.querySelectorAll('a');
              const repoLink = Array.from(links).find(a => a.textContent === 'View Repository');
              expect(repoLink).toBeUndefined();
            } finally {
              // Clean up
              unmount();
              queryClient.clear();
              cleanup();
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // 30 second timeout for property test
  });

  /**
   * Unit tests for error handling
   */
  describe('Error Handling', () => {
    it('should display error message for server errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { status: 500 },
      });
      
      renderProjectDetailPage('test-project');
      
      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
      });
    });

    it('should display Return Home button on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { status: 404 },
      });
      
      renderProjectDetailPage('test-project');
      
      await waitFor(() => {
        const returnButton = screen.getByText('Return Home');
        expect(returnButton).toBeInTheDocument();
        expect(returnButton.getAttribute('href')).toBe('/');
      });
    });
  });

  /**
   * Unit tests for placeholder sections
   */
  describe('Placeholder Sections', () => {
    it('should render Kanban Board placeholder', async () => {
      const mockProject: ProjectSchema = {
        id: 1,
        title: 'Test Project',
        slug: 'test-project',
        description: 'Test description',
        repo_url: null,
        tech_stack: [],
        hero_image: { url: null, width: null, height: null },
        created_at: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockProject });
      
      renderProjectDetailPage('test-project');
      
      await waitFor(() => {
        expect(screen.getByText('Kanban Board')).toBeInTheDocument();
        expect(screen.getByText('Kanban board coming soon...')).toBeInTheDocument();
      });
    });

    it('should render Development Logs placeholder', async () => {
      const mockProject: ProjectSchema = {
        id: 1,
        title: 'Test Project',
        slug: 'test-project',
        description: 'Test description',
        repo_url: null,
        tech_stack: [],
        hero_image: { url: null, width: null, height: null },
        created_at: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockProject });
      
      renderProjectDetailPage('test-project');
      
      await waitFor(() => {
        expect(screen.getByText('Development Logs')).toBeInTheDocument();
        expect(screen.getByText('Development logs coming soon...')).toBeInTheDocument();
      });
    });
  });
});
