# Implementation Plan

- [x] 1. Set up project structure and Docker environment





  - Create root directory structure with backend/ and frontend/ folders
  - Create docker-compose.yml with PostgreSQL 16 and Adminer services
  - Create .env.example files for both backend and frontend
  - Create .gitignore files to exclude virtual environments, node_modules, and .env files
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 10.4, 10.5_

- [x] 2. Initialize Django backend project





  - Create Python virtual environment named after the project
  - Install Django 5.0+, Django Ninja, psycopg2-binary, python-dotenv, django-cors-headers
  - Create requirements.txt with pinned versions
  - Initialize Django project named 'labyricorn'
  - Create 'core' app for shared functionality
  - Create 'api' app for Django Ninja routes
  - _Requirements: 1.3, 2.1, 11.1, 11.3_

- [x] 3. Configure Django settings with environment variables





  - Implement get_env_variable helper function with validation
  - Configure SECRET_KEY, DEBUG, and ALLOWED_HOSTS from environment
  - Configure PostgreSQL database connection using environment variables
  - Add django-cors-headers to INSTALLED_APPS and MIDDLEWARE
  - Configure CORS_ALLOWED_ORIGINS for localhost:5173
  - Configure CSRF_TRUSTED_ORIGINS for localhost:5173
  - Configure SESSION_COOKIE_SAMESITE='None' and SESSION_COOKIE_SECURE=False for development
  - _Requirements: 1.4, 10.1, 10.2, 2.4, 12.1_

- [x] 4. Set up Django Ninja API layer





  - Create NinjaAPI instance in api/urls.py with title and version
  - Implement /api/v1/health endpoint returning status and version
  - Implement /api/v1/csrf endpoint with @ensure_csrf_cookie decorator
  - Configure Django Ninja router in main urls.py under /api/v1 prefix
  - Enable OpenAPI schema generation at /api/v1/openapi.json
  - _Requirements: 2.1, 2.2, 2.3, 12.2, 16.1_

- [x] 4.1 Write property test for API path consistency


  - **Property 1: API endpoint path consistency**
  - **Validates: Requirements 2.2**

- [x] 4.2 Write property test for schema validation


  - **Property 2: Request schema validation**
  - **Validates: Requirements 2.5**

- [x] 5. Implement authentication API endpoints





  - Create authentication schemas for login request and response
  - Implement POST /api/v1/auth/login endpoint with Django authenticate()
  - Implement POST /api/v1/auth/logout endpoint with Django logout()
  - Implement GET /api/v1/auth/me endpoint returning current user info
  - Add proper error handling for invalid credentials (return 401)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 5.1 Write property test for password hashing


  - **Property 3: Password hashing security**
  - **Validates: Requirements 4.2**

- [x] 5.2 Write property test for password length validation


  - **Property 4: Password length validation**
  - **Validates: Requirements 4.3**

- [x] 5.3 Write property test for authentication failure handling


  - **Property 5: Authentication failure handling**
  - **Validates: Requirements 4.5**

- [x] 5.4 Write property test for API authentication endpoint security


  - **Property 11: Authentication endpoint security**
  - **Validates: Requirements 13.3**

- [x] 6. Configure Django admin interface





  - Enable django.contrib.admin in INSTALLED_APPS
  - Configure static files for admin assets
  - Create management command for database readiness check (wait_for_db)
  - Test createsuperuser command works correctly
  - Verify admin interface is accessible at /admin
  - _Requirements: 4.1, 5.1, 5.3_

- [x] 6.1 Write property test for admin access control


  - **Property 6: Admin access control**
  - **Validates: Requirements 5.2**


- [x] 7. Set up Uvicorn ASGI server




  - Configure asgi.py application entry point
  - Create run script for Uvicorn with --reload flag for development
  - Configure Uvicorn to bind to localhost:8000
  - Test WebSocket support is enabled
  - Verify auto-reload works when code changes
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 7.1 Write property test for CSRF token validation


  - **Property 10: CSRF validation enforcement**
  - **Validates: Requirements 12.4**

- [x] 8. Run database migrations and create superuser





  - Start PostgreSQL using docker-compose up -d
  - Run Django migrations to create database tables
  - Create superuser account for admin access
  - Verify database connection works
  - Test admin login with superuser credentials
  - _Requirements: 1.1, 1.2, 4.1, 4.4, 5.5, 14.5_

- [x] 8.1 Write unit tests for backend setup


  - Test database connection with valid credentials
  - Test health check endpoint returns 200
  - Test CSRF endpoint sets cookie
  - Test admin login flow
  - Test CORS headers are present
  - _Requirements: 1.1, 2.3, 2.4, 4.4, 12.2_

