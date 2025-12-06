"""
Django Ninja API views for Projects Management

This module implements RESTful API endpoints for CRUD operations on projects.
All write operations (POST, PATCH, DELETE) require admin authentication.
"""
from ninja import Router, File, Form
from ninja.files import UploadedFile
from django.shortcuts import get_object_or_404
from django.core.paginator import Paginator
from typing import Optional
from api.models import Project
from api.schemas import (
    ProjectSchema,
    ProjectListResponse,
    ProjectCreateForm,
    ProjectUpdateForm,
    ErrorSchema
)


# Create projects router
router = Router()


def serialize_project(project):
    """
    Helper to serialize project with hero image dimensions.
    
    Extracts hero image URL and dimensions for layout stability,
    preventing Cumulative Layout Shift (CLS) on the frontend.
    """
    hero_image_data = {
        "url": project.hero_image.url if project.hero_image else None,
        "width": project.hero_image_width,
        "height": project.hero_image_height
    }
    
    return {
        "id": project.id,
        "title": project.title,
        "slug": project.slug,
        "description": project.description,
        "repo_url": project.repo_url,
        "tech_stack": project.tech_stack,
        "hero_image": hero_image_data,
        "created_at": project.created_at
    }


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


@router.get("/projects", response=ProjectListResponse)
def list_projects(request, page: int = 1, page_size: int = 20):
    """
    Return paginated projects ordered by creation date (newest first).
    
    Query Parameters:
    - page: Page number (default: 1)
    - page_size: Number of items per page (default: 20)
    
    Returns:
    - items: List of projects
    - meta: Pagination metadata (total_count, page, page_size, total_pages)
    """
    all_projects = Project.objects.all()
    paginator = Paginator(all_projects, page_size)
    page_obj = paginator.get_page(page)
    
    return {
        "items": [serialize_project(p) for p in page_obj],
        "meta": {
            "total_count": paginator.count,
            "page": page,
            "page_size": page_size,
            "total_pages": paginator.num_pages
        }
    }


@router.get("/projects/{slug}", response={200: ProjectSchema, 404: ErrorSchema})
def get_project(request, slug: str):
    """
    Return a single project by slug.
    
    Path Parameters:
    - slug: URL-friendly project identifier
    
    Returns:
    - 200: Project data
    - 404: Project not found
    """
    project = get_object_or_404(Project, slug=slug)
    return 200, serialize_project(project)


@router.post("/projects", response={201: ProjectSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema}, auth=admin_auth)
def create_project(
    request,
    title: str = Form(...),
    description: str = Form(...),
    repo_url: Optional[str] = Form(None),
    tech_stack: str = Form(""),
    hero_image: Optional[UploadedFile] = File(None)
):
    """
    Create a new project (admin only).
    
    Accepts multipart/form-data with:
    - title: string (required)
    - description: string (required)
    - repo_url: string (optional)
    - tech_stack: comma-separated string (optional, e.g., "React,Django,PostgreSQL")
    - hero_image: file (optional)
    
    Returns:
    - 201: Created project data
    - 400: Validation error
    - 401: Authentication required
    - 403: Admin privileges required
    """
    from django.core.validators import URLValidator
    from django.core.exceptions import ValidationError
    
    # Validate title
    if not title or not title.strip():
        return 400, {"detail": "Validation failed", "errors": {"title": ["Title cannot be empty"]}}
    if len(title) > 200:
        return 400, {"detail": "Validation failed", "errors": {"title": ["Title cannot exceed 200 characters"]}}
    
    # Validate description
    if not description or not description.strip():
        return 400, {"detail": "Validation failed", "errors": {"description": ["Description cannot be empty"]}}
    
    # Validate repo_url if provided
    if repo_url and repo_url.strip():
        url_validator = URLValidator()
        try:
            url_validator(repo_url)
        except ValidationError:
            return 400, {"detail": "Validation failed", "errors": {"repo_url": ["Invalid URL format"]}}
    
    # Validate hero_image format if provided
    if hero_image:
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
        file_extension = hero_image.name.split('.')[-1].lower() if '.' in hero_image.name else ''
        if file_extension not in allowed_extensions:
            return 400, {"detail": "Validation failed", "errors": {"hero_image": [f"Invalid image format. Allowed formats: {', '.join(allowed_extensions)}"]}}
    
    # Parse tech_stack from comma-separated string
    tech_stack_list = [t.strip() for t in tech_stack.split(",") if t.strip()] if tech_stack else []
    
    try:
        project = Project.objects.create(
            title=title,
            description=description,
            repo_url=repo_url if repo_url else None,
            tech_stack=tech_stack_list,
            hero_image=hero_image
        )
        return 201, serialize_project(project)
    except Exception as e:
        return 400, {"detail": "Validation failed", "errors": {"general": [str(e)]}}


@router.patch("/projects/{slug}", response={200: ProjectSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def update_project(
    request,
    slug: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    repo_url: Optional[str] = Form(None),
    tech_stack: Optional[str] = Form(None),
    hero_image: Optional[UploadedFile] = File(None),
    remove_image: bool = Form(False)
):
    """
    Update an existing project (admin only).
    
    Accepts multipart/form-data with optional fields.
    Set remove_image=true to delete the hero image.
    
    Path Parameters:
    - slug: URL-friendly project identifier
    
    Form Parameters (all optional):
    - title: string
    - description: string
    - repo_url: string
    - tech_stack: comma-separated string
    - hero_image: file
    - remove_image: boolean (default: false)
    
    Returns:
    - 200: Updated project data
    - 400: Validation error
    - 401: Authentication required
    - 403: Admin privileges required
    - 404: Project not found
    """
    project = get_object_or_404(Project, slug=slug)
    
    try:
        if title is not None:
            project.title = title
        if description is not None:
            project.description = description
        if repo_url is not None:
            project.repo_url = repo_url if repo_url else None
        if tech_stack is not None:
            project.tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]
        
        # Handle image update
        if hero_image:
            # Delete old image if exists (handled by model's save method)
            project.hero_image = hero_image
        elif remove_image and project.hero_image:
            project.hero_image.delete(save=False)
            project.hero_image = None
            project.hero_image_width = None
            project.hero_image_height = None
        
        project.save()
        return 200, serialize_project(project)
    except Exception as e:
        return 400, {"detail": "Validation failed", "errors": {"general": [str(e)]}}


@router.delete("/projects/{slug}", response={200: dict, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema}, auth=admin_auth)
def delete_project(request, slug: str):
    """
    Delete a project (admin only).
    
    Path Parameters:
    - slug: URL-friendly project identifier
    
    Returns:
    - 200: Success confirmation
    - 401: Authentication required
    - 403: Admin privileges required
    - 404: Project not found
    """
    project = get_object_or_404(Project, slug=slug)
    project.delete()  # Model's delete method handles image cleanup
    return 200, {"success": True}
