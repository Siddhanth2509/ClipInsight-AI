"""
pdf_generator.py — Themed PDF report generator using ReportLab
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 REPORTLAB BASICS:
   ReportLab is a pure-Python PDF library — no browser, no headless Chrome.
   It draws PDFs using a coordinate system where (0,0) is the BOTTOM-LEFT.
   All measurements are in points (1 point = 1/72 inch).

   Key objects:
   • Canvas    — low-level drawing (shapes, text, images)
   • Paragraph — flow-aware text that wraps automatically
   • SimpleDocTemplate — high-level page layout engine
   • Spacer, Table, Image — layout building blocks

📚 THEME SUPPORT:
   Each UI theme maps to a color palette here. The frontend passes
   `?theme=purple` (or any other key) and the PDF adopts those colors.
   Ice White is the only light-mode theme — it gets a white background.
"""

import io
from pathlib import Path
from datetime import datetime
from backend.src.config import TEMP_DIR


# ── Theme palettes ────────────────────────────────────────────────────────────
# Each entry: (accent_hex, accent_light_hex, bg_dark_hex, bg_card_hex, is_light_mode)
THEME_PALETTES = {
    "purple": {
        "accent":      (0.486, 0.361, 0.988),  # #7C5CFC
        "accent_light":(0.706, 0.620, 1.000),  # #B49EFF
        "bg_dark":     (0.008, 0.043, 0.094),  # #020B18
        "bg_card":     (0.047, 0.078, 0.149),  # #0C1426
        "cover_txt":   (0.973, 0.980, 0.988),  # #F8FAFC near white
        "light_mode":  False,
    },
    "ocean-blue": {
        "accent":      (0.012, 0.412, 0.631),  # #0369A1
        "accent_light":(0.055, 0.647, 0.914),  # #0EA5E9
        "bg_dark":     (0.004, 0.039, 0.082),  # #010A15
        "bg_card":     (0.012, 0.063, 0.125),  # #031020
        "cover_txt":   (0.973, 0.980, 0.988),
        "light_mode":  False,
    },
    "emerald-green": {
        "accent":      (0.020, 0.588, 0.412),  # #059669
        "accent_light":(0.078, 0.839, 0.604),  # #14D49A
        "bg_dark":     (0.004, 0.043, 0.020),  # #010B05
        "bg_card":     (0.008, 0.078, 0.039),  # #02140A
        "cover_txt":   (0.973, 0.980, 0.988),
        "light_mode":  False,
    },
    "sunset-orange": {
        "accent":      (0.918, 0.353, 0.047),  # #EA580C
        "accent_light":(1.000, 0.569, 0.220),  # #FF9138
        "bg_dark":     (0.071, 0.024, 0.004),  # #120601
        "bg_card":     (0.118, 0.047, 0.008),  # #1E0C02
        "cover_txt":   (0.973, 0.980, 0.988),
        "light_mode":  False,
    },
    "royal-gold": {
        "accent":      (0.706, 0.325, 0.035),  # #B45309
        "accent_light":(0.961, 0.788, 0.416),  # #F5C96A
        "bg_dark":     (0.055, 0.039, 0.004),  # #0E0A01
        "bg_card":     (0.094, 0.067, 0.008),  # #181102
        "cover_txt":   (0.973, 0.980, 0.988),
        "light_mode":  False,
    },
    "rose-pink": {
        "accent":      (0.745, 0.094, 0.365),  # #BE185D
        "accent_light":(1.000, 0.439, 0.678),  # #FF70AD
        "bg_dark":     (0.071, 0.008, 0.035),  # #120209
        "bg_card":     (0.118, 0.020, 0.059),  # #1E050F
        "cover_txt":   (0.973, 0.980, 0.988),
        "light_mode":  False,
    },
    "ice-white": {
        "accent":      (0.020, 0.455, 0.816),  # #0574D0
        "accent_light":(0.357, 0.639, 0.914),  # #5BA3E9
        "bg_dark":     (0.910, 0.957, 0.973),  # #E8F4F8
        "bg_card":     (1.000, 1.000, 1.000),  # #FFFFFF
        "cover_txt":   (0.067, 0.094, 0.149),  # #111826
        "light_mode":  True,
    },
}

# Default (purple) for unknown theme keys
_DEFAULT_THEME = "purple"


