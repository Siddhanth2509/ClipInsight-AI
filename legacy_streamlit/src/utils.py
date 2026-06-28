import os
import streamlit as st
import shutil
from pathlib import Path
from src.config import ASSETS_DIR, TEMP_DIR

def inject_custom_css():
    """Reads style.css and injects it into the Streamlit app layout."""
    css_file = ASSETS_DIR / "style.css"
    if css_file.exists():
        with open(css_file, "r") as f:
            css_content = f.read()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)
    else:
        st.warning("Warning: custom style.css stylesheet not found.")

def initialize_session_state():
    """Sets default Streamlit session state properties if they are not already set."""
    if "page" not in st.session_state:
        st.session_state.page = "Home"
    if "api_keys" not in st.session_state:
        # Check environment configurations as initial defaults
        from src.config import GEMINI_API_KEY, OPENAI_API_KEY
        st.session_state.api_keys = {
            "gemini": GEMINI_API_KEY,
            "openai": OPENAI_API_KEY
        }
    if "video_path" not in st.session_state:
        st.session_state.video_path = None
    if "video_metadata" not in st.session_state:
        st.session_state.video_metadata = {}
    if "analysis_results" not in st.session_state:
        st.session_state.analysis_results = None
    if "processing_step" not in st.session_state:
        st.session_state.processing_step = 0

def clear_temp_directory():
    """Removes all files from the temp directory to prevent storage build-up."""
    try:
        for filename in os.listdir(TEMP_DIR):
            file_path = TEMP_DIR / filename
            if file_path.is_file() or file_path.is_symlink():
                file_path.unlink()
            elif file_path.is_dir():
                shutil.rmtree(file_path)
    except Exception as e:
        pass # Gracefully continue if some temp files are locked during cleanup
