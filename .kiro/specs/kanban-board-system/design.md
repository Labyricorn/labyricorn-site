# Design Document

## Overview

The Kanban Board System implements an interactive drag-and-drop task management interface for projects. Each project has one Kanban board containing cards organized in three columns (TODO, DOING, DONE). The backend uses Django models with atomic operations for voting and ordering, vote tracking for duplicate prevention, rate limiting for spam protection, and Django Ninja for RESTful API endpoints with automatic board creation via signals. The frontend uses React with @dnd-kit for drag-and-drop, TanStack Query for optimistic updates and auto-refresh, archived card pagination, and cyberpunk-themed styling with glow effects.

## Architecture

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Django Application                       │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Django Ninja)                                    │
│  ├─ /api/v1/projects/{slug}/kanban (GET)                    │
│  ├─ /api/v1/projects/{slug}/kanban/archived (GET)           │
│  ├─ /api/v1/kanban/cards (POST)                             │
│  ├─ /api/v1/kanban/cards/{id} (PATCH, DELETE)               │
│  ├─ /api/v1/kanban/cards/{id}/move (PATCH)                  │
│  ├─ /api/v1/kanban/cards/{id}/vote (POST, DELETE)           │
│  └─ Rate Limiting Middleware                                │
├─────────────────────────────────────────────────────────────┤
│  Business Logic                                              │
│  ├─ Card ordering and reordering                            │
│  ├─ Atomic vote increment/decrement                         │
│  ├─ Vote tracking and duplicate prevention                  │
│  ├─ Rate limiting for vote spam prevention                  │
│  ├─ Status change with order recalculation                  │
│  ├─ Completed timestamp tracking                            │
│  └─ Automatic board creation (signals)                      │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                  │
│  ├─ KanbanBoard Model (OneToOne with Project)               │
│  ├─ KanbanCard Model (ForeignKey to Board)                  │
│  ├─ CardVote Model (Vote tracking with IP hash)             │
│  └─ Admin Interface Registration                            │
├─────────────────────────────────────────────────────────────┤
│  Storage                                                     │
│  └─ PostgreSQL Database                                     │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
├─────────────────────────────────────────────────────────────┤
│  Pages                                                       │
│  └─ ProjectDetailPage (Tab Container)                       │
│      └─ KanbanTab                                            │
├─────────────────────────────────────────────────────────────┤
│  Components                                                  │
│  ├─ KanbanBoard (DndContext wrapper)                        │
│  ├─ KanbanColumn (Droppable area)                           │
│  ├─ KanbanCard (Draggable item)                             │
│  ├─ VoteButton (Optimistic voting with remove)              │
│  ├─ LoadMoreButton (Archived cards pagination)              │
│  └─ CardSkeleton (Loading state)                            │
├─────────────────────────────────────────────────────────────┤
│  Hooks                                                       │
│  ├─ useKanbanBoard (Fetch board data with auto-refresh)     │
│  ├─ useArchivedCards (Fetch archived DONE cards)            │
│  ├─ useMoveCard (Move/reorder mutation)                     │
│  ├─ useVoteCard (Vote mutation with optimistic update)      │
│  ├─ useRemoveVote (Remove vote mutation)                    │
│  ├─ useCreateCard (Admin only)                              │
│  ├─ useUpdateCard (Admin only)                              │
│  └─ useDeleteCard (Admin only)                              │
├─────────────────────────────────────────────────────────────┤
│  Services                                                    │
│  └─ API Client (Axios with types)                           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### Django Model: KanbanBoard

```python
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class KanbanBoard(models.Model):
    project = models.OneToOneField(
        'Project',
        on_delete=models.CASCADE,
        related_name='kanban_board'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Kanban Board for {self.project.title}"
    
    class Meta:
        ordering = ['created_at']

@receiver(post_save, sender='api.Project')
def create_kanban_board(sender, instance, created, **kwargs):
    """Automatically create a Kanban board when a project is created"""
    if created:
        KanbanBoard.objects.create(project=instance)
```

#### Django Model: KanbanCard

