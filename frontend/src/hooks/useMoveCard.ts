import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanCard = components['schemas']['KanbanCardSchema'];
type CardMoveRequest = components['schemas']['CardMoveSchema'];

interface MoveCardParams {
  cardId: number;
  status: string;
  order: number;
}

/**
 * Custom hook for moving/reordering Kanban cards
 * Uses TanStack Query for mutation management
 * 
 * @param projectSlug - URL-friendly project identifier
 * @returns Mutation object with move function and loading/error states
 */
export function useMoveCard(projectSlug: string) {
  const queryClient = useQueryClient();
  
  return useMutation<KanbanCard, Error, MoveCardParams>({
    mutationFn: async ({ cardId, status, order }: MoveCardParams) => {
      try {
        const requestBody: CardMoveRequest = {
          status,
          order,
        };
        
        const response = await apiClient.patch<KanbanCard>(
          `/kanban/cards/${cardId}/move`,
          requestBody
        );
        return response.data;
      } catch (error: any) {
        // Transform error into user-friendly message
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.detail || 'Invalid move request. Please check the status and position.');
        }
        if (error.response?.status === 401) {
          throw new Error('You must be logged in to move cards.');
        }
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to move cards.');
        }
        if (error.response?.status === 404) {
          throw new Error('Card not found.');
        }
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error('Failed to move card. Please try again.');
      }
    },
    onSuccess: () => {
      // Invalidate kanban query to refetch updated board state
      queryClient.invalidateQueries({ queryKey: ['kanban', projectSlug] });
    },
  });
}
