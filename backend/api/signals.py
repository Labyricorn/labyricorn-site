"""
Signal handlers for the API app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from api.models import Project, KanbanBoard


@receiver(post_save, sender=Project)
def create_kanban_board(sender, instance, created, **kwargs):
    """
    Automatically create a Kanban board when a project is created.
    
    This signal ensures that every project has exactly one associated Kanban board,
    created automatically upon project creation.
    """
    if created:
        KanbanBoard.objects.create(project=instance)
