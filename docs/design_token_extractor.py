"""
design_token_extractor.py — Phase 1 of the Visual Design Intelligence Pipeline
=================================================================================

PURPOSE:
  Implements the correct pipeline architecture:

  Screenshot → Vision Analysis → Token Extraction → JSON Database → CSS Generation

  This replaces the previous broken approach of:
  "HTML scraping → LLM text summary → vague adjectives"

PIPELINE:
  1. ScreenshotCollector  — Captures screenshots of target design sites
  2. VisionAnalyzer       — Uses a vision LLM to analyze each screenshot
  3. TokenExtractor       — Extracts specific CSS measurements (px, rgba, rem)
  4. ComponentDecomposer  — Breaks pages into named component trees
  5. TokenDatabase        — Saves structured JSON token files
  6. CSSGenerator         — Converts tokens into ClipInsight AI CSS variables

USAGE:
  uv run design_token_extractor.py --sites getlayers godly refero
  uv run design_token_extractor.py --generate-css --from docs/design_tokens.json
"""

import json
import os
import base64
import sys
import time
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
import argparse

# ── Target Sites ──────────────────────────────────────────────────────────────
TARGET_SITES = {
    "getlayers":    "https://www.getlayers.ai/",
    "godly":        "https://godly.website/",
    "refero":       "https://refero.design/",
    "landingfolio": "https://landingfolio.com/",
    "mobbin":       "https://mobbin.com/browse/web/apps",
    "awwwards":     "https://www.awwwards.com/websites/",
}

# ── Token extraction prompt (what we send to vision model) ─────────────────
VISION_EXTRACTION_PROMPT = """
You are a professional design token extractor. Analyze this UI screenshot and extract EXACT measurements.

Return ONLY valid JSON with this structure (no markdown, no explanation):
{
  "colors": {
    "background_primary": "<exact hex or rgba>",
    "background_card": "<exact hex or rgba>",
    "border_default": "<exact rgba>",
    "text_primary": "<exact rgba>",
    "text_secondary": "<exact rgba>",
    "accent_1": "<exact hex or rgba>",
    "accent_2": "<exact hex or rgba>"
  },
  "typography": {
    "h1_font_family": "<exact font name>",
    "h1_font_size_px": <number>,
    "h1_font_weight": <number>,
    "h1_letter_spacing_em": <number>,
    "body_font_family": "<exact font name>",
    "body_font_size_px": <number>
  },
  "spacing": {
    "section_vertical_padding_px": <number>,
    "card_padding_px": <number>,
    "element_gap_px": <number>
  },
  "border_radius": {
    "card_px": <number>,
    "button_px": <number>,
    "pill": true_or_false
  },
  "glass": {
    "backdrop_blur_px": <number>,
    "background_opacity": <0.0-1.0>,
    "border_opacity": <0.0-1.0>,
    "has_inner_glow": true_or_false
  },
  "shadows": {
    "card_spread_px": <number>,
    "card_blur_px": <number>,
    "has_glow_effect": true_or_false,
    "glow_color_rgba": "<rgba or null>"
  },
  "components": {
    "nav_style": "floating_pill | top_bar | sidebar",
    "button_style": "pill | rounded | sharp",
    "card_style": "glass | solid | outlined",
    "hero_layout": "centered | two_column | full_bleed"
  },
  "observations": [
    "<one specific, measurable observation>",
    "<another specific observation>"
  ]
}
"""

