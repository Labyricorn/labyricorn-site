import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import React from 'react';
import { useVoteCard } from './useVoteCard';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];
type KanbanCard = components['schemas']['KanbanCardSchema'];
type VoteResponse = components['schemas']['VoteResponseSchema'];

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
      mutations: {
        retry: false, // Disable retries in tests
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Fast-check arbitrary for generating valid Kanban card data
const kanbanCardArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  title: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  status: fc.constantFrom('TODO', 'DOING', 'DONE'),
  votes: fc.integer({ min: 0, max: 1000 }),
  allow_voting: fc.boolean(),
  order: fc.integer({ min: 0, max: 100 }),
  user_has_voted: fc.constant(false), // Start with not voted for vote tests
  completed_at: fc.option(
    fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()), 
    { nil: null }
  ),
  created_at: fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()),
  updated_at: fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ts => new Date(ts).toISOString()),
});

// Fast-check arbitrary for generating valid Kanban board data with unique card IDs
const kanbanBoardArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  project_id: fc.integer({ min: 1 }),
  todo_cards: fc.array(kanbanCardArbitrary, { minLength: 0, maxLength: 10 }),
  doing_cards: fc.array(kanbanCardArbitrary, { minLength: 0, maxLength: 10 }),
  done_cards: fc.array(kanbanCardArbitrary, { minLength: 0, maxLength: 10 }),
  has_more_done: fc.boolean(),
}).map(board => {
  // Ensure all card IDs are unique across all columns
  let nextId = 1;
  const assignUniqueIds = (cards: KanbanCard[]) =>
    cards.map(card => ({ ...card, id: nextId++ }));
  
  return {
    ...board,
    todo_cards: assignUniqueIds(board.todo_cards),
    doing_cards: assignUniqueIds(board.doing_cards),
    done_cards: assignUniqueIds(board.done_cards),
  };
});

