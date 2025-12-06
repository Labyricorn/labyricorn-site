#!/usr/bin/env python
"""Script to verify database connection"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labyricorn.settings')
django.setup()

from django.db import connection
from django.conf import settings

print("Testing database connection...")
print(f"Database: {settings.DATABASES['default']['NAME']}")
print(f"Host: {settings.DATABASES['default']['HOST']}")
print(f"Port: {settings.DATABASES['default']['PORT']}")
print(f"User: {settings.DATABASES['default']['USER']}")

try:
    with connection.cursor() as cursor:
        # Test basic query
        cursor.execute("SELECT version();")
        db_version = cursor.fetchone()[0]
        print(f"\n✓ Database connection successful!")
        print(f"  PostgreSQL version: {db_version}")
        
        # Test table count
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        """)
        table_count = cursor.fetchone()[0]
        print(f"  Tables in database: {table_count}")
        
        # List some tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
            LIMIT 5;
        """)
        tables = cursor.fetchall()
        print(f"  Sample tables: {', '.join([t[0] for t in tables])}")
        
except Exception as e:
    print(f"\n✗ Database connection failed!")
    print(f"  Error: {e}")
    sys.exit(1)

print("\n✓ All database connection tests passed!")
