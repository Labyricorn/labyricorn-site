import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import type { components } from '../types/api';
import * as fc from 'fast-check';

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

describe('KanbanCard', () => {
  describe('Basic Rendering', () => {
    it('should render card title', () => {
      const card = createTestCard({ title: 'My Test Card' });
      render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByText('My Test Card')).toBeInTheDocument();
    });

    it('should render vote count', () => {
      const card = createTestCard({ votes: 42 });
      render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('Vote Button States', () => {
    it('should show outline heart when user has not voted', () => {
      const card = createTestCard({ user_has_voted: false });
      render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      // Check for outline heart icon (not filled)
      const button = screen.getByRole('button', { name: /click to vote/i });
      expect(button).toBeInTheDocument();
    });

    it('should show filled heart when user has voted', () => {
      const card = createTestCard({ user_has_voted: true });
      render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const button = screen.getByRole('button', { name: /click to remove your vote/i });
      expect(button).toBeInTheDocument();
    });

    it('should show "Voting disabled" tooltip when voting is disabled', () => {
      const card = createTestCard({ allow_voting: false });
      render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const button = screen.getByRole('button', { name: /voting disabled/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  describe('Drag and Drop', () => {
    it('should enable drag for admin users', () => {
      const card = createTestCard();
      const { container } = render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={true}
          />
        </DndWrapper>
      );
      
      const cardElement = container.querySelector('[class*="cursor-grab"]');
      expect(cardElement).toBeInTheDocument();
    });

    it('should disable drag for non-admin users', () => {
      const card = createTestCard();
      const { container } = render(
        <DndWrapper>
          <KanbanCard
            card={card}
            onVote={vi.fn()}
            onRemoveVote={vi.fn()}
            isAdmin={false}
          />
        </DndWrapper>
      );
      
      const cardElement = container.querySelector('[class*="cursor-default"]');
      expect(cardElement).toBeInTheDocument();
    });
  });

  /**
   * Feature: kanban-board-system, Property 23: Vote button disabled state
   * Validates: Requirements 12.4
   * 
   * Property: For any card with allow_voting=false, the vote button should be 
   * rendered in a disabled state.
   * 
   * This property test verifies that regardless of other card properties (votes, 
   * user_has_voted, title, etc.), when allow_voting is false, the vote button 
   * is always disabled and shows appropriate styling.
   */
  describe('Property 23: Vote button disabled state', () => {
    it('should always disable vote button when allow_voting is false', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary card data
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            status: fc.constantFrom('TODO', 'DOING', 'DONE'),
            votes: fc.integer({ min: 0, max: 1000 }),
            order: fc.integer({ min: 0, max: 100 }),
            user_has_voted: fc.boolean(),
            completed_at: fc.option(
              fc.integer({ min: 1577836800000, max: 1924905600000 })
                .map(ts => new Date(ts).toISOString()),
              { nil: null }
            ),
            created_at: fc.integer({ min: 1577836800000, max: 1924905600000 })
              .map(ts => new Date(ts).toISOString()),
            updated_at: fc.integer({ min: 1577836800000, max: 1924905600000 })
              .map(ts => new Date(ts).toISOString()),
          }),
          fc.boolean(), // isAdmin
          (cardData, isAdmin) => {
            // Force allow_voting to false
            const card: KanbanCardType = {
              ...cardData,
              allow_voting: false,
            };

            const { unmount } = render(
              <DndWrapper>
                <KanbanCard
                  card={card}
                  onVote={vi.fn()}
                  onRemoveVote={vi.fn()}
                  isAdmin={isAdmin}
                />
              </DndWrapper>
            );

            // Verify vote button is disabled
            const button = screen.getByRole('button', { name: /voting disabled/i });
            expect(button).toBeDisabled();
            
            // Verify button has disabled styling (opacity-40 class for cyberpunk theme)
            expect(button.className).toContain('opacity-40');
            expect(button.className).toContain('cursor-not-allowed');

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enable vote button when allow_voting is true', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary card data
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            status: fc.constantFrom('TODO', 'DOING', 'DONE'),
            votes: fc.integer({ min: 0, max: 1000 }),
            order: fc.integer({ min: 0, max: 100 }),
            user_has_voted: fc.boolean(),
            completed_at: fc.option(
              fc.integer({ min: 1577836800000, max: 1924905600000 })
                .map(ts => new Date(ts).toISOString()),
              { nil: null }
            ),
            created_at: fc.integer({ min: 1577836800000, max: 1924905600000 })
              .map(ts => new Date(ts).toISOString()),
            updated_at: fc.integer({ min: 1577836800000, max: 1924905600000 })
              .map(ts => new Date(ts).toISOString()),
          }),
          fc.boolean(), // isAdmin
          (cardData, isAdmin) => {
            // Force allow_voting to true
            const card: KanbanCardType = {
              ...cardData,
              allow_voting: true,
            };

            const { unmount } = render(
              <DndWrapper>
                <KanbanCard
                  card={card}
                  onVote={vi.fn()}
                  onRemoveVote={vi.fn()}
                  isAdmin={isAdmin}
                />
              </DndWrapper>
            );

            // Verify vote button is NOT disabled
            const button = card.user_has_voted
              ? screen.getByRole('button', { name: /click to remove your vote/i })
              : screen.getByRole('button', { name: /click to vote/i });
            
            expect(button).not.toBeDisabled();
            
            // Verify button does NOT have disabled styling
            expect(button.className).not.toContain('opacity-50');
            expect(button.className).not.toContain('cursor-not-allowed');
            expect(button.className).toContain('cursor-pointer');

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
