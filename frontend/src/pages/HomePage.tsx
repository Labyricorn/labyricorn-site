import { useProjects } from '../hooks/useProjects';
import { ProjectGrid } from '../components/ProjectGrid';

export function HomePage() {
  const { data, isLoading, isError, error } = useProjects();

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-purple-400">
        Welcome to Labyricorn
      </h1>
      <p className="text-cyan-400 text-lg">
        A cyberpunk-themed portfolio platform
      </p>
      
      {/* Projects Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold text-purple-300 mb-6">
          Projects
        </h2>
        
        {/* Error State */}
        {isError && (
          <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 font-semibold mb-1">Failed to load projects</p>
            <p className="text-red-300 text-sm">{error?.message || 'Unable to fetch projects. Please try again later.'}</p>
          </div>
        )}
        
        {/* Loading State or Projects Grid */}
        {!isError && (
          <ProjectGrid 
            projects={data?.items || []} 
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