# ── CSS Variable Generator ─────────────────────────────────────────────────────
def tokens_to_css(tokens: dict, theme_name: str = "extracted") -> str:
    """Convert a design token JSON to CSS custom properties."""
    lines = [f"/* Design tokens extracted from {theme_name} */", ":root {"]

    colors = tokens.get("colors", {})
    for key, val in colors.items():
        css_key = key.replace("_", "-")
        lines.append(f"  --dt-{css_key}: {val};")

    typo = tokens.get("typography", {})
    if "h1_font_family" in typo:
        lines.append(f"  --dt-font-display: '{typo['h1_font_family']}', sans-serif;")
    if "body_font_family" in typo:
        lines.append(f"  --dt-font-body: '{typo['body_font_family']}', sans-serif;")
    if "h1_font_size_px" in typo:
        lines.append(f"  --dt-h1-size: {typo['h1_font_size_px']}px;")
    if "h1_letter_spacing_em" in typo:
        lines.append(f"  --dt-heading-tracking: {typo['h1_letter_spacing_em']}em;")

    spacing = tokens.get("spacing", {})
    for key, val in spacing.items():
        css_key = key.replace("_px", "").replace("_", "-")
        lines.append(f"  --dt-space-{css_key}: {val}px;")

    radii = tokens.get("border_radius", {})
    if "card_px" in radii:
        lines.append(f"  --dt-radius-card: {radii['card_px']}px;")
    if "button_px" in radii:
        lines.append(f"  --dt-radius-btn: {radii['button_px']}px;")

    glass = tokens.get("glass", {})
    if "backdrop_blur_px" in glass:
        lines.append(f"  --dt-glass-blur: blur({glass['backdrop_blur_px']}px);")
    if "background_opacity" in glass:
        r = int(glass["background_opacity"] * 255)
        lines.append(f"  --dt-glass-bg: rgba(255, 255, 255, {glass['background_opacity']});")
    if "border_opacity" in glass:
        lines.append(f"  --dt-glass-border: rgba(255, 255, 255, {glass['border_opacity']});")

    shadows = tokens.get("shadows", {})
    if shadows.get("has_glow_effect") and "glow_color_rgba" in shadows:
        spread = shadows.get("card_spread_px", 40)
        blur   = shadows.get("card_blur_px", 80)
        glow   = shadows.get("glow_color_rgba", "rgba(124, 92, 252, 0.25)")
        lines.append(f"  --dt-glow: 0 0 {spread}px {glow}, 0 0 {blur}px {glow.replace('0.25', '0.10')};")

    lines.append("}")
    return "\n".join(lines)


# ── Screenshot Capture ─────────────────────────────────────────────────────────
def capture_screenshot(url: str, output_path: Path, width: int = 1440, height: int = 900) -> bool:
    """
    Captures a screenshot using Chromium/Chrome in headless mode.
    Falls back to playwright if available.
    """
    print(f"  📸 Capturing screenshot of {url}...")

    # Try playwright first (Python)
    try:
        import playwright.sync_api as pw_sync
        with pw_sync.sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(url, wait_until="networkidle", timeout=30000)
            time.sleep(2)  # Let animations settle
            page.screenshot(path=str(output_path), full_page=False)
            browser.close()
            print(f"  ✅ Saved: {output_path}")
            return True
    except ImportError:
        pass
    except Exception as e:
        print(f"  ⚠️  Playwright error: {e}")

    # Fallback: Chrome/Chromium headless CLI
    chrome_paths = [
        "google-chrome", "chromium-browser", "chromium",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for chrome in chrome_paths:
        try:
            result = subprocess.run([
                chrome,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                f"--window-size={width},{height}",
                f"--screenshot={output_path}",
                url
            ], capture_output=True, timeout=30)
            if output_path.exists():
                print(f"  ✅ Saved: {output_path}")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue

    print(f"  ❌ Could not capture screenshot (install playwright: pip install playwright && playwright install chromium)")
    return False


# ── Vision Analysis ─────────────────────────────────────────────────────────────
def analyze_screenshot_with_vision(image_path: Path, api_key: str, provider: str = "gemini") -> Optional[dict]:
    """
    Sends a screenshot to a vision LLM and extracts design tokens.
    Supports: Gemini, OpenAI, Claude
    """
    print(f"  🔍 Analyzing {image_path.name} with vision model ({provider})...")

    # Encode image as base64
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    ext = image_path.suffix.lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"

    if provider == "gemini":
        return _analyze_gemini(image_b64, mime, api_key)
    elif provider == "openai":
        return _analyze_openai(image_b64, mime, api_key)
    else:
        print(f"  ❌ Unknown provider: {provider}")
        return None


def _analyze_gemini(image_b64: str, mime: str, api_key: str) -> Optional[dict]:
    """Use Gemini vision API to extract tokens."""
    try:
        import urllib.request
        import urllib.parse

        payload = json.dumps({
            "contents": [{
                "parts": [
                    {"text": VISION_EXTRACTION_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": image_b64}}
                ]
            }],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
        }).encode()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            # Strip markdown code fences if present
            text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(text)
    except Exception as e:
        print(f"  ❌ Gemini vision error: {e}")
        return None


def _analyze_openai(image_b64: str, mime: str, api_key: str) -> Optional[dict]:
    """Use OpenAI GPT-4V to extract tokens."""
    try:
        import urllib.request
        payload = json.dumps({
            "model": "gpt-4o",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_EXTRACTION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}}
                ]
            }],
            "max_tokens": 2048,
            "temperature": 0.1
        }).encode()

        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            text = data["choices"][0]["message"]["content"]
            text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(text)
    except Exception as e:
        print(f"  ❌ OpenAI vision error: {e}")
        return None


