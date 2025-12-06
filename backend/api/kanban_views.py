"""
Django Ninja API views for Kanban Board Management

This module implements RESTful API endpoints for Kanban board operations.
Public endpoints: GET board, GET archived cards, POST/DELETE vote
Admin endpoints: POST/PATCH/DELETE cards, PATCH move
"""
from ninja import Router
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import F
from typing import Optional
from api.models import Project, KanbanBoard, KanbanCard, CardVote
from api.schemas import (
    KanbanBoardSchema,
    ArchivedCardsSchema,
    KanbanCardSchema,
    CardCreateSchema,
    CardUpdateSchema,
    CardMoveSchema,
    VoteResponseSchema,
    ErrorSchema
)
from api.rate_limit import check_rate_limit


# Create kanban router
router = Router()


def get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def admin_auth(request):
    """
    Authentication function for admin-only endpoints.
    
    Returns user if authenticated and has staff privileges.
    Returns None for unauthenticated (triggers 401).
    Raises HttpError 403 for authenticated non-admin users.
    """
    if not request.user.is_authenticated:
        return None  # Will trigger 401
    
    if not (request.user.is_staff or request.user.is_superuser):
        # User is authenticated but not admin - return 403
        from ninja.errors import HttpError
        raise HttpError(403, "Admin privileges required")
    
    return request.user


@router.get("/projects/{slug}/kanban", response={200: KanbanBoardSchema, 404: ErrorSchema})
def get_kanban_board(request, slug: str):
    """
    Get Kanban board for a project with cards grouped by status (50 DONE limit).
    
    Returns all TODO and DOING cards, but only the 50 most recently completed
    DONE cards. Includes user_has_voted flag for each card based on IP hash.
    
    Path Parameters:
    - slug: URL-friendly project identifier
    
    Returns:
    - 200: Kanban board with cards grouped by status
    - 404: Project not found
    """
    project = get_object_or_404(Project, slug=slug)
    board = project.kanban_board
    
    # Get client IP for vote tracking
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Get all TODO and DOING cards
    todo_cards = list(board.cards.filter(status='TODO').order_by('order'))
    doing_cards = list(board.cards.filter(status='DOING').order_by('order'))
    
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
    
    return 200, {
        "id": board.id,
        "project_id": project.id,
        "todo_cards": [add_vote_flag(c) for c in todo_cards],
        "doing_cards": [add_vote_flag(c) for c in doing_cards],
        "done_cards": [add_vote_flag(c) for c in done_cards],
        "has_more_done": has_more_done,
    }


