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
