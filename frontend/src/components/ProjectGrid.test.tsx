import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ProjectGrid } from './ProjectGrid';
import type { components } from '../types/api';

type Project = components['schemas']['ProjectSchema'];

// Mock react-responsive-masonry
vi.mock('react-responsive-masonry', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="masonry">{children}</div>,
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to create mock project data
function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: 1,
    title: 'Test Project',
    slug: 'test-project',
    description: 'A test project description',
    repo_url: 'https://github.com/test/project',
    tech_stack: ['React', 'TypeScript'],
    hero_image: {
      url: 'https://example.com/image.jpg',
      width: 800,
      height: 600,
    },
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ProjectGrid', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Masonry layout rendering', () => {
    it('should render projects in a masonry layout', () => {
      const projects = [
        createMockProject({ id: 1, title: 'Project 1' }),
        createMockProject({ id: 2, title: 'Project 2' }),
        createMockProject({ id: 3, title: 'Project 3' }),
      ];

      render(
        <BrowserRouter>
          <ProjectGrid projects={projects} />
        </BrowserRouter>
      );

      // Verify all projects are rendered
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
      expect(screen.getByText('Project 3')).toBeInTheDocument();
    });

    it('should render empty state when no projects', () => {
      render(
        <BrowserRouter>
          <ProjectGrid projects={[]} />
        </BrowserRouter>
      );

      expect(screen.getByText('No projects found')).toBeInTheDocument();
    });

    it('should handle projects with varying content lengths', () => {
      const projects = [
        createMockProject({ 
          id: 1, 
          title: 'Short',
          description: 'Short description',
        }),
        createMockProject({ 
          id: 2, 
          title: 'Long Project Title That Spans Multiple Lines',
          description: 'A very long description that contains multiple sentences and should wrap to multiple lines in the card layout. This tests how the masonry grid handles varying content heights.',
          tech_stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
        }),
      ];

      render(
        <BrowserRouter>
          <ProjectGrid projects={projects} />
        </BrowserRouter>
      );

      expect(screen.getByText('Short')).toBeInTheDocument();
      expect(screen.getByText('Long Project Title That Spans Multiple Lines')).toBeInTheDocument();
    });
  });

  describe('Responsive breakpoints', () => {
    it('should apply responsive column breakpoints', () => {
      const projects = [createMockProject()];

      render(
        <BrowserRouter>
          <ProjectGrid projects={projects} />
        </BrowserRouter>
      );

      // The Masonry component should be present
      // We can't directly test breakpoints in jsdom, but we can verify the component renders
      const masonryContainer = screen.getByTestId('masonry');
      expect(masonryContainer).toBeInTheDocument();
    });
  });

  describe('Skeleton loader display', () => {
    it('should display skeleton loaders when loading', () => {
      const { container } = render(
        <BrowserRouter>
          <ProjectGrid projects={[]} isLoading={true} />
        </BrowserRouter>
      );

      // Check for skeleton cards with animate-pulse class
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display 6 skeleton cards while loading', () => {
      const { container } = render(
        <BrowserRouter>
          <ProjectGrid projects={[]} isLoading={true} />
        </BrowserRouter>
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(6);
    });

    it('should not display skeleton loaders when not loading', () => {
      const projects = [createMockProject()];

      const { container } = render(
        <BrowserRouter>
          <ProjectGrid projects={projects} isLoading={false} />
        </BrowserRouter>
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(0);
    });

    it('should hide skeleton loaders after loading completes', () => {
      const projects = [createMockProject()];

      const { container, rerender } = render(
        <BrowserRouter>
          <ProjectGrid projects={[]} isLoading={true} />
        </BrowserRouter>
      );

      // Initially should show skeletons
      let skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);

      // After loading completes
      rerender(
        <BrowserRouter>
          <ProjectGrid projects={projects} isLoading={false} />
        </BrowserRouter>
      );

      skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(0);
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('Navigation integration', () => {
    it('should navigate to project detail page when card is clicked', async () => {
      const user = userEvent.setup();
      const project = createMockProject({ slug: 'my-project' });

      render(
        <BrowserRouter>
          <ProjectGrid projects={[project]} />
        </BrowserRouter>
      );

      const card = screen.getByRole('button', { name: /view project: test project/i });
      await user.click(card);

      expect(mockNavigate).toHaveBeenCalledWith('/projects/my-project');
    });

    it('should navigate with correct slug for each project', async () => {
      const user = userEvent.setup();
      const projects = [
        createMockProject({ id: 1, title: 'Project A', slug: 'project-a' }),
        createMockProject({ id: 2, title: 'Project B', slug: 'project-b' }),
      ];

      render(
        <BrowserRouter>
          <ProjectGrid projects={projects} />
        </BrowserRouter>
      );

      const cardA = screen.getByRole('button', { name: /view project: project a/i });
      await user.click(cardA);
      expect(mockNavigate).toHaveBeenCalledWith('/projects/project-a');

      mockNavigate.mockClear();

      const cardB = screen.getByRole('button', { name: /view project: project b/i });
      await user.click(cardB);
      expect(mockNavigate).toHaveBeenCalledWith('/projects/project-b');
    });
  });
});
