#!/usr/bin/env python3
"""Build ZEXVRO funding & infrastructure plan deck (design.md tokens).

Sibling to build_enterprise_pitch.py. 16:9 dark theme, matches ZEXVRO.pptx.
"""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt
from lxml import etree

# --- design.md tokens ---
BG = RGBColor(0x05, 0x05, 0x05)
SURFACE = RGBColor(0x0A, 0x0A, 0x0B)
RAISED = RGBColor(0x11, 0x11, 0x13)
HOVER = RGBColor(0x18, 0x18, 0x1B)
BORDER = RGBColor(0x27, 0x27, 0x2A)
BORDER_STRONG = RGBColor(0x3F, 0x3F, 0x46)
TEXT = RGBColor(0xFA, 0xFA, 0xFA)
TEXT2 = RGBColor(0xA1, 0xA1, 0xAA)
MUTED = RGBColor(0x71, 0x71, 0x7A)
PURPLE = RGBColor(0x7C, 0x3A, 0xED)
BLUE = RGBColor(0x3B, 0x82, 0xF6)
SUCCESS = RGBColor(0x22, 0xC5, 0x5E)
WARNING = RGBColor(0xF5, 0x9E, 0x0B)
DANGER = RGBColor(0xEF, 0x44, 0x44)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

FONT = "Inter"
FONT_MONO = "JetBrains Mono"

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
ASSETS = REPO / "assets" / "brand"
OUT = ROOT / "ppt" / "ZEXVRO_Funding_Plan.pptx"

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def set_run(run, text, size=14, bold=False, color=TEXT, font=FONT, italic=False):
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    for tag in ("latin", "ea", "cs"):
        el = rPr.find(qn(f"a:{tag}"))
        if el is None:
            el = etree.SubElement(rPr, qn(f"a:{tag}"))
        el.set("typeface", font)


def add_text_box(slide, left, top, width, height, paragraphs, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    try:
        tf._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[valign])
    except Exception:
        pass
    first = True
    for p in paragraphs:
        if isinstance(p, str):
            p = {"text": p}
        para = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        para.alignment = p.get("align", PP_ALIGN.LEFT)
        para.space_before = Pt(p.get("space_before", 0))
        para.space_after = Pt(p.get("space_after", 4))
        run = para.add_run()
        set_run(
            run,
            p.get("text", ""),
            size=p.get("size", 14),
            bold=p.get("bold", False),
            color=p.get("color", TEXT),
            font=p.get("font", FONT),
            italic=p.get("italic", False),
        )
    return box


def solid_bg(slide, color=BG):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    spTree = slide.shapes._spTree
    sp = shape._element
    spTree.remove(sp)
    spTree.insert(2, sp)
    return shape


