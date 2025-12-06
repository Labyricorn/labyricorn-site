import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useProject } from '../hooks/useProject';
import { useKanbanBoard } from '../hooks/useKanbanBoard';
import { useArchivedCards } from '../hooks/useArchivedCards';
import { useMoveCard } from '../hooks/useMoveCard';
import { useVoteCard } from '../hooks/useVoteCard';
import { useRemoveVote } from '../hooks/useRemoveVote';
import { useAuth } from '../hooks/useAuth';
import { KanbanBoard } from '../components/KanbanBoard';

/**
 * ProjectDetailPage displays complete information about a single project
 * 
 * Features:
 * - Fetches project by slug from URL params
 * - Displays hero image at full size
 * - Shows title, full description, tech stack, and repository link
 * - Handles 404 errors for invalid slugs
 * - Includes tabs for Overview, Kanban, and Devlogs
 * - Styled with cyberpunk theme
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 15.1, 15.2, 15.3, 15.4
 */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: project, isLoading, isError, error } = useProject(slug || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'kanban' | 'devlogs'>('overview');
  const [isDragging, setIsDragging] = useState(false);
  
  // Auth state
  const { currentUser } = useAuth();
  const isAdmin = !!(currentUser?.is_staff || currentUser?.is_superuser);
  
  // Kanban data - only fetch when tab is active
  const { 
    data: kanbanBoard, 
    isLoading: isLoadingKanban, 
    isError: isKanbanError,
    error: kanbanError 
  } = useKanbanBoard(slug || '', isDragging);
  
  // Archived cards - only fetch when needed
  const {
    data: archivedPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useArchivedCards(slug || '');
  
  // Mutations
  const moveCardMutation = useMoveCard(slug || '');
  const voteCardMutation = useVoteCard(slug || '');
  const removeVoteMutation = useRemoveVote(slug || '');
  
  // Handlers
  const handleMoveCard = (cardId: number, status: string, order: number) => {
    moveCardMutation.mutate({ cardId, status, order }, {
      onError: (error) => {
        alert(error.message || 'Failed to move card. Please try again.');
      }
    });
  };
  
  const handleVoteCard = (cardId: number) => {
    voteCardMutation.mutate(cardId);
  };
  
  const handleRemoveVote = (cardId: number) => {
    removeVoteMutation.mutate(cardId);
  };
  
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Hero image skeleton */}
        <div className="w-full h-96 bg-slate-800 rounded-lg"></div>
        
        {/* Title skeleton */}
        <div className="h-10 bg-slate-800 rounded w-2/3"></div>
        
        {/* Description skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6"></div>
        </div>
        
        {/* Tech stack skeleton */}
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-slate-800 rounded"></div>
          <div className="h-8 w-24 bg-slate-800 rounded"></div>
          <div className="h-8 w-16 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state (404 or other errors)
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-purple-500">404</h1>
          <h2 className="text-3xl font-semibold text-purple-300">Project Not Found</h2>
          <p className="text-cyan-400 text-lg max-w-md">
            {error?.message || 'The project you are looking for has vanished into the digital void.'}
          </p>
        </div>
        <a 
          href="/"
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
        >
          Return Home
        </a>
      </div>
    );
  }

  // Success state - display project
  if (!project) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Image */}
      {project.hero_image.url && (
        <div className="w-full rounded-lg overflow-hidden shadow-2xl shadow-purple-500/20">
          <img 
            src={project.hero_image.url}
            alt={project.title}
            className="w-full h-auto object-cover"
            style={{
              aspectRatio: project.hero_image.width && project.hero_image.height 
                ? `${project.hero_image.width} / ${project.hero_image.height}`
                : 'auto'
            }}
          />
        </div>
      )}

      {/* Project Title */}
      <h1 className="text-4xl md:text-5xl font-bold text-purple-400">
        {project.title}
      </h1>

      {/* Tech Stack */}
      {project.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.tech_stack.map((tech, index) => (
            <span 
              key={`${tech}-${index}`}
              className="px-3 py-1.5 bg-purple-600/20 text-cyan-400 text-sm font-medium rounded-lg border border-purple-500/30"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Repository Link */}
      {project.repo_url && (
        <div className="flex items-center gap-3">
          <svg 
            className="w-5 h-5 text-cyan-400" 
            fill="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <a 
            href={project.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors"
          >
            View Repository
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-purple-500/20">
        <nav className="flex gap-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'kanban'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setActiveTab('devlogs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'devlogs'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Devlogs
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="prose prose-invert prose-purple max-w-none">
              <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          </div>
        )}

        {/* Kanban Tab */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            {isLoadingKanban ? (
              // Loading skeletons
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((col) => (
                  <div key={col} className="space-y-4">
                    <div className="h-8 bg-slate-800 rounded w-24 animate-pulse"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((card) => (
                        <div key={card} className="h-24 bg-slate-800 rounded animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : isKanbanError ? (
              // Error state
              <div className="p-8 bg-slate-900/50 rounded-lg border border-red-500/20 text-center">
                <p className="text-red-400">
                  {kanbanError?.message || 'Failed to load Kanban board. Please try again.'}
                </p>
              </div>
            ) : kanbanBoard ? (
              // Kanban board
              <KanbanBoard
                board={kanbanBoard}
                onMoveCard={handleMoveCard}
                onVoteCard={handleVoteCard}
                onRemoveVote={handleRemoveVote}
                onLoadMore={handleLoadMore}
                isLoadingMore={isFetchingNextPage}
                isAdmin={isAdmin}
                isDragging={isDragging}
                onDraggingChange={setIsDragging}
              />
            ) : (
              // Empty state
              <div className="p-8 bg-slate-900/50 rounded-lg border border-purple-500/20 text-center">
                <p className="text-gray-400">
                  No Kanban board available for this project.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Devlogs Tab */}
        {activeTab === 'devlogs' && (
          <div className="p-8 bg-slate-900/50 rounded-lg border border-purple-500/20 text-center">
            <p className="text-gray-400">
              Development logs coming soon...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
