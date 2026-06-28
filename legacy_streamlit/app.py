import os
import streamlit as st
from pathlib import Path

# Configure Page Settings first
st.set_page_config(
    page_title="ClipInsight AI - Multimodal Video Analysis",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Imports from src components
from src.config import TEMP_DIR, MAX_VIDEO_SIZE_MB
from src.utils import inject_custom_css, initialize_session_state, clear_temp_directory
from src.video_processor import download_video, is_valid_url

# Initialize states and inject CSS styles
initialize_session_state()
inject_custom_css()

# Navigation Router in Sidebar
st.sidebar.markdown(
    '<h1 class="gradient-text" style="text-align: center; font-size: 2.2rem; margin-bottom: 0.5rem;">ClipInsight AI</h1>'
    '<p style="text-align: center; font-size: 0.9rem; color: #9ca3af; margin-bottom: 2rem;">Multimodal Video Intelligence</p>',
    unsafe_allow_html=True
)

# Custom Navigation buttons styled nicely
pages = {
    "Home": "🏠 Home",
    "Analyze Video": "🔍 Analyze Video",
    "Analysis History": "📜 Analysis History",
    "Insights Dashboard": "📊 Insights Dashboard",
    "Settings": "⚙️ Settings"
}

# Sidebar navigation selection
selected_page = st.sidebar.radio(
    "Navigation Menu", 
    options=list(pages.keys()), 
    format_func=lambda x: pages[x],
    label_visibility="collapsed"
)
st.session_state.page = selected_page

st.sidebar.markdown("---")
# Quick API Keys Status check in sidebar
st.sidebar.markdown("### API Authentication")
gemini_key_status = "🟢 Connected" if st.session_state.api_keys["gemini"] else "🔴 Missing"
openai_key_status = "🟢 Connected" if st.session_state.api_keys["openai"] else "⚪ Optional"
st.sidebar.markdown(f"**Gemini Vision:** {gemini_key_status}")
st.sidebar.markdown(f"**OpenAI Whisper:** {openai_key_status}")

# Sidebar Footer
st.sidebar.markdown(
    '<div style="position: fixed; bottom: 10px; font-size: 0.8rem; color: #4b5563;">'
    'ClipInsight AI v1.0.0'
    '</div>', 
    unsafe_allow_html=True
)

# ----------------- PAGE 1: HOME -----------------
def render_home():
    st.markdown('<h1 class="gradient-text">Welcome to ClipInsight AI</h1>', unsafe_allow_html=True)
    st.write(
        "Analyze Instagram Reels, YouTube Shorts, and local clips using advanced computer vision "
        "and speech-to-text. Uncover virality, hooks, editing structures, and marketing strategies."
    )
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Showcase stats grid
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(
            '<div class="insight-card">'
            '<h4 style="margin: 0; color: #9ca3af; font-size: 0.9rem;">Analyzed Videos</h4>'
            '<p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700; color: #818cf8;">24</p>'
            '</div>', 
            unsafe_allow_html=True
        )
    with col2:
        st.markdown(
            '<div class="insight-card">'
            '<h4 style="margin: 0; color: #9ca3af; font-size: 0.9rem;">Average Viral Score</h4>'
            '<p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700; color: #10b981;">78/100</p>'
            '</div>', 
            unsafe_allow_html=True
        )
    with col3:
        st.markdown(
            '<div class="insight-card">'
            '<h4 style="margin: 0; color: #9ca3af; font-size: 0.9rem;">Top Category</h4>'
            '<p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700; color: #f59e0b;">Education</p>'
            '</div>', 
            unsafe_allow_html=True
        )
    with col4:
        st.markdown(
            '<div class="insight-card">'
            '<h4 style="margin: 0; color: #9ca3af; font-size: 0.9rem;">Most Common Hook</h4>'
            '<p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700; color: #ec4899;">Curiosity</p>'
            '</div>', 
            unsafe_allow_html=True
        )
        
    st.markdown("<br>### How it works", unsafe_allow_html=True)
    
    col_a, col_b, col_c = st.columns(3)
    with col_a:
        st.markdown(
            '<div class="insight-card" style="height: 180px;">'
            '<h4 style="color: #818cf8; margin-top:0;">1. Ingestion</h4>'
            '<p style="font-size: 0.9rem; color: #d1d5db;">Upload an MP4 file or paste a short-form URL. The system handles format extraction and validates specifications.</p>'
            '</div>', 
            unsafe_allow_html=True
        )
    with col_b:
        st.markdown(
            '<div class="insight-card" style="height: 180px;">'
            '<h4 style="color: #c084fc; margin-top:0;">2. Processing</h4>'
            '<p style="font-size: 0.9rem; color: #d1d5db;">The system divides the video into frame segments using OpenCV and transcribes speech using Whisper audio tracks.</p>'
            '</div>', 
            unsafe_allow_html=True
        )
    with col_c:
        st.markdown(
            '<div class="insight-card" style="height: 180px;">'
            '<h4 style="color: #f472b6; margin-top:0;">3. Intelligence</h4>'
            '<p style="font-size: 0.9rem; color: #d1d5db;">Gemini Pro models digest visual cues and text semantics to generate a multi-dimensional marketing strategy report.</p>'
            '</div>', 
            unsafe_allow_html=True
        )

# ----------------- PAGE 2: ANALYZE VIDEO -----------------
def render_analyze():
    st.markdown('<h1 class="gradient-text">Video Analysis Studio</h1>', unsafe_allow_html=True)
    
    # Warning if Gemini API Key is missing
    if not st.session_state.api_keys["gemini"]:
        st.warning("⚠️ Warning: Gemini API Key is not set. Go to Settings page to add it or enable Simulation Mode.")
        
    # Input tabs
    tab_upload, tab_url = st.tabs(["📤 Upload Video File", "🔗 Paste Video Link"])
    
    video_source = None
    video_file_name = None
    
    with tab_upload:
        uploaded_file = st.file_uploader(
            "Select a short-form video clip (MP4, MOV)", 
            type=["mp4", "mov"],
            help=f"Maximum file size: {MAX_VIDEO_SIZE_MB}MB"
        )
        if uploaded_file is not None:
            # Check file size
            if uploaded_file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024:
                st.error(f"File is too large. Please upload files under {MAX_VIDEO_SIZE_MB}MB.")
            else:
                temp_path = TEMP_DIR / uploaded_file.name
                with open(temp_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                video_source = "upload"
                video_file_name = uploaded_file.name
                st.session_state.video_path = str(temp_path.resolve())
                st.session_state.video_metadata = {
                    "source": "Local Upload",
                    "name": uploaded_file.name,
                    "size_mb": round(uploaded_file.size / (1024 * 1024), 2)
                }
                
    with tab_url:
        url_input = st.text_input(
            "Paste Instagram Reel, YouTube Shorts, or TikTok URL",
            placeholder="https://www.instagram.com/reels/... or https://youtube.com/shorts/..."
        )
        col_url_btn, _ = st.columns([1, 4])
        with col_url_btn:
            fetch_btn = st.button("Fetch and Process Link")
            
        if fetch_btn and url_input:
            if not is_valid_url(url_input):
                st.error("Please enter a valid HTTP/HTTPS URL.")
            else:
                with st.spinner("Downloading clip using yt-dlp..."):
                    try:
                        downloaded_path = download_video(url_input)
                        video_source = "url"
                        video_file_name = Path(downloaded_path).name
                        st.session_state.video_path = downloaded_path
                        st.session_state.video_metadata = {
                            "source": "URL Link",
                            "url": url_input,
                            "name": video_file_name,
                            "size_mb": round(os.path.getsize(downloaded_path) / (1024 * 1024), 2)
                        }
                        st.success("Successfully fetched video link!")
                    except Exception as e:
                        st.error(f"Failed to fetch content from URL: {str(e)}")
                        st.info("You can go to 'Settings' to enable Simulated Run if external scraping is failing.")

    # Show video information if loaded
    if st.session_state.video_path and os.path.exists(st.session_state.video_path):
        st.markdown("---")
        col_preview, col_info = st.columns([1.2, 1])
        
        with col_preview:
            st.markdown("### Video Input Preview")
            # Render video preview
            st.video(st.session_state.video_path)
            
        with col_info:
            st.markdown("### Clip Specifications")
            meta = st.session_state.video_metadata
            st.write(f"**Filename:** {meta.get('name', 'Unknown')}")
            st.write(f"**Ingestion Source:** {meta.get('source', 'Unknown')}")
            st.write(f"**File Size:** {meta.get('size_mb', 0)} MB")
            if "url" in meta:
                st.write(f"**Original URL:** [Open Link]({meta['url']})")
                
            st.markdown("<br>", unsafe_allow_html=True)
            
            # Start Analysis Button
            st.markdown("### Run Video Intelligence")
            simulated_run = st.checkbox("Simulate analysis pipeline (no API keys required)")
            
            start_btn = st.button("Launch Multimodal Analysis 🚀", use_container_width=True)
            if start_btn:
                st.session_state.processing_step = 1
                # Trigger progress bars for step transitions
                run_pipeline(simulated_run)

def run_pipeline(simulated: bool):
    """Orchestrates pipeline visual steps from extraction to synthesis."""
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    steps = [
        ("Extracting Keyframes (Phase 2)...", 0.2),
        ("Extracting Audio Tracks (Phase 3)...", 0.4),
        ("Whisper Transcribing Audio (Phase 4)...", 0.6),
        ("Analyzing visual cues via Gemini Vision (Phase 5)...", 0.8),
        ("Synthesizing Multimodal Report (Phase 6)...", 1.0)
    ]
    
    import time
    for idx, (label, val) in enumerate(steps):
        status_text.text(label)
        progress_bar.progress(val)
        time.sleep(1.0) # Visual delay for demo/step verification
        
    st.balloons()
    status_text.success("Analysis Complete!")
    
    # Store dummy results for Phase 1 mockup
    st.session_state.analysis_results = {
        "summary": "This video shows a creator explaining GenAI concepts with beautiful motion graphics overlay.",
        "topic": "AI & Technology",
        "score": 85
    }
    
    st.write(st.session_state.analysis_results)

# ----------------- PAGE 3: HISTORY -----------------
def render_history():
    st.markdown('<h1 class="gradient-text">Analysis Log History</h1>', unsafe_allow_html=True)
    st.write("Browse previously processed clips, virality scores, and download structured reports.")
    
    # SQLite connector will populate this in Phase 7
    st.markdown(
        '<div class="insight-card">'
        '<div style="display:flex; justify-content:space-between; align-items:center;">'
        '<div>'
        '<h4 style="margin:0;">how_to_learn_ai_fast.mp4</h4>'
        '<p style="margin:5px 0 0 0; font-size:0.8rem; color:#9ca3af;">Analyzed on: June 19, 2026</p>'
        '</div>'
        '<div>'
        '<span class="badge">Technology</span> '
        '<span class="badge badge-viral">Viral Score: 89</span>'
        '</div>'
        '</div>'
        '</div>',
        unsafe_allow_html=True
    )

# ----------------- PAGE 4: INSIGHTS -----------------
def render_insights():
    st.markdown('<h1 class="gradient-text">Insights & Performance Analytics</h1>', unsafe_allow_html=True)
    st.write("Aggregation metrics across all analyzed videos. Understand trends, scores, and audiences.")
    st.info("Insights will automatically calculate dynamic graphs once your SQLite database logs analysis runs.")
    
    # Static placeholder graph/charts
    st.markdown("### Virality Trend Analysis")
    st.bar_chart([75, 82, 60, 95, 89, 78, 85])

# ----------------- PAGE 5: SETTINGS -----------------
def render_settings():
    st.markdown('<h1 class="gradient-text">Settings & Preferences</h1>', unsafe_allow_html=True)
    
    st.markdown("### 🔑 API Key Configuration")
    gemini_input = st.text_input(
        "Google Gemini API Key",
        value=st.session_state.api_keys["gemini"],
        type="password",
        help="Required for visual analysis and multimodal report synthesis."
    )
    openai_input = st.text_input(
        "OpenAI API Key (Optional)",
        value=st.session_state.api_keys["openai"],
        type="password",
        help="Optional if you wish to use OpenAI Whisper API instead of local CPU transcription."
    )
    
    st.markdown("### ⚙️ Video Processing Parameters")
    intervals = st.text_input(
        "Keyframe Extraction Timestamps (comma separated seconds)",
        value="0, 3, 5, 10, 15, 20, 30"
    )
    
    save_btn = st.button("Save Settings")
    if save_btn:
        st.session_state.api_keys["gemini"] = gemini_input
        st.session_state.api_keys["openai"] = openai_input
        st.success("Settings updated successfully!")

# Render correct page based on sidebar routing
if st.session_state.page == "Home":
    render_home()
elif st.session_state.page == "Analyze Video":
    render_analyze()
elif st.session_state.page == "Analysis History":
    render_history()
elif st.session_state.page == "Insights Dashboard":
    render_insights()
elif st.session_state.page == "Settings":
    render_settings()
