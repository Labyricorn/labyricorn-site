import type { components } from '../types/api';

type Project = components['schemas']['ProjectSchema'];

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

/**
 * ProjectCard component displays a project in a card format
 * with hero image, title, description, and tech stack badges.
 * 
 * Features:
 * - Lazy loading for images
 * - Aspect ratio preservation for layout stability
 * - Cyberpunk theme styling
 * - Click handler for navigation
 */
export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-surface rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all shadow-lg hover:shadow-primary/20"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View project: ${project.title}`}
    >
      {project.hero_image.url && (
        <div 
          style={{
            aspectRatio: project.hero_image.width && project.hero_image.height 
              ? `${project.hero_image.width} / ${project.hero_image.height}`
              : '16 / 9',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <img 
            src={project.hero_image.url} 
            alt={project.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xl font-bold text-primary mb-2">{project.title}</h3>
        <p className="text-gray-300 text-sm mb-3 line-clamp-3">{project.description}</p>
        <div className="flex flex-wrap gap-2">
          {project.tech_stack.map((tech, index) => (
            <span 
              key={`${tech}-${index}`} 
              className="px-2 py-1 bg-primary/20 text-secondary text-xs rounded"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