```python
from django.db import models, transaction
from django.db.models import F, Max
from django.utils import timezone

class KanbanCard(models.Model):
    STATUS_CHOICES = [
        ('TODO', 'To Do'),
        ('DOING', 'Doing'),
        ('DONE', 'Done'),
    ]
    
    board = models.ForeignKey(
        KanbanBoard,
        on_delete=models.CASCADE,
        related_name='cards'
    )
    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='TODO',
        db_index=True
    )
    votes = models.IntegerField(default=0)
    allow_voting = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['status', 'order']
        indexes = [
            models.Index(fields=['board', 'status', 'order']),
            models.Index(fields=['board', 'status', '-completed_at']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.status})"
    
    def save(self, *args, **kwargs):
        """Set order to end of column if not specified"""
        if self.pk is None and self.order == 0:
            max_order = KanbanCard.objects.filter(
                board=self.board,
                status=self.status
            ).aggregate(Max('order'))['order__max']
            self.order = (max_order or -1) + 1
        super().save(*args, **kwargs)
    
    def increment_vote(self, ip_hash):
        """Atomically increment vote count and create vote record"""
        if not self.allow_voting:
            raise ValueError("Voting is disabled for this card")
        
        with transaction.atomic():
            # Check for duplicate vote
            if CardVote.objects.filter(card=self, ip_hash=ip_hash).exists():
                raise ValueError("User has already voted on this card")
            
            # Create vote record
            CardVote.objects.create(card=self, ip_hash=ip_hash)
            
            # Increment vote count
            KanbanCard.objects.filter(pk=self.pk).update(votes=F('votes') + 1)
            self.refresh_from_db()
    
    def decrement_vote(self, ip_hash):
        """Atomically decrement vote count and remove vote record"""
        if not self.allow_voting:
            raise ValueError("Voting is disabled for this card")
        
        with transaction.atomic():
            # Find and delete vote record
            vote = CardVote.objects.filter(card=self, ip_hash=ip_hash).first()
            if not vote:
                raise ValueError("User has not voted on this card")
            
            vote.delete()
            
            # Decrement vote count
            KanbanCard.objects.filter(pk=self.pk).update(votes=F('votes') - 1)
            self.refresh_from_db()
    
    def has_user_voted(self, ip_hash):
        """Check if user has voted on this card"""
        return CardVote.objects.filter(card=self, ip_hash=ip_hash).exists()
    
    def move_to(self, new_status, new_order):
        """Move card to new status and/or position"""
        old_status = self.status
        old_order = self.order
        
        with transaction.atomic():
            # Set completed_at timestamp when moving to DONE
            if new_status == 'DONE' and old_status != 'DONE':
                self.completed_at = timezone.now()
            elif new_status != 'DONE' and old_status == 'DONE':
                self.completed_at = None
            
            # Remove from old position
            if old_status == new_status:
                # Reordering within same column
                if new_order < old_order:
                    # Moving up
                    KanbanCard.objects.filter(
                        board=self.board,
                        status=old_status,
                        order__gte=new_order,
                        order__lt=old_order
                    ).update(order=F('order') + 1)
                elif new_order > old_order:
                    # Moving down
                    KanbanCard.objects.filter(
                        board=self.board,
                        status=old_status,
                        order__gt=old_order,
                        order__lte=new_order
                    ).update(order=F('order') - 1)
            else:
                # Moving to different column
                # Close gap in old column
                KanbanCard.objects.filter(
                    board=self.board,
                    status=old_status,
                    order__gt=old_order
                ).update(order=F('order') - 1)
                
                # Make space in new column
                KanbanCard.objects.filter(
                    board=self.board,
                    status=new_status,
                    order__gte=new_order
                ).update(order=F('order') + 1)
            
            # Update this card
            self.status = new_status
            self.order = new_order
            self.save()
```

#### Django Model: CardVote

```python
from django.db import models
from django.utils import timezone
import hashlib

class CardVote(models.Model):
    """Track individual votes to prevent duplicates and enable vote removal"""
    card = models.ForeignKey(
        KanbanCard,
        on_delete=models.CASCADE,
        related_name='vote_records'
    )
    ip_hash = models.CharField(max_length=64, db_index=True)
    voted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        unique_together = [['card', 'ip_hash']]
        indexes = [
            models.Index(fields=['card', 'ip_hash']),
            models.Index(fields=['voted_at']),
        ]
    
    def __str__(self):
        return f"Vote on {self.card.title} at {self.voted_at}"
    
    @staticmethod
    def hash_ip(ip_address):
        """Hash IP address for privacy"""
        return hashlib.sha256(ip_address.encode()).hexdigest()
    
    @classmethod
    def cleanup_old_votes(cls):
        """Remove vote records older than 90 days"""
        cutoff_date = timezone.now() - timezone.timedelta(days=90)
        cls.objects.filter(voted_at__lt=cutoff_date).delete()
```

#### Django Ninja Schemas

```python
from ninja import Schema
from typing import List, Optional
from datetime import datetime

class KanbanCardSchema(Schema):
    id: int
    title: str
    status: str
    votes: int
    allow_voting: bool
    order: int
    user_has_voted: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class KanbanBoardSchema(Schema):
    id: int
    project_id: int
    todo_cards: List[KanbanCardSchema]
    doing_cards: List[KanbanCardSchema]
    done_cards: List[KanbanCardSchema]
    has_more_done: bool

class ArchivedCardsSchema(Schema):
    cards: List[KanbanCardSchema]
    has_more: bool
    total_count: int

class CardCreateSchema(Schema):
    board_id: int
    title: str
    status: str = 'TODO'

class CardUpdateSchema(Schema):
    title: Optional[str] = None
    allow_voting: Optional[bool] = None

class CardMoveSchema(Schema):
    status: str
    order: int

class VoteResponseSchema(Schema):
    id: int
    votes: int
    user_has_voted: bool

class ErrorSchema(Schema):
    detail: str
    errors: Optional[dict] = None
```

#### API Endpoints

