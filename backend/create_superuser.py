#!/usr/bin/env python
"""Script to create a superuser for the Django admin interface"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labyricorn.settings')
django.setup()

from django.contrib.auth.models import User

# Superuser credentials
username = 'admin'
email = 'admin@labyricorn.com'
password = 'admin123'

# Check if superuser already exists
if User.objects.filter(username=username).exists():
    print(f"Superuser '{username}' already exists.")
else:
    # Create superuser
    User.objects.create_superuser(
        username=username,
        email=email,
        password=password
    )
    print(f"Superuser '{username}' created successfully!")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"Email: {email}")
