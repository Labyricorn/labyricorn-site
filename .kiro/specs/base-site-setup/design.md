# Design Document

## Overview

The Labyricorn base site establishes a full-stack foundation with Django 5.0+ backend and React 18+ frontend. The architecture follows a clear separation between the API layer (Django Ninja), business logic (Django apps), and presentation layer (React SPA). The system uses PostgreSQL for data persistence, Uvicorn as the ASGI server, and Vite for frontend tooling. Authentication is handled through Django's built-in system with session-based admin access.

The design prioritizes developer experience with hot-reloading in development, type safety through TypeScript, and a clean project structure that supports future feature additions. The cyberpunk visual theme is implemented through Tailwind CSS custom configuration.

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         React 18 + TypeScript + Tailwind           │    │
│  │              (Vite Dev Server :5173)               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            │ (CORS enabled)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Django Backend (:8000)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Uvicorn ASGI Server                   │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Django 5.0+ Application               │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ Django Ninja │  │    Django    │              │    │
│  │  │  API Layer   │  │    Admin     │              │    │
│  │  │  /api/v1/*   │  │   /admin/*   │              │    │
│  │  └──────────────┘  └──────────────┘              │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐    │    │
│  │  │      Django Authentication System        │    │    │
│  │  └──────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16 Database                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Django 5.0+ (Web framework)
- Django Ninja (API layer with OpenAPI support)
- Uvicorn (ASGI server)
- PostgreSQL 16 (Database)
- psycopg2-binary (PostgreSQL adapter)
- python-dotenv (Environment variable management)

**Frontend:**
- React 18+ (UI framework)
- TypeScript (Type safety)
- Vite (Build tool and dev server)
- Tailwind CSS (Styling)
- TanStack Query (Server state management)
- Axios (HTTP client)

## Components and Interfaces

### Backend Components

#### 1. Django Project Structure

```
backend/
├── labyricorn/              # Main project directory
│   ├── __init__.py
│   ├── settings.py          # Django settings with environment config
│   ├── urls.py              # Root URL configuration
│   ├── asgi.py              # ASGI application entry point
│   └── wsgi.py              # WSGI application (for future use)
├── core/                    # Core app for shared functionality
│   ├── __init__.py
│   ├── apps.py
│   ├── admin.py             # Admin customizations
│   └── management/
│       └── commands/
│           └── wait_for_db.py  # Database readiness check
├── api/                     # API app for Django Ninja routes
│   ├── __init__.py
│   ├── apps.py
│   ├── urls.py              # API router configuration
│   └── views.py             # API endpoint handlers
├── manage.py
└── requirements.txt
```

#### 2. Settings Configuration

The `settings.py` file will be organized into sections:

- **Core Settings**: DEBUG, SECRET_KEY, ALLOWED_HOSTS
- **Database**: PostgreSQL connection via environment variables
- **Installed Apps**: Django core, admin, Django Ninja, CORS headers
- **Middleware**: Security, sessions, CORS, authentication
- **Authentication**: Django's built-in auth with session backend
- **Static Files**: Configuration for admin static assets
- **CORS**: Whitelist for frontend origin (localhost:5173)
- **CSRF**: Configure CSRF_TRUSTED_ORIGINS for cross-origin requests from React frontend
- **Session**: Configure SESSION_COOKIE_SAMESITE and SESSION_COOKIE_SECURE for cross-origin sessions

#### 3. API Layer (Django Ninja)

```python
# api/urls.py structure
from ninja import NinjaAPI

api = NinjaAPI(
    title="Labyricorn API",
    version="0.1.0",
    description="API for Labyricorn portfolio platform"
)

# Health check endpoint
@api.get("/health")
def health_check(request):
    return {"status": "ok", "version": "0.1.0"}

# CSRF token endpoint
@api.get("/csrf")
def get_csrf_token(request):
    """Endpoint to set CSRF cookie for SPA"""
    return {"detail": "CSRF cookie set"}

# Authentication endpoints
@api.post("/auth/login")
def login(request, username: str, password: str):
    """API-based login for React frontend"""
    # Implementation in tasks
    pass

@api.post("/auth/logout")
def logout(request):
    """API-based logout"""
    # Implementation in tasks
    pass

@api.get("/auth/me")
def current_user(request):
    """Get current authenticated user info"""
    # Implementation in tasks
    pass
```

#### 4. Database Models

For the base setup, we only need Django's built-in User model. Custom models will be added in future features.

### Frontend Components

#### 1. React Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   └── layout/
│   │       └── AppShell.tsx # Main layout wrapper
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useHealthCheck.ts
│   │   └── useAuth.ts
│   ├── services/            # API client and services
│   │   └── api.ts           # Axios instance and base config
│   ├── types/               # TypeScript type definitions (auto-generated)
│   │   └── api.ts
│   ├── App.tsx              # Root component with router
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles and Tailwind imports
├── public/
├── scripts/
│   └── generate-types.js    # OpenAPI to TypeScript generator
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

#### 2. AppShell Component

The main layout component that provides consistent structure:

```typescript
interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-purple-500/20">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-purple-400">Labyricorn</h1>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

#### 3. API Client Service

```typescript
// services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Get CSRF token from cookie
function getCsrfToken(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return null;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For session cookies and CSRF
});

// Request interceptor to add CSRF token
apiClient.interceptors.request.use(
  (config) => {
    const csrfToken = getCsrfToken();
    if (csrfToken && config.method !== 'get') {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Initialize CSRF token on app load
export async function initializeCsrf() {
  await apiClient.get('/csrf');
}
```

#### 4. TanStack Query Setup

```typescript
// hooks/useHealthCheck.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface HealthCheckResponse {
  status: string;
  version: string;
}

export function useHealthCheck() {
  return useQuery<HealthCheckResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await apiClient.get<HealthCheckResponse>('/health');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
```

## Data Models

### Django User Model

For the base setup, we use Django's built-in `django.contrib.auth.models.User` model with the following relevant fields:

- `username`: CharField (unique, required)
- `password`: CharField (hashed, required)
- `email`: EmailField (optional)
- `is_superuser`: BooleanField (admin access flag)
- `is_staff`: BooleanField (admin site access flag)
- `is_active`: BooleanField (account status)
- `date_joined`: DateTimeField (auto-generated)
- `last_login`: DateTimeField (auto-updated)

### Environment Variables Schema

**Backend (.env):**
```
DATABASE_NAME=labyricorn_db
DATABASE_USER=postgres
DATABASE_PASSWORD=<secure_password>
DATABASE_HOST=localhost
DATABASE_PORT=5432
DJANGO_SECRET_KEY=<generated_secret_key>
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
```

**Frontend (.env):**
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Docker Compose Configuration

For consistent development environments, the project includes a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: labyricorn_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  adminer:
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - db

volumes:
  postgres_data:
```

This provides:
- PostgreSQL 16 database on port 5432
- Adminer database management UI on port 8080
- Persistent data storage via Docker volumes

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: API endpoint path consistency
*For any* API endpoint registered in the Django Ninja router, the endpoint's URL path should start with /api/v1
**Validates: Requirements 2.2**

Property 2: Request schema validation
*For any* API endpoint that defines an input schema, when a request is received with invalid data, the endpoint should reject the request before executing business logic
**Validates: Requirements 2.5**

Property 3: Password hashing security
*For any* user created through the Django authentication system, the stored password field should be a hashed value and not the plaintext password
**Validates: Requirements 4.2**

Property 4: Password length validation
*For any* password submitted during user creation, if the password is shorter than 8 characters, the system should reject it with a validation error
**Validates: Requirements 4.3**

Property 5: Authentication failure handling
*For any* login attempt with incorrect credentials (wrong username or wrong password), the authentication system should reject the attempt and return an error message
**Validates: Requirements 4.5**

Property 6: Admin access control
*For any* request to an admin URL path (/admin/*) without valid authentication, the system should redirect to the login page rather than displaying admin content
**Validates: Requirements 5.2**

Property 7: API request header consistency
*For any* HTTP request made by the React Frontend API client, the request should include the Content-Type: application/json header
**Validates: Requirements 9.3**

Property 8: API error handling
*For any* API request that fails (network error, 4xx, or 5xx response), the React Frontend should display an error message to the user
**Validates: Requirements 9.4**

Property 9: CSRF token inclusion
*For any* POST, PUT, PATCH, or DELETE request made by the React Frontend, the request should include the X-CSRFToken header with a valid token
**Validates: Requirements 12.3**

Property 10: CSRF validation enforcement
*For any* state-changing request (POST, PUT, PATCH, DELETE) to the Django Backend without a valid CSRF token, the backend should reject the request with status code 403
**Validates: Requirements 12.4**

Property 11: Authentication endpoint security
*For any* login attempt with invalid credentials (non-existent username or incorrect password), the /api/v1/auth/login endpoint should return status code 401 with an error message
**Validates: Requirements 13.3**

Property 12: Route handling completeness
*For any* URL path that is not defined in the React Router configuration, the application should render the 404 NotFound page
**Validates: Requirements 15.3**

## Error Handling

### Backend Error Handling

**Database Connection Errors:**
- On startup, if PostgreSQL connection fails, log detailed error including host, port, and database name
- Prevent server from starting to avoid running in degraded state
- Provide clear error messages for common issues (wrong credentials, database doesn't exist, server not running)

**API Request Errors:**
- Django Ninja automatically returns 422 for schema validation failures with detailed field errors
- Return 401 for authentication failures with generic message (avoid leaking user existence)
- Return 500 for unexpected server errors with error ID for tracking (hide stack traces in production)
- Log all errors with request context (endpoint, method, user, timestamp)

**Authentication Errors:**
- Rate limit login attempts to prevent brute force attacks (future enhancement)
- Return generic "Invalid credentials" message for both wrong username and wrong password
- Log failed login attempts with IP address and timestamp

### Frontend Error Handling

**API Communication Errors:**
- Network errors: Display "Unable to connect to server" message
- 4xx errors: Display specific error message from API response
- 5xx errors: Display "Server error, please try again" message
- Timeout errors: Display "Request timed out" message with retry option

**Component Error Boundaries:**
- Wrap main app in React Error Boundary to catch rendering errors
- Display user-friendly error page instead of blank screen
- Log errors to console for debugging
- Provide "Reload page" button for recovery

**TanStack Query Error Handling:**
- Configure global error handler for all queries
- Display toast notifications for failed mutations
- Implement retry logic for transient failures (3 retries with exponential backoff)
- Cache error states to prevent repeated failed requests

## Testing Strategy

### Backend Testing

**Unit Tests:**
- Test database connection with valid and invalid credentials
- Test health check endpoint returns correct response
- Test superuser creation command
- Test admin login with correct and incorrect credentials
- Test CORS configuration allows frontend origin
- Test environment variable loading

**Property-Based Tests:**

We will use **Hypothesis** as the property-based testing library for Python/Django.

Each property-based test will:
- Run a minimum of 100 iterations with randomly generated inputs
- Include a comment tag referencing the design document property
- Use Hypothesis strategies to generate valid and invalid test data

Property tests to implement:
1. **API Path Consistency** - Generate random endpoint names, verify all are under /api/v1
2. **Schema Validation** - Generate invalid request payloads, verify all are rejected before processing
3. **Password Hashing** - Generate random passwords, verify all stored passwords are hashed
4. **Password Length** - Generate passwords of various lengths, verify short ones are rejected
5. **Auth Failure** - Generate random incorrect credentials, verify all are rejected
6. **Access Control** - Generate requests to admin URLs without auth, verify all redirect
7. **CSRF Token Inclusion** - Generate random state-changing requests, verify all include CSRF token
8. **CSRF Validation** - Generate requests without CSRF tokens, verify all are rejected with 403
9. **API Auth Failure** - Generate invalid credentials for API login, verify all return 401
10. **404 Routing** - Generate random undefined routes, verify all render NotFound page

**Integration Tests:**
- Test full request/response cycle from API endpoint to database
- Test admin login flow end-to-end
- Test CORS preflight requests from frontend origin

### Frontend Testing

**Unit Tests:**
- Test AppShell component renders navigation and children
- Test API client configuration (base URL, headers)
- Test useHealthCheck hook returns data correctly
- Test error display components render error messages
- Test Tailwind color configuration

**Property-Based Tests:**

We will use **fast-check** as the property-based testing library for TypeScript/React.

Each property-based test will:
- Run a minimum of 100 iterations with randomly generated inputs
- Include a comment tag referencing the design document property
- Use fast-check arbitraries to generate test data

Property tests to implement:
1. **Request Headers** - Generate random API requests, verify all include JSON content-type header
2. **Error Display** - Generate random API errors, verify all trigger error message display
3. **CSRF Header** - Generate random POST/PUT/DELETE requests, verify all include X-CSRFToken header
4. **Route 404** - Generate random invalid route paths, verify all render NotFound component

**Component Tests:**
- Test AppShell renders with different children
- Test error boundary catches and displays errors
- Test TanStack Query integration with mock API

### End-to-End Tests

While not part of the initial implementation, the following E2E scenarios should be testable:
- Start backend and frontend servers
- Navigate to frontend in browser
- Verify health check displays "ok" status
- Navigate to /admin
- Verify redirect to login page
- Log in with superuser credentials
- Verify admin dashboard displays

## Deployment Considerations

### Development Environment

**Backend:**
- Run with `uvicorn labyricorn.asgi:application --reload --port 8000`
- Enable Django DEBUG mode
- Use SQLite for quick local testing (optional)
- Enable CORS for localhost:5173

**Frontend:**
- Run with `npm run dev` (Vite dev server on port 5173)
- Enable hot module replacement
- Proxy API requests to localhost:8000
- Use development environment variables

### Production Environment (Future)

**Backend:**
- Run with Gunicorn managing Uvicorn workers
- Disable DEBUG mode
- Use PostgreSQL with connection pooling
- Serve behind Nginx reverse proxy
- Enable HTTPS only
- Restrict CORS to production domain

**Frontend:**
- Build with `npm run build`
- Serve static files through Nginx
- Enable gzip compression
- Set production API base URL
- Implement CDN for assets (optional)

### Environment Variable Management

**Development:**
- Use .env files (not committed to git)
- Provide .env.example templates
- Document all required variables

**Production:**
- Use system environment variables or secrets management
- Never commit secrets to version control
- Rotate SECRET_KEY and database passwords regularly
- Use strong, randomly generated values

## Security Considerations

### Authentication Security

- Use Django's built-in password hashing (PBKDF2 by default)
- Enforce minimum password length (8 characters)
- Use session-based authentication with secure cookies
- Set CSRF protection for all state-changing requests
- Implement HTTPS-only cookies in production

### API Security

- Enable CORS only for trusted origins
- Validate all input data with Django Ninja schemas
- Sanitize error messages to avoid information leakage
- Rate limit API endpoints (future enhancement)
- Log all authentication attempts

### Database Security

- Use parameterized queries (Django ORM handles this)
- Store database credentials in environment variables
- Use least-privilege database user
- Enable SSL for database connections in production
- Regular backups with encryption

### Frontend Security

- Sanitize user input before rendering
- Use Content Security Policy headers
- Avoid storing sensitive data in localStorage
- Implement XSS protection
- Keep dependencies updated

## Performance Considerations

### Backend Performance

- Use async views where appropriate for I/O-bound operations
- Implement database connection pooling
- Add database indexes for frequently queried fields (future)
- Use Django's query optimization (select_related, prefetch_related)
- Enable query logging in development to identify N+1 queries

### Frontend Performance

- Code splitting with React.lazy for route-based chunks
- Optimize images and assets
- Use TanStack Query caching to reduce API calls
- Implement virtual scrolling for long lists (future)
- Minimize bundle size with tree shaking

### Development Performance

- Use Vite's fast HMR for quick feedback
- Use Uvicorn's auto-reload for backend changes
- Optimize Docker builds with layer caching (if using Docker)
- Use PostgreSQL locally to match production environment

## Configuration Validation

### Backend Configuration Validation

The Django settings module should validate required environment variables on startup:

```python
# labyricorn/settings.py
import os
from django.core.exceptions import ImproperlyConfigured

def get_env_variable(var_name, default=None):
    """Get environment variable or raise exception"""
    try:
        return os.environ[var_name]
    except KeyError:
        if default is not None:
            return default
        error_msg = f"Set the {var_name} environment variable"
        raise ImproperlyConfigured(error_msg)

# Required variables
SECRET_KEY = get_env_variable('DJANGO_SECRET_KEY')
DATABASE_NAME = get_env_variable('DATABASE_NAME')
DATABASE_USER = get_env_variable('DATABASE_USER')
DATABASE_PASSWORD = get_env_variable('DATABASE_PASSWORD')
```

### Frontend Configuration Validation

The Vite configuration should validate required environment variables at build time:

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Validate required variables
  const required = ['VITE_API_BASE_URL'];
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    // ... rest of config
  };
});
```

## CI/CD Pipeline

### GitHub Actions Workflow

The project includes a `.github/workflows/ci.yml` file for automated testing:

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          python manage.py test
        env:
          DATABASE_NAME: test_db
          DATABASE_USER: postgres
          DATABASE_PASSWORD: postgres
          DATABASE_HOST: localhost
          DATABASE_PORT: 5432
          DJANGO_SECRET_KEY: test-secret-key
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run linter
        run: |
          cd frontend
          npm run lint
      - name: Run tests
        run: |
          cd frontend
          npm test
```

## Future Enhancements

This base setup provides the foundation for future features:

1. **Additional API Endpoints** - Easy to add new routes to Django Ninja router
2. **Database Models** - Django apps structure supports adding new models
3. **Real-time Features** - WebSocket support already enabled in Uvicorn
4. **Task Queue** - Django-Q2 or Celery can be integrated for background jobs
5. **AI Integration** - Ollama client can be added as a service
6. **File Uploads** - Django media handling can be configured
7. **Advanced Auth** - JWT tokens, OAuth, or magic links can be added
8. **Rate Limiting** - Django middleware or nginx can implement rate limiting
9. **Caching** - Redis can be added for session storage and API caching
10. **Monitoring** - Sentry, DataDog, or similar can be integrated for error tracking

The modular architecture ensures these features can be added incrementally without major refactoring.
