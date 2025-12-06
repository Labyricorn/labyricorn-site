import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import type { components } from '../types/api';

type KanbanCard = components['schemas']['KanbanCardSchema'];

interface KanbanCardProps {
  card: KanbanCard;
  onVote: () => void;
  onRemoveVote: () => void;
  isAdmin: boolean;
}

/**
 * KanbanCard component - Draggable card with voting functionality
 * 
 * Features:
 * - Drag-and-drop support via @dnd-kit/sortable (admin only)
 * - Vote/remove vote with visual feedback
 * - Disabled state when voting is not allowed
 * - Cyberpunk theme styling with neon purple accents
 * - Tooltips for vote button states
 * 
 * @param card - Kanban card data from API
 * @param onVote - Callback when user votes on the card
 * @param onRemoveVote - Callback when user removes their vote
 * @param isAdmin - Whether current user has admin privileges
 */
export function KanbanCard({ card, onVote, onRemoveVote, isAdmin }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { card },
    disabled: !isAdmin,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.allow_voting) return;
    
    if (card.user_has_voted) {
      onRemoveVote();
    } else {
      onVote();
    }
  };
  
  // Determine cursor style based on admin status and voting state
  const cursorClass = isAdmin 
    ? 'cursor-grab active:cursor-grabbing' 
    : 'cursor-default';
  
  // Determine vote button tooltip
  const voteTooltip = !card.allow_voting
    ? 'Voting disabled'
    : card.user_has_voted
    ? 'Click to remove your vote'
    : 'Click to vote';
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isAdmin ? listeners : {})}
      className={`bg-background border-2 border-primary/30 rounded-lg p-3 hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 ${cursorClass} ${
        isDragging ? 'shadow-2xl shadow-primary/50 ring-4 ring-primary/70 scale-105' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-200 flex-1">{card.title}</p>
        
        <button
          onClick={handleVoteClick}
          disabled={!card.allow_voting}
          className={`flex items-center gap-1 text-xs transition-all duration-200 ${
            card.allow_voting
              ? card.user_has_voted
                ? 'text-success hover:text-success/80 hover:scale-110 cursor-pointer'
                : 'text-gray-400 hover:text-success hover:scale-110 cursor-pointer'
              : 'text-gray-600 cursor-not-allowed opacity-40'
          }`}
          title={voteTooltip}
          aria-label={voteTooltip}
        >
          {card.user_has_voted ? (
            <HeartSolidIcon className="w-4 h-4 drop-shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
          ) : (
            <HeartIcon className="w-4 h-4" />
          )}
          <span className="font-medium">{card.votes}</span>
        </button>
      </div>
    </div>
  );
}
