# Design Document

## Overview

The Projects Management feature implements a full-stack CRUD system for managing development project showcases. The backend uses Django models with PostgreSQL storage, Django Ninja for RESTful API endpoints, and includes admin interface integration. The frontend uses React with TanStack Query for data fetching, displays projects in a masonry grid on the home page, and provides detailed project views with routing.

## Architecture

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Django Application                       │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Django Ninja)                                    │
│  ├─ /api/v1/projects (GET, POST)                            │
│  ├─ /api/v1/projects/{slug} (GET, PATCH, DELETE)            │
│  └─ Schemas: ProjectSchema, ProjectCreateSchema, etc.       │
├─────────────────────────────────────────────────────────────┤
│  Business Logic                                              │
│  ├─ Slug generation with collision handling                 │
│  ├─ Image upload and deletion                               │
│  └─ Validation logic                                         │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                  │
│  ├─ Project Model (Django ORM)                              │
│  └─ Admin Interface Registration                            │
├─────────────────────────────────────────────────────────────┤
│  Storage                                                     │
│  ├─ PostgreSQL Database                                     │
│  └─ File System (Media files)                               │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
├─────────────────────────────────────────────────────────────┤
│  Pages                                                       │
│  ├─ HomePage (Masonry Grid)                                 │
│  └─ ProjectDetailPage (Full project view)                   │
├─────────────────────────────────────────────────────────────┤
│  Components                                                  │
│  ├─ ProjectCard (Grid item)                                 │
│  ├─ ProjectGrid (Masonry layout)                            │
│  ├─ SkeletonLoader (Loading state)                          │
│  └─ TechStackBadge (Tag display)                            │
├─────────────────────────────────────────────────────────────┤
│  Hooks                                                       │
│  ├─ useProjects (Fetch all projects)                        │
│  └─ useProject (Fetch single project)                       │
├─────────────────────────────────────────────────────────────┤
│  Services                                                    │
│  └─ API Client (Axios with types)                           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### Django Model: Project

```python
from django.db import models, transaction, IntegrityError
from django.contrib.postgres.fields import ArrayField
from django.utils.text import slugify
from django.core.validators import FileExtensionValidator
from PIL import Image
import os

def validate_image_size(image):
    """Validate image file size (max 5MB)"""
    max_size = 5 * 1024 * 1024  # 5MB
    if image.size > max_size:
        raise ValidationError(f"Image file size cannot exceed 5MB. Current size: {image.size / (1024*1024):.2f}MB")

class Project(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, db_index=True)
    description = models.TextField()
    repo_url = models.URLField(blank=True, null=True)
    tech_stack = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        default=list
    )
    hero_image = models.ImageField(
        upload_to='projects/heroes/',
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'webp']),
            validate_image_size
        ]
    )
    hero_image_width = models.IntegerField(blank=True, null=True)
    hero_image_height = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def save(self, *args, **kwargs):
        # Generate slug if needed
        if not self.slug or self._title_changed():
            self.slug = self._generate_unique_slug()
        
        # Extract image dimensions if image is present
        if self.hero_image and hasattr(self.hero_image, 'file'):
            try:
                img = Image.open(self.hero_image.file)
                self.hero_image_width, self.hero_image_height = img.size
            except Exception:
                pass  # If image processing fails, continue without dimensions
        
        # Handle race condition in slug generation
        max_retries = 5
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    super().save(*args, **kwargs)
                break
            except IntegrityError:
                if attempt == max_retries - 1:
                    raise
                # Regenerate slug and retry
                self.slug = self._generate_unique_slug()
    
    def _title_changed(self):
        """Check if title has changed from database value"""
        if not self.pk:
            return True
        try:
            original = Project.objects.get(pk=self.pk)
            return original.title != self.title
        except Project.DoesNotExist:
            return True
    
    def _generate_unique_slug(self):
        base_slug = slugify(self.title)
        slug = base_slug
        counter = 1
        while Project.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug
    
    def delete(self, *args, **kwargs):
        """Override delete to clean up image file"""
        if self.hero_image:
            if os.path.isfile(self.hero_image.path):
                os.remove(self.hero_image.path)
        super().delete(*args, **kwargs)
```

#### Django Ninja Schemas