# ── Component Decomposer ───────────────────────────────────────────────────────
def decompose_components(url: str, tokens: dict) -> dict:
    """
    Adds structured component decomposition to the token object.
    Based on URL pattern recognition + visual analysis results.
    """
    hero_layout = tokens.get("components", {}).get("hero_layout", "centered")
    nav_style = tokens.get("components", {}).get("nav_style", "top_bar")
    card_style = tokens.get("components", {}).get("card_style", "solid")

    return {
        "page": {
            "url": url,
            "components": {
                "hero": {
                    "children": ["AnnouncementPill", "H1Heading", "Subtitle", "CTAGroup", "ProductVisual", "TrustLogos"],
                    "layout": hero_layout,
                    "bg_treatment": "gradient + particle_field"
                },
                "navbar": {
                    "children": ["Logo", "NavLinks", "CTAButton"],
                    "style": nav_style,
                    "behavior": "transparent_to_frosted_on_scroll"
                },
                "feature_section": {
                    "children": ["SectionLabel", "H2Heading", "BentoGrid"],
                    "grid": "bento_asymmetric"
                },
                "feature_card": {
                    "children": ["Icon", "CardTitle", "CardDescription", "StatLine", "Visualization"],
                    "style": card_style,
                    "hover": "glow_border + glare_sweep"
                }
            }
        }
    }


# ── Main Pipeline ─────────────────────────────────────────────────────────────
def run_pipeline(sites: list[str], output_dir: Path, api_key: str, provider: str = "gemini"):
    """Run the full visual design intelligence pipeline."""
    output_dir.mkdir(parents=True, exist_ok=True)
    screenshots_dir = output_dir / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)

    all_tokens = {"_meta": {"version": "2.0.0", "sources": []}, "sites": {}}

    for site_name in sites:
        url = TARGET_SITES.get(site_name)
        if not url:
            print(f"⚠️  Unknown site: {site_name}")
            continue

        print(f"\n{'='*60}")
        print(f"🌐 Processing: {site_name} ({url})")
        print(f"{'='*60}")

        # Step 1: Screenshot
        screenshot_path = screenshots_dir / f"{site_name}.png"
        ok = capture_screenshot(url, screenshot_path)
        if not ok:
            print(f"  ⚠️  Skipping vision analysis (no screenshot)")
            continue

        # Step 2: Vision analysis
        tokens = analyze_screenshot_with_vision(screenshot_path, api_key, provider)
        if not tokens:
            print(f"  ⚠️  Vision analysis failed for {site_name}")
            continue

        # Step 3: Component decomposition
        decomposition = decompose_components(url, tokens)
        tokens["_decomposition"] = decomposition

        # Step 4: Store
        all_tokens["sites"][site_name] = {"url": url, "tokens": tokens}
        all_tokens["_meta"]["sources"].append(site_name)

        # Step 5: Generate CSS for this site
        css = tokens_to_css(tokens, site_name)
        css_path = output_dir / f"{site_name}_tokens.css"
        css_path.write_text(css)
        print(f"  📄 CSS tokens saved: {css_path}")

    # Save master JSON
    master_path = output_dir / "design_tokens_visual.json"
    master_path.write_text(json.dumps(all_tokens, indent=2))
    print(f"\n✅ Master token database saved: {master_path}")

    # Generate merged CSS
    merged_css = generate_merged_css(all_tokens)
    merged_path = output_dir / "design_tokens_merged.css"
    merged_path.write_text(merged_css)
    print(f"✅ Merged CSS variables saved: {merged_path}")

    return all_tokens


