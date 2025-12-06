"""
Integration tests for Kanban API router registration.

Tests that the Kanban router is properly registered with Django Ninja API
and that all endpoints are accessible through the OpenAPI schema.
"""
from django.test import TestCase
from api.urls import api


class KanbanRouterIntegrationTest(TestCase):
    """Test that Kanban router is properly integrated with Django Ninja API"""
    
    def test_kanban_router_is_registered(self):
        """Test that kanban router is registered with the API"""
        # Get OpenAPI schema
        schema = api.get_openapi_schema()
        
        # Verify schema has paths
        self.assertIn('paths', schema)
        paths = schema['paths']
        
        # Verify all required Kanban endpoints are present (Requirement 13.1-13.8)
        required_endpoints = [
            '/api/v1/projects/{slug}/kanban',  # GET board (13.1)
            '/api/v1/projects/{slug}/kanban/archived',  # GET archived (13.2)
            '/api/v1/kanban/cards',  # POST create card (13.3)
            '/api/v1/kanban/cards/{card_id}',  # PATCH update, DELETE delete (13.4, 13.5)
            '/api/v1/kanban/cards/{card_id}/move',  # PATCH move (13.6)
            '/api/v1/kanban/cards/{card_id}/vote',  # POST vote, DELETE remove vote (13.7, 13.8)
        ]
        
        for endpoint in required_endpoints:
            self.assertIn(endpoint, paths, f"Endpoint {endpoint} not found in OpenAPI schema")
    
    def test_kanban_schemas_are_registered(self):
        """Test that Kanban schemas are included in OpenAPI schema (Requirement 17.4)"""
        # Get OpenAPI schema
        schema = api.get_openapi_schema()
        
        # Verify schema has components
        self.assertIn('components', schema)
        self.assertIn('schemas', schema['components'])
        schemas = schema['components']['schemas']
        
        # Verify all required Kanban schemas are present
        required_schemas = [
            'KanbanBoardSchema',
            'KanbanCardSchema',
            'CardCreateSchema',
            'CardUpdateSchema',
            'CardMoveSchema',
            'VoteResponseSchema',
            'ArchivedCardsSchema',
        ]
        
        for schema_name in required_schemas:
            self.assertIn(schema_name, schemas, f"Schema {schema_name} not found in OpenAPI schema")
    
    def test_get_board_endpoint_methods(self):
        """Test that GET /projects/{slug}/kanban endpoint has correct methods"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/projects/{slug}/kanban']
        
        # Should only have GET method
        self.assertIn('get', endpoint)
        self.assertEqual(len(endpoint), 1)
    
    def test_vote_endpoint_methods(self):
        """Test that /kanban/cards/{card_id}/vote endpoint has POST and DELETE methods"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/kanban/cards/{card_id}/vote']
        
        # Should have POST (vote) and DELETE (remove vote) methods
        self.assertIn('post', endpoint)
        self.assertIn('delete', endpoint)
    
    def test_card_endpoint_methods(self):
        """Test that /kanban/cards/{card_id} endpoint has PATCH and DELETE methods"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/kanban/cards/{card_id}']
        
        # Should have PATCH (update) and DELETE (delete) methods
        self.assertIn('patch', endpoint)
        self.assertIn('delete', endpoint)
    
    def test_create_card_endpoint_methods(self):
        """Test that POST /kanban/cards endpoint exists"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/kanban/cards']
        
        # Should only have POST method
        self.assertIn('post', endpoint)
        self.assertEqual(len(endpoint), 1)
    
    def test_move_card_endpoint_methods(self):
        """Test that PATCH /kanban/cards/{card_id}/move endpoint exists"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/kanban/cards/{card_id}/move']
        
        # Should only have PATCH method
        self.assertIn('patch', endpoint)
        self.assertEqual(len(endpoint), 1)
    
    def test_archived_cards_endpoint_methods(self):
        """Test that GET /projects/{slug}/kanban/archived endpoint exists"""
        schema = api.get_openapi_schema()
        endpoint = schema['paths']['/api/v1/projects/{slug}/kanban/archived']
        
        # Should only have GET method
        self.assertIn('get', endpoint)
        self.assertEqual(len(endpoint), 1)