describe('useVoteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should vote on a card successfully', async () => {
    const mockResponse: VoteResponse = {
      id: 1,
      votes: 5,
      user_has_voted: true,
    };

    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Set initial board data
    const initialBoard: KanbanBoard = {
      id: 1,
      project_id: 1,
      todo_cards: [{ 
        id: 1, 
        title: 'Test Card', 
        status: 'TODO', 
        votes: 4, 
        allow_voting: true, 
        order: 0, 
        user_has_voted: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      doing_cards: [],
      done_cards: [],
      has_more_done: false,
    };

    queryClient.setQueryData(['kanban', 'test-project'], initialBoard);

    const { result } = renderHook(() => useVoteCard('test-project'), {
      wrapper,
    });

    // Execute vote mutation
    result.current.mutate(1);

    // Wait for mutation to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/kanban/cards/1/vote');
  });

  it('should handle 429 rate limit errors', async () => {
    const error = {
      response: { 
        status: 429,
        data: { detail: 'Rate limit exceeded' }
      },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);

    const { result } = renderHook(() => useVoteCard('test-project'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Rate limit exceeded. Please wait a minute before voting again.');
  });

  it('should handle 409 duplicate vote errors', async () => {
    const error = {
      response: { 
        status: 409,
        data: { detail: 'Already voted' }
      },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);

    const { result } = renderHook(() => useVoteCard('test-project'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('You have already voted on this card.');
  });

  it('should handle 403 voting disabled errors', async () => {
    const error = {
      response: { 
        status: 403,
        data: { detail: 'Voting disabled' }
      },
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);

    const { result } = renderHook(() => useVoteCard('test-project'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Voting is disabled for this card.');
  });
});

/**
 * Feature: kanban-board-system, Property 22: Optimistic voting updates
 * Validates: Requirements 12.1, 12.2, 12.3
 * 
 * Property: For any card that a user votes on, the vote count should be 
 * immediately incremented in the UI (optimistic update), and if the API call 
 * succeeds, the update should be maintained. If the API call fails, the vote 
 * count should be reverted to its original value.
 * 
 * This property ensures responsive UI behavior while maintaining data consistency.
 */
describe('Property 22: Optimistic voting updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should optimistically increment vote count and maintain on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 })
          .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
          .filter(s => s.length > 0),
        async (initialBoard, projectSlug) => {
          // Skip if board has no cards
          const allCards = [
            ...initialBoard.todo_cards,
            ...initialBoard.doing_cards,
            ...initialBoard.done_cards,
          ];
          
          if (allCards.length === 0) {
            return; // Skip this iteration
          }

          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          // Pick a random card to vote on
          const cardToVote = allCards[Math.floor(Math.random() * allCards.length)];
          const originalVotes = cardToVote.votes;

          // Mock successful API response
          const mockResponse: VoteResponse = {
            id: cardToVote.id,
            votes: originalVotes + 1,
            user_has_voted: true,
          };
          vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          });

          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          );

          // Set initial board data in cache
          queryClient.setQueryData(['kanban', projectSlug], initialBoard);

          const { result, unmount } = renderHook(
            () => useVoteCard(projectSlug),
            { wrapper }
          );

          // Execute vote mutation
          result.current.mutate(cardToVote.id);

          // Wait a tiny bit for the optimistic update to be applied
          // The onMutate callback runs asynchronously
          await waitFor(() => {
            const optimisticBoard = queryClient.getQueryData<KanbanBoard>(['kanban', projectSlug]);
            if (!optimisticBoard) return false;
            
            const optimisticCards = [
              ...optimisticBoard.todo_cards,
              ...optimisticBoard.doing_cards,
              ...optimisticBoard.done_cards,
            ];
            const optimisticCard = optimisticCards.find(c => c.id === cardToVote.id);
            
            // Check if optimistic update has been applied
            return optimisticCard && optimisticCard.votes === originalVotes + 1;
          }, { timeout: 500 });

          // Verify optimistic update happened
          const optimisticBoard = queryClient.getQueryData<KanbanBoard>(['kanban', projectSlug]);
          if (optimisticBoard) {
            const optimisticCards = [
              ...optimisticBoard.todo_cards,
              ...optimisticBoard.doing_cards,
              ...optimisticBoard.done_cards,
            ];
            const optimisticCard = optimisticCards.find(c => c.id === cardToVote.id);
            
            if (optimisticCard) {
              expect(optimisticCard.votes).toBe(originalVotes + 1);
              expect(optimisticCard.user_has_voted).toBe(true);
            }
          }

          // Wait for mutation to complete
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });

          // Verify API was called
          expect(apiClient.post).toHaveBeenCalledWith(`/kanban/cards/${cardToVote.id}/vote`);

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds

  it('should revert optimistic update on API failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 })
          .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
          .filter(s => s.length > 0),
        fc.constantFrom(429, 409, 403, 404, 500), // Various error codes
        async (initialBoard, projectSlug, errorCode) => {
          // Skip if board has no cards
          const allCards = [
            ...initialBoard.todo_cards,
            ...initialBoard.doing_cards,
            ...initialBoard.done_cards,
          ];
          
          if (allCards.length === 0) {
            return; // Skip this iteration
          }

          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          // Pick a random card to vote on
          const cardToVote = allCards[Math.floor(Math.random() * allCards.length)];
          const originalVotes = cardToVote.votes;
          const originalUserHasVoted = cardToVote.user_has_voted;

          // Mock API error
          const error = {
            response: { 
              status: errorCode,
              data: { detail: 'Error occurred' }
            },
          };
          vi.mocked(apiClient.post).mockRejectedValue(error);

          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          });

          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          );

          // Set initial board data in cache
          queryClient.setQueryData(['kanban', projectSlug], initialBoard);

          const { result, unmount } = renderHook(
            () => useVoteCard(projectSlug),
            { wrapper }
          );

          // Execute vote mutation
          result.current.mutate(cardToVote.id);

          // Wait for mutation to fail
          await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 2000 });

          // Verify the board was reverted to original state
          const revertedBoard = queryClient.getQueryData<KanbanBoard>(['kanban', projectSlug]);
          
          if (revertedBoard) {
            const revertedCards = [
              ...revertedBoard.todo_cards,
              ...revertedBoard.doing_cards,
              ...revertedBoard.done_cards,
            ];
            const revertedCard = revertedCards.find(c => c.id === cardToVote.id);
            
            // Verify revert happened
            if (revertedCard) {
              expect(revertedCard.votes).toBe(originalVotes);
              expect(revertedCard.user_has_voted).toBe(originalUserHasVoted);
            }
          }

          // Verify error message is user-friendly
          expect(result.current.error).toBeDefined();
          expect(result.current.error?.message).toBeTruthy();

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds

  it('should handle voting on cards in different columns', async () => {
    await fc.assert(
      fc.asyncProperty(
        kanbanBoardArbitrary,
        fc.string({ minLength: 1, maxLength: 50 })
          .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
          .filter(s => s.length > 0),
        fc.constantFrom('TODO', 'DOING', 'DONE'),
        async (initialBoard, projectSlug, targetColumn) => {
          // Get cards from the target column
          let targetCards: KanbanCard[] = [];
          if (targetColumn === 'TODO') targetCards = initialBoard.todo_cards;
          else if (targetColumn === 'DOING') targetCards = initialBoard.doing_cards;
          else targetCards = initialBoard.done_cards;

          // Skip if target column has no cards
          if (targetCards.length === 0) {
            return; // Skip this iteration
          }

          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          // Pick a random card from the target column
          const cardToVote = targetCards[Math.floor(Math.random() * targetCards.length)];
          const originalVotes = cardToVote.votes;

          // Mock successful API response
          const mockResponse: VoteResponse = {
            id: cardToVote.id,
            votes: originalVotes + 1,
            user_has_voted: true,
          };
          vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          });

          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          );

          // Set initial board data in cache
          queryClient.setQueryData(['kanban', projectSlug], initialBoard);

          const { result, unmount } = renderHook(
            () => useVoteCard(projectSlug),
            { wrapper }
          );

          // Execute vote mutation
          result.current.mutate(cardToVote.id);

          // Wait for mutation to complete
          await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });

          // Verify the correct card was updated in the correct column
          const updatedBoard = queryClient.getQueryData<KanbanBoard>(['kanban', projectSlug]);
          
          if (updatedBoard) {
            let updatedCards: KanbanCard[] = [];
            if (targetColumn === 'TODO') updatedCards = updatedBoard.todo_cards;
            else if (targetColumn === 'DOING') updatedCards = updatedBoard.doing_cards;
            else updatedCards = updatedBoard.done_cards;

            const updatedCard = updatedCards.find(c => c.id === cardToVote.id);
            
            // Verify the card was updated correctly
            if (updatedCard) {
              expect(updatedCard.votes).toBe(originalVotes + 1);
              expect(updatedCard.user_has_voted).toBe(true);
            }
          }

          // Clean up
          unmount();
        }
      ),
      { numRuns: 10, timeout: 30000 } // Run 10 iterations with 30s timeout
    );
  }, 35000); // Set test timeout to 35 seconds
});
