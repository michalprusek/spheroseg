"""
Main entry point for the Spheroseg API.
This file simply imports the FastAPI app from the app module.
"""

# Add the parent directory to the path so that we can import from parent modules
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import app from app/main.py
from app.main import app

# If this file is run directly, start the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 