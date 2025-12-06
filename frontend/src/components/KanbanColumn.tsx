import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { components } from '../types/api';

type KanbanCardType = components['schemas']['KanbanCardSchema'];

interface KanbanColumnProps {
  title: string;
  status: string;
  cards: KanbanCardType[];
  onVoteCard: (cardId: number) => void;
  onRemoveVote: (cardId: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isAdmin: boolean;
}

/**
 * KanbanColumn component - Droppable column for Kanban cards
 * 
 * Features:
 * - Drop zone for draggable cards via @dnd-kit/core
 * - Sortable context for card reordering
 * - Empty state when no cards present
 * - Load More button for DONE column pagination
 * - Cyberpunk theme styling with surface color background
 * 
 * Requirements:
 * - 15.3: Display three columns (TODO, DOING, DONE)
 * - 15.5: Display empty state message when no cards
 * - 15.6: Display "Load More" button for DONE column
 * - 20.1: Support archived cards pagination
 * 
 * @param title - Column display title (e.g., "To Do", "Doing", "Done")
 * @param status - Column status identifier (TODO, DOING, DONE)
 * @param cards - Array of cards to display in this column
 * @param onVoteCard - Callback when user votes on a card
 * @param onRemoveVote - Callback when user removes their vote
 * @param hasMore - Whether more cards are available (for DONE column)
 * @param onLoadMore - Callback to load more archived cards
 * @param isLoadingMore - Loading state for Load More button
 * @param isAdmin - Whether current user has admin privileges
 */
export function KanbanColumn({ 
  title, 
  status, 
  cards, 
  onVoteCard, 
  onRemoveVote,
  hasMore,
  onLoadMore,
  isLoadingMore,
  isAdmin 
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
    data: { status }
  });
  
  return (
    <div className="bg-surface rounded-lg p-4 border border-surface hover:border-primary/20 transition-all duration-300">
      <h3 className="text-lg font-bold text-secondary mb-4 tracking-wide">{title}</h3>
      
      <SortableContext
        items={cards.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="space-y-3 min-h-[200px]">
          {cards.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No cards yet
            </p>
          ) : (
            <>
              {cards.map((card) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onVote={() => onVoteCard(card.id)}
                  onRemoveVote={() => onRemoveVote(card.id)}
                  isAdmin={isAdmin}
                />
              ))}
              
              {hasMore && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-2 px-4 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/10 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-primary/30 disabled:hover:shadow-none"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
