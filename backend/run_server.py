#!/usr/bin/env python
"""
Development server script for running Uvicorn with auto-reload.
This script starts the Django application using Uvicorn ASGI server.
"""
import os
import sys

def main():
    """Run the Uvicorn server with development settings"""
    # Set Django settings module
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labyricorn.settings')
    
    # Import uvicorn
    try:
        import uvicorn
    except ImportError:
        print("Error: uvicorn is not installed. Install it with: pip install uvicorn[standard]")
        sys.exit(1)
    
    # Run Uvicorn with auto-reload for development
    uvicorn.run(
        "labyricorn.asgi:application",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True,
    )

if __name__ == "__main__":
    main()
