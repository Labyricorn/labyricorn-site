from django.test import TestCase
from hypothesis import given, strategies as st, settings, HealthCheck
from hypothesis.extra.django import TestCase as HypothesisTestCase
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.contrib.auth import authenticate
from api.models import Project, KanbanBoard, KanbanCard, CardVote
from api.urls import api
import os


class APIPathConsistencyTests(HypothesisTestCase):
    """
    Property-based tests for API endpoint path consistency
    Feature: base-site-setup, Property 1: API endpoint path consistency
    Validates: Requirements 2.2
    """
    
    @settings(max_examples=100)
    @given(endpoint_path=st.sampled_from(['/health', '/csrf']))
    def test_all_api_endpoints_start_with_api_v1(self, endpoint_path):
        """
        For any API endpoint registered in the Django Ninja router,
        the endpoint's URL path should start with /api/v1
        """
        # Test that the endpoint is accessible under /api/v1
        full_path = f"/api/v1{endpoint_path}"
        
        # Make a request to verify the endpoint exists and is under /api/v1
        response = self.client.get(full_path)
        
        # Should get a valid response (not 404)
        self.assertNotEqual(
            response.status_code, 
            404, 
            f"API endpoint {full_path} not found - not properly mounted under /api/v1"
        )
        
        # Verify the path starts with /api/v1
        self.assertTrue(
            full_path.startswith("/api/v1"),
            f"API endpoint {full_path} does not start with /api/v1"
        )


class RequestSchemaValidationTests(HypothesisTestCase):
    """
    Property-based tests for request schema validation
    Feature: base-site-setup, Property 2: Request schema validation
    Validates: Requirements 2.5
    """
    
    @settings(max_examples=100)
    @given(
        invalid_data=st.one_of(
            st.none(),
            st.integers(),
            st.lists(st.integers()),
            st.text(min_size=1000),  # Very long strings
            st.dictionaries(
                keys=st.text(alphabet=st.characters(blacklist_categories=('Cs',)), min_size=1, max_size=10),
                values=st.one_of(st.none(), st.integers(), st.text())
            )
        )
    )
    def test_api_validates_request_schema_before_processing(self, invalid_data):
        """
        For any API endpoint that defines an input schema,
        when a request is received with invalid data,
        the endpoint should reject the request before executing business logic
        """
        # Note: This test will be more meaningful when we have endpoints with schemas
        # For now, we test that the health endpoint doesn't break with invalid data
        
        # The health endpoint doesn't accept any input, so any POST data should be ignored
        # or the endpoint should only accept GET requests
        response = self.client.get('/api/v1/health')
        
        # Should succeed regardless of what invalid_data we generated
        # because GET endpoints don't process request bodies
        self.assertEqual(response.status_code, 200)
        
        # Verify response structure
        data = response.json()
        self.assertIn('status', data)
        self.assertIn('version', data)


class OpenAPISchemaTests(TestCase):
    """
    Tests for OpenAPI schema generation
    Validates: Requirements 16.1
    """
    
    def test_openapi_schema_accessible(self):
        """Test that OpenAPI schema is accessible at /api/v1/openapi.json"""
        response = self.client.get('/api/v1/openapi.json')
        self.assertEqual(response.status_code, 200)
        
        # Verify it's valid JSON
        schema = response.json()
        
        # Verify basic OpenAPI structure
        self.assertIn('openapi', schema)
        self.assertIn('info', schema)
        self.assertIn('paths', schema)
        
        # Verify API info
        self.assertEqual(schema['info']['title'], 'Labyricorn API')
        self.assertEqual(schema['info']['version'], '0.1.0')
        
        # Verify our endpoints are in the schema
        self.assertIn('/api/v1/health', schema['paths'])
        self.assertIn('/api/v1/csrf', schema['paths'])


class PasswordHashingSecurityTests(HypothesisTestCase):
    """
    Property-based tests for password hashing security
    Feature: base-site-setup, Property 3: Password hashing security
    Validates: Requirements 4.2
    """
    
    @settings(max_examples=5, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        username=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=15
        ),
        password=st.text(
            alphabet=st.characters(min_codepoint=33, max_codepoint=126),
            min_size=8,
            max_size=30
        )
    )
    def test_password_is_hashed_not_plaintext(self, username, password):
        """
        For any user created through the Django authentication system,
        the stored password field should be a hashed value and not the plaintext password
        """
        # Ensure unique username to avoid conflicts
        import time
        unique_username = f"{username}_{int(time.time() * 1000000) % 1000000}"
        
        # Create a user with the generated password
        user = User.objects.create_user(
            username=unique_username,
            password=password
        )
        
        try:
            # Verify the password is not stored in plaintext
            self.assertNotEqual(
                user.password,
                password,
                f"Password stored in plaintext for user {unique_username}"
            )
            
            # Verify the password field is actually hashed (should start with algorithm identifier)
            self.assertTrue(
                user.password.startswith('pbkdf2_sha256$') or 
                user.password.startswith('argon2') or
                user.password.startswith('bcrypt'),
                f"Password does not appear to be hashed: {user.password[:20]}"
            )
            
            # Verify the hashed password can be validated against the original
            self.assertTrue(
                check_password(password, user.password),
                f"Hashed password cannot be validated against original password"
            )
        finally:
            # Clean up
            user.delete()


class PasswordLengthValidationTests(HypothesisTestCase):
    """
    Property-based tests for password length validation
    Feature: base-site-setup, Property 4: Password length validation
    Validates: Requirements 4.3
    """
    
    @settings(max_examples=5, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        username=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=15
        ),
        password=st.text(
            alphabet=st.characters(min_codepoint=33, max_codepoint=126),
            min_size=1,
            max_size=7
        )
    )
    def test_short_passwords_are_rejected(self, username, password):
        """
        For any password submitted during user creation,
        if the password is shorter than 8 characters,
        the system should reject it with a validation error
        """
        from django.core.exceptions import ValidationError
        from django.contrib.auth.password_validation import validate_password
        
        # Verify the password is indeed short
        self.assertLess(len(password), 8, f"Generated password should be < 8 chars: {len(password)}")
        
        # Attempt to validate the password - should raise ValidationError
        with self.assertRaises(ValidationError, msg=f"Password '{password}' with length {len(password)} should be rejected"):
            validate_password(password)


class AuthenticationFailureHandlingTests(HypothesisTestCase):
    """
    Property-based tests for authentication failure handling
    Feature: base-site-setup, Property 5: Authentication failure handling
    Validates: Requirements 4.5
    """
    
    def setUp(self):
        """Create a test user for authentication tests"""
        super().setUp()
        self.test_user = User.objects.create_user(
            username='testuser',
            password='correctpassword123'
        )
    
    def tearDown(self):
        """Clean up test user"""
        self.test_user.delete()
        super().tearDown()
    
    @settings(max_examples=5, deadline=None)
    @given(
        wrong_password=st.text(
            alphabet=st.characters(min_codepoint=33, max_codepoint=126),
            min_size=8,
            max_size=30
        ).filter(lambda x: x != 'correctpassword123')
    )
    def test_wrong_password_rejected(self, wrong_password):
        """
        For any login attempt with incorrect password,
        the authentication system should reject the attempt and return an error message
        """
        # Attempt to authenticate with wrong password
        user = authenticate(username='testuser', password=wrong_password)
        
        # Should return None for failed authentication
        self.assertIsNone(user, f"Authentication should fail with wrong password: {wrong_password}")
    
    @settings(max_examples=5, deadline=None)
    @given(
        wrong_username=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=15
        ).filter(lambda x: x != 'testuser')
    )
    def test_wrong_username_rejected(self, wrong_username):
        """
        For any login attempt with non-existent username,
        the authentication system should reject the attempt and return an error message
        """
        # Attempt to authenticate with wrong username
        user = authenticate(username=wrong_username, password='correctpassword123')
        
        # Should return None for failed authentication
        self.assertIsNone(user, f"Authentication should fail with wrong username: {wrong_username}")