```python
from ninja import Router
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.core.cache import cache
from typing import List

router = Router()

def get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def check_rate_limit(ip_hash, limit=10, window=60):
    """Check if IP has exceeded rate limit (10 votes per minute)"""
    cache_key = f"vote_rate_limit:{ip_hash}"
    vote_count = cache.get(cache_key, 0)
    
    if vote_count >= limit:
        return False
    
    cache.set(cache_key, vote_count + 1, window)
    return True

@router.get("/projects/{slug}/kanban", response=KanbanBoardSchema)
def get_kanban_board(request, slug: str):
    """Get Kanban board for a project with cards grouped by status (50 DONE limit)"""
    project = get_object_or_404(Project, slug=slug)
    board = project.kanban_board
    
    # Get client IP for vote tracking
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Get all TODO and DOING cards
    todo_cards = list(board.cards.filter(status='TODO'))
    doing_cards = list(board.cards.filter(status='DOING'))
    
    # Get only 50 most recent DONE cards
    done_cards = list(
        board.cards.filter(status='DONE')
        .order_by('-completed_at', 'order')[:50]
    )
    
    # Check if there are more DONE cards
    total_done = board.cards.filter(status='DONE').count()
    has_more_done = total_done > 50
    
    # Add user_has_voted flag to each card
    def add_vote_flag(card):
        card.user_has_voted = card.has_user_voted(ip_hash)
        return card
    
    return {
        "id": board.id,
        "project_id": project.id,
        "todo_cards": [add_vote_flag(c) for c in todo_cards],
        "doing_cards": [add_vote_flag(c) for c in doing_cards],
        "done_cards": [add_vote_flag(c) for c in done_cards],
        "has_more_done": has_more_done,
    }

@router.get("/projects/{slug}/kanban/archived", response=ArchivedCardsSchema)
def get_archived_cards(request, slug: str, offset: int = 0, limit: int = 50):
    """Get archived DONE cards with pagination"""
    project = get_object_or_404(Project, slug=slug)
    board = project.kanban_board
    
    # Get client IP for vote tracking
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Get DONE cards with pagination
    done_cards_query = board.cards.filter(status='DONE').order_by('-completed_at', 'order')
    total_count = done_cards_query.count()
    
    cards = list(done_cards_query[offset:offset + limit])
    has_more = (offset + limit) < total_count
    
    # Add user_has_voted flag
    for card in cards:
        card.user_has_voted = card.has_user_voted(ip_hash)
    
    return {
        "cards": cards,
        "has_more": has_more,
        "total_count": total_count,
    }

@router.post("/kanban/cards", response=KanbanCardSchema, auth=admin_required)
def create_card(request, data: CardCreateSchema):
    """Create a new Kanban card (admin only)"""
    board = get_object_or_404(KanbanBoard, id=data.board_id)
    
    card = KanbanCard.objects.create(
        board=board,
        title=data.title,
        status=data.status
    )
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return card

@router.patch("/kanban/cards/{card_id}", response=KanbanCardSchema, auth=admin_required)
def update_card(request, card_id: int, data: CardUpdateSchema):
    """Update a Kanban card (admin only)"""
    card = get_object_or_404(KanbanCard, id=card_id)
    
    if data.title is not None:
        card.title = data.title
    if data.allow_voting is not None:
        card.allow_voting = data.allow_voting
    
    card.save()
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return card

@router.delete("/kanban/cards/{card_id}", auth=admin_required)
def delete_card(request, card_id: int):
    """Delete a Kanban card (admin only)"""
    card = get_object_or_404(KanbanCard, id=card_id)
    
    with transaction.atomic():
        # Close gap in column
        KanbanCard.objects.filter(
            board=card.board,
            status=card.status,
            order__gt=card.order
        ).update(order=F('order') - 1)
        
        card.delete()
    
    return {"success": True}

@router.patch("/kanban/cards/{card_id}/move", response=KanbanCardSchema, auth=admin_required)
def move_card(request, card_id: int, data: CardMoveSchema):
    """Move or reorder a Kanban card (admin only)"""
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Validate status
    valid_statuses = ['TODO', 'DOING', 'DONE']
    if data.status not in valid_statuses:
        return 400, {"detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}
    
    # Clamp order to valid range
    max_order = KanbanCard.objects.filter(
        board=card.board,
        status=data.status
    ).count()
    clamped_order = max(0, min(data.order, max_order))
    
    card.move_to(data.status, clamped_order)
    card.refresh_from_db()
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return card

@router.post("/kanban/cards/{card_id}/vote", response=VoteResponseSchema)
def vote_card(request, card_id: int):
    """Vote on a Kanban card (public endpoint with rate limiting)"""
    card = get_object_or_404(KanbanCard, id=card_id)
    
    if not card.allow_voting:
        return 403, {"detail": "Voting is disabled for this card"}
    
    # Get and hash IP address
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Check rate limit
    if not check_rate_limit(ip_hash):
        return 429, {
            "detail": "Rate limit exceeded. Please try again later.",
            "retry_after": 60
        }
    
    try:
        card.increment_vote(ip_hash)
    except ValueError as e:
        if "already voted" in str(e):
            return 409, {"detail": str(e)}
        return 403, {"detail": str(e)}
    
    return {
        "id": card.id,
        "votes": card.votes,
        "user_has_voted": True,
    }

@router.delete("/kanban/cards/{card_id}/vote", response=VoteResponseSchema)
def remove_vote(request, card_id: int):
    """Remove vote from a Kanban card (public endpoint)"""
    card = get_object_or_404(KanbanCard, id=card_id)
    
    if not card.allow_voting:
        return 403, {"detail": "Voting is disabled for this card"}
    
    # Get and hash IP address
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    try:
        card.decrement_vote(ip_hash)
    except ValueError as e:
        if "has not voted" in str(e):
            return 404, {"detail": str(e)}
        return 403, {"detail": str(e)}
    
    return {
        "id": card.id,
        "votes": card.votes,
        "user_has_voted": False,
    }
```

