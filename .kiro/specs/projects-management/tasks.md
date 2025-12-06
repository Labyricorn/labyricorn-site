# Implementation Plan

- [x] 1. Set up Project model and database migrations





  - Install Pillow for ImageField support
  - Create Project model in backend/api/models.py with all fields
  - Implement slug generation with collision handling and race condition protection
  - Implement image dimension extraction in save() method
  - Implement image cleanup in delete() method
  - Add file size and format validators
  - Create and run database migrations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 3.1, 3.2, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 1.1 Write property test for slug generation


  - **Property 2: Slug generation from title**
  - **Validates: Requirements 1.2**

- [x] 1.2 Write property test for slug uniqueness


  - **Property 3: Slug uniqueness enforcement**
  - **Validates: Requirements 1.3, 2.5**

- [x] 1.3 Write property test for image file lifecycle


  - **Property 6: Image file lifecycle management**
  - **Validates: Requirements 2.3, 2.4**

- [x] 1.4 Write property test for project deletion


  - **Property 7: Project deletion completeness**
  - **Validates: Requirements 3.1, 3.2**

- [x] 2. Configure Django admin for Project model





  - Register Project model in backend/api/admin.py
  - Configure list_display to show title, slug, created_at
  - Configure search_fields for title and slug
  - Add hero_image thumbnail display in admin detail view
  - Configure form fields for all project attributes
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2.1 Write property test for admin search


  - **Property 17: Admin search functionality**
  - **Validates: Requirements 7.5**

- [x] 3. Create Django Ninja schemas for Project API





  - Create HeroImageSchema with url, width, height fields
  - Create ProjectSchema with all project fields
  - Create PaginationMeta schema
  - Create ProjectListResponse schema
  - Create ProjectCreateForm and ProjectUpdateForm for multipart/form-data
  - Create ErrorSchema for error responses
  - _Requirements: 4.2, 5.3, 10.1, 10.2, 12.1, 12.2, 12.3_

- [x] 4. Implement Project API endpoints





  - Create projects router in backend/api/urls.py
  - Implement GET /api/v1/projects with pagination support
  - Implement GET /api/v1/projects/{slug} for single project
  - Implement POST /api/v1/projects with Form parameters and file upload (admin only)
  - Implement PATCH /api/v1/projects/{slug} with Form parameters (admin only)
  - Implement DELETE /api/v1/projects/{slug} (admin only)
  - Add serialize_project helper for hero_image dimension handling
  - Register router in main urls.py
  - _Requirements: 2.1, 4.1, 5.1, 5.2, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 4.1 Write property test for project creation


  - **Property 1: Project creation persistence**
  - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 4.2 Write property test for project update


  - **Property 4: Project update persistence**
  - **Validates: Requirements 2.1**

- [x] 4.3 Write property test for slug regeneration

  - **Property 5: Slug regeneration on title update**
  - **Validates: Requirements 2.2**

- [x] 4.4 Write property test for list ordering

  - **Property 8: Project list ordering**
  - **Validates: Requirements 4.1**

- [x] 4.5 Write property test for response completeness

  - **Property 9: Response field completeness**
  - **Validates: Requirements 4.2, 5.3**

- [x] 4.6 Write property test for project retrieval

  - **Property 10: Project retrieval by slug**
  - **Validates: Requirements 5.1**

- [x] 4.7 Write property test for 404 errors

  - **Property 11: 404 error for invalid slugs**
  - **Validates: Requirements 5.2, 11.2**

- [x] 4.8 Write property test for title validation

  - **Property 12: Title validation**
  - **Validates: Requirements 6.1**

- [x] 4.9 Write property test for description validation

  - **Property 13: Description validation**
  - **Validates: Requirements 6.2**

- [x] 4.10 Write property test for URL validation

  - **Property 14: URL validation**
  - **Validates: Requirements 6.3**

- [x] 4.11 Write property test for tech stack validation

  - **Property 15: Tech stack type validation**
  - **Validates: Requirements 6.4**

- [x] 4.12 Write property test for image format validation

  - **Property 16: Image format validation**
  - **Validates: Requirements 6.5**

- [x] 4.13 Write property test for validation error format

  - **Property 22: Validation error response format**
  - **Validates: Requirements 11.1**

