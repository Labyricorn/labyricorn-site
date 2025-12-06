"""
Management command to clean up old vote records.

This command removes CardVote records older than 90 days to maintain database
performance and allow users to vote again on cards after the expiration period.

Usage:
    python manage.py cleanup_old_votes

Recommended cron schedule (daily at 2 AM):
    0 2 * * * cd /path/to/project && python manage.py cleanup_old_votes
"""

from django.core.management.base import BaseCommand
from api.models import CardVote


class Command(BaseCommand):
    help = 'Remove vote records older than 90 days'
    
    def handle(self, *args, **options):
        """Execute the cleanup operation"""
        self.stdout.write('Starting vote cleanup...')
        
        try:
            deleted_count = CardVote.cleanup_old_votes()
            
            if deleted_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully deleted {deleted_count} old vote record(s)'
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS('No old vote records found to delete')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error during vote cleanup: {str(e)}')
            )
            raise
