import os
from pathlib import Path
from dotenv import load_dotenv

# Load environmental variables from .env file
load_dotenv()

# Workspace paths
ROOT_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = ROOT_DIR / "temp"
DATA_DIR = ROOT_DIR / "data"
ASSETS_DIR = ROOT_DIR / "assets"

# Database Configuration
DATABASE_PATH = DATA_DIR / "clipinsight.db"

# Create directories if they don't exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# App Configurations
DEFAULT_THEME = "dark"
APP_NAME = "ClipInsight AI"

# Frame Extraction settings
DEFAULT_FRAME_INTERVALS = [0, 3, 5, 10, 15, 20, 30] # Extraction timestamps in seconds
MAX_VIDEO_SIZE_MB = 50