### Frontend Components

#### React Hook: useKanbanBoard

```typescript
import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type KanbanBoard = components['schemas']['KanbanBoardSchema'];

export function useKanbanBoard(projectSlug: string, isDragging: boolean = false) {
  const lastFetchTime = useRef<number>(Date.now());
  
  const query = useQuery({
    queryKey: ['kanban', projectSlug],
    queryFn: async () => {
      const response = await apiClient.get<KanbanBoard>(
        `/projects/${projectSlug}/kanban`
      );
      lastFetchTime.current = Date.now();
      return response.data;
    },
    enabled: !!projectSlug,
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: isDragging ? false : 15 * 1000, // Auto-refresh every 15s unless dragging
    refetchIntervalInBackground: false,
  });
  
  return query;
}
```

#### React Hook: useArchivedCards

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ArchivedCards = components['schemas']['ArchivedCardsSchema'];

export function useArchivedCards(projectSlug: string) {
  return useInfiniteQuery({
    queryKey: ['kanban-archived', projectSlug],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiClient.get<ArchivedCards>(
        `/projects/${projectSlug}/kanban/archived`,
        { params: { offset: pageParam, limit: 50 } }
      );
      return response.data;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.has_more) {
        return pages.length * 50;
      }
      return undefined;
    },
    enabled: !!projectSlug,
  });
}
```

#### React Hook: useVoteCard

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export function useVoteCard(projectSlug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cardId: number) => {
      const response = await apiClient.post(`/kanban/cards/${cardId}/vote`);
      return response.data;
    },
    onMutate: async (cardId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['kanban', projectSlug]);
      
      // Snapshot previous value
      const previousBoard = queryClient.getQueryData(['kanban', projectSlug]);
      
      // Optimistically update
      queryClient.setQueryData(['kanban', projectSlug], (old: any) => {
        if (!old) return old;
        
        const updateCards = (cards: any[]) =>
          cards.map(card =>
            card.id === cardId
              ? { ...card, votes: card.votes + 1, user_has_voted: true }
              : card
          );
        
        return {
          ...old,
          todo_cards: updateCards(old.todo_cards),
          doing_cards: updateCards(old.doing_cards),
          done_cards: updateCards(old.done_cards),
        };
      });
      
      return { previousBoard };
    },
    onError: (err, cardId, context) => {
      // Revert on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['kanban', projectSlug], context.previousBoard);
      }
      
      // Show error message
      const error = err as any;
      if (error.response?.status === 429) {
        alert('Rate limit exceeded. Please wait a minute before voting again.');
      } else if (error.response?.status === 409) {
        alert('You have already voted on this card.');
      } else {
        alert('Failed to vote. Please try again.');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries(['kanban', projectSlug]);
    },
  });
}
```

#### React Hook: useRemoveVote

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export function useRemoveVote(projectSlug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cardId: number) => {
      const response = await apiClient.delete(`/kanban/cards/${cardId}/vote`);
      return response.data;
    },
    onMutate: async (cardId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['kanban', projectSlug]);
      
      // Snapshot previous value
      const previousBoard = queryClient.getQueryData(['kanban', projectSlug]);
      
      // Optimistically update
      queryClient.setQueryData(['kanban', projectSlug], (old: any) => {
        if (!old) return old;
        
        const updateCards = (cards: any[]) =>
          cards.map(card =>
            card.id === cardId
              ? { ...card, votes: card.votes - 1, user_has_voted: false }
              : card
          );
        
        return {
          ...old,
          todo_cards: updateCards(old.todo_cards),
          doing_cards: updateCards(old.doing_cards),
          done_cards: updateCards(old.done_cards),
        };
      });
      
      return { previousBoard };
    },
    onError: (err, cardId, context) => {
      // Revert on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['kanban', projectSlug], context.previousBoard);
      }
      
      // Show error message
      const error = err as any;
      if (error.response?.status === 404) {
        alert('You have not voted on this card.');
      } else {
        alert('Failed to remove vote. Please try again.');
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries(['kanban', projectSlug]);
    },
  });
}
```

#### React Hook: useMoveCard

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface MoveCardParams {
  cardId: number;
  status: string;
  order: number;
}

export function useMoveCard(projectSlug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cardId, status, order }: MoveCardParams) => {
      const response = await apiClient.patch(
        `/kanban/cards/${cardId}/move`,
        { status, order }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['kanban', projectSlug]);
    },
  });
}
```

#### React Component: KanbanBoard

