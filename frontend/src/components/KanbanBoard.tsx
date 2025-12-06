import { 
  DndContext, 
  DragOverlay, 
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];
type KanbanCardType = components['schemas']['KanbanCardSchema'];

interface KanbanBoardProps {
  board: KanbanBoard;
  onMoveCard: (cardId: number, status: string, order: number) => void;
  onVoteCard: (cardId: number) => void;
  onRemoveVote: (cardId: number) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isAdmin: boolean;
  isDragging?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
}

/**
 * KanbanBoard component - Main drag-and-drop board container
 * 
 * Features:
 * - DndContext with closestCorners collision detection
 * - Tracks isDragging state to pause auto-refresh
 * - Handles drag start and drag end events
 * - Renders three columns (TODO, DOING, DONE)
 * - Renders DragOverlay with active card during drag
 * - Wires up vote, remove vote, and move handlers
 * - Touch device support with press-and-hold delay
 * 
 * Requirements:
 * - 11.1: Display visual overlay with neon purple glow during drag
 * - 11.2: Send new status and position to API on drop
 * - 11.3: Update UI when API confirms move
 * - 11.4: Revert card to original position on API error
 * - 11.5: Show drop zones in valid columns while dragging
 * - 11.6: Touch device support with press-and-hold delay
 * - 21.3: Pass isDragging to useKanbanBoard hook to pause auto-refresh
 * 
 * @param board - Kanban board data with cards grouped by status
 * @param onMoveCard - Callback when card is dropped in new position
 * @param onVoteCard - Callback when user votes on a card
 * @param onRemoveVote - Callback when user removes their vote
 * @param onLoadMore - Callback to load more archived DONE cards
 * @param isLoadingMore - Loading state for Load More button
 * @param isAdmin - Whether current user has admin privileges
 * @param isDragging - External isDragging state (optional)
 * @param onDraggingChange - Callback to notify parent of dragging state changes
 */
export function KanbanBoard({ 
  board, 
  onMoveCard, 
  onVoteCard, 
  onRemoveVote,
  onLoadMore,
  isLoadingMore,
  isAdmin,
  isDragging: externalIsDragging,
  onDraggingChange,
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardType | null>(null);
  const [internalIsDragging, setInternalIsDragging] = useState(false);
  
  // Use external isDragging if provided, otherwise use internal state
  const isDragging = externalIsDragging !== undefined ? externalIsDragging : internalIsDragging;
  
  // Configure sensors for touch device support
  // Press-and-hold delay prevents conflicts with scrolling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement tolerance before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms press-and-hold delay before drag starts
        tolerance: 5, // 5px movement tolerance during delay
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as KanbanCardType;
    setActiveCard(card);
    
    // Update dragging state
    if (onDraggingChange) {
      onDraggingChange(true);
    } else {
      setInternalIsDragging(true);
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Reset dragging state
    if (onDraggingChange) {
      onDraggingChange(false);
    } else {
      setInternalIsDragging(false);
    }
    
    setActiveCard(null);
    
    // If dropped outside a valid drop zone, do nothing
    if (!over) {
      return;
    }
    
    const cardId = active.id as number;
    const newStatus = over.data.current?.status as string;
    
    // Calculate new order based on drop position
    // If dropped on a card, insert before it
    // If dropped on column, append to end
    let newOrder = 0;
    
    if (over.data.current?.card) {
      // Dropped on another card - use its order
      newOrder = over.data.current.card.order;
    } else {
      // Dropped on column - append to end
      const columnCards = newStatus === 'TODO' 
        ? board.todo_cards 
        : newStatus === 'DOING' 
        ? board.doing_cards 
        : board.done_cards;
      newOrder = columnCards.length;
    }
    
    // Call move handler
    onMoveCard(cardId, newStatus, newOrder);
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn
          title="To Do"
          status="TODO"
          cards={board.todo_cards}
          onVoteCard={onVoteCard}
          onRemoveVote={onRemoveVote}
          isAdmin={isAdmin}
        />
        <KanbanColumn
          title="Doing"
          status="DOING"
          cards={board.doing_cards}
          onVoteCard={onVoteCard}
          onRemoveVote={onRemoveVote}
          isAdmin={isAdmin}
        />
        <KanbanColumn
          title="Done"
          status="DONE"
          cards={board.done_cards}
          onVoteCard={onVoteCard}
          onRemoveVote={onRemoveVote}
          hasMore={board.has_more_done}
          onLoadMore={onLoadMore}
          isLoadingMore={isLoadingMore}
          isAdmin={isAdmin}
        />
      </div>
      
      <DragOverlay>
        {activeCard ? (
          <div className="ring-4 ring-primary/70 shadow-2xl shadow-primary/60 animate-pulse">
            <KanbanCard 
              card={activeCard} 
              onVote={() => {}} 
              onRemoveVote={() => {}}
              isAdmin={isAdmin} 
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