@router.post("/kanban/cards", response={200: KanbanCardSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def create_card(request, data: CardCreateSchema):
    """
    Create a new Kanban card (admin only).
    
    Creates a card with default values: votes=0, allow_voting=True, and order
    at the end of the target column. The status defaults to TODO if not specified.
    
    Request Body:
    - board_id: ID of the Kanban board
    - title: Card title (1-200 characters)
    - status: Card status (TODO, DOING, or DONE) - defaults to TODO
    
    Returns:
    - 200: Created card with user_has_voted flag
    - 400: Validation error (invalid board_id, title, or status)
    - 401: Unauthenticated user
    - 403: Non-admin user
    - 404: Board not found
    """
    # Validate board exists
    board = get_object_or_404(KanbanBoard, id=data.board_id)
    
    # Validate title (Requirements 10.1, 14.1)
    if not data.title or len(data.title.strip()) == 0:
        return 400, {
            "detail": "Title cannot be empty"
        }
    
    if len(data.title) > 200:
        return 400, {
            "detail": "Title cannot exceed 200 characters"
        }
    
    # Validate status (Requirements 10.2, 14.1)
    valid_statuses = ['TODO', 'DOING', 'DONE']
    if data.status not in valid_statuses:
        return 400, {
            "detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        }
    
    # Create card with default values
    card = KanbanCard.objects.create(
        board=board,
        title=data.title.strip(),
        status=data.status
    )
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return 200, card


@router.delete("/kanban/cards/{card_id}", response={200: dict, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def delete_card(request, card_id: int):
    """
    Delete a Kanban card (admin only).
    
    Deletes a card and reorders remaining cards in the same column to fill the gap.
    Uses a database transaction to ensure atomic operation.
    
    Path Parameters:
    - card_id: ID of the card to delete
    
    Returns:
    - 200: Success response with {"success": True}
    - 401: Unauthenticated user
    - 403: Non-admin user
    - 404: Card not found
    """
    # Get the card or return 404
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Delete the card and reorder remaining cards in transaction
    with transaction.atomic():
        # Close gap in column by decrementing order of cards after this one
        KanbanCard.objects.filter(
            board=card.board,
            status=card.status,
            order__gt=card.order
        ).update(order=F('order') - 1)
        
        # Delete the card
        card.delete()
    
    return 200, {"success": True}


@router.get("/projects/{slug}/kanban/archived", response={200: ArchivedCardsSchema, 404: ErrorSchema})
def get_archived_cards(request, slug: str, offset: int = 0, limit: int = 50):
    """
    Get archived DONE cards with pagination.
    
    Returns DONE cards beyond the initial 50 limit shown in the main board view.
    Supports pagination with offset and limit parameters. Cards are ordered by
    completion date descending (most recent first).
    
    Path Parameters:
    - slug: URL-friendly project identifier
    
    Query Parameters:
    - offset: Number of cards to skip (default: 0)
    - limit: Maximum number of cards to return (default: 50)
    
    Returns:
    - 200: Paginated list of archived DONE cards
    - 404: Project not found
    """
    project = get_object_or_404(Project, slug=slug)
    board = project.kanban_board
    
    # Get client IP for vote tracking
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Get DONE cards with pagination
    done_cards_query = board.cards.filter(status='DONE').order_by('-completed_at', 'order')
    total_count = done_cards_query.count()
    
    # Apply pagination
    cards = list(done_cards_query[offset:offset + limit])
    has_more = (offset + limit) < total_count
    
    # Add user_has_voted flag to each card
    for card in cards:
        card.user_has_voted = card.has_user_voted(ip_hash)
    
    return 200, {
        "cards": cards,
        "has_more": has_more,
        "total_count": total_count,
    }


@router.patch("/kanban/cards/{card_id}", response={200: KanbanCardSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def update_card(request, card_id: int, data: CardUpdateSchema):
    """
    Update a Kanban card (admin only).
    
    Updates the title and/or allow_voting fields of a card. All other fields
    (status, votes, order, completed_at) are preserved. At least one field
    must be provided in the request.
    
    Path Parameters:
    - card_id: ID of the card to update
    
    Request Body:
    - title: New card title (1-200 characters) - optional
    - allow_voting: Enable/disable voting on the card - optional
    
    Returns:
    - 200: Updated card with user_has_voted flag
    - 400: Validation error (invalid title or allow_voting)
    - 401: Unauthenticated user
    - 403: Non-admin user
    - 404: Card not found
    """
    # Get the card or return 404
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Update title if provided
    if data.title is not None:
        # Validate title (Requirements 10.1, 14.1)
        if len(data.title.strip()) == 0:
            return 400, {
                "detail": "Title cannot be empty"
            }
        
        if len(data.title) > 200:
            return 400, {
                "detail": "Title cannot exceed 200 characters"
            }
        
        card.title = data.title.strip()
    
    # Update allow_voting if provided
    if data.allow_voting is not None:
        # Validate allow_voting is boolean (Requirements 10.5, 14.1)
        # Django Ninja schema already validates this, but we add explicit check
        if not isinstance(data.allow_voting, bool):
            return 400, {
                "detail": "Validation failed",
                "errors": {"allow_voting": ["Must be a boolean value (true or false)"]}
            }
        
        card.allow_voting = data.allow_voting
    
    # Save the card (this will update updated_at automatically)
    card.save()
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return 200, card



@router.patch("/kanban/cards/{card_id}/move", response={200: KanbanCardSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def move_card(request, card_id: int, data: CardMoveSchema):
    """
    Move or reorder a Kanban card (admin only).
    
    Moves a card to a new status and/or position within a column. The order
    value is clamped to the valid range if out of bounds. When moving to DONE
    status, sets completed_at timestamp. When moving from DONE to another status,
    clears completed_at.
    
    Path Parameters:
    - card_id: ID of the card to move
    
    Request Body:
    - status: Target status (TODO, DOING, or DONE)
    - order: Target position within the column (0-indexed, non-negative)
    
    Returns:
    - 200: Moved card with user_has_voted flag
    - 400: Validation error (invalid status or order)
    - 401: Unauthenticated user
    - 403: Non-admin user
    - 404: Card not found
    """
    # Get the card or return 404
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Validate status (Requirements 10.2, 14.1)
    valid_statuses = ['TODO', 'DOING', 'DONE']
    if data.status not in valid_statuses:
        return 400, {
            "detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        }
    
    # Validate order (Requirements 10.4, 14.1)
    if data.order < 0:
        return 400, {
            "detail": "Order must be a non-negative integer"
        }
    
    # Clamp order to valid range
    # When moving to a different column, max position is count (card will be added)
    # When moving within same column, max position is count-1 (card is already there)
    if card.status == data.status:
        max_order = KanbanCard.objects.filter(
            board=card.board,
            status=data.status
        ).count() - 1
    else:
        max_order = KanbanCard.objects.filter(
            board=card.board,
            status=data.status
        ).count()
    
    clamped_order = max(0, min(data.order, max_order))
    
    # Move the card
    card.move_to(data.status, clamped_order)
    card.refresh_from_db()
    
    # Add user_has_voted flag
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    card.user_has_voted = card.has_user_voted(ip_hash)
    
    return 200, card


@router.post("/kanban/cards/{card_id}/vote", response={200: VoteResponseSchema, 403: ErrorSchema, 404: ErrorSchema, 409: ErrorSchema, 429: ErrorSchema})
def vote_card(request, card_id: int):
    """
    Vote on a Kanban card (public endpoint with rate limiting).
    
    Increments the vote count for a card and records the vote to prevent
    duplicates. Rate limited to 10 votes per minute per IP address.
    
    Path Parameters:
    - card_id: ID of the card to vote on
    
    Returns:
    - 200: Vote recorded successfully with updated vote count
    - 403: Voting is disabled for this card
    - 404: Card not found
    - 409: User has already voted on this card
    - 429: Rate limit exceeded (10 votes per minute)
    
    Rate Limiting:
    - Maximum 10 votes per minute per IP address
    - Returns 429 with retry-after header when exceeded
    
    Duplicate Prevention:
    - Uses IP address hash to track votes
    - Returns 409 if user has already voted on this card
    """
    # Get the card or return 404
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Check if voting is enabled for this card
    if not card.allow_voting:
        return 403, {"detail": "Voting is disabled for this card"}
    
    # Get and hash IP address
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Check rate limit (10 votes per minute)
    if not check_rate_limit(ip_hash):
        return 429, {"detail": "Rate limit exceeded. Please try again later."}
    
    # Attempt to increment vote
    try:
        card.increment_vote(ip_hash)
    except ValueError as e:
        error_message = str(e)
        if "already voted" in error_message:
            return 409, {"detail": error_message}
        # This handles the "Voting is disabled" case, though we already checked above
        return 403, {"detail": error_message}
    
    # Return success response
    return 200, {
        "id": card.id,
        "votes": card.votes,
        "user_has_voted": True,
    }


@router.delete("/kanban/cards/{card_id}/vote", response={200: VoteResponseSchema, 403: ErrorSchema, 404: ErrorSchema})
def remove_vote(request, card_id: int):
    """
    Remove vote from a Kanban card (public endpoint).
    
    Decrements the vote count for a card and removes the vote record.
    Only works if the user has previously voted on this card.
    
    Path Parameters:
    - card_id: ID of the card to remove vote from
    
    Returns:
    - 200: Vote removed successfully with updated vote count
    - 403: Voting is disabled for this card
    - 404: Card not found or user has not voted on this card
    
    Vote Removal:
    - Uses IP address hash to identify the vote to remove
    - Returns 404 if user has not voted on this card
    - Returns 403 if voting is disabled for this card
    """
    # Get the card or return 404
    card = get_object_or_404(KanbanCard, id=card_id)
    
    # Check if voting is enabled for this card
    if not card.allow_voting:
        return 403, {"detail": "Voting is disabled for this card"}
    
    # Get and hash IP address
    ip_address = get_client_ip(request)
    ip_hash = CardVote.hash_ip(ip_address)
    
    # Attempt to decrement vote
    try:
        card.decrement_vote(ip_hash)
    except ValueError as e:
        error_message = str(e)
        if "has not voted" in error_message:
            return 404, {"detail": error_message}
        # This handles the "Voting is disabled" case, though we already checked above
        return 403, {"detail": error_message}
    
    # Return success response
    return 200, {
        "id": card.id,
        "votes": card.votes,
        "user_has_voted": False,
    }