```typescript
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  board: KanbanBoard;
  onMoveCard: (cardId: number, status: string, order: number) => void;
  onVoteCard: (cardId: number) => void;
  onRemoveVote: (cardId: number) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isAdmin: boolean;
}

export function KanbanBoard({ 
  board, 
  onMoveCard, 
  onVoteCard, 
  onRemoveVote,
  onLoadMore,
  isLoadingMore,
  isAdmin 
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = (event) => {
    setActiveCard(event.active.data.current.card);
    setIsDragging(true);
  };
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    setIsDragging(false);
    
    if (!over) {
      setActiveCard(null);
      return;
    }
    
    const cardId = active.id;
    const newStatus = over.data.current.status;
    const newOrder = over.data.current.order;
    
    onMoveCard(cardId, newStatus, newOrder);
    setActiveCard(null);
  };
  
  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-6">
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
          <div className="ring-4 ring-primary shadow-lg shadow-primary/50">
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
```

#### React Component: KanbanColumn

```typescript
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  status: string;
  cards: KanbanCard[];
  onVoteCard: (cardId: number) => void;
  onRemoveVote: (cardId: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isAdmin: boolean;
}

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
    <div className="bg-surface rounded-lg p-4">
      <h3 className="text-lg font-bold text-secondary mb-4">{title}</h3>
      
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
                  className="w-full py-2 px-4 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
```

#### React Component: KanbanCard

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

