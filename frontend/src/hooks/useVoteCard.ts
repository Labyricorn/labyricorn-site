import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type VoteResponse = components['schemas']['VoteResponseSchema'];
type KanbanBoard = components['schemas']['KanbanBoardSchema'];
type KanbanCard = components['schemas']['KanbanCardSchema'];

/**
 * Custom hook for voting on Kanban cards with optimistic updates
 * Uses TanStack Query for mutation management and cache updates
 * 
 * @param projectSlug - URL-friendly project identifier
 * @returns Mutation object with vote function and loading/error states
 */
export function useVoteCard(projectSlug: string) {
  const queryClient = useQueryClient();
  
  return useMutation<VoteResponse, Error, number>({
    mutationFn: async (cardId: number) => {
      try {
        const response = await apiClient.post<VoteResponse>(
          `/kanban/cards/${cardId}/vote`
        );
        return response.data;
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a minute before voting again.');
        }
        if (error.response?.status === 409) {
          throw new Error('You have already voted on this card.');
        }
        if (error.response?.status === 403) {
          throw new Error('Voting is disabled for this card.');
        }
        if (error.response?.status === 404) {
          throw new Error('Card not found.');
        }
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Failed to vote. Please try again.');
      }
    },
    onMutate: async (cardId) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['kanban', projectSlug] });
      
      // Snapshot previous value for rollback
      const previousBoard = queryClient.getQueryData<KanbanBoard>(['kanban', projectSlug]);
      
      // Optimistically update the cache
      queryClient.setQueryData<KanbanBoard>(['kanban', projectSlug], (old) => {
        if (!old) return old;
        
        // Helper function to update cards in an array
        const updateCards = (cards: KanbanCard[]): KanbanCard[] =>
          cards.map(card =>
            card.id === cardId
              ? { ...card, votes: card.votes + 1, user_has_voted: true }
              : card
          );
        
        // Update cards in all columns
        return {
          ...old,
          todo_cards: updateCards(old.todo_cards),
          doing_cards: updateCards(old.doing_cards),
          done_cards: updateCards(old.done_cards),
        };
      });
      
      // Return context with previous state for rollback
      return { previousBoard };
    },
    onError: (error, cardId, context) => {
      // Revert optimistic update on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['kanban', projectSlug], context.previousBoard);
      }
      
      // Error message is already transformed in mutationFn
      // The error will be available in mutation.error for the UI to display
    },
    onSettled: () => {
      // Refetch to ensure consistency with server state
      queryClient.invalidateQueries({ queryKey: ['kanban', projectSlug] });
    },
  });
}
