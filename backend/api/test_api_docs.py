"""
Test that API documentation is accessible.

Verifies that the OpenAPI documentation endpoints are working correctly.
"""
from django.test import TestCase, Client


class APIDocumentationTest(TestCase):
    """Test API documentation endpoints"""
    
    def setUp(self):
        self.client = Client()
    
    def test_openapi_json_accessible(self):
        """Test that OpenAPI JSON schema is accessible at /api/v1/openapi.json"""
        response = self.client.get('/api/v1/openapi.json')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON
        self.assertEqual(response['Content-Type'], 'application/json')
        
        # Should have OpenAPI structure
        data = response.json()
        self.assertIn('openapi', data)
        self.assertIn('info', data)
        self.assertIn('paths', data)
        self.assertIn('components', data)
    
    def test_docs_page_accessible(self):
        """Test that API documentation page is accessible at /api/v1/docs"""
        response = self.client.get('/api/v1/docs')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return HTML
        self.assertIn('text/html', response['Content-Type'])
    
    def test_kanban_endpoints_in_openapi_schema(self):
        """Test that all Kanban endpoints are documented in OpenAPI schema"""
        response = self.client.get('/api/v1/openapi.json')
        data = response.json()
        
        # Verify all Kanban endpoints are documented
        paths = data['paths']
        kanban_endpoints = [k for k in paths.keys() if 'kanban' in k]
        
        # Should have at least 6 Kanban endpoints
        self.assertGreaterEqual(len(kanban_endpoints), 6)
        
        # Verify specific endpoints
        self.assertIn('/api/v1/projects/{slug}/kanban', paths)
        self.assertIn('/api/v1/projects/{slug}/kanban/archived', paths)
        self.assertIn('/api/v1/kanban/cards', paths)
        self.assertIn('/api/v1/kanban/cards/{card_id}', paths)
        self.assertIn('/api/v1/kanban/cards/{card_id}/move', paths)
        self.assertIn('/api/v1/kanban/cards/{card_id}/vote', paths)