interface KanbanCardProps {
  card: KanbanCard;
  onVote: () => void;
  onRemoveVote: () => void;
  isAdmin: boolean;
}

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
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-background border-2 border-primary/30 rounded-lg p-3 hover:border-primary transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-200 flex-1">{card.title}</p>
        
        <button
          onClick={handleVoteClick}
          disabled={!card.allow_voting}
          className={`flex items-center gap-1 text-xs transition-colors ${
            card.allow_voting
              ? card.user_has_voted
                ? 'text-success hover:text-success/60'
                : 'text-gray-400 hover:text-success'
              : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
          title={
            !card.allow_voting
              ? 'Voting disabled'
              : card.user_has_voted
              ? 'Click to remove your vote'
              : 'Click to vote'
          }
        >
          {card.user_has_voted ? (
            <HeartSolidIcon className="w-4 h-4" />
          ) : (
            <HeartIcon className="w-4 h-4" />
          )}
          <span>{card.votes}</span>
        </button>
      </div>
    </div>
  );
}
```

## Data Models

### KanbanBoard Model Schema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key | Unique identifier |
| project | ForeignKey | OneToOne, CASCADE | Reference to Project |
| created_at | DateTime | Auto-set | Creation timestamp |

### KanbanCard Model Schema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key | Unique identifier |
| board | ForeignKey | CASCADE | Reference to KanbanBoard |
| title | String(200) | Not null | Card title/description |
| status | String(10) | Choices: TODO/DOING/DONE | Column status |
| votes | Integer | Default: 0, Non-negative | Vote count |
| allow_voting | Boolean | Default: True | Voting enabled flag |
| order | Integer | Default: 0, Non-negative | Position in column |
| completed_at | DateTime | Nullable, Indexed | Timestamp when moved to DONE |
| created_at | DateTime | Auto-set | Creation timestamp |
| updated_at | DateTime | Auto-update | Last update timestamp |

### CardVote Model Schema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key | Unique identifier |
| card | ForeignKey | CASCADE | Reference to KanbanCard |
| ip_hash | String(64) | Indexed | SHA-256 hash of voter IP |
| voted_at | DateTime | Auto-set, Indexed | Vote timestamp |

### Database Indexes

- KanbanCard: Composite index on (board, status, order) for efficient column queries
- KanbanCard: Composite index on (board, status, -completed_at) for archived card queries
- KanbanCard: Index on status for filtering
- KanbanCard: Index on completed_at for DONE card sorting
- CardVote: Unique constraint on (card, ip_hash) to prevent duplicate votes
- CardVote: Composite index on (card, ip_hash) for vote lookups
- CardVote: Index on voted_at for cleanup queries

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Automatic board creation
*For any* project, when it is created, a Kanban board should be automatically created and associated with it through a one-to-one relationship.
**Validates: Requirements 1.1, 1.3**

### Property 2: Cascade deletion
*For any* project with a Kanban board, deleting the project should result in the board being deleted as well.
**Validates: Requirements 1.2**

### Property 3: One board per project
*For any* project, attempting to create a second Kanban board should be rejected, enforcing the one-to-one constraint.
**Validates: Requirements 1.4**

### Property 4: Card creation with defaults
*For any* valid card title and board, creating a card should result in a new card with status=TODO, votes=0, allow_voting=true, and order value placing it at the end of the TODO column.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 5: Title update preservation
*For any* card, updating its title should change only the title field while preserving status, votes, order, and allow_voting values.
**Validates: Requirements 3.1, 3.2**

### Property 6: Card deletion and reordering
*For any* card in a column, deleting it should remove the card from the database and adjust the order values of remaining cards in the same column to fill the gap.
**Validates: Requirements 4.1, 4.2**

### Property 7: Status change during move
*For any* card, moving it to a different status should update the card's status field and assign an appropriate order value in the destination column.
**Validates: Requirements 5.1, 5.2**

### Property 8: Order recalculation during moves
*For any* card being moved (to a different column or reordered within the same column), all affected cards in both source and destination columns should have their order values recalculated to maintain sequential ordering.
**Validates: Requirements 5.3, 6.1, 6.2**

### Property 9: Invalid status rejection
*For any* move request with a status value other than TODO, DOING, or DONE, the system should return a 400 error with a validation message.
**Validates: Requirements 5.4, 10.2**

### Property 10: Position boundary clamping
*For any* move request with an out-of-bounds order value, the system should clamp the position to the nearest valid value (0 to column length).
**Validates: Requirements 6.3**

### Property 11: Vote increment
*For any* card with allow_voting=true, voting on it should atomically increment the vote count by exactly 1.
**Validates: Requirements 7.1, 7.3**

### Property 12: Voting rejection for disabled cards
*For any* card with allow_voting=false, attempting to vote should return a 403 error with a descriptive message.
**Validates: Requirements 7.2, 14.5**

### Property 13: Voting control toggle
*For any* card, toggling allow_voting between true and false should control whether votes are accepted, while preserving the existing vote count.
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 14: Board retrieval with grouping
*For any* project, requesting its Kanban board should return all cards grouped by status (todo_cards, doing_cards, done_cards) and ordered by the order field within each group.
**Validates: Requirements 9.1, 9.2**

### Property 15: Card response completeness
*For any* card returned by the API, the response should include all required fields: id, title, status, votes, allow_voting, order, created_at, and updated_at.
**Validates: Requirements 9.4**

### Property 16: Title validation
*For any* card submission with an empty title or a title exceeding 200 characters, the system should reject it with a 400 error and validation message.
**Validates: Requirements 10.1**

### Property 17: Votes validation
*For any* card submission with a negative votes value, the system should reject it with a 400 error and validation message.
**Validates: Requirements 10.3**

### Property 18: Order validation
*For any* card submission with a negative order value, the system should reject it with a 400 error and validation message.
**Validates: Requirements 10.4**

### Property 19: Boolean validation
*For any* card submission where allow_voting is not a boolean value, the system should reject it with a 400 error and validation message.
**Validates: Requirements 10.5**

### Property 20: Drag-drop API integration
*For any* card drop event in the UI, the system should send a move request to the API with the new status and order, and update the UI based on the API response.
**Validates: Requirements 11.2, 11.3**

### Property 21: Drag-drop error handling
*For any* card drop event where the API rejects the move, the system should revert the card to its original position in the UI.
**Validates: Requirements 11.4**

### Property 22: Optimistic voting updates
*For any* vote button click, the system should immediately increment the displayed vote count, maintain it on API success, or revert it on API failure with an error message.
**Validates: Requirements 12.1, 12.2, 12.3**

### Property 23: Vote button disabled state
*For any* card with allow_voting=false, the vote button should be rendered in a disabled state.
**Validates: Requirements 12.4**

### Property 24: 404 error for missing resources
*For any* request for a non-existent card ID, the system should return a 404 error with a descriptive message.
**Validates: Requirements 3.3, 4.3, 7.4, 14.2**

### Property 25: Validation error response format
*For any* validation failure, the API should return a 400 status code with a response body containing detailed validation error messages.
**Validates: Requirements 14.1**

### Property 26: Authentication error handling
*For any* admin-only endpoint, requests without authentication should return a 401 error.
**Validates: Requirements 14.3**

### Property 27: Authorization error handling
*For any* admin-only endpoint, requests from non-admin authenticated users should return a 403 error.
**Validates: Requirements 14.4**

### Property 28: Vote removal
*For any* card where a user has voted, removing the vote should decrement the vote count by 1 and delete the vote record.
**Validates: Requirements 18.1, 18.3**

### Property 29: Vote removal rejection for non-voters
*For any* card where a user has not voted, attempting to remove a vote should return a 404 error.
**Validates: Requirements 18.2**

### Property 30: Vote removal disabled state
*For any* card with allow_voting=false, attempting to remove a vote should return a 403 error.
**Validates: Requirements 18.4**

### Property 31: Rate limiting enforcement
*For any* IP address, attempting more than 10 votes within 60 seconds should result in a 429 error with retry-after header.
**Validates: Requirements 19.1, 14.6**

### Property 32: Duplicate vote prevention
*For any* card and IP address, attempting to vote twice should return a 409 error.
**Validates: Requirements 7.2, 19.2**

### Property 33: IP hash privacy
*For any* vote record, the stored IP address should be a SHA-256 hash, not the raw IP address.
**Validates: Requirements 19.3**

### Property 34: Vote record expiration
*For any* vote record older than 90 days, the system should allow the same IP to vote again on the same card.
**Validates: Requirements 19.4**

### Property 35: DONE card limit
*For any* project board request, the response should include only the 50 most recently completed DONE cards.
**Validates: Requirements 9.3**

### Property 36: User vote status
*For any* card in the API response, the user_has_voted field should accurately reflect whether the requesting user has voted on that card.
**Validates: Requirements 9.6**

### Property 37: Archived cards pagination
*For any* archived cards request, the system should return cards based on offset and limit parameters with has_more flag.
**Validates: Requirements 20.1, 20.2**

### Property 38: Archived cards ordering
*For any* archived cards response, cards should be ordered by completion date descending.
**Validates: Requirements 20.4**

### Property 39: Empty archived response
*For any* archived cards request where no more cards exist, the system should return an empty array.
**Validates: Requirements 20.3**

### Property 40: Auto-refresh interval
*For any* Kanban board view, the system should automatically refetch board data every 15 seconds.
**Validates: Requirements 21.1, 21.2**

### Property 41: Drag pause auto-refresh
*For any* active drag operation, the system should pause automatic refetching to prevent conflicts.
**Validates: Requirements 21.3**

### Property 42: Completed timestamp
*For any* card moved to DONE status, the system should set the completed_at timestamp to the current time.
**Validates: Requirements 5.4**

## Error Handling

### Validation Errors (400)
- Empty or oversized title (>200 chars)
- Invalid status (not TODO/DOING/DONE)
- Negative votes or order values
- Non-boolean allow_voting value
- Response format: `{"detail": "Validation failed", "errors": {"field": ["error message"]}}`

### Authentication Errors (401)
- Unauthenticated requests to admin endpoints (POST, PATCH, DELETE)
- Response format: `{"detail": "Authentication required"}`

### Authorization Errors (403)
- Non-admin users attempting admin operations
- Voting on cards with voting disabled
- Removing vote from cards with voting disabled
- Response format: `{"detail": "Permission denied"}` or `{"detail": "Voting is disabled for this card"}`

### Not Found Errors (404)
- Card ID does not exist
- Project slug does not exist
- Attempting to remove vote that doesn't exist
- Response format: `{"detail": "Card not found"}`, `{"detail": "Project not found"}`, or `{"detail": "User has not voted on this card"}`

### Conflict Errors (409)
- Attempting to vote on a card already voted on
- Response format: `{"detail": "User has already voted on this card"}`

### Rate Limit Errors (429)
- Exceeding 10 votes per minute from same IP
- Response format: `{"detail": "Rate limit exceeded. Please try again later.", "retry_after": 60}`
- Include Retry-After header with seconds until limit resets

### Server Errors (500)
- Database connection failures
- Race condition failures (should be rare with atomic operations)
- Unexpected exceptions
- Response format: `{"detail": "Internal server error"}`
- All 500 errors should be logged with full stack traces

## Testing Strategy

### Property-Based Testing

We will use **Hypothesis** for Python property-based testing. Each correctness property will be implemented as a Hypothesis test with appropriate strategies for generating test data.

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with format: `# Feature: kanban-board-system, Property X: [property text]`

**Test Strategies:**
- `board_strategy`: Generates KanbanBoard instances with associated projects
- `card_strategy`: Generates KanbanCard instances with random titles, statuses, votes
- `vote_strategy`: Generates CardVote instances with random IP hashes
- `move_strategy`: Generates valid move operations (status, order pairs)
- `invalid_status_strategy`: Generates invalid status strings
- `concurrent_vote_strategy`: Generates concurrent vote operations to test atomicity
- `ip_address_strategy`: Generates random IP addresses for rate limiting tests
- `pagination_strategy`: Generates offset/limit pairs for pagination tests

**Key Property Tests:**
1. Automatic board creation for all projects
2. Order recalculation correctness during moves and deletions
3. Atomic vote increment/decrement under concurrent operations
4. Duplicate vote prevention with IP hash tracking
5. Rate limiting enforcement (10 votes per minute)
6. Vote removal and vote record cleanup
7. Archived card pagination and ordering
8. Completed timestamp setting when moving to DONE
9. IP hash privacy (no raw IPs stored)
10. Auto-refresh behavior during drag operations
11. Optimistic update rollback on API failures
12. Validation rejection for all invalid input types
13. Error response format consistency

### Unit Testing

Unit tests will cover:
- Specific examples of card ordering (e.g., moving card from position 2 to 5)
- Signal handler for automatic board creation
- Admin interface registration and configuration
- API endpoint existence and routing
- OpenAPI schema generation
- TypeScript type generation
- Frontend component rendering with specific test data
- Drag-and-drop event handling
- Optimistic update logic

### Integration Testing

Integration tests will verify:
- End-to-end card creation flow (API → Database)
- End-to-end move operation (UI → API → Database → UI update)
- End-to-end voting flow with optimistic updates
- Error handling across API and UI layers
- Tab navigation and board loading

### Test Organization

**Backend:**
```
backend/api/tests/
├── test_kanban_models.py       # Model logic, ordering, signals
├── test_kanban_api.py          # API endpoint behavior
├── test_kanban_validation.py   # Input validation
├── test_kanban_admin.py        # Admin interface
└── test_kanban_properties.py   # Hypothesis property tests
```

**Frontend:**
```
frontend/src/
├── hooks/
│   ├── useKanbanBoard.test.ts
│   ├── useMoveCard.test.ts
│   └── useVoteCard.test.ts
├── components/
│   ├── KanbanBoard.test.tsx
│   ├── KanbanColumn.test.tsx
│   └── KanbanCard.test.tsx
└── pages/
    └── ProjectDetailPage.kanban.test.tsx
```

## Performance Considerations

### Database Optimization
- Composite index on (board, status, order) for efficient column queries
- Use atomic F() expressions for vote increments to prevent race conditions
- Use select_for_update() in move operations if needed for additional safety
- Batch order updates in single transaction during moves

### API Response Optimization
- Return cards grouped by status to minimize client-side processing
- Include all necessary fields in single query (no N+1 problems)
- Consider caching board data with short TTL (30 seconds)

### Frontend Optimization
- Use TanStack Query caching (30-second stale time)
- Implement optimistic updates for voting to feel instant
- Use @dnd-kit's built-in performance optimizations
- Debounce rapid move operations if needed
- Lazy load Kanban tab content (only fetch when tab is active)

### Drag-and-Drop Performance
- Use CSS transforms for smooth animations
- Minimize re-renders during drag operations
- Use React.memo for KanbanCard components
- Implement virtual scrolling if columns have many cards (future enhancement)

## Security Considerations

### Authentication & Authorization
- All write operations (POST, PATCH, DELETE) except voting require admin authentication
- Voting endpoint is public but rate-limited (future enhancement)
- Use Django's built-in authentication system
- Verify user.is_staff or user.is_superuser for admin operations

### Input Validation
- Sanitize all user inputs (titles)
- Validate status enum values
- Validate numeric ranges (votes, order)
- Use Django ORM to prevent SQL injection

### Race Condition Prevention
- Use atomic F() expressions for vote increments
- Use database transactions for move operations
- Use select_for_update() if concurrent moves become an issue
- Test concurrent operations in property tests

### CSRF Protection
- CSRF tokens required for all state-changing operations
- Already configured in base-site-setup

### Rate Limiting
- Consider rate limiting on voting endpoint (future enhancement)
- Prevent vote spam from single IP/user

## Deployment Considerations

### Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### Signal Registration
- Ensure signals are imported in apps.py ready() method
- Test signal behavior in automated tests

### Scheduled Tasks
Set up a periodic task to clean up old vote records (90+ days):

```python
# In management/commands/cleanup_old_votes.py
from django.core.management.base import BaseCommand
from api.models import CardVote

class Command(BaseCommand):
    help = 'Remove vote records older than 90 days'
    
    def handle(self, *args, **options):
        deleted_count = CardVote.cleanup_old_votes()
        self.stdout.write(f'Deleted {deleted_count} old vote records')
```

Schedule with cron or Celery:
```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/project && python manage.py cleanup_old_votes
```

### Cache Configuration
- Configure cache backend for rate limiting (Redis recommended for production)
- Ensure cache is accessible across all application servers
- Monitor cache hit rates and memory usage

### Environment Variables
- No new environment variables required
- Uses existing database and Django configuration
- Consider adding RATE_LIMIT_VOTES_PER_MINUTE (default: 10) for configurability

## Future Enhancements

### Phase 2 Features
- Card descriptions (markdown support)
- Card due dates and reminders
- Card assignees (link to users)
- Card labels/tags with colors
- Activity log for card changes
- Comments on cards

### Phase 3 Features
- Multiple boards per project (sprints, milestones)
- Board templates
- Card archiving instead of deletion
- Export board to CSV/JSON
- Keyboard shortcuts for card operations
- Bulk card operations

### Performance Enhancements
- WebSocket updates for real-time collaboration (replace polling)
- Virtual scrolling for large boards
- Board-level caching with cache invalidation
- Database query optimization with select_related/prefetch_related
- CDN caching for static board views

### Analytics Enhancements
- Vote analytics dashboard
- Card completion time tracking
- User engagement metrics
- Popular cards trending view

## Dependencies

### Backend
- Django 5.0+ (already installed)
- Django cache framework (for rate limiting) - already configured
- hashlib (for IP hashing) - Python standard library
- No new backend dependencies required

### Frontend
- @dnd-kit/core (for drag-and-drop) - **NEW**
- @dnd-kit/sortable (for sortable lists) - **NEW**
- @dnd-kit/utilities (for CSS transforms) - **NEW**
- @heroicons/react (for vote icon) - **NEW**
- Existing dependencies: react-router-dom, @tanstack/react-query, axios

### Installation Commands

**Frontend:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @heroicons/react
```

### Cache Configuration

The rate limiting feature requires Django's cache framework. Ensure cache is configured in settings.py:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'kanban-rate-limit',
    }
}
```

For production, consider using Redis or Memcached for distributed caching.

## Integration with Existing Features

### Project Model Integration
- KanbanBoard has OneToOneField to Project
- Automatic board creation via post_save signal
- Cascade deletion when project is deleted
- Access board via `project.kanban_board`

### Project Detail Page Integration
- Add Kanban tab to existing tab container
- Fetch board data when tab is activated
- Share authentication context with other tabs
- Maintain consistent cyberpunk styling

### API Integration
- Add Kanban router to existing Django Ninja API
- Follow same authentication patterns as Projects API
- Include Kanban schemas in OpenAPI generation
- Generate TypeScript types alongside Project types
