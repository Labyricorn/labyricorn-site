"""
Tests for the cleanup_old_votes management command.
"""

from django.test import TestCase
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from io import StringIO

from api.models import Project, KanbanBoard, KanbanCard, CardVote


class CleanupOldVotesCommandTest(TestCase):
    """Test the cleanup_old_votes management command"""
    
    def setUp(self):
        """Create test data"""
        # Create a project and board
        self.project = Project.objects.create(
            title="Test Project",
            slug="test-project",
            description="Test description"
        )
        self.board = self.project.kanban_board
        
        # Create a card
        self.card = KanbanCard.objects.create(
            board=self.board,
            title="Test Card",
            status="TODO"
        )
    
    def test_cleanup_removes_old_votes(self):
        """Test that votes older than 90 days are removed"""
        # Create an old vote (91 days old)
        old_vote = CardVote.objects.create(
            card=self.card,
            ip_hash='old_vote_hash'
        )
        old_date = timezone.now() - timedelta(days=91)
        old_vote.voted_at = old_date
        old_vote.save()
        
        # Create a recent vote (30 days old)
        recent_vote = CardVote.objects.create(
            card=self.card,
            ip_hash='recent_vote_hash'
        )
        recent_date = timezone.now() - timedelta(days=30)
        recent_vote.voted_at = recent_date
        recent_vote.save()
        
        # Verify both votes exist
        self.assertEqual(CardVote.objects.count(), 2)
        
        # Run the command
        out = StringIO()
        call_command('cleanup_old_votes', stdout=out)
        
        # Verify only the old vote was deleted
        self.assertEqual(CardVote.objects.count(), 1)
        self.assertTrue(
            CardVote.objects.filter(ip_hash='recent_vote_hash').exists()
        )
        self.assertFalse(
            CardVote.objects.filter(ip_hash='old_vote_hash').exists()
        )
        
        # Verify output message
        output = out.getvalue()
        self.assertIn('Successfully deleted 1 old vote record', output)
    
    def test_cleanup_with_no_old_votes(self):
        """Test that command handles case with no old votes gracefully"""
        # Create only recent votes
        recent_vote = CardVote.objects.create(
            card=self.card,
            ip_hash='recent_vote_hash'
        )
        
        # Run the command
        out = StringIO()
        call_command('cleanup_old_votes', stdout=out)
        
        # Verify no votes were deleted
        self.assertEqual(CardVote.objects.count(), 1)
        
        # Verify output message
        output = out.getvalue()
        self.assertIn('No old vote records found to delete', output)
    
    def test_cleanup_with_multiple_old_votes(self):
        """Test that command removes multiple old votes"""
        # Create multiple old votes
        for i in range(5):
            old_vote = CardVote.objects.create(
                card=self.card,
                ip_hash=f'old_vote_hash_{i}'
            )
            old_date = timezone.now() - timedelta(days=91 + i)
            old_vote.voted_at = old_date
            old_vote.save()
        
        # Verify all votes exist
        self.assertEqual(CardVote.objects.count(), 5)
        
        # Run the command
        out = StringIO()
        call_command('cleanup_old_votes', stdout=out)
        
        # Verify all old votes were deleted
        self.assertEqual(CardVote.objects.count(), 0)
        
        # Verify output message
        output = out.getvalue()
        self.assertIn('Successfully deleted 5 old vote record', output)
    
    def test_cleanup_preserves_vote_counts(self):
        """Test that cleanup doesn't affect vote counts on cards"""
        # Set initial vote count
        self.card.votes = 10
        self.card.save()
        
        # Create an old vote
        old_vote = CardVote.objects.create(
            card=self.card,
            ip_hash='old_vote_hash'
        )
        old_date = timezone.now() - timedelta(days=91)
        old_vote.voted_at = old_date
        old_vote.save()
        
        # Run the command
        call_command('cleanup_old_votes', stdout=StringIO())
        
        # Verify vote count is preserved
        self.card.refresh_from_db()
        self.assertEqual(self.card.votes, 10)
