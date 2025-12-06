from django.contrib import admin
from django.utils.html import format_html
from .models import Project, KanbanBoard, KanbanCard, CardVote


class KanbanCardInline(admin.TabularInline):
    """Inline display of Kanban cards within a board"""
    model = KanbanCard
    extra = 0
    fields = ('title', 'status', 'votes', 'allow_voting', 'order', 'completed_at')
    readonly_fields = ('votes', 'completed_at')
    ordering = ['status', 'order']


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


@admin.register(KanbanBoard)
class KanbanBoardAdmin(admin.ModelAdmin):
    """Admin interface for Kanban boards with inline card display"""
    list_display = ('id', 'project', 'card_count', 'created_at')
    search_fields = ('project__title', 'project__slug')
    readonly_fields = ('created_at',)
    list_filter = ('created_at',)
    inlines = [KanbanCardInline]
    
    def card_count(self, obj):
        """Display total number of cards on the board"""
        return obj.cards.count()
    card_count.short_description = 'Total Cards'


@admin.register(KanbanCard)
class KanbanCardAdmin(admin.ModelAdmin):
    """Admin interface for Kanban cards with filtering and search"""
    list_display = ('title', 'board', 'status', 'votes', 'allow_voting', 'order', 'completed_at', 'created_at')
    search_fields = ('title', 'board__project__title')
    list_filter = ('status', 'allow_voting', 'created_at', 'completed_at')
    readonly_fields = ('votes', 'completed_at', 'created_at', 'updated_at')
    ordering = ['board', 'status', 'order']
    
    fieldsets = (
        ('Card Information', {
            'fields': ('board', 'title', 'status', 'order')
        }),
        ('Voting', {
            'fields': ('allow_voting', 'votes')
        }),
        ('Timestamps', {
            'fields': ('completed_at', 'created_at', 'updated_at')
        }),
    )


@admin.register(CardVote)
class CardVoteAdmin(admin.ModelAdmin):
    """Admin interface for card votes with read-only fields"""
    list_display = ('card', 'ip_hash_preview', 'voted_at')
    search_fields = ('card__title', 'ip_hash')
    list_filter = ('voted_at',)
    readonly_fields = ('card', 'ip_hash', 'voted_at')
    ordering = ['-voted_at']
    
    def ip_hash_preview(self, obj):
        """Display truncated IP hash for privacy"""
        return f"{obj.ip_hash[:16]}..."
    ip_hash_preview.short_description = 'IP Hash'
    
    def has_add_permission(self, request):
        """Prevent manual vote creation through admin"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent vote modification through admin"""
        return False
