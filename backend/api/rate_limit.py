"""
Rate limiting utilities for Kanban voting endpoints.

This module provides rate limiting functionality to prevent vote spam
and abuse. Uses Django's cache framework to track vote attempts per IP.
"""
from django.core.cache import cache


def check_rate_limit(ip_hash, limit=10, window=60):
    """
    Check if IP has exceeded rate limit for voting.
    
    Args:
        ip_hash: SHA-256 hash of the IP address
        limit: Maximum number of votes allowed (default: 10)
        window: Time window in seconds (default: 60)
    
    Returns:
        bool: True if request is within rate limit, False if exceeded
    
    The function tracks vote attempts using Django's cache with a key
    based on the IP hash. Each vote increments the counter, and the
    counter expires after the time window.
    """
    cache_key = f"vote_rate_limit:{ip_hash}"
    vote_count = cache.get(cache_key, 0)
    
    if vote_count >= limit:
        return False
    
    # Increment counter and set expiry
    cache.set(cache_key, vote_count + 1, window)
    return True
