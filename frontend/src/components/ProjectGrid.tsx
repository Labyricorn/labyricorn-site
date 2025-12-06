import Masonry from 'react-responsive-masonry';
import { useNavigate } from 'react-router-dom';
import { ProjectCard } from './ProjectCard';
import type { components } from '../types/api';

type Project = components['schemas']['ProjectSchema'];

interface ProjectGridProps {
  projects: Project[];
  isLoading?: boolean;
}

/**
 * ProjectGrid component displays projects in a responsive masonry layout.
 * 
 * Features:
 * - Responsive column breakpoints (1/2/3 columns)
 * - Masonry layout for varying card heights
 * - Skeleton loaders for loading state
 * - Navigation integration
 */
export function ProjectGrid({ projects, isLoading = false }: ProjectGridProps) {
  const navigate = useNavigate();

  // Show skeleton loaders while loading
  if (isLoading) {
    return (
      <Masonry 
        columnsCountBreakPoints={{ 350: 1, 750: 2, 1200: 3 }}
        gutter="1.5rem"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </Masonry>
    );
  }

  // Show empty state if no projects
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No projects found</p>
      </div>
    );
  }

  return (
    <Masonry 
      columnsCountBreakPoints={{ 350: 1, 750: 2, 1200: 3 }}
      gutter="1.5rem"
    >
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          onClick={() => navigate(`/projects/${project.slug}`)}
        />
      ))}
    </Masonry>
  );
}

/**
 * SkeletonCard component displays a loading placeholder
 * with pulsing animation for the masonry grid.
 */
function SkeletonCard() {
  return (
    <div className="bg-surface rounded-lg overflow-hidden shadow-lg animate-pulse">
      {/* Image skeleton */}
      <div className="w-full h-48 bg-gray-700" />
      
      {/* Content skeleton */}
      <div className="p-4">
        {/* Title skeleton */}
        <div className="h-6 bg-gray-700 rounded mb-2 w-3/4" />
        
        {/* Description skeleton */}
        <div className="space-y-2 mb-3">
          <div className="h-4 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-700 rounded w-4/6" />
        </div>
        
        {/* Tech stack badges skeleton */}
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-16 bg-gray-700 rounded" />
          <div className="h-6 w-20 bg-gray-700 rounded" />
          <div className="h-6 w-24 bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}
