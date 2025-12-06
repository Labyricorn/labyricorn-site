from django.db import models, transaction, IntegrityError
from django.contrib.postgres.fields import ArrayField
from django.utils.text import slugify
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from PIL import Image
import os


def validate_image_size(image):
    """Validate image file size (max 5MB)"""
    max_size = 5 * 1024 * 1024  # 5MB
    if image.size > max_size:
        raise ValidationError(
            f"Image file size cannot exceed 5MB. Current size: {image.size / (1024*1024):.2f}MB"
        )


class Project(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, db_index=True)
    description = models.TextField()
    repo_url = models.URLField(blank=True, null=True)
    tech_stack = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        default=list
    )
    hero_image = models.ImageField(
        upload_to='projects/heroes/',
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'webp']),
            validate_image_size
        ]
    )
    hero_image_width = models.IntegerField(blank=True, null=True)
    hero_image_height = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def save(self, *args, **kwargs):
        # Generate slug if needed
        if not self.slug or self._title_changed():
            self.slug = self._generate_unique_slug()
        
        # Handle image replacement - delete old image if being replaced
        if self.pk:
            try:
                old_instance = Project.objects.get(pk=self.pk)
                if old_instance.hero_image and old_instance.hero_image != self.hero_image:
                    # Delete the old image file
                    if os.path.isfile(old_instance.hero_image.path):
                        os.remove(old_instance.hero_image.path)
            except Project.DoesNotExist:
                pass
        
        # Extract image dimensions if image is present
        if self.hero_image and hasattr(self.hero_image, 'file'):
            try:
                img = Image.open(self.hero_image.file)
                self.hero_image_width, self.hero_image_height = img.size
            except Exception:
                pass  # If image processing fails, continue without dimensions
        
        # Handle race condition in slug generation
        max_retries = 5
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    super().save(*args, **kwargs)
                break
            except IntegrityError:
                if attempt == max_retries - 1:
                    raise
                # Regenerate slug and retry
                self.slug = self._generate_unique_slug()
    
    def _title_changed(self):
        """Check if title has changed from database value"""
        if not self.pk:
            return True
        try:
            original = Project.objects.get(pk=self.pk)
            return original.title != self.title
        except Project.DoesNotExist:
            return True
    
    def _generate_unique_slug(self):
        base_slug = slugify(self.title)
        # Handle edge case where title has no alphanumeric characters
        if not base_slug:
            base_slug = 'project'
        # Replace underscores with hyphens to ensure URL-safe format
        base_slug = base_slug.replace('_', '-')
        slug = base_slug
        counter = 1
        while Project.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug
    
    def delete(self, *args, **kwargs):
        """Override delete to clean up image file"""
        if self.hero_image:
            if os.path.isfile(self.hero_image.path):
                os.remove(self.hero_image.path)
        super().delete(*args, **kwargs)


# Kanban Board Models

