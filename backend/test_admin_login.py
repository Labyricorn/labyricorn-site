#!/usr/bin/env python
"""Script to test admin login with the created superuser"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labyricorn.settings')
django.setup()

from django.contrib.auth import authenticate
from django.contrib.auth.models import User

# Test credentials
username = 'admin'
password = 'admin123'

print(f"Testing admin login with username: {username}")

# Check if user exists
try:
    user = User.objects.get(username=username)
    print(f"✓ User '{username}' exists in database")
    print(f"  - Is superuser: {user.is_superuser}")
    print(f"  - Is staff: {user.is_staff}")
    print(f"  - Is active: {user.is_active}")
except User.DoesNotExist:
    print(f"✗ User '{username}' does not exist")
    sys.exit(1)

# Test authentication
authenticated_user = authenticate(username=username, password=password)

if authenticated_user is not None:
    print(f"✓ Authentication successful for user '{username}'")
    print(f"  - User ID: {authenticated_user.id}")
    print(f"  - Email: {authenticated_user.email}")
else:
    print(f"✗ Authentication failed for user '{username}'")
    sys.exit(1)

print("\n✓ All admin login tests passed!")
print(f"\nYou can now login to the admin interface at http://localhost:8000/admin/")
print(f"Username: {username}")
print(f"Password: {password}")