```python
from ninja import Schema, Form
from typing import Optional, List
from datetime import datetime

class HeroImageSchema(Schema):
    """Schema for hero image with dimensions for layout stability"""
    url: Optional[str]
    width: Optional[int]
    height: Optional[int]

class ProjectSchema(Schema):
    id: int
    title: str
    slug: str
    description: str
    repo_url: Optional[str]
    tech_stack: List[str]
    hero_image: HeroImageSchema
    created_at: datetime

class PaginationMeta(Schema):
    total_count: int
    page: int
    page_size: int
    total_pages: int

class ProjectListResponse(Schema):
    items: List[ProjectSchema]
    meta: PaginationMeta

class ProjectCreateForm(Schema):
    """Form schema for multipart/form-data compatibility"""
    title: str
    description: str
    repo_url: Optional[str] = None
    tech_stack: str = ""  # Comma-separated string, parsed to array

class ProjectUpdateForm(Schema):
    """Form schema for multipart/form-data compatibility"""
    title: Optional[str] = None
    description: Optional[str] = None
    repo_url: Optional[str] = None
    tech_stack: Optional[str] = None  # Comma-separated string

class ErrorSchema(Schema):
    detail: str
    errors: Optional[dict] = None
```

#### API Endpoints

```python
from ninja import Router, File, Form
from ninja.files import UploadedFile
from django.shortcuts import get_object_or_404
from django.core.paginator import Paginator
from typing import List

router = Router()

def serialize_project(project):
    """Helper to serialize project with hero image dimensions"""
    hero_image_data = {
        "url": project.hero_image.url if project.hero_image else None,
        "width": project.hero_image_width,
        "height": project.hero_image_height
    }
    return {
        **project.__dict__,
        "hero_image": hero_image_data
    }

@router.get("/projects", response=ProjectListResponse)
def list_projects(request, page: int = 1, page_size: int = 20):
    """Return paginated projects ordered by creation date"""
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

@router.get("/projects/{slug}", response=ProjectSchema)
def get_project(request, slug: str):
    """Return a single project by slug"""
    project = get_object_or_404(Project, slug=slug)
    return serialize_project(project)

@router.post("/projects", response=ProjectSchema, auth=admin_required)
def create_project(
    request, 
    title: str = Form(...),
    description: str = Form(...),
    repo_url: str = Form(None),
    tech_stack: str = Form(""),  # Comma-separated
    hero_image: UploadedFile = File(None)
):
    """Create a new project (admin only)
    
    Accepts multipart/form-data with:
    - title: string (required)
    - description: string (required)
    - repo_url: string (optional)
    - tech_stack: comma-separated string (optional, e.g., "React,Django,PostgreSQL")
    - hero_image: file (optional)
    """
    # Parse tech_stack from comma-separated string
    tech_stack_list = [t.strip() for t in tech_stack.split(",") if t.strip()] if tech_stack else []
    
    project = Project.objects.create(
        title=title,
        description=description,
        repo_url=repo_url if repo_url else None,
        tech_stack=tech_stack_list,
        hero_image=hero_image
    )
    return serialize_project(project)

@router.patch("/projects/{slug}", response=ProjectSchema, auth=admin_required)
def update_project(
    request, 
    slug: str,
    title: str = Form(None),
    description: str = Form(None),
    repo_url: str = Form(None),
    tech_stack: str = Form(None),
    hero_image: UploadedFile = File(None),
    remove_image: bool = Form(False)
):
    """Update an existing project (admin only)
    
    Accepts multipart/form-data with optional fields.
    Set remove_image=true to delete the hero image.
    """
    project = get_object_or_404(Project, slug=slug)
    
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
        # Delete old image if exists
        if project.hero_image:
            project.hero_image.delete(save=False)
        project.hero_image = hero_image
    elif remove_image and project.hero_image:
        project.hero_image.delete(save=False)
        project.hero_image = None
        project.hero_image_width = None
        project.hero_image_height = None
    
    project.save()
    return serialize_project(project)

@router.delete("/projects/{slug}", auth=admin_required)
def delete_project(request, slug: str):
    """Delete a project (admin only)"""
    project = get_object_or_404(Project, slug=slug)
    project.delete()  # Model's delete method handles image cleanup
    return {"success": True}
```

### Frontend Components

#### React Hook: useProjects

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type ProjectListResponse = components['schemas']['ProjectListResponse'];
type Project = components['schemas']['ProjectSchema'];