class KanbanBoard(models.Model):
    """
    Kanban board associated with a project (one-to-one relationship).
    Automatically created when a project is created via signal.
    """
    project = models.OneToOneField(
        'Project',
        on_delete=models.CASCADE,
        related_name='kanban_board'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Kanban Board for {self.project.title}"
    
    class Meta:
        ordering = ['created_at']


class KanbanCard(models.Model):
    """
    Individual card on a Kanban board with voting and ordering support.
    """
    STATUS_CHOICES = [
        ('TODO', 'To Do'),
        ('DOING', 'Doing'),
        ('DONE', 'Done'),
    ]
    
    board = models.ForeignKey(
        KanbanBoard,
        on_delete=models.CASCADE,
        related_name='cards'
    )
    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='TODO',
        db_index=True
    )
    votes = models.IntegerField(default=0)
    allow_voting = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['status', 'order']
        indexes = [
            models.Index(fields=['board', 'status', 'order']),
            models.Index(fields=['board', 'status', '-completed_at']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.status})"
    
    def clean(self):
        """Validate model fields (Requirements 10.3, 10.4)"""
        from django.core.exceptions import ValidationError
        errors = {}
        
        # Validate votes is non-negative
        if self.votes < 0:
            errors['votes'] = 'Votes must be a non-negative integer'
        
        # Validate order is non-negative
        if self.order < 0:
            errors['order'] = 'Order must be a non-negative integer'
        
        if errors:
            raise ValidationError(errors)
    
    def save(self, *args, **kwargs):
        """Set order to end of column if not specified"""
        if self.pk is None and self.order == 0:
            from django.db.models import Max
            max_order = KanbanCard.objects.filter(
                board=self.board,
                status=self.status
            ).aggregate(Max('order'))['order__max']
            self.order = (max_order if max_order is not None else -1) + 1
        super().save(*args, **kwargs)
    
    def increment_vote(self, ip_hash):
        """Atomically increment vote count and create vote record"""
        if not self.allow_voting:
            raise ValueError("Voting is disabled for this card")
        
        with transaction.atomic():
            # Check for duplicate vote
            if CardVote.objects.filter(card=self, ip_hash=ip_hash).exists():
                raise ValueError("User has already voted on this card")
            
            # Create vote record
            CardVote.objects.create(card=self, ip_hash=ip_hash)
            
            # Increment vote count
            KanbanCard.objects.filter(pk=self.pk).update(votes=models.F('votes') + 1)
            self.refresh_from_db()
    
    def decrement_vote(self, ip_hash):
        """Atomically decrement vote count and remove vote record"""
        if not self.allow_voting:
            raise ValueError("Voting is disabled for this card")
        
        with transaction.atomic():
            # Find and delete vote record
            vote = CardVote.objects.filter(card=self, ip_hash=ip_hash).first()
            if not vote:
                raise ValueError("User has not voted on this card")
            
            vote.delete()
            
            # Decrement vote count
            KanbanCard.objects.filter(pk=self.pk).update(votes=models.F('votes') - 1)
            self.refresh_from_db()
    
    def has_user_voted(self, ip_hash):
        """Check if user has voted on this card"""
        return CardVote.objects.filter(card=self, ip_hash=ip_hash).exists()
    
    def move_to(self, new_status, new_order):
        """Move card to new status and/or position"""
        from django.utils import timezone
        
        old_status = self.status
        old_order = self.order
        
        with transaction.atomic():
            # Set completed_at timestamp when moving to DONE
            if new_status == 'DONE' and old_status != 'DONE':
                self.completed_at = timezone.now()
            elif new_status != 'DONE' and old_status == 'DONE':
                self.completed_at = None
            
            # Remove from old position
            if old_status == new_status:
                # Reordering within same column
                if new_order < old_order:
                    # Moving up
                    KanbanCard.objects.filter(
                        board=self.board,
                        status=old_status,
                        order__gte=new_order,
                        order__lt=old_order
                    ).update(order=models.F('order') + 1)
                elif new_order > old_order:
                    # Moving down
                    KanbanCard.objects.filter(
                        board=self.board,
                        status=old_status,
                        order__gt=old_order,
                        order__lte=new_order
                    ).update(order=models.F('order') - 1)
            else:
                # Moving to different column
                # Close gap in old column
                KanbanCard.objects.filter(
                    board=self.board,
                    status=old_status,
                    order__gt=old_order
                ).update(order=models.F('order') - 1)
                
                # Make space in new column
                KanbanCard.objects.filter(
                    board=self.board,
                    status=new_status,
                    order__gte=new_order
                ).update(order=models.F('order') + 1)
            
            # Update this card
            self.status = new_status
            self.order = new_order
            self.save()


class CardVote(models.Model):
    """Track individual votes to prevent duplicates and enable vote removal"""
    card = models.ForeignKey(
        KanbanCard,
        on_delete=models.CASCADE,
        related_name='vote_records'
    )
    ip_hash = models.CharField(max_length=64, db_index=True)
    voted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        unique_together = [['card', 'ip_hash']]
        indexes = [
            models.Index(fields=['card', 'ip_hash']),
            models.Index(fields=['voted_at']),
        ]
    
    def __str__(self):
        return f"Vote on {self.card.title} at {self.voted_at}"
    
    @staticmethod
    def hash_ip(ip_address):
        """Hash IP address for privacy"""
        import hashlib
        return hashlib.sha256(ip_address.encode()).hexdigest()
    
    @classmethod
    def cleanup_old_votes(cls):
        """Remove vote records older than 90 days"""
        from django.utils import timezone
        cutoff_date = timezone.now() - timezone.timedelta(days=90)
        deleted_count, _ = cls.objects.filter(voted_at__lt=cutoff_date).delete()
        return deleted_count
