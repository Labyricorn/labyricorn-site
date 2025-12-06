"""
Django Ninja API router configuration
"""
from ninja import NinjaAPI, Schema
from ninja.security import django_auth
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

# Create NinjaAPI instance
# Django Ninja respects Django's CSRF middleware by default
api = NinjaAPI(
    title="Labyricorn API",
    version="0.1.0",
    description="API for Labyricorn portfolio platform"
)

# Import and register projects router
from api.views import router as projects_router
api.add_router("", projects_router)


# Authentication Schemas
class LoginRequest(Schema):
    username: str
    password: str


class LoginResponse(Schema):
    id: int
    username: str
    email: str


class ErrorResponse(Schema):
    detail: str


class UserResponse(Schema):
    id: int
    username: str
    email: str


@api.get("/health")
def health_check(request):
    """Health check endpoint returning status and version"""
    return {"status": "ok", "version": "0.1.0"}


@api.get("/csrf")
def get_csrf_token(request):
    """Endpoint to set CSRF cookie for SPA"""
    # This will generate and set the CSRF token cookie
    csrf_token = get_token(request)
    return {"detail": "CSRF cookie set", "csrfToken": csrf_token}


@api.post("/auth/login", response={200: LoginResponse, 401: ErrorResponse})
def api_login(request, payload: LoginRequest):
    """
    API-based login endpoint for React frontend
    Validates credentials and creates authenticated session
    
    Note: CSRF protection is enforced by Django middleware for this endpoint
    """
    user = authenticate(request, username=payload.username, password=payload.password)
    
    if user is not None:
        login(request, user)
        return 200, {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    else:
        return 401, {"detail": "Invalid credentials"}


@api.post("/auth/logout", response={200: dict})
def api_logout(request):
    """
    API-based logout endpoint
    Destroys the current authenticated session
    
    Note: CSRF protection is enforced by Django middleware for this endpoint
    """
    logout(request)
    return 200, {"detail": "Successfully logged out"}


@api.get("/auth/me", response={200: UserResponse, 401: ErrorResponse})
def current_user(request):
    """
    Get current authenticated user information
    Returns user data if authenticated, 401 if not
    """
    if request.user.is_authenticated:
        return 200, {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email
        }
    else:
        return 401, {"detail": "Not authenticated"}
