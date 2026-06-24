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
            HRFlowable, KeepTogether
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

    story = []

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
        story.append(Paragraph(
            f"<b>{music.get('song_title', '')}</b>  ·  {music.get('artist', '')}", body))
        if music.get("album"):
            story.append(Paragraph(f"Album: {music['album']}", body))
        if music.get("genre"):
            story.append(Paragraph(f"Genre: {music['genre']}", body))
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