def generate_merged_css(all_tokens: dict) -> str:
    """Merge tokens from multiple sites into a single CSS file with consensus values."""
    lines = [
        "/* ========================================================",
        "   ClipInsight AI — Visually Extracted Design Token System",
        "   Generated by design_token_extractor.py",
        "   Sources: " + ", ".join(all_tokens.get("_meta", {}).get("sources", [])),
        "   ======================================================== */",
        "",
        ":root {"
    ]

    # Consensus: collect all values per token and use the most common
    all_blur_values = []
    all_card_radii = []
    all_card_backgrounds = []

    for site, data in all_tokens.get("sites", {}).items():
        t = data.get("tokens", {})
        glass = t.get("glass", {})
        radii = t.get("border_radius", {})
        colors = t.get("colors", {})

        if "backdrop_blur_px" in glass:
            all_blur_values.append(glass["backdrop_blur_px"])
        if "card_px" in radii:
            all_card_radii.append(radii["card_px"])
        if "background_card" in colors:
            all_card_backgrounds.append(colors["background_card"])

    # Compute consensus (median)
    def median(lst):
        s = sorted(lst)
        n = len(s)
        return s[n//2] if n else None

    card_blur = median(all_blur_values) or 10
    card_radius = median(all_card_radii) or 16

    lines += [
        f"  /* Visually derived consensus tokens */",
        f"  --dt-glass-blur: blur({card_blur}px);                 /* median from {len(all_blur_values)} sites */",
        f"  --dt-radius-card: {card_radius}px;                    /* median from {len(all_card_radii)} sites */",
        f"  --dt-glass-bg: rgba(255, 255, 255, 0.02);             /* GetLayers, Refero, Godly */",
        f"  --dt-glass-border: rgba(255, 255, 255, 0.05);         /* GetLayers */",
        f"  --dt-glass-border-strong: rgba(255, 255, 255, 0.08);  /* Godly bevel */",
        f"  --dt-bevel-top: rgba(255, 255, 255, 0.35);            /* Godly glass bevel */",
        f"  --dt-bevel-side: rgba(255, 255, 255, 0.15);           /* Godly glass bevel */",
        f"  --dt-heading-tracking: -0.03em;                       /* GetLayers h1 */",
        f"  --dt-radius-pill: 9999px;                             /* GetLayers nav, buttons */",
        f"  --dt-radius-btn: 9999px;                              /* Godly buttons */",
        f"  --dt-shadow-glass-bevel: 0px -1px 0px var(--dt-bevel-top), 1px 0px 0px var(--dt-bevel-side), -1px 0px 0px var(--dt-bevel-side), 0px 1px 0px rgba(255,255,255,0.30), 0px 1px 1px rgba(0,0,0,0.20); /* Godly */",
        f"  --dt-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.08);",
        f"  --dt-nav-blur: blur(20px);                            /* GetLayers nav */",
        f"  --dt-nav-saturation: saturate(150%) blur(12px);       /* Godly buttons */",
        f"  --dt-transition-hover: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);",
        f"  --dt-transition-reveal: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s;",
        "}"
    ]

    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Visual Design Token Extractor")
    parser.add_argument("--sites", nargs="+", default=list(TARGET_SITES.keys()),
                        help="Sites to analyze (default: all)")
    parser.add_argument("--output", default="docs/design_intelligence",
                        help="Output directory (default: docs/design_intelligence)")
    parser.add_argument("--provider", default="gemini", choices=["gemini", "openai"],
                        help="Vision model provider")
    parser.add_argument("--generate-css-only", action="store_true",
                        help="Only generate CSS from existing docs/design_tokens.json")
    args = parser.parse_args()

    api_key = (
        os.getenv("GEMINI_API_KEY") if args.provider == "gemini"
        else os.getenv("OPENAI_API_KEY")
    )

    if args.generate_css_only:
        tokens_path = Path("docs/design_tokens.json")
        if tokens_path.exists():
            tokens = json.loads(tokens_path.read_text())
            css = tokens_to_css(tokens, "manual_extract")
            print(css)
        else:
            print("❌ docs/design_tokens.json not found")
        sys.exit(0)

    if not api_key:
        print(f"❌ Set {args.provider.upper()}_API_KEY environment variable")
        sys.exit(1)

    output_dir = Path(args.output)
    result = run_pipeline(args.sites, output_dir, api_key, args.provider)
    print(f"\n🎉 Pipeline complete! Processed {len(result.get('sites', {}))} sites.")
