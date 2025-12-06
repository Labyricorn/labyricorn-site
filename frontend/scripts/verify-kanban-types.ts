/**
 * Verification script for Kanban TypeScript types
 * This script checks that all required Kanban types are present in the generated API types
 */

import type { components, operations } from '../src/types/api';

// Verify KanbanCardSchema exists and has all required fields
type KanbanCard = components['schemas']['KanbanCardSchema'];
const verifyKanbanCard: KanbanCard = {
  id: 1,
  title: 'Test Card',
  status: 'TODO',
  votes: 0,
  allow_voting: true,
  order: 0,
  user_has_voted: false,
  completed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Verify KanbanBoardSchema exists and has all required fields
type KanbanBoard = components['schemas']['KanbanBoardSchema'];
const verifyKanbanBoard: KanbanBoard = {
  id: 1,
  project_id: 1,
  todo_cards: [],
  doing_cards: [],
  done_cards: [],
  has_more_done: false,
};

// Verify ArchivedCardsSchema exists and has all required fields
type ArchivedCards = components['schemas']['ArchivedCardsSchema'];
const verifyArchivedCards: ArchivedCards = {
  cards: [],
  has_more: false,
  total_count: 0,
};

// Verify CardCreateSchema exists
type CardCreate = components['schemas']['CardCreateSchema'];
const verifyCardCreate: CardCreate = {
  board_id: 1,
  title: 'New Card',
  status: 'TODO',
};

// Verify CardUpdateSchema exists
type CardUpdate = components['schemas']['CardUpdateSchema'];
const verifyCardUpdate: CardUpdate = {
  title: 'Updated Card',
  allow_voting: true,
};

// Verify CardMoveSchema exists
type CardMove = components['schemas']['CardMoveSchema'];
const verifyCardMove: CardMove = {
  status: 'DOING',
  order: 1,
};

// Verify VoteResponseSchema exists
type VoteResponse = components['schemas']['VoteResponseSchema'];
const verifyVoteResponse: VoteResponse = {
  id: 1,
  votes: 5,
  user_has_voted: true,
};

// Verify all endpoint operations exist
type GetKanbanBoard = operations['api_kanban_views_get_kanban_board'];
type GetArchivedCards = operations['api_kanban_views_get_archived_cards'];
type CreateCard = operations['api_kanban_views_create_card'];
type UpdateCard = operations['api_kanban_views_update_card'];
type DeleteCard = operations['api_kanban_views_delete_card'];
type MoveCard = operations['api_kanban_views_move_card'];
type VoteCard = operations['api_kanban_views_vote_card'];
type RemoveVote = operations['api_kanban_views_remove_vote'];

console.log('✓ All Kanban TypeScript types verified successfully!');
console.log('✓ KanbanCardSchema - Complete');
console.log('✓ KanbanBoardSchema - Complete');
console.log('✓ ArchivedCardsSchema - Complete');
console.log('✓ CardCreateSchema - Complete');
console.log('✓ CardUpdateSchema - Complete');
console.log('✓ CardMoveSchema - Complete');
console.log('✓ VoteResponseSchema - Complete');
console.log('✓ All 8 Kanban API operations - Complete');