def card(slide, left, top, width, height, fill=RAISED, border=BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = border
    shape.line.width = Pt(1)
    try:
        shape.adjustments[0] = 0.05
    except Exception:
        pass
    return shape


def accent_bar(slide, left, top, width, height, color=PURPLE):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    return s


def pill(slide, left, top, width, height, text, fill=HOVER, text_color=TEXT2, size=11):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = BORDER
    s.line.width = Pt(1)
    try:
        s.adjustments[0] = 0.5
    except Exception:
        pass
    tf = s.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    set_run(run, text, size=size, bold=True, color=text_color)
    try:
        tf._txBody.bodyPr.set("anchor", "ctr")
    except Exception:
        pass
    return s


def footer(slide, page, total, label="ZEXVRO · Funding & Infrastructure Plan"):
    add_text_box(
        slide, Inches(0.6), Inches(7.1), Inches(8), Inches(0.3),
        [{"text": label, "size": 10, "color": MUTED, "font": FONT_MONO}],
    )
    add_text_box(
        slide, Inches(11.5), Inches(7.1), Inches(1.3), Inches(0.3),
        [{"text": f"{page:02d} / {total:02d}", "size": 10, "color": MUTED, "font": FONT_MONO, "align": PP_ALIGN.RIGHT}],
    )


def header_meta(slide, kicker="STELLAR GARAGE PUNE · 3RD PLACE"):
    add_text_box(
        slide, Inches(0.6), Inches(0.28), Inches(8), Inches(0.28),
        [{"text": kicker, "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO}],
    )
    add_text_box(
        slide, Inches(9.0), Inches(0.28), Inches(3.7), Inches(0.28),
        [{"text": "zexvro.in", "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO, "align": PP_ALIGN.RIGHT}],
    )


def add_logo(slide, path, left, top, height):
    if not path.exists():
        return None
    from PIL import Image
    im = Image.open(path)
    w, h = im.size
    width = height * (w / h)
    return slide.shapes.add_picture(str(path), left, top, width=width, height=height)


def title_block(slide, kicker, title, subtitle=None, page=None, total=None):
    solid_bg(slide)
    header_meta(slide, kicker)
    accent_bar(slide, Inches(0.6), Inches(0.95), Inches(0.18), Inches(0.62), PURPLE)
    add_text_box(slide, Inches(1.0), Inches(0.9), Inches(11.7), Inches(0.8),
                 [{"text": title, "size": 30, "bold": True, "color": TEXT}])
    if subtitle:
        add_text_box(slide, Inches(1.0), Inches(1.62), Inches(11.7), Inches(0.4),
                     [{"text": subtitle, "size": 15, "color": TEXT2}])
    if page:
        footer(slide, page, total)


BORDER_W = 6350  # 0.5pt cell border in EMU


def _set_cell_borders(cell, color=BORDER):
    """Add thin borders to a table cell (insert before fill so schema order holds)."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for tag in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
        for el in tcPr.findall(qn(tag)):
            tcPr.remove(el)
        ln = etree.SubElement(tcPr, qn(tag))
        ln.set("w", str(BORDER_W))
        ln.set("cap", "flat")
        sf = etree.SubElement(ln, qn("a:solidFill"))
        clr = etree.SubElement(sf, qn("a:srgbClr"))
        clr.set("val", "%02X%02X%02X" % (color[0], color[1], color[2]))


def data_table(slide, left, top, width, col_widths, headers, rows, row_h=0.34, head_h=0.34, header_fill=HOVER, header_color=TEXT2, size=12, total_pages=None):
    """Real PowerPoint table — renders cleanly in PPT and LibreOffice PDF export."""
    nrows = len(rows) + 1
    ncols = len(headers)
    total_h = head_h + row_h * len(rows)
    gfx = slide.shapes.add_table(nrows, ncols, left, top, width, Inches(total_h))
    table = gfx.table
    table.first_row = False
    table.horz_banding = False
    for i, cw in enumerate(col_widths):
        table.columns[i].width = cw
    table.rows[0].height = Inches(head_h)
    for r in range(1, nrows):
        table.rows[r].height = Inches(row_h)

    def style_cell(cell, txt, fill, color, bold, font=FONT):
        cell.fill.solid()
        cell.fill.fore_color.rgb = fill
        cell.margin_left = Inches(0.08)
        cell.margin_right = Inches(0.08)
        cell.margin_top = Inches(0.02)
        cell.margin_bottom = Inches(0.02)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf = cell.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        run = p.add_run()
        set_run(run, txt, size=size, bold=bold, color=color, font=font)
        _set_cell_borders(cell)

    for i, htxt in enumerate(headers):
        style_cell(table.cell(0, i), htxt, header_fill, header_color, True)
    for ri, r in enumerate(rows, start=1):
        for ci, cellv in enumerate(r):
            if isinstance(cellv, tuple):
                txt, color, bold = cellv
            else:
                txt, color, bold = cellv, TEXT, False
            style_cell(table.cell(ri, ci), txt, RAISED, color, bold)
    return top + total_h


def hbar(slide, left, top, width, height, frac, color=PURPLE, label_left="", label_right=""):
    card(slide, left, top, width, height, fill=HOVER, border=BORDER)
    accent_bar(slide, left, top, width * frac, height, color)
    if label_left:
        add_text_box(slide, left + Inches(0.15), top + Inches(0.01), width - Inches(0.3), height - Inches(0.02),
                     [{"text": label_left, "size": 11, "bold": True, "color": TEXT}], valign=MSO_ANCHOR.MIDDLE)
    if label_right:
        add_text_box(slide, left + Inches(0.15), top + Inches(0.01), width - Inches(0.3), height - Inches(0.02),
                     [{"text": label_right, "size": 11, "bold": True, "color": TEXT, "align": PP_ALIGN.RIGHT}], valign=MSO_ANCHOR.MIDDLE)


def build_deck():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]
    S = lambda: prs.slides.add_slide(blank)
    TOTAL = 12

    # ---------- 01 Title ----------
    s = S(); solid_bg(s)
    add_logo(s, ASSETS / "logo2.png", Inches(0.6), Inches(0.55), Inches(0.55))
    add_text_box(s, Inches(0.6), Inches(2.3), Inches(12.1), Inches(1.6),
                 [{"text": "ZEXVRO — Funding & Infrastructure Plan", "size": 44, "bold": True, "color": TEXT}])
    add_text_box(s, Inches(0.6), Inches(3.6), Inches(12.1), Inches(0.6),
                 [{"text": "Where we are · what we spent · what the next build needs — and exactly what each dollar funds", "size": 18, "color": TEXT2}])
    pill(s, Inches(0.6), Inches(4.45), Inches(3.4), Inches(0.5), "3rd place · Stellar Garage Pune", fill=RAISED, text_color=SUCCESS, size=13)
    pill(s, Inches(4.2), Inches(4.45), Inches(2.6), Inches(0.5), "Unified Web3 PaaS", fill=RAISED, text_color=BLUE, size=13)
    pill(s, Inches(7.0), Inches(4.45), Inches(2.4), Inches(0.5), "Stellar + AWS", fill=RAISED, text_color=TEXT2, size=13)
    add_text_box(s, Inches(0.6), Inches(6.1), Inches(8), Inches(0.4),
                 [{"text": "2026-08-15 · live AWS + on-chain data snapshot", "size": 13, "color": MUTED, "font": FONT_MONO}])
    footer(s, 1, TOTAL)

    # ---------- 02 Where we are ----------
    s = S(); title_block(s, "WHERE WE ARE", "Current standing", "Five live services, mainnet contracts, real bootcamp usage.", page=2, total=TOTAL)
    cards = [
        ("3rd place", "Stellar Garage Pune build station — grant funding secured for the next build.", SUCCESS),
        ("5 services", "Zer0 · Morph · REQWID · NFTo · DEDSEC on one unified Web3 PaaS.", PURPLE),
        ("Mainnet live", "NFTo WASM + checkout, Zer0 privacy pools deployed on Stellar mainnet.", BLUE),
        ("Real users", "labs.zexvro.in bootcamp platform running SPPU learners.", WARNING),
    ]
    cw = (13.333 - 1.2 - 0.6) / 4
    for i, (t, d, c) in enumerate(cards):
        x = Inches(0.6 + i * (cw + 0.2))
        card(s, x, Inches(2.1), Inches(cw), Inches(2.3))
        accent_bar(s, x, Inches(2.1), Inches(cw), Inches(0.09), c)
        add_text_box(s, x + Inches(0.25), Inches(2.35), Inches(cw - 0.5), Inches(0.5),
                     [{"text": t, "size": 22, "bold": True, "color": c}])
        add_text_box(s, x + Inches(0.25), Inches(3.0), Inches(cw - 0.5), Inches(1.3),
                     [{"text": d, "size": 13, "color": TEXT2}])
    add_text_box(s, Inches(0.6), Inches(4.85), Inches(12.1), Inches(1.6),
                 [{"text": "One sentence", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "ZEXVRO is a unified Web3 PaaS helping teams move from Web2 to Web3 infrastructure through private, verifiable, agent-ready services. Developer-first, Vercel/Cloudflare clarity, Stellar rails.", "size": 17, "color": TEXT, "space_before": 8}])

    # ---------- 03 Money spent to date ----------
    s = S(); title_block(s, "MONEY SPENT TO DATE", "What we have spent so far", "Real numbers, pulled live from AWS Cost Explorer + Stellar mainnet.", page=3, total=TOTAL)
    stats = [
        ("≈ $0", "AWS billed (3 mo)", "Covered by AWS startup credits + free tier", SUCCESS),
        ("≈ $86/mo", "AWS list price (worker off)", "What the bill really is when credits expire", WARNING),
        ("≈ $211/mo", "AWS list price (worker on)", "ZK prover EC2 running 24/7 adds ~$125", DANGER),
        ("≈ $8–14", "On-chain (Stellar)", "≈50–90 XLM total contract deploys + fees", BLUE),
    ]
    cw = (13.333 - 1.2 - 0.6) / 4
    for i, (num, lab, d, c) in enumerate(stats):
        x = Inches(0.6 + i * (cw + 0.2))
        card(s, x, Inches(2.1), Inches(cw), Inches(2.2))
        accent_bar(s, x, Inches(2.1), Inches(cw), Inches(0.09), c)
        add_text_box(s, x + Inches(0.25), Inches(2.3), Inches(cw - 0.5), Inches(0.6),
                     [{"text": num, "size": 30, "bold": True, "color": c}])
        add_text_box(s, x + Inches(0.25), Inches(2.95), Inches(cw - 0.5), Inches(0.4),
                     [{"text": lab, "size": 13, "bold": True, "color": TEXT}])
        add_text_box(s, x + Inches(0.25), Inches(3.35), Inches(cw - 0.5), Inches(0.9),
                     [{"text": d, "size": 11, "color": TEXT2}])
    add_text_box(s, Inches(0.6), Inches(4.75), Inches(12.1), Inches(1.9),
                 [{"text": "Where the money actually sits", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "Cash on-chain today: Zer0 deployer 5.42 XLM · NFTo sponsor 8.02 XLM (≈ $2 total at $0.159/XLM). No salary drawn — 3 co-founders. The platform is effectively free to run right now because credits absorb the AWS bill.", "size": 15, "color": TEXT, "space_before": 8},
                  {"text": "Separate project note: peakCTF resources in the same AWS account are NOT ZEXVRO — excluded from this plan.", "size": 13, "color": MUTED, "space_before": 8}])

    # ---------- 04 Credits insight ----------
    s = S(); title_block(s, "THE CREDITS INSIGHT", "Free today — not free tomorrow", "AWS startup credits expire. Plan on list price so the bill is survivable.", page=4, total=TOTAL)
    card(s, Inches(0.6), Inches(2.15), Inches(12.13), Inches(1.05), fill=HOVER, border=BORDER_STRONG)
    add_text_box(s, Inches(0.9), Inches(2.3), Inches(11.6), Inches(0.8),
                 [{"text": "Cost Explorer reports $0 for 3 months — but App Runner, Fargate and the ALB have run continuously since July. The bill appears the day credits run out.", "size": 15, "bold": True, "color": TEXT}])
    add_text_box(s, Inches(0.6), Inches(3.45), Inches(12.1), Inches(0.4),
                 [{"text": "Three free cost wins — do these now", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO}])
    wins = [
        ("Release EIP 52.23.146.176", "Billed $3.60/mo while the ZK instance is stopped. Release it or pair with auto start/stop.", SUCCESS),
        ("Keep ZK worker OFF by default", "The ~$125/mo line. Lambda auto start/stop already exists — wire it.", SUCCESS),
        ("Cap CloudWatch retention", "agent-backend logs already ~90 MB. Set 14-day retention now.", SUCCESS),
    ]
    y = 3.95
    for t, d, c in wins:
        card(s, Inches(0.6), Inches(y), Inches(12.13), Inches(0.78))
        accent_bar(s, Inches(0.6), Inches(y), Inches(0.08), Inches(0.78), c)
        add_text_box(s, Inches(0.9), Inches(y + 0.06), Inches(11.6), Inches(0.3),
                     [{"text": t, "size": 14, "bold": True, "color": TEXT}])
        add_text_box(s, Inches(0.9), Inches(y + 0.38), Inches(11.6), Inches(0.36),
                     [{"text": d, "size": 11, "color": TEXT2}])
        y += 0.9
    add_text_box(s, Inches(0.6), Inches(6.7), Inches(12.1), Inches(0.4),
                 [{"text": "Action: verify credit balance + expiry in the AWS Billing console this week.", "size": 13, "bold": True, "color": WARNING}])

    # ---------- 05 Roadmap Phases A–D ----------
    s = S(); title_block(s, "THE PLAN", "Roadmap — Phases A to D", "From unify-the-spine to first client. Mapped to docs/roadmap-unified-paas.md.", page=5, total=TOTAL)
    phases = [
        ("A · Unify the spine", "Weeks 1–3", "Service Registry, one gateway, one identity, green tests. ~$0 new infra.", PURPLE),
        ("B · Unify value", "Weeks 4–6", "ZCR metering plane, workspace provisioning, audit+health, onboard NFTo + DEDSEC. +$30–60/mo.", BLUE),
        ("C · Agentic + delivery", "Weeks 7–10", "Morph + REQWID as modules, CI/CD, cost discipline. +$10–40/mo.", WARNING),
        ("D · Programs + team", "Weeks 10+", "SCF / accelerators, first part-time hires, land-and-expand first client. Salaries dominate.", SUCCESS),
    ]
    cw = (13.333 - 1.2 - 0.6) / 4
    for i, (t, when, d, c) in enumerate(phases):
        x = Inches(0.6 + i * (cw + 0.2))
        card(s, x, Inches(2.1), Inches(cw), Inches(3.4))
        accent_bar(s, x, Inches(2.1), Inches(cw), Inches(0.09), c)
        add_text_box(s, x + Inches(0.25), Inches(2.35), Inches(cw - 0.5), Inches(0.8),
                     [{"text": t, "size": 17, "bold": True, "color": TEXT}])
        add_text_box(s, x + Inches(0.25), Inches(3.15), Inches(cw - 0.5), Inches(0.4),
                     [{"text": when, "size": 12, "bold": True, "color": c, "font": FONT_MONO}])
        add_text_box(s, x + Inches(0.25), Inches(3.6), Inches(cw - 0.5), Inches(1.7),
                     [{"text": d, "size": 12, "color": TEXT2}])
    add_text_box(s, Inches(0.6), Inches(5.85), Inches(12.1), Inches(1.0),
                 [{"text": "North star", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "One identity, one workspace, one credits ledger, one control plane — five pluggable services. Excludes: multi-chain, A2A Trade, new paid infra before Phase B.", "size": 14, "color": TEXT, "space_before": 6}])

    # ---------- 06 Future infra cost ----------
    s = S(); title_block(s, "FUTURE COSTS", "Infrastructure cost per phase", "Monthly list-price deltas. Infra is small; team salaries are the real line.", page=6, total=TOTAL)
    rows = [
        [("Current footprint (worker off)", TEXT, False), ("$86/mo", TEXT2, False), ("2× App Runner + Fargate gate + ALB + serverless", MUTED, False)],
        [("Phase A — unify spine", PURPLE, True), ("+$0/mo", SUCCESS, True), ("Pure code + gateway routing. No new paid infra.", MUTED, False)],
        [("Phase B — ledger + workspace", BLUE, True), ("+$30–60/mo", WARNING, True), ("RDS Postgres ($13–60) + Redis ($13–40) for the control plane", MUTED, False)],
        [("Phase C — agentic + CI", WARNING, True), ("+$10–40/mo", WARNING, True), ("CI runners, optional premium Soroban RPC ($0–99), LLM for Morph", MUTED, False)],
        [("Phase D — programs + team", SUCCESS, True), ("salaries", DANGER, True), ("Part-time security/devrel/BD hires; infra stays sub-$200/mo", MUTED, False)],
    ]
    data_table(s, Inches(0.6), Inches(2.15), Inches(12.13), [Inches(3.6), Inches(1.9), Inches(6.63)],
               ["Phase", "Monthly delta", "What it funds"], rows, row_h=0.62, head_h=0.4, size=12)
    add_text_box(s, Inches(0.6), Inches(5.9), Inches(12.1), Inches(1.0),
                 [{"text": "Rule of thumb", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "Don't add any system until a phase needs it. Every premature service adds fixed cost to a credits-funded runway.", "size": 14, "color": TEXT, "space_before": 6}])

    # ---------- 07 Future systems ----------
    s = S(); title_block(s, "FUTURE SYSTEMS", "What IPFS, databases and the rest cost", "Cheap first step vs scale step — only when a phase actually needs them.", page=7, total=TOTAL)
    rows = [
        [("Postgres (ledger/audit)", BLUE, False), ("RDS t4g.micro ~$13/mo", SUCCESS, False), ("Aurora Serverless v2 $60–120/mo", MUTED, False)],
        [("Redis (DEDSEC anti-replay)", BLUE, False), ("ElastiCache Serverless $25–40/mo", WARNING, False), ("Managed node $13–50/mo", MUTED, False)],
        [("IPFS / de-pin storage", BLUE, False), ("Keep S3 + CloudFront (default)", SUCCESS, False), ("Pinata $20/mo · self-host ~$30 · Storj $4–8/TB", MUTED, False)],
        [("Soroban RPC", BLUE, False), ("Public RPC — free", SUCCESS, False), ("QuickNode/Ankr premium $49–99/mo", MUTED, False)],
        [("ZK proving capacity", BLUE, False), ("EC2 batch + spot ≈ $0–36/mo", WARNING, False), ("Reserved/GPU only if real-time proofs", MUTED, False)],
        [("Analytics + observability", BLUE, False), ("PostHog/Grafana free tiers — $0", SUCCESS, False), ("Self-host ClickHouse $30–100/mo", MUTED, False)],
    ]
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13), [Inches(3.2), Inches(4.7), Inches(4.23)],
               ["System", "Cheap / first step", "Scale step"], rows, row_h=0.5, head_h=0.38, size=12)
    add_text_box(s, Inches(0.6), Inches(5.65), Inches(12.1), Inches(1.1),
                 [{"text": "Decision already made", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "NFT media stays on AWS S3 + CloudFront (decided in context.md). IPFS remains an optional legacy mode — only adopted if a client explicitly requires content-addressed storage.", "size": 14, "color": TEXT, "space_before": 6}])

    # ---------- 08 Funding scenarios ----------
    s = S(); title_block(s, "FUNDING", "Grant scenarios — runway", "Plug in the real Stellar Garage Pune amount; these are the brackets.", page=8, total=TOTAL)
    scen = [
        ("Conservative", "$5,000", "Infra + tools for ~1 year", "Runway ≈ 33+ months (infra only)", WARNING),
        ("Base", "$10,000", "Phases A–D + first part-time hires", "12-mo cash need ≈ $8k–12k", BLUE),
        ("Optimistic", "$25,000", "Hires + GTM + working capital", "Runway ≈ 50–80 months (infra only)", SUCCESS),
    ]
    cw = (13.333 - 1.2 - 0.6) / 3
    for i, (t, amt, use, rw, c) in enumerate(scen):
        x = Inches(0.6 + i * (cw + 0.2))
        card(s, x, Inches(2.15), Inches(cw), Inches(2.9))
        accent_bar(s, x, Inches(2.15), Inches(cw), Inches(0.09), c)
        add_text_box(s, x + Inches(0.25), Inches(2.4), Inches(cw - 0.5), Inches(0.5),
                     [{"text": t, "size": 16, "bold": True, "color": TEXT}])
        add_text_box(s, x + Inches(0.25), Inches(2.95), Inches(cw - 0.5), Inches(0.7),
                     [{"text": amt, "size": 34, "bold": True, "color": c}])
        add_text_box(s, x + Inches(0.25), Inches(3.75), Inches(cw - 0.5), Inches(1.2),
                     [{"text": use, "size": 13, "color": TEXT2},
                      {"text": rw, "size": 12, "color": MUTED, "space_before": 8}])
    add_text_box(s, Inches(0.6), Inches(5.4), Inches(12.1), Inches(1.3),
                 [{"text": "The real constraint", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "Infrastructure is NOT the bottleneck — it's ~$86–150/mo. The constraint is time and team: with 3 founders working for free the 12-month need is small; the moment you hire, salary becomes the burn.", "size": 14, "color": TEXT, "space_before": 6}])

    # ---------- 09 Milestone cash needs ----------
    s = S(); title_block(s, "MONEY NEEDED — FOR WHAT", "Milestone by milestone", "Base scenario: exactly what each dollar funds, in order.", page=9, total=TOTAL)
    rows = [
        [("M0 · Unify the spine", PURPLE, True), ("Weeks 1–3", MUTED, False), ("$0–500", SUCCESS, True), ("Service Registry + gateway/auth + green tests; domains + one CloudFront origin", TEXT2, False)],
        [("M1 · Unify value", BLUE, True), ("Weeks 4–6", MUTED, False), ("$500–1,000", SUCCESS, True), ("RDS Postgres + Redis (or first credits) + premium RPC for load tests", TEXT2, False)],
        [("M2 · Agentic + delivery", WARNING, True), ("Weeks 7–10", MUTED, False), ("$1,000–2,500", SUCCESS, True), ("CI runners, LLM API budget for Morph, RPC, legal/ops", TEXT2, False)],
        [("M3 · Programs + team", WARNING, True), ("Weeks 10–16", MUTED, False), ("$3,000–10,000", SUCCESS, True), ("SCF/T-Hub/MeitY applications + 1 part-time security reviewer + devrel (3–6 mo)", TEXT2, False)],
        [("M4 · First client", SUCCESS, True), ("Weeks 16+", MUTED, False), ("$5,000–15,000", SUCCESS, True), ("Working capital for infra + onboarding support; free-trial isolation", TEXT2, False)],
        [("12-month total", TEXT, True), ("—", MUTED, False), ("≈ $8k–12k", SUCCESS, True), ("3 co-founders, no salary", TEXT2, True)],
    ]
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13), [Inches(2.6), Inches(1.5), Inches(1.7), Inches(6.33)],
               ["Milestone", "When", "Cash", "Used for (exactly)"], rows, row_h=0.56, head_h=0.38, size=11)
    add_text_box(s, Inches(0.6), Inches(6.05), Inches(12.1), Inches(1.0),
                 [{"text": "Use-of-funds split", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "40% product/infra · 40% go-to-market · 20% ops/G&A — benchmarked from the startup-financial-modeling skill.", "size": 14, "color": TEXT, "space_before": 6}])

    # ---------- 10 Revenue basis ----------
    s = S(); title_block(s, "REVENUE BASIS", "How the plan pays for itself", "Billing streams already live today — unified credits ledger routes them in Phase B.", page=10, total=TOTAL)
    rev = [
        ("ZCR credits", "$0.05 / ZCR", "Packs + custom amounts. Freemium wedge: one service free, pay for the rest.", PURPLE),
        ("NFTo", "USDC per NFT (SEP-41)", "Fixed-price primary checkout; fees cover the sponsor envelope.", BLUE),
        ("DEDSEC", "USDC per request (x402)", "Pay-per-request; settle before release. Scale: per-1k-tokens later.", WARNING),
    ]
    cw = (13.333 - 1.2 - 0.6) / 3
    for i, (t, price, d, c) in enumerate(rev):
        x = Inches(0.6 + i * (cw + 0.2))
        card(s, x, Inches(2.15), Inches(cw), Inches(2.5))
        accent_bar(s, x, Inches(2.15), Inches(cw), Inches(0.09), c)
        add_text_box(s, x + Inches(0.25), Inches(2.4), Inches(cw - 0.5), Inches(0.5),
                     [{"text": t, "size": 18, "bold": True, "color": TEXT}])
        add_text_box(s, x + Inches(0.25), Inches(2.95), Inches(cw - 0.5), Inches(0.4),
                     [{"text": price, "size": 14, "bold": True, "color": c, "font": FONT_MONO}])
        add_text_box(s, x + Inches(0.25), Inches(3.45), Inches(cw - 0.5), Inches(1.1),
                     [{"text": d, "size": 12, "color": TEXT2}])
    add_text_box(s, Inches(0.6), Inches(4.95), Inches(12.1), Inches(1.8),
                 [{"text": "Business model", "size": 12, "bold": True, "color": MUTED, "font": FONT_MONO},
                  {"text": "Usage SaaS, not seats. Infra must be costed per unit of usage (per checkout, per request, per proof). Targets: gross margin 75–85%, CAC payback < 12 months, LTV/CAC > 3.", "size": 15, "color": TEXT, "space_before": 8}])

    # ---------- 11 90-day goals ----------
    s = S(); title_block(s, "NEXT 90 DAYS", "Goals (OKR shape)", "Measurable, evidenced, bounded — written with the define-goal skill.", page=11, total=TOTAL)
    okrs = [
        ("OKR 1 — Unify the platform", "All 5 services read one Service Registry; console, landing, docs and Morph agent render the same catalog; `npm run lint && npm test && npm run build` green (12 failing tests fixed).", "Evidence: refactored serviceCatalog.ts consumed by ~20 hardcoded copies; CI badge green on main.", PURPLE),
        ("OKR 2 — First paying usage", "≥1 workspace pays for a ZCR pack OR 3 NFTo studios deploy mainnet collections, with ≥1 settlement per service recorded in memory.md.", "Evidence: credits ledger entries + on-chain sale/checkout hashes.", BLUE),
        ("OKR 3 — Cost discipline", "AWS list-price burn ≤ $120/mo; ZK worker off by default with Lambda auto start/stop proven; EIP released; log retention capped; credits checked monthly.", "Evidence: Cost Explorer < $120, worker stopped, cost doc refreshed.", SUCCESS),
    ]
    y = 2.1
    for t, main, ev, c in okrs:
        card(s, Inches(0.6), Inches(y), Inches(12.13), Inches(1.5))
        accent_bar(s, Inches(0.6), Inches(y), Inches(0.08), Inches(1.5), c)
        add_text_box(s, Inches(0.9), Inches(y + 0.12), Inches(11.6), Inches(0.35),
                     [{"text": t, "size": 15, "bold": True, "color": c}])
        add_text_box(s, Inches(0.9), Inches(y + 0.5), Inches(11.6), Inches(0.55),
                     [{"text": main, "size": 12, "color": TEXT}])
        add_text_box(s, Inches(0.9), Inches(y + 1.08), Inches(11.6), Inches(0.35),
                     [{"text": ev, "size": 11, "color": MUTED, "font": FONT_MONO}])
        y += 1.62

    # ---------- 12 Next 30 days ----------
    s = S(); title_block(s, "NEXT 30 DAYS", "Execution checklist + asks", "Free cost wins this week, Phase A build in weeks 1–3.", page=12, total=TOTAL)
    items = [
        ("Week 1 (free)", "Release EIP · cap log retention · verify AWS credit balance & expiry · confirm peakCTF ownership (separate project — excluded) · lock the real grant amount into the plan.", SUCCESS),
        ("Weeks 1–3 · Phase A (~$0)", "A1 Service Registry (first funded build) · A0 fix 12 red tests · A2 unified gateway origin · A3 one Cognito session across services.", PURPLE),
        ("Weeks 4–6 · Phase B (first paid infra)", "B1 ZCR metering plane · B2 workspace provisioning · B3 audit+health · B4 onboard NFTo + DEDSEC. Provision RDS/Redis only when the ledger write path is ready.", BLUE),
        ("Ongoing", "Monthly AWS cost check into memory.md · run the new skills (planning-with-files, startup-financial-modeling, fundraising) for grants.", WARNING),
    ]
    y = 2.1
    for t, d, c in items:
        card(s, Inches(0.6), Inches(y), Inches(12.13), Inches(0.95))
        accent_bar(s, Inches(0.6), Inches(y), Inches(0.08), Inches(0.95), c)
        add_text_box(s, Inches(0.9), Inches(y + 0.08), Inches(3.1), Inches(0.8),
                     [{"text": t, "size": 13, "bold": True, "color": c}], valign=MSO_ANCHOR.MIDDLE)
        add_text_box(s, Inches(4.0), Inches(y + 0.08), Inches(8.5), Inches(0.8),
                     [{"text": d, "size": 12, "color": TEXT}], valign=MSO_ANCHOR.MIDDLE)
        y += 1.08
    add_text_box(s, Inches(0.6), Inches(6.55), Inches(12.1), Inches(0.5),
                 [{"text": "Ask: grant amount + go-ahead on Phase A1 Service Registry → then I start building.", "size": 15, "bold": True, "color": SUCCESS}])

    prs.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    build_deck()