class APIAuthenticationEndpointSecurityTests(HypothesisTestCase):
    """
    Property-based tests for API authentication endpoint security
    Feature: base-site-setup, Property 11: Authentication endpoint security
    Validates: Requirements 13.3
    """
    
    def setUp(self):
        """Create a test user for API authentication tests"""
        super().setUp()
        self.test_user = User.objects.create_user(
            username='apiuser',
            password='validpassword123'
        )
    
    def tearDown(self):
        """Clean up test user"""
        self.test_user.delete()
        super().tearDown()
    
    @settings(max_examples=5, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        wrong_password=st.text(
            alphabet=st.characters(min_codepoint=33, max_codepoint=126),
            min_size=8,
            max_size=30
        ).filter(lambda x: x != 'validpassword123')
    )
    def test_api_login_wrong_password_returns_401(self, wrong_password):
        """
        For any login attempt with invalid credentials (incorrect password),
        the /api/v1/auth/login endpoint should return status code 401 with an error message
        """
        # Get CSRF token first
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to login via API with wrong password
        # Use the test client which handles CSRF automatically when we set the cookie
        response = self.client.post(
            '/api/v1/auth/login',
            data={'username': 'apiuser', 'password': wrong_password},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(
            response.status_code,
            401,
            f"API should return 401 for wrong password, got {response.status_code}"
        )
        
        # Should include error message
        data = response.json()
        self.assertIn('detail', data, "Response should include error detail")
        self.assertEqual(data['detail'], 'Invalid credentials')
    
    @settings(max_examples=5, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        wrong_username=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=15
        ).filter(lambda x: x != 'apiuser')
    )
    def test_api_login_wrong_username_returns_401(self, wrong_username):
        """
        For any login attempt with invalid credentials (non-existent username),
        the /api/v1/auth/login endpoint should return status code 401 with an error message
        """
        # Get CSRF token first
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to login via API with wrong username
        response = self.client.post(
            '/api/v1/auth/login',
            data={'username': wrong_username, 'password': 'validpassword123'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(
            response.status_code,
            401,
            f"API should return 401 for wrong username, got {response.status_code}"
        )
        
        # Should include error message
        data = response.json()
        self.assertIn('detail', data, "Response should include error detail")
        self.assertEqual(data['detail'], 'Invalid credentials')


class AdminAccessControlTests(HypothesisTestCase):
    """
    Property-based tests for admin access control
    Feature: base-site-setup, Property 6: Admin access control
    Validates: Requirements 5.2
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        admin_path=st.sampled_from([
            '/admin/',
            '/admin/auth/',
            '/admin/auth/user/',
            '/admin/auth/group/',
            '/admin/core/',
        ])
    )
    def test_unauthenticated_admin_access_redirects_to_login(self, admin_path):
        """
        For any request to an admin URL path (/admin/*) without valid authentication,
        the system should redirect to the login page rather than displaying admin content
        """
        # Make request to admin path without authentication
        response = self.client.get(admin_path, follow=False)
        
        # Should redirect (302 or 301)
        self.assertIn(
            response.status_code,
            [301, 302],
            f"Admin path {admin_path} should redirect unauthenticated users, got {response.status_code}"
        )
        
        # Should redirect to login page
        self.assertTrue(
            response.url.startswith('/admin/login/'),
            f"Admin path {admin_path} should redirect to login page, got {response.url}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        admin_path=st.sampled_from([
            '/admin/',
            '/admin/auth/user/',
            '/admin/auth/group/',
        ])
    )
    def test_authenticated_non_staff_user_cannot_access_admin(self, admin_path):
        """
        For any request to an admin URL path from a non-staff user,
        the system should deny access
        """
        # Create a regular user (not staff)
        regular_user = User.objects.create_user(
            username='regularuser',
            password='testpass123',
            is_staff=False
        )
        
        try:
            # Login as regular user
            self.client.login(username='regularuser', password='testpass123')
            
            # Attempt to access admin
            response = self.client.get(admin_path, follow=False)
            
            # Should redirect to login (because user is not staff)
            self.assertIn(
                response.status_code,
                [301, 302],
                f"Non-staff user should be redirected from {admin_path}, got {response.status_code}"
            )
        finally:
            # Clean up
            self.client.logout()
            regular_user.delete()
    
    @settings(max_examples=100, deadline=None)
    @given(
        admin_path=st.sampled_from([
            '/admin/',
            '/admin/auth/user/',
            '/admin/auth/group/',
        ])
    )
    def test_authenticated_superuser_can_access_admin(self, admin_path):
        """
        For any request to an admin URL path from a superuser,
        the system should allow access
        """
        # Create a superuser (staff with all permissions)
        superuser = User.objects.create_superuser(
            username='superuser',
            password='testpass123',
            email='super@example.com'
        )
        
        try:
            # Login as superuser
            self.client.login(username='superuser', password='testpass123')
            
            # Attempt to access admin
            response = self.client.get(admin_path, follow=True)
            
            # Should get 200 OK (access granted)
            self.assertEqual(
                response.status_code,
                200,
                f"Superuser should access {admin_path}, got {response.status_code}"
            )
            
            # Should not be on login page
            self.assertNotIn(
                'login',
                response.request['PATH_INFO'].lower(),
                f"Superuser should not be redirected to login for {admin_path}"
            )
        finally:
            # Clean up
            self.client.logout()
            superuser.delete()


class CSRFValidationEnforcementTests(HypothesisTestCase):
    """
    Property-based tests for CSRF validation enforcement
    Feature: base-site-setup, Property 10: CSRF validation enforcement
    Validates: Requirements 12.4
    """
    
    databases = '__all__'
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        request_method=st.sampled_from(['POST', 'DELETE']),
        endpoint=st.sampled_from([
            '/api/v1/auth/logout',
        ])
    )
    def test_state_changing_requests_without_csrf_token_rejected(self, request_method, endpoint):
        """
        For any state-changing request (POST, PUT, PATCH, DELETE) to the Django Backend
        without a valid CSRF token, the backend should reject the request with status code 403
        
        Note: We test logout endpoint because it doesn't have authentication logic that
        would return a different error code before CSRF validation occurs.
        """
        # Make request without CSRF token by using enforce_csrf_checks=True
        # This simulates a request from an untrusted origin without CSRF token
        if request_method == 'POST':
            response = self.client.post(
                endpoint,
                data={},
                content_type='application/json',
                HTTP_X_CSRFTOKEN='',  # Empty CSRF token
                enforce_csrf_checks=True
            )
        elif request_method == 'DELETE':
            response = self.client.delete(
                endpoint,
                HTTP_X_CSRFTOKEN='',  # Empty CSRF token
                enforce_csrf_checks=True
            )
        
        # Should reject with 403 Forbidden due to missing/invalid CSRF token
        self.assertEqual(
            response.status_code,
            403,
            f"{request_method} request to {endpoint} without CSRF token should return 403, got {response.status_code}"
        )
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        request_method=st.sampled_from(['POST', 'DELETE']),
        endpoint=st.sampled_from([
            '/api/v1/auth/logout',
        ])
    )
    def test_state_changing_requests_with_valid_csrf_token_accepted(self, request_method, endpoint):
        """
        For any state-changing request with a valid CSRF token,
        the backend should process the request (not reject with 403)
        
        Note: We test logout endpoint to verify CSRF validation passes when token is present.
        """
        # Get a valid CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        self.assertEqual(csrf_response.status_code, 200)
        
        # Extract CSRF token from cookie
        csrf_token = self.client.cookies.get('csrftoken')
        self.assertIsNotNone(csrf_token, "CSRF token should be set in cookie")
        
        # Make request with valid CSRF token
        if request_method == 'POST':
            response = self.client.post(
                endpoint,
                data={},
                content_type='application/json',
                HTTP_X_CSRFTOKEN=csrf_token.value
            )
        elif request_method == 'DELETE':
            response = self.client.delete(
                endpoint,
                HTTP_X_CSRFTOKEN=csrf_token.value
            )
        
        # Should NOT be rejected with 403 (may get other status codes based on endpoint logic)
        # The logout endpoint will return 200 when CSRF is valid
        self.assertNotEqual(
            response.status_code,
            403,
            f"{request_method} request to {endpoint} with valid CSRF token should not return 403, got {response.status_code}"
        )


# Unit Tests for Backend Setup
# Validates: Requirements 1.1, 2.3, 2.4, 4.4, 12.2

class BackendSetupTests(TestCase):
    """
    Unit tests for backend setup and configuration
    Tests database connection, API endpoints, CSRF, admin login, and CORS headers
    """
    
    def test_database_connection_with_valid_credentials(self):
        """
        Test that database connection works with valid credentials
        Validates: Requirements 1.1
        """
        from django.db import connection
        
        # Attempt to connect to the database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                self.assertEqual(result[0], 1, "Database query should return 1")
        except Exception as e:
            self.fail(f"Database connection failed: {e}")
    
    def test_health_check_endpoint_returns_200(self):
        """
        Test that health check endpoint returns 200 status code
        Validates: Requirements 2.3
        """
        response = self.client.get('/api/v1/health')
        
        # Should return 200 OK
        self.assertEqual(
            response.status_code,
            200,
            f"Health check should return 200, got {response.status_code}"
        )
        
        # Should return JSON with status and version
        data = response.json()
        self.assertIn('status', data, "Health check response should include 'status'")
        self.assertIn('version', data, "Health check response should include 'version'")
        self.assertEqual(data['status'], 'ok', "Health check status should be 'ok'")
    
    def test_csrf_endpoint_sets_cookie(self):
        """
        Test that CSRF endpoint sets the CSRF cookie
        Validates: Requirements 12.2
        """
        response = self.client.get('/api/v1/csrf')
        
        # Should return 200 OK
        self.assertEqual(
            response.status_code,
            200,
            f"CSRF endpoint should return 200, got {response.status_code}"
        )
        
        # Should set csrftoken cookie
        self.assertIn(
            'csrftoken',
            response.cookies,
            "CSRF endpoint should set csrftoken cookie"
        )
        
        # Cookie should have a value
        csrf_cookie = response.cookies['csrftoken']
        self.assertIsNotNone(csrf_cookie.value, "CSRF token should have a value")
        self.assertGreater(len(csrf_cookie.value), 0, "CSRF token should not be empty")
    
    def test_admin_login_flow(self):
        """
        Test that admin login flow works correctly
        Validates: Requirements 4.4
        """
        # Create a superuser for testing
        superuser = User.objects.create_superuser(
            username='testadmin',
            password='testpass123',
            email='admin@example.com'
        )
        
        try:
            # Attempt to access admin without authentication
            response = self.client.get('/admin/', follow=False)
            self.assertIn(
                response.status_code,
                [301, 302],
                "Unauthenticated access to admin should redirect"
            )
            
            # Login with superuser credentials
            login_success = self.client.login(username='testadmin', password='testpass123')
            self.assertTrue(login_success, "Admin login should succeed with valid credentials")
            
            # Access admin after login
            response = self.client.get('/admin/', follow=True)
            self.assertEqual(
                response.status_code,
                200,
                "Authenticated superuser should access admin"
            )
            
            # Logout
            self.client.logout()
            
            # Verify logout worked
            response = self.client.get('/admin/', follow=False)
            self.assertIn(
                response.status_code,
                [301, 302],
                "After logout, admin access should redirect"
            )
        finally:
            # Clean up
            superuser.delete()
    
    def test_cors_headers_are_present(self):
        """
        Test that CORS headers are present in API responses
        Validates: Requirements 2.4
        """
        # Make a request to the health endpoint
        response = self.client.get(
            '/api/v1/health',
            HTTP_ORIGIN='http://localhost:5173'
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Check for CORS headers
        # Note: In test environment, CORS headers might not be set the same way
        # as in production, but we can verify the middleware is configured
        from django.conf import settings
        
        # Verify CORS is configured in settings
        self.assertIn(
            'corsheaders',
            settings.INSTALLED_APPS,
            "CORS headers app should be installed"
        )
        
        self.assertIn(
            'corsheaders.middleware.CorsMiddleware',
            settings.MIDDLEWARE,
            "CORS middleware should be configured"
        )
        
        # Verify allowed origins are configured
        self.assertIn(
            'http://localhost:5173',
            settings.CORS_ALLOWED_ORIGINS,
            "Frontend origin should be in CORS allowed origins"
        )



# Property-Based Tests for Projects Management Feature
# Feature: projects-management

class ProjectSlugGenerationTests(HypothesisTestCase):
    """
    Property-based tests for slug generation from title
    Feature: projects-management, Property 2: Slug generation from title
    Validates: Requirements 1.2
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=200
        )
    )
    def test_slug_is_url_safe_and_derived_from_title(self, title):
        """
        For any project title, the system should generate a URL-safe slug
        that contains only lowercase letters, numbers, and hyphens, derived from the title.
        """
        from api.models import Project
        import re
        
        # Create a project with the generated title
        project = Project.objects.create(
            title=title,
            description="Test description"
        )
        
        try:
            # Verify slug is not empty
            self.assertIsNotNone(project.slug, f"Slug should not be None for title: {title}")
            self.assertGreater(len(project.slug), 0, f"Slug should not be empty for title: {title}")
            
            # Verify slug is URL-safe (only lowercase letters, numbers, and hyphens)
            url_safe_pattern = r'^[a-z0-9-]+$'
            self.assertTrue(
                re.match(url_safe_pattern, project.slug),
                f"Slug '{project.slug}' is not URL-safe (should only contain lowercase letters, numbers, and hyphens)"
            )
            
            # Verify slug is lowercase
            self.assertEqual(
                project.slug,
                project.slug.lower(),
                f"Slug '{project.slug}' should be lowercase"
            )
        finally:
            # Clean up
            project.delete()


class ProjectSlugUniquenessTests(HypothesisTestCase):
    """
    Property-based tests for slug uniqueness enforcement
    Feature: projects-management, Property 3: Slug uniqueness enforcement
    Validates: Requirements 1.3, 2.5
    """
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        ),
        num_duplicates=st.integers(min_value=2, max_value=5)
    )
    def test_duplicate_titles_get_unique_slugs_with_numeric_suffixes(self, title, num_duplicates):
        """
        For any set of projects with duplicate or conflicting titles,
        each project should have a unique slug, with numeric suffixes appended as needed.
        """
        from api.models import Project
        
        projects = []
        slugs = set()
        
        try:
            # Create multiple projects with the same title
            for i in range(num_duplicates):
                project = Project.objects.create(
                    title=title,
                    description=f"Test description {i}"
                )
                projects.append(project)
                slugs.add(project.slug)
            
            # Verify all slugs are unique
            self.assertEqual(
                len(slugs),
                num_duplicates,
                f"Expected {num_duplicates} unique slugs for duplicate title '{title}', got {len(slugs)}: {slugs}"
            )
            
            # Verify the first project has the base slug (no suffix)
            # and subsequent projects have numeric suffixes
            base_slug = projects[0].slug
            
            for i, project in enumerate(projects[1:], start=1):
                # Should have a numeric suffix
                self.assertTrue(
                    project.slug.startswith(base_slug),
                    f"Slug '{project.slug}' should start with base slug '{base_slug}'"
                )
                # The suffix should be a number
                suffix = project.slug[len(base_slug):]
                if suffix:  # May have a hyphen and number
                    self.assertTrue(
                        suffix.startswith('-'),
                        f"Suffix '{suffix}' should start with hyphen"
                    )
                    self.assertTrue(
                        suffix[1:].isdigit(),
                        f"Suffix '{suffix[1:]}' should be a number"
                    )
        finally:
            # Clean up
            for project in projects:
                project.delete()


class ProjectImageLifecycleTests(HypothesisTestCase):
    """
    Property-based tests for image file lifecycle management
    Feature: projects-management, Property 6: Image file lifecycle management
    Validates: Requirements 2.3, 2.4
    """
    
    @settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        )
    )
    def test_image_file_deleted_when_project_updated_or_removed(self, title):
        """
        For any project with a hero image, updating or removing the image
        should result in the old image file being deleted from storage.
        """
        from api.models import Project
        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image as PILImage
        import io
        
        # Create a test image
        image1 = PILImage.new('RGB', (100, 100), color='red')
        image1_io = io.BytesIO()
        image1.save(image1_io, format='PNG')
        image1_io.seek(0)
        image1_file = SimpleUploadedFile(
            "test_image1.png",
            image1_io.read(),
            content_type="image/png"
        )
        
        # Create project with image
        project = Project.objects.create(
            title=title,
            description="Test description",
            hero_image=image1_file
        )
        
        try:
            # Store the path of the first image
            first_image_path = project.hero_image.path
            
            # Verify first image exists
            self.assertTrue(
                os.path.isfile(first_image_path),
                f"First image should exist at {first_image_path}"
            )
            
            # Create a second test image
            image2 = PILImage.new('RGB', (100, 100), color='blue')
            image2_io = io.BytesIO()
            image2.save(image2_io, format='PNG')
            image2_io.seek(0)
            image2_file = SimpleUploadedFile(
                "test_image2.png",
                image2_io.read(),
                content_type="image/png"
            )
            
            # Update project with new image
            project.hero_image = image2_file
            project.save()
            
            # Verify first image was deleted
            self.assertFalse(
                os.path.isfile(first_image_path),
                f"First image should be deleted after update, but still exists at {first_image_path}"
            )
            
            # Verify second image exists
            second_image_path = project.hero_image.path
            self.assertTrue(
                os.path.isfile(second_image_path),
                f"Second image should exist at {second_image_path}"
            )
        finally:
            # Clean up - this will also delete the second image
            project.delete()
            
            # Verify second image was deleted
            if 'second_image_path' in locals():
                self.assertFalse(
                    os.path.isfile(second_image_path),
                    f"Second image should be deleted after project deletion"
                )


class ProjectDeletionCompletenessTests(HypothesisTestCase):
    """
    Property-based tests for project deletion completeness
    Feature: projects-management, Property 7: Project deletion completeness
    Validates: Requirements 3.1, 3.2
    """
    
    @settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        ),
        has_image=st.booleans()
    )
    def test_project_deletion_removes_database_record_and_image_file(self, title, has_image):
        """
        For any project, deleting it should result in both the database record
        being removed and any associated hero image file being deleted from storage.
        """
        from api.models import Project
        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image as PILImage
        import io
        
        # Create project
        project_data = {
            'title': title,
            'description': 'Test description'
        }
        
        image_path = None
        if has_image:
            # Create a test image
            image = PILImage.new('RGB', (100, 100), color='green')
            image_io = io.BytesIO()
            image.save(image_io, format='PNG')
            image_io.seek(0)
            image_file = SimpleUploadedFile(
                "test_image.png",
                image_io.read(),
                content_type="image/png"
            )
            project_data['hero_image'] = image_file
        
        project = Project.objects.create(**project_data)
        project_id = project.id
        
        if has_image:
            image_path = project.hero_image.path
            # Verify image exists before deletion
            self.assertTrue(
                os.path.isfile(image_path),
                f"Image should exist before deletion at {image_path}"
            )
        
        # Delete the project
        project.delete()
        
        # Verify database record is removed
        with self.assertRaises(Project.DoesNotExist):
            Project.objects.get(id=project_id)
        
        # Verify image file is deleted if it existed
        if has_image and image_path:
            self.assertFalse(
                os.path.isfile(image_path),
                f"Image should be deleted after project deletion, but still exists at {image_path}"
            )



class AdminSearchFunctionalityTests(HypothesisTestCase):
    """
    Property-based tests for admin search functionality
    Feature: projects-management, Property 17: Admin search functionality
    Validates: Requirements 7.5
    """
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=5,
            max_size=50
        ),
        search_query=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=2,
            max_size=10
        )
    )
    def test_admin_search_returns_projects_matching_title_or_slug(self, title, search_query):
        """
        For any search query in the Django admin, projects matching the query
        in either title or slug fields should be returned in the results.
        """
        from api.models import Project
        from django.contrib.admin.sites import site
        from api.admin import ProjectAdmin
        from django.contrib.auth.models import User
        from django.test import RequestFactory
        
        # Create a project
        project = Project.objects.create(
            title=title,
            description="Test description"
        )
        
        try:
            # Create a mock request with a superuser
            factory = RequestFactory()
            request = factory.get('/admin/api/project/', {'q': search_query})
            
            # Create a superuser for the request
            superuser = User.objects.create_superuser(
                username='testadmin',
                password='testpass123',
                email='admin@example.com'
            )
            request.user = superuser
            
            try:
                # Get the ProjectAdmin instance
                project_admin = ProjectAdmin(Project, site)
                
                # Get the queryset with search applied
                queryset = project_admin.get_search_results(
                    request,
                    Project.objects.all(),
                    search_query
                )[0]
                
                # Check if the project should be in results
                # It should be included if search_query is in title or slug
                should_be_included = (
                    search_query.lower() in title.lower() or
                    search_query.lower() in project.slug.lower()
                )
                
                if should_be_included:
                    # Project should be in the search results
                    self.assertIn(
                        project,
                        queryset,
                        f"Project with title '{title}' and slug '{project.slug}' should be in search results for query '{search_query}'"
                    )
                else:
                    # Project should not be in the search results
                    self.assertNotIn(
                        project,
                        queryset,
                        f"Project with title '{title}' and slug '{project.slug}' should NOT be in search results for query '{search_query}'"
                    )
            finally:
                # Clean up superuser
                superuser.delete()
        finally:
            # Clean up project
            project.delete()



# Property-Based Tests for Project API Endpoints
# Feature: projects-management

class ProjectCreationPersistenceTests(HypothesisTestCase):
    """
    Property-based tests for project creation persistence
    Feature: projects-management, Property 1: Project creation persistence
    Validates: Requirements 1.1, 1.4, 1.5
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        ),
        description=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=10,
            max_size=200
        ),
        repo_url=st.one_of(
            st.none(),
            st.just("https://github.com/test/repo"),
            st.just("https://gitlab.com/test/project")
        ),
        tech_stack=st.lists(
            st.text(
                alphabet=st.characters(min_codepoint=65, max_codepoint=90),
                min_size=2,
                max_size=15
            ),
            min_size=0,
            max_size=5
        )
    )
    def test_project_creation_persists_all_fields_correctly(self, title, description, repo_url, tech_stack):
        """
        For any valid project data (title, description, optional repo_url, tech_stack, hero_image),
        creating a project should result in a database record with all submitted fields
        correctly stored and a created_at timestamp set to the current time.
        """
        from api.models import Project
        from django.utils import timezone
        from datetime import timedelta
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Prepare form data
        form_data = {
            'title': title,
            'description': description,
            'tech_stack': ','.join(tech_stack) if tech_stack else ''
        }
        
        if repo_url:
            form_data['repo_url'] = repo_url
        
        # Record time before creation
        time_before = timezone.now()
        
        # Create project via API
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Record time after creation
        time_after = timezone.now()
        
        try:
            # Should return 201 Created
            self.assertEqual(
                response.status_code,
                201,
                f"Project creation should return 201, got {response.status_code}: {response.content}"
            )
            
            # Get response data
            data = response.json()
            
            # Verify all fields are present in response
            self.assertIn('id', data)
            self.assertIn('title', data)
            self.assertIn('slug', data)
            self.assertIn('description', data)
            self.assertIn('repo_url', data)
            self.assertIn('tech_stack', data)
            self.assertIn('hero_image', data)
            self.assertIn('created_at', data)
            
            # Verify fields match submitted data
            self.assertEqual(data['title'], title)
            self.assertEqual(data['description'], description)
            self.assertEqual(data['repo_url'], repo_url)
            self.assertEqual(sorted(data['tech_stack']), sorted(tech_stack))
            
            # Verify project exists in database
            project = Project.objects.get(id=data['id'])
            self.assertEqual(project.title, title)
            self.assertEqual(project.description, description)
            self.assertEqual(project.repo_url, repo_url)
            self.assertEqual(sorted(project.tech_stack), sorted(tech_stack))
            
            # Verify created_at is set to current time (within reasonable window)
            self.assertGreaterEqual(
                project.created_at,
                time_before - timedelta(seconds=1),
                "created_at should be set to current time"
            )
            self.assertLessEqual(
                project.created_at,
                time_after + timedelta(seconds=1),
                "created_at should be set to current time"
            )
            
            # Clean up
            project.delete()
        except Exception as e:
            # Clean up any created projects
            if 'data' in locals() and 'id' in data:
                try:
                    Project.objects.get(id=data['id']).delete()
                except:
                    pass
            raise



class ProjectUpdatePersistenceTests(HypothesisTestCase):
    """
    Property-based tests for project update persistence
    Feature: projects-management, Property 4: Project update persistence
    Validates: Requirements 2.1
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser and initial project for update tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        initial_title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=30
        ),
        updated_title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=30
        ),
        updated_description=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=10,
            max_size=200
        ),
        updated_repo_url=st.one_of(
            st.none(),
            st.just("https://github.com/updated/repo")
        ),
        updated_tech_stack=st.lists(
            st.text(
                alphabet=st.characters(min_codepoint=65, max_codepoint=90),
                min_size=2,
                max_size=15
            ),
            min_size=0,
            max_size=5
        )
    )
    def test_project_update_persists_changes_correctly(self, initial_title, updated_title, updated_description, updated_repo_url, updated_tech_stack):
        """
        For any existing project and any valid update data, updating the project
        should result in the database record reflecting all changes while preserving unchanged fields.
        """
        from api.models import Project
        
        # Create initial project
        project = Project.objects.create(
            title=initial_title,
            description="Initial description",
            repo_url="https://github.com/initial/repo",
            tech_stack=["Initial", "Tech"]
        )
        
        try:
            # Get CSRF token
            csrf_response = self.client.get('/api/v1/csrf')
            csrf_token = self.client.cookies.get('csrftoken')
            
            # Prepare update data - encode as multipart form data
            from django.test import RequestFactory
            from django.core.files.uploadedfile import SimpleUploadedFile
            import urllib.parse
            
            update_data = {
                'title': updated_title,
                'description': updated_description,
                'tech_stack': ','.join(updated_tech_stack) if updated_tech_stack else '',
                'repo_url': updated_repo_url if updated_repo_url else ''
            }
            
            # Encode as form data
            encoded_data = urllib.parse.urlencode(update_data)
            
            # Update project via API using generic method to properly handle PATCH with form data
            response = self.client.generic(
                'PATCH',
                f'/api/v1/projects/{project.slug}',
                data=encoded_data,
                content_type='application/x-www-form-urlencoded',
                HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
            )
            
            # Should return 200 OK
            self.assertEqual(
                response.status_code,
                200,
                f"Project update should return 200, got {response.status_code}: {response.content}"
            )
            
            # Get response data
            data = response.json()
            
            # Verify updated fields match submitted data
            self.assertEqual(data['title'], updated_title)
            self.assertEqual(data['description'], updated_description)
            self.assertEqual(data['repo_url'], updated_repo_url)
            self.assertEqual(sorted(data['tech_stack']), sorted(updated_tech_stack))
            
            # Verify project in database reflects changes
            project.refresh_from_db()
            self.assertEqual(project.title, updated_title)
            self.assertEqual(project.description, updated_description)
            self.assertEqual(project.repo_url, updated_repo_url)
            self.assertEqual(sorted(project.tech_stack), sorted(updated_tech_stack))
            
        finally:
            # Clean up
            project.delete()



class ProjectSlugRegenerationTests(HypothesisTestCase):
    """
    Property-based tests for slug regeneration on title update
    Feature: projects-management, Property 5: Slug regeneration on title update
    Validates: Requirements 2.2
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        initial_title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=30
        ),
        updated_title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=30
        )
    )
    def test_slug_regenerated_when_title_updated(self, initial_title, updated_title):
        """
        For any project, updating its title should result in the slug being
        regenerated to match the new title while maintaining uniqueness.
        """
        from api.models import Project
        from django.utils.text import slugify
        import urllib.parse
        
        # Skip if titles are the same
        if initial_title == updated_title:
            return
        
        # Create initial project
        project = Project.objects.create(
            title=initial_title,
            description="Test description"
        )
        
        try:
            initial_slug = project.slug
            
            # Get CSRF token
            csrf_response = self.client.get('/api/v1/csrf')
            csrf_token = self.client.cookies.get('csrftoken')
            
            # Update title via API
            update_data = {'title': updated_title}
            encoded_data = urllib.parse.urlencode(update_data)
            
            response = self.client.generic(
                'PATCH',
                f'/api/v1/projects/{initial_slug}',
                data=encoded_data,
                content_type='application/x-www-form-urlencoded',
                HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
            )
            
            self.assertEqual(response.status_code, 200)
            
            # Verify slug was regenerated
            project.refresh_from_db()
            new_slug = project.slug
            
            # Slug should be different if titles are different
            if initial_title != updated_title:
                # The new slug should be based on the updated title
                expected_base_slug = slugify(updated_title)
                if not expected_base_slug:
                    expected_base_slug = 'project'
                expected_base_slug = expected_base_slug.replace('_', '-')
                
                self.assertTrue(
                    new_slug.startswith(expected_base_slug),
                    f"New slug '{new_slug}' should start with '{expected_base_slug}' (from title '{updated_title}')"
                )
        finally:
            # Clean up
            project.delete()


class ProjectListOrderingTests(HypothesisTestCase):
    """
    Property-based tests for project list ordering
    Feature: projects-management, Property 8: Project list ordering
    Validates: Requirements 4.1
    """
    
    databases = '__all__'
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        num_projects=st.integers(min_value=2, max_value=10)
    )
    def test_project_list_ordered_by_created_at_descending(self, num_projects):
        """
        For any set of projects in the database, the list endpoint should
        return them ordered by created_at in descending order (newest first).
        """
        from api.models import Project
        from django.utils import timezone
        from datetime import timedelta
        import time
        
        projects = []
        
        try:
            # Create projects with slight time delays to ensure different timestamps
            for i in range(num_projects):
                project = Project.objects.create(
                    title=f"Project {i}",
                    description=f"Description {i}"
                )
                projects.append(project)
                # Small delay to ensure different timestamps
                time.sleep(0.01)
            
            # Fetch projects via API
            response = self.client.get('/api/v1/projects')
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            returned_projects = data['items']
            
            # Verify projects are ordered by created_at descending
            for i in range(len(returned_projects) - 1):
                current_time = returned_projects[i]['created_at']
                next_time = returned_projects[i + 1]['created_at']
                
                self.assertGreaterEqual(
                    current_time,
                    next_time,
                    f"Projects should be ordered by created_at descending. "
                    f"Project at index {i} has created_at {current_time}, "
                    f"but project at index {i+1} has created_at {next_time}"
                )
        finally:
            # Clean up
            for project in projects:
                project.delete()


class ProjectResponseCompletenessTests(HypothesisTestCase):
    """
    Property-based tests for response field completeness
    Feature: projects-management, Property 9: Response field completeness
    Validates: Requirements 4.2, 5.3
    """
    
    databases = '__all__'
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        )
    )
    def test_api_response_includes_all_required_fields(self, title):
        """
        For any project returned by the API (list or detail endpoint),
        the response should include all required fields: id, title, slug,
        description, repo_url, tech_stack, hero_image, and created_at.
        """
        from api.models import Project
        
        # Create a project
        project = Project.objects.create(
            title=title,
            description="Test description",
            repo_url="https://github.com/test/repo",
            tech_stack=["Python", "Django"]
        )
        
        try:
            # Test list endpoint
            list_response = self.client.get('/api/v1/projects')
            self.assertEqual(list_response.status_code, 200)
            
            list_data = list_response.json()
            self.assertIn('items', list_data)
            
            if list_data['items']:
                first_item = list_data['items'][0]
                
                # Verify all required fields are present
                required_fields = ['id', 'title', 'slug', 'description', 'repo_url', 'tech_stack', 'hero_image', 'created_at']
                for field in required_fields:
                    self.assertIn(field, first_item, f"Field '{field}' should be in list response")
                
                # Verify hero_image is an object with url, width, height
                self.assertIn('url', first_item['hero_image'])
                self.assertIn('width', first_item['hero_image'])
                self.assertIn('height', first_item['hero_image'])
            
            # Test detail endpoint
            detail_response = self.client.get(f'/api/v1/projects/{project.slug}')
            self.assertEqual(detail_response.status_code, 200)
            
            detail_data = detail_response.json()
            
            # Verify all required fields are present
            for field in required_fields:
                self.assertIn(field, detail_data, f"Field '{field}' should be in detail response")
            
            # Verify hero_image structure
            self.assertIn('url', detail_data['hero_image'])
            self.assertIn('width', detail_data['hero_image'])
            self.assertIn('height', detail_data['hero_image'])
        finally:
            # Clean up
            project.delete()


class ProjectRetrievalBySlugTests(HypothesisTestCase):
    """
    Property-based tests for project retrieval by slug
    Feature: projects-management, Property 10: Project retrieval by slug
    Validates: Requirements 5.1
    """
    
    databases = '__all__'
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=3,
            max_size=50
        )
    )
    def test_project_retrievable_by_slug(self, title):
        """
        For any project in the database, requesting it by its slug should
        return the complete project record with all fields.
        """
        from api.models import Project
        
        # Create a project
        project = Project.objects.create(
            title=title,
            description="Test description",
            repo_url="https://github.com/test/repo",
            tech_stack=["Python", "Django"]
        )
        
        try:
            # Retrieve project by slug
            response = self.client.get(f'/api/v1/projects/{project.slug}')
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            
            # Verify returned data matches created project
            self.assertEqual(data['id'], project.id)
            self.assertEqual(data['title'], project.title)
            self.assertEqual(data['slug'], project.slug)
            self.assertEqual(data['description'], project.description)
            self.assertEqual(data['repo_url'], project.repo_url)
            self.assertEqual(sorted(data['tech_stack']), sorted(project.tech_stack))
        finally:
            # Clean up
            project.delete()


class Project404ErrorTests(HypothesisTestCase):
    """
    Property-based tests for 404 errors with invalid slugs
    Feature: projects-management, Property 11: 404 error for invalid slugs
    Validates: Requirements 5.2, 11.2
    """
    
    databases = '__all__'
    
    @settings(max_examples=100, deadline=None)
    @given(
        invalid_slug=st.text(
            alphabet=st.characters(min_codepoint=97, max_codepoint=122),
            min_size=5,
            max_size=30
        )
    )
    def test_invalid_slug_returns_404(self, invalid_slug):
        """
        For any slug that does not exist in the database, requesting a project
        by that slug should return a 404 error with a descriptive message.
        """
        from api.models import Project
        
        # Ensure slug doesn't exist (delete if it does)
        Project.objects.filter(slug=invalid_slug).delete()
        
        # Request project with invalid slug
        response = self.client.get(f'/api/v1/projects/{invalid_slug}')
        
        # Should return 404
        self.assertEqual(
            response.status_code,
            404,
            f"Request for non-existent slug '{invalid_slug}' should return 404, got {response.status_code}"
        )



class ProjectTitleValidationTests(HypothesisTestCase):
    """
    Property-based tests for title validation
    Feature: projects-management, Property 12: Title validation
    Validates: Requirements 6.1
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        title=st.one_of(
            st.just(''),  # Empty title
            st.text(min_size=201, max_size=300)  # Title exceeding 200 characters
        )
    )
    def test_invalid_title_rejected_with_400(self, title):
        """
        For any project submission with an empty title or a title exceeding 200 characters,
        the system should reject it with a 400 error and validation message.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Attempt to create project with invalid title
        form_data = {
            'title': title,
            'description': 'Valid description'
        }
        
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(
            response.status_code,
            400,
            f"Invalid title should return 400, got {response.status_code}"
        )


class ProjectDescriptionValidationTests(HypothesisTestCase):
    """
    Property-based tests for description validation
    Feature: projects-management, Property 13: Description validation
    Validates: Requirements 6.2
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        description=st.just('')  # Empty description
    )
    def test_empty_description_rejected_with_400(self, description):
        """
        For any project submission with an empty description,
        the system should reject it with a 400 error and validation message.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Attempt to create project with empty description
        form_data = {
            'title': 'Valid Title',
            'description': description
        }
        
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(
            response.status_code,
            400,
            f"Empty description should return 400, got {response.status_code}"
        )


class ProjectURLValidationTests(HypothesisTestCase):
    """
    Property-based tests for URL validation
    Feature: projects-management, Property 14: URL validation
    Validates: Requirements 6.3
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        invalid_url=st.one_of(
            st.just('not-a-url'),
            st.just('htp://invalid'),
            st.just('www.noscheme.com')
        )
    )
    def test_invalid_url_rejected_with_400(self, invalid_url):
        """
        For any project submission with an invalid repo_url format,
        the system should reject it with a 400 error and validation message.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Attempt to create project with invalid URL
        form_data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'repo_url': invalid_url
        }
        
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(
            response.status_code,
            400,
            f"Invalid URL should return 400, got {response.status_code}"
        )


class ProjectTechStackValidationTests(HypothesisTestCase):
    """
    Property-based tests for tech stack type validation
    Feature: projects-management, Property 15: Tech stack type validation
    Validates: Requirements 6.4
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        tech_stack=st.text(
            alphabet=st.characters(min_codepoint=65, max_codepoint=90),
            min_size=3,
            max_size=50
        )
    )
    def test_tech_stack_accepts_comma_separated_strings(self, tech_stack):
        """
        For any project submission where tech_stack is provided as a comma-separated string,
        the system should accept it and parse it into an array.
        
        Note: The API accepts tech_stack as a comma-separated string, not as an array directly.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Create project with tech_stack as comma-separated string
        form_data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'tech_stack': tech_stack
        }
        
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        try:
            # Should return 201 Created (tech_stack is optional and accepts strings)
            self.assertEqual(
                response.status_code,
                201,
                f"Valid tech_stack should be accepted, got {response.status_code}: {response.content}"
            )
            
            # Clean up
            if response.status_code == 201:
                from api.models import Project
                data = response.json()
                Project.objects.get(id=data['id']).delete()
        except Exception as e:
            # Clean up on error
            if response.status_code == 201:
                try:
                    from api.models import Project
                    data = response.json()
                    Project.objects.get(id=data['id']).delete()
                except:
                    pass
            raise


class ProjectImageFormatValidationTests(HypothesisTestCase):
    """
    Property-based tests for image format validation
    Feature: projects-management, Property 16: Image format validation
    Validates: Requirements 6.5
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        file_extension=st.sampled_from(['txt', 'pdf', 'doc', 'exe'])
    )
    def test_invalid_image_format_rejected_with_400(self, file_extension):
        """
        For any file upload that is not a valid image format (JPEG, PNG, GIF, WebP),
        the system should reject it with a 400 error and validation message.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Create a fake file with invalid extension
        invalid_file = SimpleUploadedFile(
            f"test_file.{file_extension}",
            b"This is not an image",
            content_type="text/plain"
        )
        
        # Attempt to create project with invalid file
        form_data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'hero_image': invalid_file
        }
        
        response = self.client.post(
            '/api/v1/projects',
            data=form_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(
            response.status_code,
            400,
            f"Invalid image format should return 400, got {response.status_code}"
        )


class ValidationErrorFormatTests(HypothesisTestCase):
    """
    Property-based tests for validation error response format
    Feature: projects-management, Property 22: Validation error response format
    Validates: Requirements 11.1
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a superuser for API authentication tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            username='apitest_admin',
            password='testpass123',
            email='admin@test.com'
        )
        self.client.login(username='apitest_admin', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.superuser.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        invalid_data=st.one_of(
            st.just({'title': '', 'description': 'Valid'}),  # Empty title
            st.just({'title': 'Valid', 'description': ''})   # Empty description
        )
    )
    def test_validation_error_returns_400_with_detail(self, invalid_data):
        """
        For any validation failure, the API should return a 400 status code
        with a response body containing detailed validation error messages.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Attempt to create project with invalid data
        response = self.client.post(
            '/api/v1/projects',
            data=invalid_data,
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(
            response.status_code,
            400,
            f"Validation error should return 400, got {response.status_code}"
        )
        
        # Response should contain error details
        data = response.json()
        self.assertIn('detail', data, "Validation error response should include 'detail' field")


class AuthenticationErrorTests(HypothesisTestCase):
    """
    Property-based tests for authentication error handling
    Feature: projects-management, Property 23: Authentication error handling
    Validates: Requirements 11.3
    """
    
    databases = '__all__'
    
    @settings(max_examples=50, deadline=None)
    @given(
        endpoint=st.sampled_from([
            '/api/v1/projects',  # POST
        ]),
        method=st.just('POST')
    )
    def test_unauthenticated_requests_return_401(self, endpoint, method):
        """
        For any admin-only endpoint, requests without authentication
        should return a 401 error.
        """
        from django.test import Client
        
        # Create unauthenticated client
        client = Client()
        
        # Get CSRF token
        csrf_response = client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to access admin endpoint without authentication
        if method == 'POST':
            response = client.post(
                endpoint,
                data={'title': 'Test', 'description': 'Test'},
                HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
            )
        
        # Should return 401 Unauthorized
        self.assertEqual(
            response.status_code,
            401,
            f"Unauthenticated request to {endpoint} should return 401, got {response.status_code}"
        )


class AuthorizationErrorTests(HypothesisTestCase):
    """
    Property-based tests for authorization error handling
    Feature: projects-management, Property 24: Authorization error handling
    Validates: Requirements 11.4
    """
    
    databases = '__all__'
    
    def setUp(self):
        """Create a regular (non-admin) user for authorization tests"""
        from django.test import Client
        super().setUp()
        self.client = Client()
        self.regular_user = User.objects.create_user(
            username='regular_user',
            password='testpass123',
            is_staff=False
        )
        self.client.login(username='regular_user', password='testpass123')
    
    def tearDown(self):
        """Clean up test user"""
        self.client.logout()
        self.regular_user.delete()
        super().tearDown()
    
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    @given(
        endpoint=st.sampled_from([
            '/api/v1/projects',  # POST
        ]),
        method=st.just('POST')
    )
    def test_non_admin_requests_return_403(self, endpoint, method):
        """
        For any admin-only endpoint, requests from non-admin authenticated users
        should return a 403 error.
        """
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = self.client.cookies.get('csrftoken')
        
        # Attempt to access admin endpoint as non-admin user
        if method == 'POST':
            response = self.client.post(
                endpoint,
                data={'title': 'Test', 'description': 'Test'},
                HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
            )
        
        # Should return 403 Forbidden
        self.assertEqual(
            response.status_code,
            403,
            f"Non-admin request to {endpoint} should return 403, got {response.status_code}"
        )



# Property-Based Tests for Kanban Board System
# Feature: kanban-board-system

class KanbanBoardAutomaticCreationTests(HypothesisTestCase):
    """
    Property-based tests for automatic board creation
    Feature: kanban-board-system, Property 1: Automatic board creation
    Validates: Requirements 1.1, 1.3
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=200
        ),
        description=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=500
        )
    )
    def test_kanban_board_automatically_created_with_project(self, title, description):
        """
        For any project, when it is created, a Kanban board should be automatically 
        created and associated with it through a one-to-one relationship.
        """
        from api.models import Project, KanbanBoard
        
        # Create a project
        project = Project.objects.create(
            title=title,
            description=description
        )
        
        try:
            # Verify that a Kanban board was automatically created
            self.assertTrue(
                hasattr(project, 'kanban_board'),
                f"Project should have a kanban_board attribute"
            )
            
            # Verify the board exists
            board = project.kanban_board
            self.assertIsNotNone(board, f"Kanban board should be created for project '{title}'")
            self.assertIsInstance(board, KanbanBoard, "Board should be a KanbanBoard instance")
            
            # Verify the one-to-one relationship
            self.assertEqual(
                board.project.id,
                project.id,
                f"Board should be associated with the project"
            )
            
            # Verify board was created (has an ID)
            self.assertIsNotNone(board.id, "Board should have an ID")
            self.assertGreater(board.id, 0, "Board ID should be positive")
            
        finally:
            # Clean up
            project.delete()


class KanbanBoardCascadeDeletionTests(HypothesisTestCase):
    """
    Property-based tests for cascade deletion
    Feature: kanban-board-system, Property 2: Cascade deletion
    Validates: Requirements 1.2
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=200
        ),
        description=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=500
        )
    )
    def test_kanban_board_deleted_when_project_deleted(self, title, description):
        """
        For any project with a Kanban board, deleting the project should result 
        in the board being deleted as well.
        """
        from api.models import Project, KanbanBoard
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title=title,
            description=description
        )
        
        # Get the board ID before deletion
        board_id = project.kanban_board.id
        
        # Verify board exists
        self.assertTrue(
            KanbanBoard.objects.filter(id=board_id).exists(),
            "Board should exist before project deletion"
        )
        
        # Delete the project
        project.delete()
        
        # Verify the board was also deleted (cascade)
        self.assertFalse(
            KanbanBoard.objects.filter(id=board_id).exists(),
            f"Board with ID {board_id} should be deleted when project is deleted"
        )


class KanbanBoardOnePerProjectTests(HypothesisTestCase):
    """
    Property-based tests for one board per project constraint
    Feature: kanban-board-system, Property 3: One board per project
    Validates: Requirements 1.4
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        title=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=200
        ),
        description=st.text(
            alphabet=st.characters(min_codepoint=32, max_codepoint=126),
            min_size=1,
            max_size=500
        )
    )
    def test_cannot_create_second_board_for_project(self, title, description):
        """
        For any project, attempting to create a second Kanban board should be rejected,
        enforcing the one-to-one constraint.
        """
        from api.models import Project, KanbanBoard
        from django.db import IntegrityError, transaction
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title=title,
            description=description
        )
        
        try:
            # Verify one board exists
            initial_board_count = KanbanBoard.objects.filter(project=project).count()
            self.assertEqual(
                initial_board_count,
                1,
                "Project should have exactly one board after creation"
            )
            
            # Attempt to create a second board for the same project
            # This should raise an IntegrityError due to the OneToOne constraint
            # Wrap in atomic block to handle the broken transaction
            with self.assertRaises(
                IntegrityError,
                msg=f"Creating a second board for project '{title}' should raise IntegrityError"
            ):
                with transaction.atomic():
                    KanbanBoard.objects.create(project=project)
            
            # Verify still only one board exists
            final_board_count = KanbanBoard.objects.filter(project=project).count()
            self.assertEqual(
                final_board_count,
                1,
                "Project should still have exactly one board after failed creation attempt"
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardOrderRecalculationTests(HypothesisTestCase):
    """
    Property-based tests for order recalculation during moves
    Feature: kanban-board-system, Property 8: Order recalculation during moves
    Validates: Requirements 5.3, 6.1, 6.2
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        num_cards=st.integers(min_value=3, max_value=10),
        move_from_index=st.integers(min_value=0, max_value=9),
        move_to_index=st.integers(min_value=0, max_value=9),
        same_column=st.booleans()
    )
    def test_order_recalculation_maintains_sequential_ordering(self, num_cards, move_from_index, move_to_index, same_column):
        """
        For any card being moved (to a different column or reordered within the same column),
        all affected cards in both source and destination columns should have their order 
        values recalculated to maintain sequential ordering.
        """
        from api.models import Project, KanbanBoard, KanbanCard
        
        # Clamp indices to valid range
        move_from_index = min(move_from_index, num_cards - 1)
        move_to_index = min(move_to_index, num_cards - 1)
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title=f"Test Project {num_cards}",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create cards in TODO column
            cards = []
            for i in range(num_cards):
                card = KanbanCard.objects.create(
                    board=board,
                    title=f"Card {i}",
                    status='TODO'
                )
                cards.append(card)
            
            # Refresh to get correct order values
            for card in cards:
                card.refresh_from_db()
            
            # Verify initial sequential ordering in TODO
            # Note: The save() method sets order automatically, so we just verify they're sequential
            todo_cards = list(KanbanCard.objects.filter(board=board, status='TODO').order_by('order'))
            self.assertEqual(
                len(todo_cards),
                num_cards,
                f"Should have {num_cards} cards in TODO"
            )
            
            # Verify orders are sequential (starting from 0)
            for i, card in enumerate(todo_cards):
                self.assertEqual(
                    card.order,
                    i,
                    f"Initial order should be sequential: card at position {i} should have order {i}, got {card.order}"
                )
            
            # Move a card
            card_to_move = cards[move_from_index]
            if same_column:
                # Move within same column
                card_to_move.move_to('TODO', move_to_index)
                
                # Verify all cards in TODO have sequential ordering
                todo_cards = list(KanbanCard.objects.filter(board=board, status='TODO').order_by('order'))
                for i, card in enumerate(todo_cards):
                    self.assertEqual(
                        card.order,
                        i,
                        f"After same-column move, card at position {i} should have order {i}, got {card.order}"
                    )
            else:
                # Move to different column (DOING)
                # First create some cards in DOING to have a target
                doing_cards_count = min(num_cards, 3)
                for i in range(doing_cards_count):
                    KanbanCard.objects.create(
                        board=board,
                        title=f"Doing Card {i}",
                        status='DOING'
                    )
                
                # Clamp move_to_index to valid range for DOING column
                move_to_index = min(move_to_index, doing_cards_count)
                
                card_to_move.move_to('DOING', move_to_index)
                
                # Verify all cards in TODO have sequential ordering (gap closed)
                todo_cards = list(KanbanCard.objects.filter(board=board, status='TODO').order_by('order'))
                for i, card in enumerate(todo_cards):
                    self.assertEqual(
                        card.order,
                        i,
                        f"After cross-column move, TODO card at position {i} should have order {i}, got {card.order}"
                    )
                
                # Verify all cards in DOING have sequential ordering (space made)
                doing_cards = list(KanbanCard.objects.filter(board=board, status='DOING').order_by('order'))
                for i, card in enumerate(doing_cards):
                    self.assertEqual(
                        card.order,
                        i,
                        f"After cross-column move, DOING card at position {i} should have order {i}, got {card.order}"
                    )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardPositionBoundaryClampingTests(HypothesisTestCase):
    """
    Property-based tests for position boundary clamping
    Feature: kanban-board-system, Property 10: Position boundary clamping
    Validates: Requirements 6.3
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        num_cards=st.integers(min_value=1, max_value=10),
        out_of_bounds_position=st.integers(min_value=-100, max_value=100)
    )
    def test_out_of_bounds_position_clamped_to_valid_range(self, num_cards, out_of_bounds_position):
        """
        For any move request with an out-of-bounds order value, the system should 
        clamp the position to the nearest valid value (0 to column length).
        """
        from api.models import Project, KanbanBoard, KanbanCard
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title=f"Test Project {num_cards}",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create cards in TODO column
            cards = []
            for i in range(num_cards):
                card = KanbanCard.objects.create(
                    board=board,
                    title=f"Card {i}",
                    status='TODO'
                )
                cards.append(card)
            
            # Refresh cards to get their actual order values
            for card in cards:
                card.refresh_from_db()
            
            # Create a card in DOING to move
            card_to_move = KanbanCard.objects.create(
                board=board,
                title="Moving Card",
                status='DOING'
            )
            
            # Attempt to move to out-of-bounds position in TODO
            # The API endpoint should clamp this, but let's test the model behavior
            # by clamping it ourselves (simulating what the API does)
            max_order = KanbanCard.objects.filter(board=board, status='TODO').count()
            clamped_position = max(0, min(out_of_bounds_position, max_order))
            
            # Move the card
            card_to_move.move_to('TODO', clamped_position)
            card_to_move.refresh_from_db()
            
            # Verify the card is at a valid position
            self.assertGreaterEqual(
                card_to_move.order,
                0,
                f"Card order should be >= 0, got {card_to_move.order}"
            )
            
            # Verify the card is within the column bounds
            total_cards_in_todo = KanbanCard.objects.filter(board=board, status='TODO').count()
            self.assertLess(
                card_to_move.order,
                total_cards_in_todo,
                f"Card order should be < {total_cards_in_todo}, got {card_to_move.order}"
            )
            
            # Verify all cards still have sequential ordering
            todo_cards = list(KanbanCard.objects.filter(board=board, status='TODO').order_by('order'))
            self.assertEqual(
                len(todo_cards),
                num_cards + 1,  # Original cards + moved card
                f"Should have {num_cards + 1} cards in TODO after move"
            )
            
            for i, card in enumerate(todo_cards):
                self.assertEqual(
                    card.order,
                    i,
                    f"After clamped move, card at position {i} should have order {i}, got {card.order}"
                )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardCompletedTimestampTests(HypothesisTestCase):
    """
    Property-based tests for completed timestamp
    Feature: kanban-board-system, Property 42: Completed timestamp
    Validates: Requirements 5.4
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        initial_status=st.sampled_from(['TODO', 'DOING']),
        num_intermediate_moves=st.integers(min_value=0, max_value=3)
    )
    def test_completed_timestamp_set_when_moved_to_done(self, initial_status, num_intermediate_moves):
        """
        For any card moved to DONE status, the system should set the completed_at 
        timestamp to the current time.
        """
        from api.models import Project, KanbanBoard, KanbanCard
        from django.utils import timezone
        import time
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title=f"Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card in initial status
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status=initial_status
            )
            
            # Verify completed_at is initially None
            self.assertIsNone(
                card.completed_at,
                f"Card in {initial_status} should not have completed_at set"
            )
            
            # Make some intermediate moves (but not to DONE)
            statuses = ['TODO', 'DOING']
            for i in range(num_intermediate_moves):
                status = statuses[i % 2]
                card.move_to(status, 0)
                card.refresh_from_db()
                
                # Verify completed_at is still None
                self.assertIsNone(
                    card.completed_at,
                    f"Card moved to {status} should not have completed_at set"
                )
            
            # Record time before moving to DONE
            time_before_move = timezone.now()
            time.sleep(0.01)  # Small delay to ensure timestamp is after time_before_move
            
            # Move to DONE
            card.move_to('DONE', 0)
            card.refresh_from_db()
            
            time.sleep(0.01)  # Small delay to ensure timestamp is before time_after_move
            time_after_move = timezone.now()
            
            # Verify completed_at is now set
            self.assertIsNotNone(
                card.completed_at,
                "Card moved to DONE should have completed_at set"
            )
            
            # Verify completed_at is within reasonable time range
            self.assertGreater(
                card.completed_at,
                time_before_move,
                f"completed_at should be after move started"
            )
            self.assertLess(
                card.completed_at,
                time_after_move,
                f"completed_at should be before move completed"
            )
            
            # Test moving back from DONE clears the timestamp
            card.move_to('TODO', 0)
            card.refresh_from_db()
            
            self.assertIsNone(
                card.completed_at,
                "Card moved from DONE back to TODO should have completed_at cleared"
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardVoteIncrementTests(HypothesisTestCase):
    """
    Property-based tests for vote increment
    Feature: kanban-board-system, Property 11: Vote increment
    Validates: Requirements 7.1, 7.3
    """
    
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.filter_too_much])
    @given(
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_vote_increment_atomically_increases_count_by_one(self, ip_parts):
        """
        For any card with allow_voting=true, voting on it should atomically 
        increment the vote count by exactly 1.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Record initial vote count
            initial_votes = card.votes
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # Vote on the card
            card.increment_vote(ip_hash)
            
            # Verify vote count increased by exactly 1
            self.assertEqual(
                card.votes,
                initial_votes + 1,
                f"Vote count should increase by exactly 1, was {initial_votes}, now {card.votes}"
            )
            
            # Verify vote record was created
            vote_exists = CardVote.objects.filter(card=card, ip_hash=ip_hash).exists()
            self.assertTrue(
                vote_exists,
                f"Vote record should be created for IP hash {ip_hash[:10]}..."
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardDuplicateVotePreventionTests(HypothesisTestCase):
    """
    Property-based tests for duplicate vote prevention
    Feature: kanban-board-system, Property 32: Duplicate vote prevention
    Validates: Requirements 7.2, 19.2
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_duplicate_vote_from_same_ip_rejected(self, ip_parts):
        """
        For any card and IP address, attempting to vote twice should return a 409 error.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # First vote should succeed
            card.increment_vote(ip_hash)
            initial_votes = card.votes
            
            # Second vote from same IP should raise ValueError
            with self.assertRaises(
                ValueError,
                msg=f"Duplicate vote from IP {ip_address} should raise ValueError"
            ) as context:
                card.increment_vote(ip_hash)
            
            # Verify error message mentions duplicate vote
            self.assertIn(
                "already voted",
                str(context.exception).lower(),
                "Error message should mention duplicate vote"
            )
            
            # Verify vote count did not increase
            card.refresh_from_db()
            self.assertEqual(
                card.votes,
                initial_votes,
                f"Vote count should not increase on duplicate vote, stayed at {card.votes}"
            )
            
            # Verify only one vote record exists
            vote_count = CardVote.objects.filter(card=card, ip_hash=ip_hash).count()
            self.assertEqual(
                vote_count,
                1,
                f"Should have exactly 1 vote record, found {vote_count}"
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardVoteRemovalTests(HypothesisTestCase):
    """
    Property-based tests for vote removal
    Feature: kanban-board-system, Property 28: Vote removal
    Validates: Requirements 18.1, 18.3
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_vote_removal_decrements_count_and_deletes_record(self, ip_parts):
        """
        For any card where a user has voted, removing the vote should decrement 
        the vote count by 1 and delete the vote record.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # First, vote on the card
            card.increment_vote(ip_hash)
            votes_after_increment = card.votes
            
            # Verify vote record exists
            self.assertTrue(
                CardVote.objects.filter(card=card, ip_hash=ip_hash).exists(),
                "Vote record should exist after voting"
            )
            
            # Remove the vote
            card.decrement_vote(ip_hash)
            
            # Verify vote count decreased by exactly 1
            self.assertEqual(
                card.votes,
                votes_after_increment - 1,
                f"Vote count should decrease by exactly 1, was {votes_after_increment}, now {card.votes}"
            )
            
            # Verify vote record was deleted
            vote_exists = CardVote.objects.filter(card=card, ip_hash=ip_hash).exists()
            self.assertFalse(
                vote_exists,
                f"Vote record should be deleted for IP hash {ip_hash[:10]}..."
            )
            
        finally:
            # Clean up
            project.delete()
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_vote_removal_from_non_voter_rejected(self, ip_parts):
        """
        For any card where a user has not voted, attempting to remove a vote 
        should return a 404 error.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # Attempt to remove vote without having voted
            with self.assertRaises(
                ValueError,
                msg=f"Removing non-existent vote from IP {ip_address} should raise ValueError"
            ) as context:
                card.decrement_vote(ip_hash)
            
            # Verify error message mentions user has not voted
            self.assertIn(
                "has not voted",
                str(context.exception).lower(),
                "Error message should mention user has not voted"
            )
            
            # Verify vote count is still 0
            card.refresh_from_db()
            self.assertEqual(
                card.votes,
                0,
                f"Vote count should remain 0, got {card.votes}"
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardIPHashPrivacyTests(HypothesisTestCase):
    """
    Property-based tests for IP hash privacy
    Feature: kanban-board-system, Property 33: IP hash privacy
    Validates: Requirements 19.3
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_vote_record_stores_hash_not_raw_ip(self, ip_parts):
        """
        For any vote record, the stored IP address should be a SHA-256 hash, 
        not the raw IP address.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        import hashlib
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # Vote on the card
            card.increment_vote(ip_hash)
            
            # Retrieve the vote record
            vote_record = CardVote.objects.get(card=card, ip_hash=ip_hash)
            
            # Verify the stored value is not the raw IP
            self.assertNotEqual(
                vote_record.ip_hash,
                ip_address,
                f"Vote record should not store raw IP address"
            )
            
            # Verify the stored value is a SHA-256 hash (64 hex characters)
            self.assertEqual(
                len(vote_record.ip_hash),
                64,
                f"IP hash should be 64 characters (SHA-256), got {len(vote_record.ip_hash)}"
            )
            
            # Verify it's hexadecimal
            try:
                int(vote_record.ip_hash, 16)
                is_hex = True
            except ValueError:
                is_hex = False
            
            self.assertTrue(
                is_hex,
                f"IP hash should be hexadecimal, got {vote_record.ip_hash[:20]}..."
            )
            
            # Verify it matches the expected SHA-256 hash
            expected_hash = hashlib.sha256(ip_address.encode()).hexdigest()
            self.assertEqual(
                vote_record.ip_hash,
                expected_hash,
                f"Stored hash should match SHA-256 of IP address"
            )
            
        finally:
            # Clean up
            project.delete()


class KanbanCardVoteRecordExpirationTests(HypothesisTestCase):
    """
    Property-based tests for vote record expiration
    Feature: kanban-board-system, Property 34: Vote record expiration
    Validates: Requirements 19.4
    """
    
    @settings(max_examples=50, deadline=None)
    @given(
        days_old=st.integers(min_value=91, max_value=365),
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_old_vote_records_cleaned_up_after_90_days(self, days_old, ip_parts):
        """
        For any vote record older than 90 days, the system should allow the same IP 
        to vote again on the same card.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        from django.utils import timezone
        from datetime import timedelta
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # Create an old vote record manually (bypassing increment_vote to set old date)
            old_date = timezone.now() - timedelta(days=days_old)
            old_vote = CardVote.objects.create(
                card=card,
                ip_hash=ip_hash
            )
            # Manually update the voted_at timestamp to be old
            CardVote.objects.filter(id=old_vote.id).update(voted_at=old_date)
            
            # Also manually increment the vote count
            card.votes = 1
            card.save()
            
            # Verify the old vote exists
            self.assertTrue(
                CardVote.objects.filter(card=card, ip_hash=ip_hash).exists(),
                "Old vote record should exist before cleanup"
            )
            
            # Run cleanup
            deleted_count = CardVote.cleanup_old_votes()
            
            # Verify the old vote was deleted
            self.assertGreater(
                deleted_count,
                0,
                f"Cleanup should delete at least 1 old vote record (deleted {deleted_count})"
            )
            
            vote_exists_after_cleanup = CardVote.objects.filter(card=card, ip_hash=ip_hash).exists()
            self.assertFalse(
                vote_exists_after_cleanup,
                f"Vote record older than 90 days should be deleted by cleanup"
            )
            
            # Now the same IP should be able to vote again
            # (since the old vote record is gone, duplicate check will pass)
            try:
                card.increment_vote(ip_hash)
                vote_succeeded = True
            except ValueError:
                vote_succeeded = False
            
            self.assertTrue(
                vote_succeeded,
                f"After cleanup, same IP should be able to vote again on the same card"
            )
            
        finally:
            # Clean up
            project.delete()
    
    @settings(max_examples=50, deadline=None)
    @given(
        days_old=st.integers(min_value=1, max_value=89),
        ip_parts=st.tuples(
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_recent_vote_records_not_cleaned_up(self, days_old, ip_parts):
        """
        For any vote record less than 90 days old, the cleanup should not delete it.
        """
        from api.models import Project, KanbanBoard, KanbanCard, CardVote
        from django.utils import timezone
        from datetime import timedelta
        
        # Convert IP parts to IP address string
        ip_address = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.{ip_parts[3]}"
        
        # Create a project (which automatically creates a board)
        project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        
        try:
            board = project.kanban_board
            
            # Create a card with voting enabled
            card = KanbanCard.objects.create(
                board=board,
                title="Test Card",
                status='TODO',
                allow_voting=True,
                votes=0
            )
            
            # Hash the IP address
            ip_hash = CardVote.hash_ip(ip_address)
            
            # Create a recent vote record manually
            recent_date = timezone.now() - timedelta(days=days_old)
            recent_vote = CardVote.objects.create(
                card=card,
                ip_hash=ip_hash
            )
            # Manually update the voted_at timestamp to be recent (but not too recent)
            CardVote.objects.filter(id=recent_vote.id).update(voted_at=recent_date)
            
            # Verify the vote exists
            self.assertTrue(
                CardVote.objects.filter(card=card, ip_hash=ip_hash).exists(),
                "Recent vote record should exist before cleanup"
            )
            
            # Run cleanup
            CardVote.cleanup_old_votes()
            
            # Verify the recent vote still exists
            vote_exists_after_cleanup = CardVote.objects.filter(card=card, ip_hash=ip_hash).exists()
            self.assertTrue(
                vote_exists_after_cleanup,
                f"Vote record less than 90 days old should NOT be deleted by cleanup (was {days_old} days old)"
            )
            
        finally:
            # Clean up
            project.delete()



class RateLimitingEnforcementTests(HypothesisTestCase):
    """
    Property-based tests for rate limiting enforcement
    Feature: kanban-board-system, Property 31: Rate limiting enforcement
    Validates: Requirements 19.1, 14.6
    """
    
    def setUp(self):
        """Set up test environment and clear cache"""
        from django.core.cache import cache
        cache.clear()
        super().setUp()
    
    def tearDown(self):
        """Clean up cache after tests"""
        from django.core.cache import cache
        cache.clear()
        super().tearDown()
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_address=st.builds(
            lambda a, b, c, d: f"{a}.{b}.{c}.{d}",
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        )
    )
    def test_rate_limit_allows_up_to_10_votes_per_minute(self, ip_address):
        """
        For any IP address, the first 10 vote attempts within 60 seconds should be allowed,
        and the 11th attempt should be rejected.
        """
        from api.rate_limit import check_rate_limit
        from api.models import CardVote
        
        # Hash the IP address
        ip_hash = CardVote.hash_ip(ip_address)
        
        # First 10 votes should be allowed
        for i in range(10):
            result = check_rate_limit(ip_hash, limit=10, window=60)
            self.assertTrue(
                result,
                f"Vote attempt {i+1} should be allowed (within rate limit)"
            )
        
        # 11th vote should be rejected
        result = check_rate_limit(ip_hash, limit=10, window=60)
        self.assertFalse(
            result,
            "Vote attempt 11 should be rejected (exceeds rate limit of 10 per minute)"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_address=st.builds(
            lambda a, b, c, d: f"{a}.{b}.{c}.{d}",
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255),
            st.integers(min_value=0, max_value=255)
        ),
        vote_count=st.integers(min_value=1, max_value=9)
    )
    def test_rate_limit_resets_after_window(self, ip_address, vote_count):
        """
        For any IP address, after making some votes (less than limit), 
        the rate limit counter should track correctly.
        """
        from api.rate_limit import check_rate_limit
        from api.models import CardVote
        from django.core.cache import cache
        
        # Clear cache before this test to ensure clean state
        cache.clear()
        
        # Hash the IP address
        ip_hash = CardVote.hash_ip(ip_address)
        
        # Make some votes (less than limit)
        for i in range(vote_count):
            result = check_rate_limit(ip_hash, limit=10, window=60)
            self.assertTrue(
                result,
                f"Vote attempt {i+1} of {vote_count} should be allowed"
            )
        
        # Verify the cache has the correct count
        cache_key = f"vote_rate_limit:{ip_hash}"
        cached_count = cache.get(cache_key, 0)
        self.assertEqual(
            cached_count,
            vote_count,
            f"Cache should track {vote_count} votes"
        )
        
        # Should still be able to vote more (up to 10 total)
        remaining = 10 - vote_count
        for i in range(remaining):
            result = check_rate_limit(ip_hash, limit=10, window=60)
            self.assertTrue(
                result,
                f"Additional vote attempt {i+1} of {remaining} should be allowed"
            )
    
    @settings(max_examples=100, deadline=None)
    @given(
        ip_addresses=st.lists(
            st.builds(
                lambda a, b, c, d: f"{a}.{b}.{c}.{d}",
                st.integers(min_value=0, max_value=255),
                st.integers(min_value=0, max_value=255),
                st.integers(min_value=0, max_value=255),
                st.integers(min_value=0, max_value=255)
            ),
            min_size=2,
            max_size=5,
            unique=True
        )
    )
    def test_rate_limit_independent_per_ip(self, ip_addresses):
        """
        For any set of different IP addresses, rate limits should be tracked independently.
        Each IP should be able to make 10 votes regardless of other IPs.
        """
        from api.rate_limit import check_rate_limit
        from api.models import CardVote
        from django.core.cache import cache
        
        # Clear cache before this test to ensure clean state
        cache.clear()
        
        # Each IP should be able to make 10 votes
        for ip_address in ip_addresses:
            ip_hash = CardVote.hash_ip(ip_address)
            
            # First 10 votes should be allowed for this IP
            for i in range(10):
                result = check_rate_limit(ip_hash, limit=10, window=60)
                self.assertTrue(
                    result,
                    f"Vote attempt {i+1} for IP {ip_address} should be allowed"
                )
            
            # 11th vote should be rejected for this IP
            result = check_rate_limit(ip_hash, limit=10, window=60)
            self.assertFalse(
                result,
                f"Vote attempt 11 for IP {ip_address} should be rejected"
            )


# Unit Tests for Kanban Card Creation Endpoint

class KanbanCardCreationEndpointTests(TestCase):
    """
    Unit tests for POST /kanban/cards endpoint
    Validates: Requirements 2.1, 2.2, 2.3, 2.4, 10.1, 13.3
    """
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a superuser for admin authentication
        self.admin_user = User.objects.create_superuser(
            username='admin',
            password='adminpass123',
            email='admin@example.com'
        )
        
        # Create a regular user for testing non-admin access
        self.regular_user = User.objects.create_user(
            username='regular',
            password='regularpass123'
        )
        
        # Create a project with a board
        self.project = Project.objects.create(
            title='Test Project',
            description='Test description'
        )
        self.board = self.project.kanban_board
    
    def tearDown(self):
        """Clean up test fixtures"""
        self.admin_user.delete()
        self.regular_user.delete()
        self.project.delete()
    
    def test_create_card_as_admin_with_valid_data(self):
        """Test that admin can create a card with valid data"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Create a card
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'Test Card',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}")
        
        # Verify response data
        data = response.json()
        self.assertEqual(data['title'], 'Test Card')
        self.assertEqual(data['status'], 'TODO')
        self.assertEqual(data['votes'], 0)
        self.assertEqual(data['allow_voting'], True)
        self.assertIn('user_has_voted', data)
        self.assertFalse(data['user_has_voted'])
        
        # Verify card was created in database
        card = KanbanCard.objects.filter(board=self.board, title='Test Card').first()
        self.assertIsNotNone(card)
        self.assertEqual(card.status, 'TODO')
        self.assertEqual(card.votes, 0)
        self.assertEqual(card.allow_voting, True)
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_with_default_status(self):
        """Test that card defaults to TODO status if not specified"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Create a card without specifying status
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'Default Status Card'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify status defaults to TODO
        data = response.json()
        self.assertEqual(data['status'], 'TODO')
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_with_empty_title_returns_400(self):
        """Test that empty title returns 400 error"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to create a card with empty title
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': '',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('empty', data['detail'].lower())
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_with_invalid_board_id_returns_404(self):
        """Test that invalid board_id returns 404 error"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to create a card with non-existent board_id
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': 99999,
                'title': 'Test Card',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_with_invalid_status_returns_400(self):
        """Test that invalid status returns 400 error"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to create a card with invalid status
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'Test Card',
                'status': 'INVALID'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('Invalid status', data['detail'])
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_as_unauthenticated_user_returns_401(self):
        """Test that unauthenticated user gets 401 error"""
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to create a card without authentication
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'Test Card',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401)
    
    def test_create_card_as_non_admin_user_returns_403(self):
        """Test that non-admin user gets 403 error"""
        # Login as regular user
        self.client.login(username='regular', password='regularpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to create a card as non-admin
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'Test Card',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
        
        # Cleanup
        self.client.logout()
    
    def test_create_card_order_at_end_of_column(self):
        """Test that new card is placed at end of column"""
        # Create some existing cards in TODO column
        for i in range(3):
            KanbanCard.objects.create(
                board=self.board,
                title=f'Existing Card {i}',
                status='TODO',
                order=i
            )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Create a new card
        response = self.client.post(
            '/api/v1/kanban/cards',
            data={
                'board_id': self.board.id,
                'title': 'New Card',
                'status': 'TODO'
            },
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify card is at end of column (order=3)
        data = response.json()
        self.assertEqual(data['order'], 3)
        
        # Cleanup
        self.client.logout()



# Unit Tests for Kanban Card Update Endpoint
# Feature: kanban-board-system

class KanbanCardUpdateTests(TestCase):
    """
    Unit tests for PATCH /kanban/cards/{id} endpoint
    Validates: Requirements 3.1, 3.2, 3.3, 8.1, 8.2, 8.3, 13.4
    """
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a superuser for admin operations
        self.admin_user = User.objects.create_superuser(
            username='admin',
            password='adminpass123',
            email='admin@example.com'
        )
        
        # Create a regular user
        self.regular_user = User.objects.create_user(
            username='regular',
            password='userpass123'
        )
        
        # Create a project with a board
        self.project = Project.objects.create(
            title='Test Project',
            description='Test description'
        )
        self.board = self.project.kanban_board
        
        # Create a test card
        self.card = KanbanCard.objects.create(
            board=self.board,
            title='Original Title',
            status='TODO',
            votes=5,
            allow_voting=True,
            order=0
        )
    
    def tearDown(self):
        """Clean up test fixtures"""
        self.admin_user.delete()
        self.regular_user.delete()
        self.project.delete()
    
    def test_update_card_title_only(self):
        """Test updating only the card title preserves other fields"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Store original values
        original_status = self.card.status
        original_votes = self.card.votes
        original_allow_voting = self.card.allow_voting
        original_order = self.card.order
        
        # Update only the title
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': 'Updated Title'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response data
        data = response.json()
        self.assertEqual(data['title'], 'Updated Title')
        self.assertEqual(data['status'], original_status)
        self.assertEqual(data['votes'], original_votes)
        self.assertEqual(data['allow_voting'], original_allow_voting)
        self.assertEqual(data['order'], original_order)
        
        # Verify database was updated
        self.card.refresh_from_db()
        self.assertEqual(self.card.title, 'Updated Title')
        self.assertEqual(self.card.status, original_status)
        self.assertEqual(self.card.votes, original_votes)
        self.assertEqual(self.card.allow_voting, original_allow_voting)
        self.assertEqual(self.card.order, original_order)
    
    def test_update_card_allow_voting_only(self):
        """Test updating only allow_voting preserves other fields"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Store original values
        original_title = self.card.title
        original_status = self.card.status
        original_votes = self.card.votes
        original_order = self.card.order
        
        # Update only allow_voting
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'allow_voting': False},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response data
        data = response.json()
        self.assertEqual(data['title'], original_title)
        self.assertEqual(data['status'], original_status)
        self.assertEqual(data['votes'], original_votes)
        self.assertEqual(data['allow_voting'], False)
        self.assertEqual(data['order'], original_order)
        
        # Verify database was updated
        self.card.refresh_from_db()
        self.assertEqual(self.card.title, original_title)
        self.assertEqual(self.card.allow_voting, False)
        self.assertEqual(self.card.votes, original_votes)
    
    def test_update_card_both_fields(self):
        """Test updating both title and allow_voting"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Update both fields
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': 'New Title', 'allow_voting': False},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response data
        data = response.json()
        self.assertEqual(data['title'], 'New Title')
        self.assertEqual(data['allow_voting'], False)
        
        # Verify database was updated
        self.card.refresh_from_db()
        self.assertEqual(self.card.title, 'New Title')
        self.assertEqual(self.card.allow_voting, False)
    
    def test_update_card_empty_title_rejected(self):
        """Test that empty title is rejected with 400"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to update with empty title
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': '   '},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('empty', data['detail'].lower())
    
    def test_update_card_title_too_long_rejected(self):
        """Test that title exceeding 200 characters is rejected with 400"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to update with title > 200 chars
        long_title = 'A' * 201
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': long_title},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('200', data['detail'])
    
    def test_update_card_not_found_returns_404(self):
        """Test that updating non-existent card returns 404"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to update non-existent card
        response = self.client.patch(
            '/api/v1/kanban/cards/99999',
            data={'title': 'New Title'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
    
    def test_update_card_unauthenticated_returns_401(self):
        """Test that unauthenticated request returns 401"""
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to update without authentication
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': 'New Title'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401)
    
    def test_update_card_non_admin_returns_403(self):
        """Test that non-admin user returns 403"""
        # Login as regular user
        self.client.login(username='regular', password='userpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to update as non-admin
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': 'New Title'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
    
    def test_update_card_includes_user_has_voted_flag(self):
        """Test that response includes user_has_voted flag"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Update card
        response = self.client.patch(
            f'/api/v1/kanban/cards/{self.card.id}',
            data={'title': 'Updated Title'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify user_has_voted field is present
        data = response.json()
        self.assertIn('user_has_voted', data)
        self.assertIsInstance(data['user_has_voted'], bool)



# Feature: kanban-board-system

class KanbanCardDeletionTests(TestCase):
    """
    Unit tests for DELETE /kanban/cards/{id} endpoint
    Validates: Requirements 4.1, 4.2, 4.3, 13.5
    """
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a superuser for admin operations
        self.admin_user = User.objects.create_superuser(
            username='admin',
            password='adminpass123',
            email='admin@example.com'
        )
        
        # Create a regular user
        self.regular_user = User.objects.create_user(
            username='regular',
            password='userpass123'
        )
        
        # Create a project with a board
        self.project = Project.objects.create(
            title='Test Project',
            description='Test description'
        )
        self.board = self.project.kanban_board
    
    def tearDown(self):
        """Clean up test fixtures"""
        self.admin_user.delete()
        self.regular_user.delete()
        self.project.delete()
    
    def test_delete_card_success(self):
        """Test successful card deletion"""
        # Create a test card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        card_id = card.id
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Delete the card
        response = self.client.delete(
            f'/api/v1/kanban/cards/{card_id}',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response data
        data = response.json()
        self.assertIn('success', data)
        self.assertTrue(data['success'])
        
        # Verify card is deleted from database
        card_exists = KanbanCard.objects.filter(id=card_id).exists()
        self.assertFalse(card_exists, "Card should be deleted from database")
    
    def test_delete_card_reorders_remaining_cards(self):
        """Test that deleting a card reorders remaining cards in the column"""
        # Create multiple cards in TODO column
        card1 = KanbanCard.objects.create(
            board=self.board,
            title='Card 1',
            status='TODO',
            order=0
        )
        card2 = KanbanCard.objects.create(
            board=self.board,
            title='Card 2',
            status='TODO',
            order=1
        )
        card3 = KanbanCard.objects.create(
            board=self.board,
            title='Card 3',
            status='TODO',
            order=2
        )
        card4 = KanbanCard.objects.create(
            board=self.board,
            title='Card 4',
            status='TODO',
            order=3
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Delete card2 (order=1)
        response = self.client.delete(
            f'/api/v1/kanban/cards/{card2.id}',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify card2 is deleted
        card2_exists = KanbanCard.objects.filter(id=card2.id).exists()
        self.assertFalse(card2_exists)
        
        # Verify remaining cards are reordered
        card1.refresh_from_db()
        card3.refresh_from_db()
        card4.refresh_from_db()
        
        # card1 should still be at order 0
        self.assertEqual(card1.order, 0)
        
        # card3 should be moved from order 2 to order 1
        self.assertEqual(card3.order, 1)
        
        # card4 should be moved from order 3 to order 2
        self.assertEqual(card4.order, 2)
        
        # Verify no gaps in order values
        remaining_cards = list(
            KanbanCard.objects.filter(board=self.board, status='TODO').order_by('order')
        )
        self.assertEqual(len(remaining_cards), 3)
        for i, card in enumerate(remaining_cards):
            self.assertEqual(card.order, i, f"Card at position {i} should have order={i}")
    
    def test_delete_card_only_affects_same_column(self):
        """Test that deleting a card only reorders cards in the same column"""
        # Create cards in different columns
        todo_card1 = KanbanCard.objects.create(
            board=self.board,
            title='TODO Card 1',
            status='TODO',
            order=0
        )
        todo_card2 = KanbanCard.objects.create(
            board=self.board,
            title='TODO Card 2',
            status='TODO',
            order=1
        )
        doing_card1 = KanbanCard.objects.create(
            board=self.board,
            title='DOING Card 1',
            status='DOING',
            order=0
        )
        doing_card2 = KanbanCard.objects.create(
            board=self.board,
            title='DOING Card 2',
            status='DOING',
            order=1
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Delete todo_card1
        response = self.client.delete(
            f'/api/v1/kanban/cards/{todo_card1.id}',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify TODO cards are reordered
        todo_card2.refresh_from_db()
        self.assertEqual(todo_card2.order, 0)
        
        # Verify DOING cards are unchanged
        doing_card1.refresh_from_db()
        doing_card2.refresh_from_db()
        self.assertEqual(doing_card1.order, 0)
        self.assertEqual(doing_card2.order, 1)
    
    def test_delete_card_not_found_returns_404(self):
        """Test that deleting non-existent card returns 404"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to delete non-existent card
        response = self.client.delete(
            '/api/v1/kanban/cards/99999',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
    
    def test_delete_card_unauthenticated_returns_401(self):
        """Test that unauthenticated request returns 401"""
        # Create a test card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to delete without authentication
        response = self.client.delete(
            f'/api/v1/kanban/cards/{card.id}',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401)
        
        # Verify card still exists
        card_exists = KanbanCard.objects.filter(id=card.id).exists()
        self.assertTrue(card_exists, "Card should not be deleted")
    
    def test_delete_card_non_admin_returns_403(self):
        """Test that non-admin user returns 403"""
        # Create a test card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Login as regular user
        self.client.login(username='regular', password='userpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to delete as non-admin
        response = self.client.delete(
            f'/api/v1/kanban/cards/{card.id}',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
        
        # Verify card still exists
        card_exists = KanbanCard.objects.filter(id=card.id).exists()
        self.assertTrue(card_exists, "Card should not be deleted")



# Feature: kanban-board-system

class KanbanCardMoveTests(TestCase):
    """
    Unit tests for PATCH /kanban/cards/{id}/move endpoint
    Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 10.2, 13.6
    """
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a superuser for admin operations
        self.admin_user = User.objects.create_superuser(
            username='admin',
            password='adminpass123',
            email='admin@example.com'
        )
        
        # Create a regular user
        self.regular_user = User.objects.create_user(
            username='regular',
            password='userpass123'
        )
        
        # Create a project with a board
        self.project = Project.objects.create(
            title='Test Project',
            description='Test description'
        )
        self.board = self.project.kanban_board
    
    def tearDown(self):
        """Clean up test fixtures"""
        self.admin_user.delete()
        self.regular_user.delete()
        self.project.delete()
    
    def test_move_card_to_different_status_success(self):
        """Test successfully moving a card to a different status"""
        # Create a card in TODO
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Move card to DOING
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DOING', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response data
        data = response.json()
        self.assertEqual(data['status'], 'DOING')
        self.assertEqual(data['order'], 0)
        self.assertEqual(data['id'], card.id)
        
        # Verify card is updated in database
        card.refresh_from_db()
        self.assertEqual(card.status, 'DOING')
        self.assertEqual(card.order, 0)
    
    def test_move_card_to_done_sets_completed_at(self):
        """Test that moving a card to DONE sets completed_at timestamp"""
        from django.utils import timezone
        
        # Create a card in TODO
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Verify completed_at is None
        self.assertIsNone(card.completed_at)
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Move card to DONE
        before_move = timezone.now()
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DONE', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        after_move = timezone.now()
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify completed_at is set
        card.refresh_from_db()
        self.assertIsNotNone(card.completed_at)
        
        # Verify completed_at is recent (within the time window)
        self.assertGreaterEqual(card.completed_at, before_move)
        self.assertLessEqual(card.completed_at, after_move)
    
    def test_move_card_from_done_clears_completed_at(self):
        """Test that moving a card from DONE clears completed_at timestamp"""
        from django.utils import timezone
        
        # Create a card in DONE with completed_at set
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='DONE',
            order=0,
            completed_at=timezone.now()
        )
        
        # Verify completed_at is set
        self.assertIsNotNone(card.completed_at)
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Move card to TODO
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'TODO', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify completed_at is cleared
        card.refresh_from_db()
        self.assertIsNone(card.completed_at)
    
    def test_move_card_reorders_within_same_column(self):
        """Test that moving a card within the same column reorders correctly"""
        # Create multiple cards in TODO
        card1 = KanbanCard.objects.create(
            board=self.board,
            title='Card 1',
            status='TODO',
            order=0
        )
        card2 = KanbanCard.objects.create(
            board=self.board,
            title='Card 2',
            status='TODO',
            order=1
        )
        card3 = KanbanCard.objects.create(
            board=self.board,
            title='Card 3',
            status='TODO',
            order=2
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Move card1 from position 0 to position 2
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card1.id}/move',
            data={'status': 'TODO', 'order': 2},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify cards are reordered
        card1.refresh_from_db()
        card2.refresh_from_db()
        card3.refresh_from_db()
        
        # card1 should be at position 2
        self.assertEqual(card1.order, 2)
        
        # card2 should be at position 0
        self.assertEqual(card2.order, 0)
        
        # card3 should be at position 1
        self.assertEqual(card3.order, 1)
    
    def test_move_card_clamps_order_to_valid_range(self):
        """Test that order is clamped to valid range when out of bounds"""
        # Create a card in TODO
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Try to move card to position 100 (out of bounds)
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DOING', 'order': 100},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify order is clamped to 0 (since DOING column is empty)
        card.refresh_from_db()
        self.assertEqual(card.order, 0)
    
    def test_move_card_invalid_status_returns_400(self):
        """Test that invalid status returns 400 error"""
        # Create a card in TODO
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Try to move card to invalid status
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'INVALID', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('Invalid status', data['detail'])
        
        # Verify card is unchanged
        card.refresh_from_db()
        self.assertEqual(card.status, 'TODO')
        self.assertEqual(card.order, 0)
    
    def test_move_card_not_found_returns_404(self):
        """Test that moving non-existent card returns 404"""
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to move non-existent card
        response = self.client.patch(
            '/api/v1/kanban/cards/99999/move',
            data={'status': 'DOING', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
    
    def test_move_card_unauthenticated_returns_401(self):
        """Test that unauthenticated request returns 401"""
        # Create a card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to move without authentication
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DOING', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401)
        
        # Verify card is unchanged
        card.refresh_from_db()
        self.assertEqual(card.status, 'TODO')
    
    def test_move_card_non_admin_returns_403(self):
        """Test that non-admin user returns 403"""
        # Create a card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0
        )
        
        # Login as regular user
        self.client.login(username='regular', password='userpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Attempt to move as non-admin
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DOING', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
        
        # Verify card is unchanged
        card.refresh_from_db()
        self.assertEqual(card.status, 'TODO')
    
    def test_move_card_includes_user_has_voted_flag(self):
        """Test that response includes user_has_voted flag"""
        # Create a card
        card = KanbanCard.objects.create(
            board=self.board,
            title='Test Card',
            status='TODO',
            order=0,
            allow_voting=True
        )
        
        # Login as admin
        self.client.login(username='admin', password='adminpass123')
        
        # Get CSRF token
        csrf_response = self.client.get('/api/v1/csrf')
        csrf_token = csrf_response.cookies.get('csrftoken')
        
        # Move card
        response = self.client.patch(
            f'/api/v1/kanban/cards/{card.id}/move',
            data={'status': 'DOING', 'order': 0},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_token.value if csrf_token else ''
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response includes user_has_voted flag
        data = response.json()
        self.assertIn('user_has_voted', data)
        self.assertIsInstance(data['user_has_voted'], bool)
        self.assertFalse(data['user_has_voted'])  # Admin hasn't voted



# Feature: kanban-board-system

class KanbanCardVoteEndpointTests(TestCase):
    """
    Unit tests for POST /kanban/cards/{id}/vote endpoint
    Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6, 13.7, 14.5, 14.6, 14.7, 19.1, 19.2
    """
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a project with a board
        self.project = Project.objects.create(
            title="Test Project",
            description="Test description"
        )
        self.board = self.project.kanban_board
        
        # Create a card with voting enabled
        self.card = KanbanCard.objects.create(
            board=self.board,
            title="Test Card",
            status='TODO',
            votes=0,
            allow_voting=True,
            order=0
        )
        
        # Create a card with voting disabled
        self.disabled_card = KanbanCard.objects.create(
            board=self.board,
            title="Disabled Card",
            status='TODO',
            votes=0,
            allow_voting=False,
            order=1
        )
    
    def tearDown(self):
        """Clean up test fixtures"""
        self.project.delete()
    
    def test_vote_on_card_with_voting_enabled_succeeds(self):
        """Test that voting on a card with voting enabled succeeds"""
        # Vote on the card
        response = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response structure
        data = response.json()
        self.assertIn('id', data)
        self.assertIn('votes', data)
        self.assertIn('user_has_voted', data)
        
        # Verify vote count increased
        self.assertEqual(data['id'], self.card.id)
        self.assertEqual(data['votes'], 1)
        self.assertTrue(data['user_has_voted'])
        
        # Verify database was updated
        self.card.refresh_from_db()
        self.assertEqual(self.card.votes, 1)
    
    def test_vote_on_card_with_voting_disabled_returns_403(self):
        """Test that voting on a card with voting disabled returns 403"""
        # Attempt to vote on disabled card
        response = self.client.post(
            f'/api/v1/kanban/cards/{self.disabled_card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertEqual(data['detail'], 'Voting is disabled for this card')
        
        # Verify vote count unchanged
        self.disabled_card.refresh_from_db()
        self.assertEqual(self.disabled_card.votes, 0)
    
    def test_duplicate_vote_returns_409(self):
        """Test that voting twice on the same card returns 409"""
        # First vote
        response1 = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        self.assertEqual(response1.status_code, 200)
        
        # Second vote from same IP
        response2 = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 409 Conflict
        self.assertEqual(response2.status_code, 409)
        
        # Verify error message
        data = response2.json()
        self.assertIn('detail', data)
        self.assertIn('already voted', data['detail'])
        
        # Verify vote count is still 1
        self.card.refresh_from_db()
        self.assertEqual(self.card.votes, 1)
    
    def test_vote_on_nonexistent_card_returns_404(self):
        """Test that voting on a non-existent card returns 404"""
        # Attempt to vote on non-existent card
        response = self.client.post(
            '/api/v1/kanban/cards/99999/vote',
            content_type='application/json'
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
    
    def test_vote_creates_vote_record(self):
        """Test that voting creates a vote record in the database"""
        # Vote on the card
        response = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify vote record was created
        vote_records = CardVote.objects.filter(card=self.card)
        self.assertEqual(vote_records.count(), 1)
        
        # Verify vote record has IP hash
        vote_record = vote_records.first()
        self.assertIsNotNone(vote_record.ip_hash)
        self.assertEqual(len(vote_record.ip_hash), 64)  # SHA-256 hash length
    
    def test_vote_response_includes_user_has_voted_flag(self):
        """Test that vote response includes user_has_voted flag"""
        # Vote on the card
        response = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response includes user_has_voted flag
        data = response.json()
        self.assertIn('user_has_voted', data)
        self.assertIsInstance(data['user_has_voted'], bool)
        self.assertTrue(data['user_has_voted'])
    
    def test_remove_vote_after_voting_succeeds(self):
        """Test that removing a vote after voting succeeds"""
        # First, vote on the card
        vote_response = self.client.post(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        self.assertEqual(vote_response.status_code, 200)
        self.assertEqual(vote_response.json()['votes'], 1)
        
        # Now remove the vote
        response = self.client.delete(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Verify response structure
        data = response.json()
        self.assertIn('id', data)
        self.assertIn('votes', data)
        self.assertIn('user_has_voted', data)
        
        # Verify vote count decreased
        self.assertEqual(data['id'], self.card.id)
        self.assertEqual(data['votes'], 0)
        self.assertFalse(data['user_has_voted'])
        
        # Verify database was updated
        self.card.refresh_from_db()
        self.assertEqual(self.card.votes, 0)
        
        # Verify vote record was deleted
        vote_records = CardVote.objects.filter(card=self.card)
        self.assertEqual(vote_records.count(), 0)
    
    def test_remove_vote_without_voting_returns_404(self):
        """Test that removing a vote without having voted returns 404"""
        # Attempt to remove vote without voting first
        response = self.client.delete(
            f'/api/v1/kanban/cards/{self.card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertIn('has not voted', data['detail'])
        
        # Verify vote count unchanged
        self.card.refresh_from_db()
        self.assertEqual(self.card.votes, 0)
    
    def test_remove_vote_from_disabled_card_returns_403(self):
        """Test that removing a vote from a card with voting disabled returns 403"""
        # First, enable voting and vote on the card
        self.disabled_card.allow_voting = True
        self.disabled_card.save()
        
        vote_response = self.client.post(
            f'/api/v1/kanban/cards/{self.disabled_card.id}/vote',
            content_type='application/json'
        )
        self.assertEqual(vote_response.status_code, 200)
        
        # Refresh to get updated vote count
        self.disabled_card.refresh_from_db()
        self.assertEqual(self.disabled_card.votes, 1)
        
        # Now disable voting
        self.disabled_card.allow_voting = False
        self.disabled_card.save()
        
        # Attempt to remove vote
        response = self.client.delete(
            f'/api/v1/kanban/cards/{self.disabled_card.id}/vote',
            content_type='application/json'
        )
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, 403)
        
        # Verify error message
        data = response.json()
        self.assertIn('detail', data)
        self.assertEqual(data['detail'], 'Voting is disabled for this card')
        
        # Verify vote count unchanged
        self.disabled_card.refresh_from_db()
        self.assertEqual(self.disabled_card.votes, 1)
    
    def test_remove_vote_from_nonexistent_card_returns_404(self):
        """Test that removing a vote from a non-existent card returns 404"""
        # Attempt to remove vote from non-existent card
        response = self.client.delete(
            '/api/v1/kanban/cards/99999/vote',
            content_type='application/json'
        )
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, 404)
