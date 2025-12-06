import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import type { components } from '../types/api';

type KanbanCardType = components['schemas']['KanbanCardSchema'];

// Helper to create a test card with defaults
function createTestCard(overrides: Partial<KanbanCardType> = {}): KanbanCardType {
  return {
    id: 1,
    title: 'Test Card',
    status: 'TODO',
    votes: 0,
    allow_voting: true,
    order: 0,
    user_has_voted: false,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Wrapper component to provide DndContext
function DndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe('KanbanColumn', () => {
  describe('Basic Rendering', () => {
    it('should render column title', () => {
      render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={[]}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    it('should render all cards in the column', () => {
      const cards = [
        createTestCard({ id: 1, title: 'Card 1' }),
        createTestCard({ id: 2, title: 'Card 2' }),
        createTestCard({ id: 3, title: 'Card 3' }),
      ];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Doing"
            status="DOING"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
      expect(screen.getByText('Card 3')).toBeInTheDocument();
    });
  });

  describe('Empty State (Requirement 15.5)', () => {
    it('should display empty state message when no cards', () => {
      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={[]}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByText('No cards yet')).toBeInTheDocument();
    });

    it('should not display empty state when cards are present', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.queryByText('No cards yet')).not.toBeInTheDocument();
    });
  });

  describe('Load More Button (Requirements 15.6, 20.1)', () => {
    it('should display Load More button when hasMore is true', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            hasMore={true}
            onLoadMore={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('should not display Load More button when hasMore is false', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            hasMore={false}
            onLoadMore={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });

    it('should not display Load More button when onLoadMore is not provided', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            hasMore={true}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });

    it('should show loading state when isLoadingMore is true', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            hasMore={true}
            onLoadMore={vi.fn()}
            isLoadingMore={true}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('should call onLoadMore when Load More button is clicked', () => {
      const cards = [createTestCard({ id: 1, title: 'Card 1' })];
      const onLoadMore = vi.fn();

      render(
        <DndWrapper>
          <KanbanColumn
            title="Done"
            status="DONE"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            hasMore={true}
            onLoadMore={onLoadMore}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const button = screen.getByRole('button', { name: /load more/i });
      button.click();
      
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('Droppable Zone', () => {
    it('should create a droppable zone with correct status', () => {
      const { container } = render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={[]}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      // Verify the droppable zone is rendered (has min-h-[200px] class)
      const dropZone = container.querySelector('.min-h-\\[200px\\]');
      expect(dropZone).toBeInTheDocument();
    });
  });

  describe('Card Interactions', () => {
    it('should call onVoteCard with correct card ID when card is voted', () => {
      const cards = [
        createTestCard({ id: 123, title: 'Card 1' }),
        createTestCard({ id: 456, title: 'Card 2' }),
      ];
      const onVoteCard = vi.fn();

      render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={cards}
            onVoteCard={onVoteCard}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      // Click vote button on first card
      const voteButtons = screen.getAllByRole('button', { name: /click to vote/i });
      voteButtons[0].click();
      
      expect(onVoteCard).toHaveBeenCalledWith(123);
    });

    it('should call onRemoveVote with correct card ID when vote is removed', () => {
      const cards = [
        createTestCard({ id: 789, title: 'Card 1', user_has_voted: true }),
      ];
      const onRemoveVote = vi.fn();

      render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={cards}
            onVoteCard={vi.fn()}
            onRemoveVote={onRemoveVote}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      // Click vote button to remove vote
      const voteButton = screen.getByRole('button', { name: /click to remove your vote/i });
      voteButton.click();
      
      expect(onRemoveVote).toHaveBeenCalledWith(789);
    });
  });

  describe('Styling (Requirement 16.1)', () => {
    it('should apply surface color background', () => {
      const { container } = render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={[]}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const column = container.querySelector('.bg-surface');
      expect(column).toBeInTheDocument();
    });

    it('should apply secondary color to title', () => {
      const { container } = render(
        <DndWrapper>
          <KanbanColumn
            title="To Do"
            status="TODO"
            cards={[]}
            onVoteCard={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const title = container.querySelector('.text-secondary');
      expect(title).toBeInTheDocument();
      expect(title?.textContent).toBe('To Do');
    });
  });
});
