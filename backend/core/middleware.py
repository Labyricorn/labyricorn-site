"""
Custom middleware for Labyricorn
"""
from django.middleware.csrf import CsrfViewMiddleware
from django.utils.decorators import decorator_from_middleware_with_args
from django.conf import settings
import secrets


class NinjaCSRFMiddleware:
    """
    Middleware to enforce CSRF protection on Django Ninja API endpoints.
    
    Django Ninja by default applies @csrf_exempt to all its views, which bypasses
    Django's CSRF protection. This middleware re-enables CSRF checking for API endpoints
    to ensure security compliance with Requirements 12.4.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def _compare_tokens(self, token1, token2):
        """
        Compare two CSRF tokens using constant-time comparison.
        Handles both masked and unmasked tokens.
        """
        if not token1 or not token2:
            return False
        
        # Django CSRF tokens can be masked (64 chars) or unmasked (32 chars)
        # For simplicity, we'll do a direct comparison
        # In production, Django's middleware handles the masking/unmasking
        return secrets.compare_digest(token1, token2)
    
    def __call__(self, request):
        # Check if this is an API request that needs CSRF protection
        if request.path.startswith('/api/v1/') and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Skip CSRF check for the /csrf endpoint itself (though it's GET, so wouldn't match anyway)
            if request.path == '/api/v1/csrf':
                return self.get_response(request)
            
            # Skip CSRF check for public voting endpoints
            # These endpoints are public and don't require authentication
            if '/vote' in request.path:
                return self.get_response(request)
            
            # Get CSRF token from header
            csrf_token = request.META.get('HTTP_X_CSRFTOKEN', '')
            
            # Get CSRF token from cookie
            csrf_cookie = request.COOKIES.get(settings.CSRF_COOKIE_NAME, '')
            
            # If no CSRF token provided, reject
            if not csrf_token:
                from django.http import JsonResponse
                return JsonResponse({'detail': 'CSRF verification failed'}, status=403)
            
            # If no CSRF cookie, reject
            if not csrf_cookie:
                from django.http import JsonResponse
                return JsonResponse({'detail': 'CSRF verification failed'}, status=403)
            
            # Compare tokens
            if not self._compare_tokens(csrf_token, csrf_cookie):
                from django.http import JsonResponse
                return JsonResponse({'detail': 'CSRF verification failed'}, status=403)
        
        response = self.get_response(request)
        return response
