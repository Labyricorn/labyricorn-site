"""
Django Ninja schemas for Project API

These schemas define the request and response structures for the Projects Management API.
They provide validation, serialization, and type safety for API endpoints.
"""
from ninja import Schema
from typing import Optional, List
from datetime import datetime


class HeroImageSchema(Schema):
    """
    Schema for hero image with dimensions for layout stability.
    
    Includes URL and dimensions to prevent Cumulative Layout Shift (CLS)
    by allowing the frontend to reserve space before the image loads.
    """
    url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class ProjectSchema(Schema):
    """
    Complete project schema for API responses.
    
    Used for both list and detail endpoints to ensure consistent
    response structure across the API.
    """
    id: int
    title: str
    slug: str
    description: str
    repo_url: Optional[str] = None
    tech_stack: List[str]
    hero_image: HeroImageSchema
    created_at: datetime


class PaginationMeta(Schema):
    """
    Pagination metadata for list responses.
    
    Provides clients with information needed to implement
    pagination controls and understand the full dataset size.
    """
    total_count: int
    page: int
    page_size: int
    total_pages: int


class ProjectListResponse(Schema):
    """
    Response schema for paginated project list endpoint.
    
    Combines project items with pagination metadata to provide
    a complete view of the dataset.
    """
    items: List[ProjectSchema]
    meta: PaginationMeta


class ProjectCreateForm(Schema):
    """
    Form schema for creating projects via multipart/form-data.
    
    Designed to work with file uploads. The tech_stack field accepts
    a comma-separated string which will be parsed into an array.
    
    Example tech_stack: "React,Django,PostgreSQL"
    """
    title: str
    description: str
    repo_url: Optional[str] = None
    tech_stack: str = ""  # Comma-separated string, parsed to array


class ProjectUpdateForm(Schema):
    """
    Form schema for updating projects via multipart/form-data.
    
    All fields are optional to support partial updates.
    The tech_stack field accepts a comma-separated string.
    """
    title: Optional[str] = None
    description: Optional[str] = None
    repo_url: Optional[str] = None
    tech_stack: Optional[str] = None  # Comma-separated string


class ErrorSchema(Schema):
    """
    Standard error response schema.
    
    Provides consistent error formatting across all API endpoints.
    The errors field contains field-specific validation errors when applicable.
    """
    detail: str
    errors: Optional[dict] = None


# Kanban Board Schemas

class KanbanCardSchema(Schema):
    """
    Schema for Kanban card in API responses.
    
    Includes user_has_voted flag to indicate if the current user
    has voted on this card (based on IP hash).
    """
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
    """
    Schema for complete Kanban board with cards grouped by status.
    
    Returns all TODO and DOING cards, but only the 50 most recent
    DONE cards. The has_more_done flag indicates if there are
    additional archived DONE cards available.
    """
    id: int
    project_id: int
    todo_cards: List[KanbanCardSchema]
    doing_cards: List[KanbanCardSchema]
    done_cards: List[KanbanCardSchema]
    has_more_done: bool


class ArchivedCardsSchema(Schema):
    """
    Schema for paginated archived DONE cards.
    
    Used for loading additional completed cards beyond the initial 50.
    Includes pagination metadata to support infinite scroll.
    """
    cards: List[KanbanCardSchema]
    has_more: bool
    total_count: int


class CardCreateSchema(Schema):
    """
    Schema for creating a new Kanban card.
    
    Requires board_id and title. Status defaults to TODO if not specified.
    Only accessible to admin users.
    """
    board_id: int
    title: str
    status: str = 'TODO'


class CardUpdateSchema(Schema):
    """
    Schema for updating an existing Kanban card.
    
    All fields are optional to support partial updates.
    Only accessible to admin users.
    """
    title: Optional[str] = None
    allow_voting: Optional[bool] = None


class CardMoveSchema(Schema):
    """
    Schema for moving or reordering a Kanban card.
    
    Requires both status and order. The order will be clamped
    to valid range if out of bounds.
    Only accessible to admin users.
    """
    status: str
    order: int


class VoteResponseSchema(Schema):
    """
    Schema for vote operation responses.
    
    Returns the card ID, updated vote count, and whether the
    current user has voted on the card.
    """
    id: int
    votes: int
    user_has_voted: bool
