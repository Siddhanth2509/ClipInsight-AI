"""
pdf_generator.py — Branded PDF report generator using ReportLab
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
"""

import io
from pathlib import Path
from datetime import datetime
from backend.src.config import TEMP_DIR


# ── Sakura color palette (matches the UI) ─────────────────────────────────────
SAKURA_PINK   = (0.91, 0.33, 0.48)   # #E8557A  — hot pink
SAKURA_BLUSH  = (1.00, 0.72, 0.77)   # #FFB7C5  — light blush
SAKURA_PALE   = (1.00, 0.89, 0.93)   # #FFE4EE  — very pale
DARK_BG       = (0.06, 0.04, 0.13)   # #0F0A22  — dark navy
TEXT_MAIN     = (0.95, 0.92, 0.97)   # #F2EBFA  — near-white
TEXT_MUTED    = (0.60, 0.55, 0.68)   # #998CAD  — muted


def generate_pdf_report(result: dict) -> bytes:
    """
    Generate a beautiful branded PDF report from an analysis result dict.

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
    except ImportError:
        # Fallback: return a plain-text "PDF" if reportlab not available
        return _fallback_text_report(result)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
        topMargin=2.5*cm,  bottomMargin=2.5*cm,
        title="ClipInsight AI Analysis Report",
        author="ClipInsight AI",
    )

    W = A4[0]

    # ── Styles ─────────────────────────────────────────────────────────────────
    c_pink   = Color(*SAKURA_PINK)
    c_blush  = Color(*SAKURA_BLUSH)
    c_dark   = Color(*DARK_BG)
    c_text   = Color(0.15, 0.10, 0.25)
    c_muted  = Color(*TEXT_MUTED)

    styles = getSampleStyleSheet()

    h1 = ParagraphStyle("H1", fontSize=28, textColor=c_pink,
                         spaceAfter=4, spaceBefore=0, leading=32,
                         fontName="Helvetica-Bold")
    h2 = ParagraphStyle("H2", fontSize=14, textColor=c_pink,
                         spaceAfter=6, spaceBefore=14, leading=18,
                         fontName="Helvetica-Bold")
    body = ParagraphStyle("Body", fontSize=10, textColor=c_text,
                           spaceAfter=6, leading=15, fontName="Helvetica")
    label_s = ParagraphStyle("Label", fontSize=8, textColor=c_muted,
                              spaceAfter=2, leading=10,
                              fontName="Helvetica", textTransform="uppercase",
                              letterSpacing=1.2)
    tag_s   = ParagraphStyle("Tag", fontSize=9, textColor=c_pink,
                               spaceAfter=0, leading=12, fontName="Helvetica-Bold")

    cover_title_style = ParagraphStyle(
        "CoverTitle", fontSize=36, textColor=c_pink, fontName="Helvetica-Bold",
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
    # Branded Accent Circle / Kanji
    story.append(Paragraph("<font size=48>🌸</font>", ParagraphStyle("Logo", alignment=TA_CENTER, spaceAfter=20)))
    story.append(Paragraph("ClipInsight AI", cover_title_style))
    story.append(Paragraph("Short-Form Video Analysis Report", cover_subtitle_style))
    story.append(Spacer(1, 0.5 * cm))
    
    # Branded Divider Line
    story.append(HRFlowable(width="60%", thickness=2, color=c_pink, spaceAfter=40, hAlign="CENTER"))
    
    # Metadata Box
    meta_table_data = [
        [Paragraph("REPORT DETAILS", ParagraphStyle("HMeta", fontSize=10, textColor=c_pink, fontName="Helvetica-Bold", spaceAfter=8))],
        [Paragraph("ANALYZED ON", cover_meta_label)],
        [Paragraph(datetime.now().strftime("%B %d, %Y  ·  %I:%M %p"), cover_meta_val)],
        [Paragraph("CATEGORY", cover_meta_label)],
        [Paragraph(result.get("content_category", "General"), cover_meta_val)],
        [Paragraph("HOOK SCORE", cover_meta_label)],
        [Paragraph(f"{result.get('hook_score', 0)}/100", cover_meta_val)]
    ]
    meta_table = Table(meta_table_data, colWidths=[10 * cm], hAlign="CENTER")
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#FAF1F4")),
        ("PADDING", (0,0), (-1,-1), 16),
        ("BOX", (0,0), (-1,-1), 1, c_blush),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 2 * cm))
    
    story.append(Paragraph("桜の知恵  ·  WISDOM OF THE CHERRY BLOSSOM", ParagraphStyle("CoverFooter", fontSize=8, textColor=c_muted, alignment=TA_CENTER, fontName="Helvetica", letterSpacing=2)))
    story.append(PageBreak())

    # ── Cover Header ──────────────────────────────────────────────────────────
    story.append(Paragraph("🌸 ClipInsight AI", h1))
    story.append(Paragraph("Analysis Report · 桜の知恵", ParagraphStyle(
        "Sub", fontSize=12, textColor=c_muted, spaceAfter=16, leading=16,
        fontName="Helvetica")))
    story.append(HRFlowable(width="100%", thickness=1, color=c_pink, spaceAfter=20))

    # ── Stats Row (2×3 table) ─────────────────────────────────────────────────
    hook    = result.get("hook_score", 0)
    dur     = result.get("duration_seconds", 0)
    frames  = result.get("frame_count", 0)
    words   = result.get("word_count", 0)
    sent    = result.get("sentiment", "Neutral")
    cat     = result.get("content_category", "General")

    stats_data = [
        ["HOOK SCORE",       "DURATION",    "FRAMES SAMPLED"],
        [f"{hook}/100",      f"{dur}s",     str(frames)],
        ["SENTIMENT",        "CATEGORY",    "EST. WATCH TIME"],
        [sent,               cat,           result.get("estimated_watch_time", "—")],
    ]

    def _cell(txt, is_val=False):
        style = ParagraphStyle(
            "C", fontSize=9 if not is_val else 18,
            textColor=c_pink if is_val else c_muted,
            fontName="Helvetica-Bold" if is_val else "Helvetica",
            leading=12 if not is_val else 22, alignment=TA_CENTER,
        )
        return Paragraph(txt, style)

    tbl_data = [
        [_cell("HOOK SCORE"), _cell("DURATION"),  _cell("FRAMES SAMPLED")],
        [_cell(f"{hook}/100", True), _cell(f"{dur}s", True), _cell(str(frames), True)],
        [_cell("SENTIMENT"), _cell("CATEGORY"), _cell("EST. WATCH TIME")],
        [_cell(sent, True), _cell(cat, True), _cell(result.get("estimated_watch_time", "—"), True)],
    ]

    tbl = Table(tbl_data, colWidths=[(W - 5*cm) / 3] * 3)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), HexColor("#F9F0F5")),
        ("ROWBACKGROUND",(0,1), (-1,1),  HexColor("#FFF0F5")),
        ("ROWBACKGROUND",(0,3), (-1,3),  HexColor("#FFF0F5")),
        ("BOX",          (0,0), (-1,-1), 0.5, c_blush),
        ("INNERGRID",    (0,0), (-1,-1), 0.3, c_blush),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("ALIGN",        (0,0), (-1,-1), "CENTER"),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 18))

    # ── Hook Score Bar ────────────────────────────────────────────────────────
    story.append(Paragraph("HOOK SCORE", label_s))
    bar_data = [[" " * int(hook * 0.45), " " * int((100 - hook) * 0.45)]]
    bar_tbl  = Table(bar_data, colWidths=[hook * 3.8, (100 - hook) * 3.8])
    bar_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (0,0), c_pink),
        ("BACKGROUND",   (1,0), (1,0), HexColor("#EEE0F0")),
        ("ROWHEIGHT",    (0,0), (-1,-1), 12),
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(bar_tbl)
    story.append(Spacer(1, 20))

    # ── Summary ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_blush, spaceAfter=10))
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
            "Tags", fontSize=10, textColor=c_pink, spaceAfter=8, leading=16,
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
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_blush, spaceAfter=10))
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
            expl_style = ParagraphStyle("Expl", fontSize=9, textColor=c_muted, fontName="Helvetica-Oblique", leading=11, spaceBefore=4)
            story.append(Paragraph(f"AI Note: {music['explanation']}", expl_style))
    else:
        story.append(Paragraph("No music detected in this video.", body))

    # ── Transcript ────────────────────────────────────────────────────────────
    transcript = result.get("transcript", "").strip()
    if transcript:
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=0.5, color=c_blush, spaceAfter=10))
        story.append(Paragraph("Transcript", h2))
        # Truncate very long transcripts
        if len(transcript) > 2000:
            transcript = transcript[:2000] + "…  [truncated]"
        story.append(Paragraph(transcript, body))

    # ── Visual Frames Grid ────────────────────────────────────────────────────
    frames = result.get("frames", [])
    if frames:
        frames_story = []
        frames_story.append(Spacer(1, 8))
        frames_story.append(HRFlowable(width="100%", thickness=0.5, color=c_blush, spaceAfter=10))
        frames_story.append(Paragraph("Visual Frame Highlights", h2))

        # Select up to 6 key frames uniformly distributed
        step = max(1, len(frames) // 6)
        key_frames = frames[::step][:6]

        grid_data = []
        row = []
        for frame in key_frames:
            img_path = TEMP_DIR / frame["path"]
            if img_path.exists():
                try:
                    # Size: A4 width - margins is approx 16cm (453 points)
                    # We can use 3 columns, so each image can be 140 points wide, 78 points height (~16:9 ratio)
                    img_w = 140
                    img_h = 78
                    img = Image(str(img_path), width=img_w, height=img_h)

                    # Under each image, show the timestamp label
                    ts = frame.get("timestamp", 0)
                    lbl = Paragraph(f"At {ts:.1f}s", ParagraphStyle("T", fontSize=8, textColor=c_muted, alignment=TA_CENTER))

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
            grid_table = Table(grid_data, colWidths=[(W - 5*cm) / 3] * 3)
            grid_table.setStyle(TableStyle([
                ("ALIGN", (0,0), (-1,-1), "CENTER"),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("BOTTOMPADDING", (0,0), (-1,-1), 12),
            ]))
            frames_story.append(grid_table)

        story.append(KeepTogether(frames_story))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=c_blush, spaceAfter=8))
    story.append(Paragraph(
        f"Generated by ClipInsight AI · 🌸 sakura-ai.dev · {datetime.now().strftime('%B %d, %Y')}",
        ParagraphStyle("Footer", fontSize=8, textColor=c_muted, alignment=TA_CENTER,
                       fontName="Helvetica")))

    doc.build(story)
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
