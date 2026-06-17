import sys
import os

# Add the backend root to sys.path so tests can import rules, db, app, etc.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))