- [x] 9. Checkpoint - Ensure backend tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Initialize React frontend project





  - Create React 18+ project with Vite and TypeScript template
  - Install dependencies: react-router-dom, @tanstack/react-query, axios
  - Install Tailwind CSS and configure PostCSS
  - Create directory structure: components/, pages/, hooks/, services/, types/
  - Configure absolute imports with path aliases in vite.config.ts and tsconfig.json
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 9.1, 11.2, 11.4, 15.1_

- [x] 11. Configure Tailwind CSS with cyberpunk theme





  - Extend Tailwind config with custom colors: background (#0f172a), surface (#1e293b), primary (#a855f7), secondary (#06b6d4), success (#22c55e)
  - Configure custom font families: Inter for headers, JetBrains Mono for code
  - Import Tailwind directives in index.css
  - Apply background color to root element
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. Create AppShell layout component





  - Create AppShell component with sticky navigation bar
  - Apply glassmorphism effect using backdrop-blur and bg-opacity
  - Display "Labyricorn" text in navigation with cyberpunk colors
  - Add main content area with proper padding
  - Export component for use in pages
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 13. Set up React Router with pages





  - Configure BrowserRouter in App.tsx
  - Create HomePage component with basic content
  - Create LoginPage component with login form placeholder
  - Create NotFoundPage component with cyberpunk-styled 404 message
  - Define routes for /, /login, and catch-all 404
  - Wrap all routes with AppShell layout
  - _Requirements: 15.1, 15.2, 15.3, 15.5_

- [x] 13.1 Write property test for route 404 handling


  - **Property 12: Route handling completeness**
  - **Validates: Requirements 15.3**

- [x] 14. Implement API client service with CSRF support





  - Create axios instance with base URL from environment variable
  - Configure withCredentials: true for session cookies
  - Implement getCsrfToken() helper to read cookie
  - Add request interceptor to include X-CSRFToken header on state-changing requests
  - Add response interceptor for error logging
  - Create initializeCsrf() function to call /csrf endpoint
  - _Requirements: 9.2, 9.3, 12.3, 12.5_

- [x] 14.1 Write property test for CSRF header inclusion


  - **Property 9: CSRF token inclusion**
  - **Validates: Requirements 12.3**

- [x] 14.2 Write property test for API request headers


  - **Property 7: API request header consistency**
  - **Validates: Requirements 9.3**

- [x] 15. Create custom hooks for API communication





  - Set up QueryClient and QueryClientProvider in main.tsx
  - Create useHealthCheck hook using useQuery
  - Create useAuth hook with login, logout, and getCurrentUser functions
  - Implement error handling in hooks to display user-friendly messages
  - Call initializeCsrf() on app initialization
  - _Requirements: 9.1, 9.4, 9.5_

- [x] 15.1 Write property test for API error handling


  - **Property 8: API error handling**
  - **Validates: Requirements 9.4**

- [x] 16. Set up TypeScript type generation from OpenAPI





  - Install openapi-typescript as dev dependency
  - Create scripts/generate-types.js to fetch OpenAPI schema and generate types
  - Add "gen:types" script to package.json
  - Run script to generate initial types in src/types/api.ts
  - Update API client to use generated types
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 17. Implement LoginPage with authentication





  - Create login form with username and password fields
  - Style form with cyberpunk theme colors
  - Connect form to useAuth hook
  - Handle login success by redirecting to home page
  - Display error messages for failed login attempts
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 18. Display health check status on HomePage





  - Use useHealthCheck hook to fetch API status
  - Display loading state while fetching
  - Show status and version when data loads
  - Display error message if health check fails
  - Style with cyberpunk theme
  - _Requirements: 9.5, 9.4_

- [x] 18.1 Write unit tests for frontend components


  - Test AppShell renders navigation and children
  - Test NotFoundPage renders 404 message
  - Test API client configuration
  - Test useHealthCheck hook
  - Test CSRF token helper functions
  - _Requirements: 8.1, 8.3, 9.2, 9.5, 12.3_

- [x] 19. Configure environment variables and validation






  - Create backend/.env.example with all required variables
  - Create frontend/.env.example with VITE_API_BASE_URL
  - Implement environment variable validation in Django settings
  - Implement environment variable validation in vite.config.ts
  - Document environment setup in README
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 20. Set up CI/CD pipeline





  - Create .github/workflows/ci.yml
  - Configure backend-tests job with PostgreSQL service
  - Configure frontend-tests job with linting and tests
  - Test workflow runs on pull requests and pushes
  - _Requirements: Testing Strategy_

- [x] 21. Create project documentation





  - Create README.md with project overview
  - Document setup instructions for Docker, backend, and frontend
  - Document environment variable configuration
  - Document how to run tests
  - Document API endpoints and authentication flow
  - _Requirements: 10.4, 10.5_

- [x] 22. Final checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