export function useProjects(page: number = 1, pageSize: number = 20) {
  return useQuery({
    queryKey: ['projects', page, pageSize],
    queryFn: async () => {
      const response = await apiClient.get<ProjectListResponse>('/projects', {
        params: { page, page_size: pageSize }
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Keep previous page data while loading next
  });
}
```

#### React Hook: useProject

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { components } from '../types/api';

type Project = components['schemas']['ProjectSchema'];

export function useProject(slug: string) {
  return useQuery({
    queryKey: ['project', slug],
    queryFn: async () => {
      const response = await apiClient.get<Project>(`/projects/${slug}`);
      return response.data;
    },
    enabled: !!slug,
  });
}
```

#### React Component: ProjectCard

```typescript
interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-surface rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
    >
      {project.hero_image.url && (
        <div 
          style={{
            aspectRatio: project.hero_image.width && project.hero_image.height 
              ? `${project.hero_image.width} / ${project.hero_image.height}`
              : '16 / 9',
            position: 'relative'
          }}
        >
          <img 
            src={project.hero_image.url} 
            alt={project.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xl font-bold text-primary mb-2">{project.title}</h3>
        <p className="text-gray-300 text-sm mb-3 line-clamp-3">{project.description}</p>
        <div className="flex flex-wrap gap-2">
          {project.tech_stack.map(tech => (
            <span key={tech} className="px-2 py-1 bg-primary/20 text-secondary text-xs rounded">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### React Component: ProjectGrid

```typescript
import Masonry from 'react-responsive-masonry';
import { useNavigate } from 'react-router-dom';

interface ProjectGridProps {
  projects: Project[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const navigate = useNavigate();
  
  return (
    <Masonry 
      columnsCountBreakPoints={{ 350: 1, 750: 2, 1200: 3 }}
      gutter="1.5rem"
    >
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          onClick={() => navigate(`/projects/${project.slug}`)}
        />
      ))}
    </Masonry>
  );
}
```

## Data Models

### Project Model Schema

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key, Auto-increment | Unique identifier |
| title | String(200) | Not null | Project title |
| slug | String(220) | Unique, Indexed | URL-friendly identifier |
| description | Text | Not null | Full project description |
| repo_url | URL | Nullable | Link to repository |
| tech_stack | Array[String] | Default: [] | List of technologies |
| hero_image | ImageField | Nullable, Max 5MB | Featured image path |
| hero_image_width | Integer | Nullable | Image width in pixels |
| hero_image_height | Integer | Nullable | Image height in pixels |
| created_at | DateTime | Auto-set | Creation timestamp |

### Related Models (For Future Features)

These models will be implemented in subsequent features but are defined here to ensure proper cascade delete behavior:

**KanbanBoard Model:**
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key | Unique identifier |
| project | ForeignKey | CASCADE delete | Reference to Project |

**DevLog Model:**
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | Primary Key | Unique identifier |
| project | ForeignKey | CASCADE delete | Reference to Project |
| title | String(200) | Not null | Devlog title |
| body_markdown | Text | Not null | Markdown content |
| published_at | DateTime | Not null | Publication timestamp |

### Database Indexes

- Primary index on `id`
- Unique index on `slug` for fast lookups
- Index on `created_at` for ordering

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Project creation persistence
*For any* valid project data (title, description, optional repo_url, tech_stack, hero_image), creating a project should result in a database record with all submitted fields correctly stored and a created_at timestamp set to the current time.
**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Slug generation from title
*For any* project title, the system should generate a URL-safe slug that contains only lowercase letters, numbers, and hyphens, derived from the title.
**Validates: Requirements 1.2**

### Property 3: Slug uniqueness enforcement
*For any* set of projects with duplicate or conflicting titles, each project should have a unique slug, with numeric suffixes appended as needed to resolve collisions.
**Validates: Requirements 1.3, 2.5**

### Property 4: Project update persistence
*For any* existing project and any valid update data, updating the project should result in the database record reflecting all changes while preserving unchanged fields.
**Validates: Requirements 2.1**

### Property 5: Slug regeneration on title update
*For any* project, updating its title should result in the slug being regenerated to match the new title while maintaining uniqueness.
**Validates: Requirements 2.2**

### Property 6: Image file lifecycle management
*For any* project with a hero image, updating or removing the image should result in the old image file being deleted from storage and the new image (if provided) being stored with the correct path reference.
**Validates: Requirements 2.3, 2.4**

### Property 7: Project deletion completeness
*For any* project, deleting it should result in both the database record being removed and any associated hero image file being deleted from storage.
**Validates: Requirements 3.1, 3.2**

### Property 8: Project list ordering
*For any* set of projects in the database, the list endpoint should return them ordered by created_at in descending order (newest first).
**Validates: Requirements 4.1**

### Property 9: Response field completeness
*For any* project returned by the API (list or detail endpoint), the response should include all required fields: id, title, slug, description, repo_url, tech_stack, hero_image, and created_at.
**Validates: Requirements 4.2, 5.3**

### Property 10: Project retrieval by slug
*For any* project in the database, requesting it by its slug should return the complete project record with all fields.
**Validates: Requirements 5.1**

### Property 11: 404 error for invalid slugs
*For any* slug that does not exist in the database, requesting a project by that slug should return a 404 error with a descriptive message.
**Validates: Requirements 5.2, 11.2**

### Property 12: Title validation
*For any* project submission with an empty title or a title exceeding 200 characters, the system should reject it with a 400 error and validation message.
**Validates: Requirements 6.1**

### Property 13: Description validation
*For any* project submission with an empty description, the system should reject it with a 400 error and validation message.
**Validates: Requirements 6.2**

### Property 14: URL validation
*For any* project submission with an invalid repo_url format, the system should reject it with a 400 error and validation message.
**Validates: Requirements 6.3**

### Property 15: Tech stack type validation
*For any* project submission where tech_stack is not an array of strings, the system should reject it with a 400 error and validation message.
**Validates: Requirements 6.4**

### Property 16: Image format validation
*For any* file upload that is not a valid image format (JPEG, PNG, GIF, WebP), the system should reject it with a 400 error and validation message.
**Validates: Requirements 6.5**

### Property 17: Admin search functionality
*For any* search query in the Django admin, projects matching the query in either title or slug fields should be returned in the results.
**Validates: Requirements 7.5**

### Property 18: Project card rendering completeness
*For any* project displayed in the grid, the card should render all required elements: hero image (if present), title, tech stack tags, and description.
**Validates: Requirements 8.4**

### Property 19: Project card navigation
*For any* project card, clicking it should trigger navigation to the project detail page with the correct slug in the URL.
**Validates: Requirements 8.5**

### Property 20: Project detail rendering completeness
*For any* project on the detail page, all elements should be rendered: hero image (if present), title, full description, tech stack, and repository link (if present).
**Validates: Requirements 9.2**

### Property 21: Repository link rendering
*For any* project with a repo_url, the detail page should render it as a clickable link element.
**Validates: Requirements 9.3**

### Property 22: Validation error response format
*For any* validation failure, the API should return a 400 status code with a response body containing detailed validation error messages.
**Validates: Requirements 11.1**

### Property 23: Authentication error handling
*For any* admin-only endpoint, requests without authentication should return a 401 error.
**Validates: Requirements 11.3**

### Property 24: Authorization error handling
*For any* admin-only endpoint, requests from non-admin authenticated users should return a 403 error.
**Validates: Requirements 11.4**

## Error Handling

### Validation Errors (400)
- Empty or oversized title
- Empty description
- Invalid URL format for repo_url
- Invalid tech_stack type (not an array of strings)
- Invalid image file format
- Response format: `{"detail": "Validation failed", "errors": {"field": ["error message"]}}`

### Authentication Errors (401)
- Unauthenticated requests to admin endpoints (POST, PATCH, DELETE)
- Response format: `{"detail": "Authentication required"}`

### Authorization Errors (403)
- Non-admin users attempting admin operations
- Response format: `{"detail": "Admin privileges required"}`

### Not Found Errors (404)
- Project slug does not exist
- Response format: `{"detail": "Project not found"}`

### Server Errors (500)
- Database connection failures
- File system errors during image operations
- Unexpected exceptions
- Response format: `{"detail": "Internal server error"}`
- All 500 errors should be logged with full stack traces

## Testing Strategy

### Property-Based Testing

We will use **Hypothesis** for Python property-based testing. Each correctness property will be implemented as a Hypothesis test with appropriate strategies for generating test data.

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with format: `# Feature: projects-management, Property X: [property text]`

**Test Strategies:**
- `project_data_strategy`: Generates valid project dictionaries with random titles, descriptions, tech stacks
- `title_strategy`: Generates various title strings including edge cases (unicode, special chars, long strings)
- `slug_strategy`: Generates URL-safe slug strings
- `image_strategy`: Generates mock image files of various formats
- `invalid_data_strategy`: Generates intentionally invalid data for validation testing

**Key Property Tests:**
1. Slug uniqueness across multiple projects with duplicate titles
2. Image file cleanup during updates and deletions
3. Response field completeness across all API endpoints
4. Validation rejection for all invalid input types
5. Error response format consistency

### Unit Testing

Unit tests will cover:
- Specific examples of slug generation (e.g., "My Project" → "my-project")
- Admin interface registration and configuration
- API endpoint existence and routing
- OpenAPI schema generation
- TypeScript type generation
- Frontend component rendering with specific test data
- React Router navigation flows

### Integration Testing

Integration tests will verify:
- End-to-end project creation flow (API → Database → File System)
- Image upload and retrieval through the full stack
- Frontend data fetching and rendering
- Error handling across API and UI layers

### Test Organization

**Backend:**
```
backend/api/tests/
├── test_models.py          # Model logic and slug generation
├── test_api_endpoints.py   # API endpoint behavior
├── test_validation.py      # Input validation
├── test_admin.py           # Admin interface
└── test_properties.py      # Hypothesis property tests
```

**Frontend:**
```
frontend/src/
├── hooks/
│   ├── useProjects.test.ts
│   └── useProject.test.ts
├── components/
│   ├── ProjectCard.test.tsx
│   └── ProjectGrid.test.tsx
└── pages/
    ├── HomePage.test.tsx
    └── ProjectDetailPage.test.tsx
```

## Performance Considerations

### Database Optimization
- Index on `slug` field for fast lookups
- Index on `created_at` for efficient ordering
- Use `select_related()` for future foreign key relationships (Kanban, Devlogs)

### Image Handling
- Store images in `/media/projects/heroes/` directory
- Serve images through Django's media URL in development
- Enforce 5MB file size limit with validation
- Extract and store image dimensions (width/height) for layout stability
- Use aspect-ratio CSS to prevent Cumulative Layout Shift (CLS)
- Implement lazy loading for images in grid view
- Consider CDN integration for production
- Future: Thumbnail generation for optimized grid view

### Frontend Optimization
- Use TanStack Query caching (5-minute stale time)
- Implement skeleton loaders to prevent layout shift
- Lazy load images in masonry grid
- Consider pagination for large project lists (future enhancement)

### API Response Optimization
- Implement pagination (default 20 items per page) to prevent performance degradation
- Return pagination metadata (total_count, page, page_size, total_pages)
- Include image dimensions in response for layout stability
- Use Django Ninja's response model to control serialization
- Future: Implement `/projects/{slug}/full` endpoint with related Kanban/Devlog data

## Security Considerations

### Authentication & Authorization
- All write operations (POST, PATCH, DELETE) require admin authentication
- Read operations (GET) are public
- Use Django's built-in authentication system
- Verify user.is_staff or user.is_superuser for admin operations

### Input Validation
- Sanitize all user inputs
- Validate file uploads (type, size, max 5MB)
- Use Django ORM to prevent SQL injection
- Validate URLs to prevent SSRF attacks
- Tech stack entries are free-form strings (no enum) for flexibility
  - Note: This allows variations like "React", "react", "ReactJS"
  - Future enhancement: Implement tag normalization or autocomplete
  - For MVP: Accept any string, rely on admin to maintain consistency

### File Upload Security
- Restrict file types to images only
- Validate file extensions and MIME types
- Store uploaded files outside web root
- Generate unique filenames to prevent overwrites
- Implement file size limits

### CSRF Protection
- CSRF tokens required for all state-changing operations
- Already configured in base-site-setup

### CORS Configuration
- Already configured for localhost:5173 in development (from base-site-setup)
- CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS set in Django settings
- Session-based authentication with cookies (withCredentials: true in axios)
- Update for production domain when deploying

## Deployment Considerations

### Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### Static Files
```bash
python manage.py collectstatic
```

### Media Files
- Configure `MEDIA_ROOT` and `MEDIA_URL` in settings
- Ensure media directory has proper permissions
- Consider cloud storage (S3, Cloudinary) for production

### Environment Variables
- No new environment variables required
- Uses existing database and Django configuration

## Future Enhancements

### Phase 2 Features
- Search and filtering by tech stack
- Project sorting options (date, title, popularity)
- Image thumbnail generation for optimized loading
- Multiple images per project (gallery)
- Infinite scroll for project list

### Phase 3 Features
- Project categories/tags
- Featured projects flag
- Project status (active, archived, completed)
- View counter
- Social sharing metadata (Open Graph)

## Dependencies

### Backend
- Django 5.0+ (already installed)
- Pillow (for ImageField support and dimension extraction) - **NEW**
- hypothesis (for property-based testing) - **NEW**

### Frontend
- react-responsive-masonry (for grid layout) - **NEW**
- Existing dependencies: react-router-dom, @tanstack/react-query, axios

### Installation Commands

**Backend:**
```bash
pip install Pillow hypothesis
pip freeze > requirements.txt
```

**Frontend:**
```bash
npm install react-responsive-masonry
```
