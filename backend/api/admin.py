from django.contrib import admin
from django.utils.html import format_html
from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'created_at', 'hero_image_thumbnail')
    search_fields = ('title', 'slug')
    readonly_fields = ('slug', 'created_at', 'hero_image_preview', 'hero_image_width', 'hero_image_height')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'slug', 'description')
        }),
        ('Project Details', {
            'fields': ('repo_url', 'tech_stack')
        }),
        ('Hero Image', {
            'fields': ('hero_image', 'hero_image_preview', 'hero_image_width', 'hero_image_height')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )
    
    def hero_image_thumbnail(self, obj):
        """Display small thumbnail in list view"""
        if obj.hero_image:
            return format_html(
                '<img src="{}" style="max-height: 50px; max-width: 100px;" />',
                obj.hero_image.url
            )
        return "No image"
    hero_image_thumbnail.short_description = 'Thumbnail'
    
    def hero_image_preview(self, obj):
        """Display larger preview in detail view"""
        if obj.hero_image:
            return format_html(
                '<img src="{}" style="max-height: 300px; max-width: 500px;" />',
                obj.hero_image.url
            )
        return "No image uploaded"
    hero_image_preview.short_description = 'Image Preview'
