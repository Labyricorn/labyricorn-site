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