def generate_pdf_report(result: dict, theme: str = "purple") -> bytes:
    """
    Generate a beautiful branded PDF report from an analysis result dict.

    Args:
        result: The full analysis result dict from the AI pipeline.
        theme:  The active UI theme name (e.g. "purple", "ocean-blue").

    Returns:
        Raw PDF bytes ready to be streamed as a file download.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.colors import Color, HexColor
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
            HRFlowable, KeepTogether, PageBreak, Image
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.pdfgen import canvas as rl_canvas
    except ImportError:
        return _fallback_text_report(result)

    palette  = THEME_PALETTES.get(theme, THEME_PALETTES[_DEFAULT_THEME])
    is_light = palette["light_mode"]

    c_accent  = Color(*palette["accent"])
    c_light   = Color(*palette["accent_light"])
    c_dark    = Color(*palette["bg_dark"])
    c_card    = Color(*palette["bg_card"])
    c_cover_t = Color(*palette["cover_txt"])

    # Text colors adapt for light vs dark mode
    if is_light:
        c_text  = Color(0.067, 0.094, 0.149)
        c_muted = Color(0.380, 0.420, 0.490)
        c_card_bg = HexColor("#FFFFFF")
        c_page_bg = HexColor("#E8F4F8")
    else:
        c_text  = Color(0.973, 0.980, 0.988)
        c_muted = Color(0.490, 0.557, 0.655)
        c_card_bg = Color(*palette["bg_card"])
        c_page_bg = Color(*palette["bg_dark"])

    buf = io.BytesIO()

    # ── Custom canvas for dark backgrounds ────────────────────────────────────
    class ThemedCanvas(rl_canvas.Canvas):
        def __init__(self, filename, **kwargs):
            super().__init__(filename, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_bg_and_page()
                super().showPage()
            super().save()

        def _draw_bg_and_page(self):
            """Draw dark (or light) background on every page."""
            self.saveState()
            self.setFillColor(c_page_bg)
            self.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
            self.restoreState()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
        topMargin=2.5*cm,  bottomMargin=2.5*cm,
        title="ClipInsight AI Analysis Report",
        author="ClipInsight AI",
    )

    W = A4[0]

    # ── Text styles ───────────────────────────────────────────────────────────
    h1 = ParagraphStyle("H1", fontSize=28, textColor=c_accent,
                         spaceAfter=4, spaceBefore=0, leading=32,
                         fontName="Helvetica-Bold")
    h2 = ParagraphStyle("H2", fontSize=14, textColor=c_accent,
                         spaceAfter=6, spaceBefore=14, leading=18,
                         fontName="Helvetica-Bold")
    body = ParagraphStyle("Body", fontSize=10, textColor=c_text,
                           spaceAfter=6, leading=15, fontName="Helvetica")
    label_s = ParagraphStyle("Label", fontSize=8, textColor=c_muted,
                               spaceAfter=2, leading=10,
                               fontName="Helvetica", textTransform="uppercase",
                               letterSpacing=1.2)

    cover_title_style = ParagraphStyle(
        "CoverTitle", fontSize=36, textColor=c_accent, fontName="Helvetica-Bold",
        alignment=TA_CENTER, spaceAfter=12, leading=42
    )
    cover_subtitle_style = ParagraphStyle(
        "CoverSubtitle", fontSize=16, textColor=c_muted, fontName="Helvetica",
        alignment=TA_CENTER, spaceAfter=40, leading=20
    )
    cover_meta_label = ParagraphStyle(
        "CoverMetaLabel", fontSize=9, textColor=c_muted, fontName="Helvetica-Bold",
        leading=14, spaceAfter=2
    )
    cover_meta_val = ParagraphStyle(
        "CoverMetaVal", fontSize=11, textColor=c_text, fontName="Helvetica",
        leading=16, spaceAfter=14
    )

    story = []

    # ── Cover Page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("<font size=48>✦</font>",
                            ParagraphStyle("Logo", alignment=TA_CENTER, spaceAfter=20,
                                           textColor=c_accent)))
    story.append(Paragraph("ClipInsight AI", cover_title_style))
    story.append(Paragraph("Short-Form Video Analysis Report", cover_subtitle_style))
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="60%", thickness=2, color=c_accent,
                             spaceAfter=40, hAlign="CENTER"))

    # Metadata box
    meta_tbl_data = [
        [Paragraph("REPORT DETAILS", ParagraphStyle(
            "HMeta", fontSize=10, textColor=c_accent,
            fontName="Helvetica-Bold", spaceAfter=8))],
        [Paragraph("ANALYZED ON", cover_meta_label)],
        [Paragraph(datetime.now().strftime("%B %d, %Y  ·  %I:%M %p"), cover_meta_val)],
        [Paragraph("CATEGORY", cover_meta_label)],
        [Paragraph(result.get("content_category", "General"), cover_meta_val)],
        [Paragraph("HOOK SCORE", cover_meta_label)],
        [Paragraph(f"{result.get('hook_score', 0)}/100", cover_meta_val)],
        [Paragraph("THEME", cover_meta_label)],
        [Paragraph(theme.replace("-", " ").title(), cover_meta_val)],
    ]
    meta_tbl = Table(meta_tbl_data, colWidths=[10 * cm], hAlign="CENTER")
    meta_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), c_card_bg),
        ("PADDING", (0, 0), (-1, -1), 16),
        ("BOX", (0, 0), (-1, -1), 1, c_light),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph(
        f"ClipInsight AI  ·  {theme.replace('-', ' ').upper()} EDITION",
        ParagraphStyle("CoverFooter", fontSize=8, textColor=c_muted,
                       alignment=TA_CENTER, fontName="Helvetica", letterSpacing=2)))
    story.append(PageBreak())

    # ── Page 2+ Header ────────────────────────────────────────────────────────
    story.append(Paragraph("✦ ClipInsight AI", h1))
    story.append(Paragraph("Analysis Report", ParagraphStyle(
        "Sub", fontSize=12, textColor=c_muted, spaceAfter=16, leading=16,
        fontName="Helvetica")))
    story.append(HRFlowable(width="100%", thickness=1, color=c_accent, spaceAfter=20))

    # ── Stats Row ─────────────────────────────────────────────────────────────
    hook  = result.get("hook_score", 0)
    dur   = result.get("duration_seconds", 0)
    frames= result.get("frame_count", 0)
    words = result.get("word_count", 0)
    sent  = result.get("sentiment", "Neutral")
    cat   = result.get("content_category", "General")

    def _cell(txt, is_val=False):
        st = ParagraphStyle(
            "C", fontSize=9 if not is_val else 18,
            textColor=c_accent if is_val else c_muted,
            fontName="Helvetica-Bold" if is_val else "Helvetica",
            leading=12 if not is_val else 22, alignment=TA_CENTER,
        )
        return Paragraph(txt, st)

    tbl_data = [
        [_cell("HOOK SCORE"), _cell("DURATION"), _cell("FRAMES SAMPLED")],
        [_cell(f"{hook}/100", True), _cell(f"{dur}s", True), _cell(str(frames), True)],
        [_cell("SENTIMENT"), _cell("CATEGORY"), _cell("EST. WATCH TIME")],
        [_cell(sent, True), _cell(cat, True), _cell(result.get("estimated_watch_time", "—"), True)],
    ]

    tbl = Table(tbl_data, colWidths=[(W - 5*cm) / 3] * 3)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), c_card_bg),
        ("BOX",           (0, 0), (-1, -1), 0.5, c_light),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, c_light),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 18))

    # ── Hook Score Bar ────────────────────────────────────────────────────────
    story.append(Paragraph("HOOK SCORE", label_s))
    if hook > 0:
        bar_tbl = Table([[" " * int(hook * 0.45), " " * int((100 - hook) * 0.45)]],
                         colWidths=[hook * 3.8, (100 - hook) * 3.8])
        bar_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), c_accent),
            ("BACKGROUND",    (1, 0), (1, 0), c_card_bg),
            ("ROWHEIGHT",     (0, 0), (-1, -1), 12),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))
        story.append(bar_tbl)
    story.append(Spacer(1, 20))

    # ── Summary ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_light, spaceAfter=10))
    story.append(Paragraph("Summary", h2))
    story.append(Paragraph(result.get("summary", ""), body))
    story.append(Spacer(1, 8))

    # ── Referenced Media ──────────────────────────────────────────────────────
    ref_media = result.get("referenced_media")
    if ref_media:
        story.append(Paragraph("REFERENCED MEDIA", label_s))
        story.append(Paragraph(ref_media, body))
        story.append(Spacer(1, 8))

    # ── Target Audience ───────────────────────────────────────────────────────
    story.append(Paragraph("TARGET AUDIENCE", label_s))
    story.append(Paragraph(result.get("target_audience", ""), body))

    # ── Hook Analysis ─────────────────────────────────────────────────────────
    if result.get("hook_analysis"):
        story.append(Paragraph("HOOK ANALYSIS", label_s))
        story.append(Paragraph(result["hook_analysis"], body))

    # ── Tags ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10))
    story.append(Paragraph("Tags & Keywords", h2))
    tags = result.get("tags", [])
    if tags:
        tag_text = "  ".join([f"#{t}" for t in tags])
        story.append(Paragraph(tag_text, ParagraphStyle(
            "Tags", fontSize=10, textColor=c_accent, spaceAfter=8, leading=16,
            fontName="Helvetica-Bold")))

    topics = result.get("topics", [])
    if topics:
        story.append(Paragraph("TOPICS", label_s))
        for topic in topics:
            story.append(Paragraph(f"• {topic}", body))

    # ── Improvement Suggestions ───────────────────────────────────────────────
    story.append(Spacer(1, 8))
    story.append(Paragraph("Improvement Suggestions", h2))
    for i, s in enumerate(result.get("suggestions", []), 1):
        story.append(Paragraph(f"<b>{i}.</b>  {s}", body))

    # ── Music ─────────────────────────────────────────────────────────────────
    music = result.get("music", {})
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_light, spaceAfter=10))
    story.append(Paragraph("Background Music", h2))
    if music.get("detected"):
        inferred_str = " (AI Inferred)" if music.get("inferred") else ""
        story.append(Paragraph(
            f"<b>{music.get('song_title', '')}</b>  ·  {music.get('artist', '')}{inferred_str}", body))
        if music.get("album"):
            story.append(Paragraph(f"Album: {music['album']}", body))
        if music.get("genre"):
            story.append(Paragraph(f"Genre: {music['genre']}", body))
        if music.get("explanation"):
            expl_style = ParagraphStyle("Expl", fontSize=9, textColor=c_muted,
                                         fontName="Helvetica-Oblique", leading=11, spaceBefore=4)
            story.append(Paragraph(f"AI Note: {music['explanation']}", expl_style))
    else:
        story.append(Paragraph("No music detected in this video.", body))

    # ── Transcript ────────────────────────────────────────────────────────────
    transcript = result.get("transcript", "").strip()
    if transcript:
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=0.5, color=c_light, spaceAfter=10))
        story.append(Paragraph("Transcript", h2))
        if len(transcript) > 2000:
            transcript = transcript[:2000] + "…  [truncated]"
        story.append(Paragraph(transcript, body))

    # ── Visual Frames Grid ────────────────────────────────────────────────────
    raw_frames = result.get("frames", [])
    if raw_frames:
        frames_story = []
        frames_story.append(Spacer(1, 8))
        frames_story.append(HRFlowable(width="100%", thickness=0.5, color=c_light, spaceAfter=10))
        frames_story.append(Paragraph("Visual Frame Highlights", h2))

        step       = max(1, len(raw_frames) // 6)
        key_frames = raw_frames[::step][:6]

        grid_data = []
        row = []
        for frame in key_frames:
            img_path = TEMP_DIR / frame["path"]
            if img_path.exists():
                try:
                    img_w, img_h = 140, 78
                    img = Image(str(img_path), width=img_w, height=img_h)
                    ts  = frame.get("timestamp", 0)
                    lbl = Paragraph(f"At {ts:.1f}s", ParagraphStyle(
                        "T", fontSize=8, textColor=c_muted, alignment=TA_CENTER))
                    cell = [img, Spacer(1, 2), lbl]
                    row.append(cell)
                except Exception as ex:
                    print(f"[WARN] Failed to load frame image for PDF: {ex}")

            if len(row) == 3:
                grid_data.append(row)
                row = []
        if row:
            while len(row) < 3:
                row.append("")
            grid_data.append(row)

        if grid_data:
            grid_tbl = Table(grid_data, colWidths=[(W - 5*cm) / 3] * 3)
            grid_tbl.setStyle(TableStyle([
                ("ALIGN",          (0, 0), (-1, -1), "CENTER"),
                ("VALIGN",         (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING",  (0, 0), (-1, -1), 12),
                ("BACKGROUND",     (0, 0), (-1, -1), c_card_bg),
            ]))
            frames_story.append(grid_tbl)

        story.append(KeepTogether(frames_story))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_light, spaceAfter=8))
    story.append(Paragraph(
        f"Generated by ClipInsight AI  ·  {theme.replace('-', ' ').upper()} EDITION  ·  "
        f"{datetime.now().strftime('%B %d, %Y')}",
        ParagraphStyle("Footer", fontSize=8, textColor=c_muted, alignment=TA_CENTER,
                       fontName="Helvetica")))

    doc.build(story, canvasmaker=ThemedCanvas)
    return buf.getvalue()


def _fallback_text_report(result: dict) -> bytes:
    """Minimal fallback if reportlab is not available."""
    lines = [
        "ClipInsight AI Analysis Report",
        "=" * 40,
        f"Hook Score: {result.get('hook_score', 0)}/100",
        f"Sentiment:  {result.get('sentiment', '')}",
        f"Summary:    {result.get('summary', '')}",
        "",
        "Suggestions:",
        *[f"  {i+1}. {s}" for i, s in enumerate(result.get("suggestions", []))],
    ]
    return "\n".join(lines).encode("utf-8")
