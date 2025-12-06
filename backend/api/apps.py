from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'
    default_auto_field = 'django.db.models.BigAutoField'
    
    def ready(self):
        """Import signals when app is ready"""
        import api.signals