- [x] 4.14 Write property test for authentication errors

  - **Property 23: Authentication error handling**
  - **Validates: Requirements 11.3**

- [x] 4.15 Write property test for authorization errors

  - **Property 24: Authorization error handling**
  - **Validates: Requirements 11.4**

- [x] 5. Checkpoint - Ensure backend tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Generate TypeScript types from OpenAPI schema









  - Run npm run gen:types to generate types from /api/v1/openapi.json
  - Verify ProjectSchema, ProjectListResponse, HeroImageSchema types are generated
  - Verify PaginationMeta type is generated
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 7. Create React hooks for projects API





  - Create useProjects hook with pagination support in frontend/src/hooks/
  - Create useProject hook for single project fetch
  - Configure TanStack Query with keepPreviousData for pagination
  - Implement error handling in hooks
  - _Requirements: 9.1, 9.4, 9.5_

- [x] 7.1 Write unit tests for useProjects hook


  - Test pagination parameters
  - Test data fetching and caching
  - Test error handling
  - _Requirements: 9.4, 9.5_

- [x] 7.2 Write unit tests for useProject hook


  - Test single project fetch by slug
  - Test error handling for invalid slugs
  - _Requirements: 5.1, 5.2_

- [x] 8. Create ProjectCard component





  - Create ProjectCard component in frontend/src/components/
  - Implement hero image with aspect-ratio for layout stability
  - Add lazy loading for images
  - Display title, description (truncated), and tech stack badges
  - Style with cyberpunk theme colors
  - Handle click events for navigation
  - _Requirements: 8.4, 8.5_

- [x] 8.1 Write property test for card rendering completeness


  - **Property 18: Project card rendering completeness**
  - **Validates: Requirements 8.4**

- [x] 8.2 Write property test for card navigation

  - **Property 19: Project card navigation**
  - **Validates: Requirements 8.5**

- [x] 9. Create ProjectGrid component with masonry layout





  - Install react-responsive-masonry package
  - Create ProjectGrid component in frontend/src/components/
  - Implement responsive column breakpoints (1/2/3 columns)
  - Integrate ProjectCard components
  - Add skeleton loaders for loading state
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 9.1 Write unit tests for ProjectGrid component


  - Test masonry layout rendering
  - Test responsive breakpoints
  - Test skeleton loader display
  - _Requirements: 8.1, 8.3_

- [x] 10. Update HomePage to display projects grid





  - Update frontend/src/pages/HomePage.tsx
  - Use useProjects hook to fetch projects
  - Display ProjectGrid with fetched projects
  - Show skeleton loaders while loading
  - Display error message if fetch fails
  - Add pagination controls (optional for MVP)
  - _Requirements: 4.1, 8.1, 8.2, 8.3, 9.5_

- [x] 11. Create ProjectDetailPage





  - Create ProjectDetailPage component in frontend/src/pages/
  - Use useProject hook to fetch project by slug from URL params
  - Display hero image with full size
  - Display title, full description, tech stack, and repository link
  - Render repository URL as clickable link if present
  - Add placeholder sections for Kanban and Devlogs tabs
  - Handle 404 errors for invalid slugs
  - Style with cyberpunk theme
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11.1 Write property test for detail page rendering


  - **Property 20: Project detail rendering completeness**
  - **Validates: Requirements 9.2**

- [x] 11.2 Write property test for repository link rendering


  - **Property 21: Repository link rendering**
  - **Validates: Requirements 9.3**

- [x] 12. Add project routes to React Router





  - Update frontend/src/App.tsx
  - Add route for /projects/:slug to ProjectDetailPage
  - Ensure AppShell wraps project routes
  - Test navigation from HomePage to ProjectDetailPage
  - _Requirements: 15.1, 15.2, 15.3_

- [x] 13. Configure media files in Django settings




  - Configure MEDIA_ROOT and MEDIA_URL in backend/labyricorn/settings.py
  - Add media URL pattern to backend/labyricorn/urls.py for development
  - Create media directory structure
  - Test image upload and retrieval
  - _Requirements: 1.5, 2.3, 2.4_

- [x] 14. Update project documentation





  - Update README.md with Projects Management feature description
  - Document API endpoints for projects
  - Document how to create projects via Django admin
  - Document image upload requirements (formats, size limits)
  - Add example curl commands for API testing
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [-] 15. Final checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
