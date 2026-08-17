#!/usr/bin/env python3
"""Build ZEXVRO Team Onboarding deck (design.md tokens).

15 slides, 16:9 dark theme, matches ZEXVRO_Funding_Plan.pptx / ZEXVRO.pptx.
Covers: what we ship, three surfaces (Labs / Console / Console·Zer0),
future dev plan (Unified PaaS A–D), ownership, and a credits-based pricing proposal.
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

# --- design.md tokens (dark) ---
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
OUT = ROOT / "ppt" / "ZEXVRO_Team_Onboarding.pptx"

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

FOOT = "ZEXVRO · Internal · Team Onboarding"


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


def footer(slide, page, total):
    add_text_box(
        slide, Inches(0.6), Inches(7.1), Inches(8), Inches(0.3),
        [{"text": FOOT, "size": 10, "color": MUTED, "font": FONT_MONO}],
    )
    add_text_box(
        slide, Inches(11.5), Inches(7.1), Inches(1.3), Inches(0.3),
        [{"text": f"{page:02d} / {total:02d}", "size": 10, "color": MUTED, "font": FONT_MONO, "align": PP_ALIGN.RIGHT}],
    )


def header_meta(slide, kicker="TEAM · INTERNAL · 2026-08"):
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


BORDER_W = 6350


def _set_cell_borders(cell, color=BORDER):
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


def data_table(slide, left, top, width, col_widths, headers, rows, row_h=0.34, head_h=0.34, header_fill=HOVER, header_color=TEXT2, size=12):
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


def pathway_card(slide, x, y, w, h, kicker, title, url, accent, lines, model, owner):
    card(slide, x, y, w, h, fill=RAISED, border=BORDER_STRONG)
    accent_bar(slide, x, y, Inches(0.09), h, accent)
    pill(slide, x + Inches(0.28), y + Inches(0.24), Inches(1.5), Inches(0.3), kicker, fill=HOVER, text_color=accent, size=10)
    add_text_box(slide, x + Inches(0.28), y + Inches(0.64), w - Inches(0.6), Inches(0.5),
                 [{"text": title, "size": 24, "bold": True, "color": TEXT}])
    add_text_box(slide, x + Inches(0.28), y + Inches(1.12), w - Inches(0.6), Inches(0.3),
                 [{"text": url, "size": 12, "color": MUTED, "font": FONT_MONO}])
    cy = y + Inches(1.5)
    for ln in lines:
        add_text_box(slide, x + Inches(0.28), cy, w - Inches(0.6), Inches(0.55),
                     [{"text": "·  " + ln, "size": 12, "color": TEXT2}])
        cy += Inches(0.5)
    model_y = y + h - Inches(1.14)
    card(slide, x + Inches(0.28), model_y, w - Inches(0.56), Inches(0.9), fill=HOVER, border=BORDER)
    add_text_box(slide, x + Inches(0.42), model_y + Inches(0.10), w - Inches(0.84), Inches(0.3),
                 [{"text": "REVENUE MODEL", "size": 9, "bold": True, "color": accent}])
    add_text_box(slide, x + Inches(0.42), model_y + Inches(0.34), w - Inches(0.84), Inches(0.5),
                 [{"text": model, "size": 11, "color": TEXT}])
    add_text_box(slide, x + Inches(0.28), y + h - Inches(0.28), w - Inches(0.6), Inches(0.22),
                 [{"text": owner, "size": 10, "color": MUTED}])


def service_card(slide, x, y, w, h, name, one, status, owner, accent):
    card(slide, x, y, w, h, fill=RAISED, border=BORDER)
    accent_bar(slide, x, y, Inches(0.07), h, accent)
    add_text_box(slide, x + Inches(0.22), y + Inches(0.16), w - Inches(0.4), Inches(0.4),
                 [{"text": name, "size": 20, "bold": True, "color": TEXT}])
    add_text_box(slide, x + Inches(0.22), y + Inches(0.58), w - Inches(0.4), Inches(1.0),
                 [{"text": one, "size": 12.5, "color": TEXT2}])
    add_text_box(slide, x + Inches(0.22), y + h - Inches(0.52), w - Inches(0.4), Inches(0.42),
                 [{"text": f"STATUS · {status}", "size": 10, "bold": True, "color": SUCCESS if status.startswith("Live") or status.startswith("Prod") else WARNING},
                  {"text": f"Owner · {owner}", "size": 10, "color": MUTED, "space_before": 2}])


def bullets(slide, left, top, width, height, items, size=14, gap=10, bullet="·  "):
    paras = []
    for it in items:
        if isinstance(it, tuple):
            t, c = it
            paras.append({"text": bullet + t, "size": size, "color": c, "space_after": gap})
        else:
            paras.append({"text": bullet + it, "size": size, "color": TEXT2, "space_after": gap})
    add_text_box(slide, left, top, width, height, paras)


def build_deck():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]
    S = lambda: prs.slides.add_slide(blank)
    TOTAL = 15

    # ---------- 01 Title ----------
    s = S(); solid_bg(s)
    add_logo(s, ASSETS / "logo2.png", Inches(0.6), Inches(0.55), Inches(0.55))
    add_text_box(s, Inches(0.6), Inches(2.2), Inches(12.1), Inches(1.6),
                 [{"text": "ZEXVRO — Team Onboarding", "size": 44, "bold": True, "color": TEXT}])
    add_text_box(s, Inches(0.6), Inches(3.55), Inches(12.1), Inches(0.6),
                 [{"text": "What we ship · Three surfaces · Future dev plan · Ownership · Pricing", "size": 16, "color": TEXT2}])
    add_text_box(s, Inches(0.6), Inches(4.15), Inches(12.1), Inches(0.5),
                 [{"text": "unified Web3 PaaS on Stellar", "size": 14, "color": PURPLE}])
    footer(s, 1, TOTAL)

    # ---------- 02 North star ----------
    s = S()
    title_block(s, "WHERE WE ARE", "One platform. Five services. Stellar rails.",
                "We are not five apps sharing a shell — we are one control plane services plug into.", page=2, total=TOTAL)
    # three mini-cards
    mw = Inches(3.8); mx = Inches(0.6); my = Inches(2.35); mh = Inches(1.5)
    for i, (t, d) in enumerate([
        ("One identity", "One Cognito session every service accepts — no per-app tokens."),
        ("One workspace + ledger", "Every team gets a workspace and one ZCR credits balance."),
        ("One control plane", "Sidebar, services, docs, agent and landing all read the same Service Registry."),
    ]):
        card(s, Inches(0.6 + 4.12 * i), my, mw, mh, fill=RAISED, border=BORDER)
        accent_bar(s, Inches(0.6 + 4.12 * i), my, Inches(1.3), Inches(0.05), PURPLE if i == 2 else BLUE)
        add_text_box(s, Inches(0.6 + 4.12 * i + 0.2), my + Inches(0.18), mw - Inches(0.4), Inches(0.4),
                     [{"text": t, "size": 16, "bold": True, "color": TEXT}])
        add_text_box(s, Inches(0.6 + 4.12 * i + 0.2), my + Inches(0.62), mw - Inches(0.4), Inches(0.8),
                     [{"text": d, "size": 12, "color": TEXT2}])
    # stat strip
    y = Inches(4.35)
    for i, (v, l) in enumerate([
        ("5", "services"), ("1", "credits ledger"), ("3", "founders"), ("Mainnet", "live · NFTo"), ("3rd place", "Stellar Garage Pune")]):
        card(s, Inches(0.6 + 2.44 * i), y, Inches(2.24), Inches(1.1), fill=HOVER, border=BORDER)
        add_text_box(s, Inches(0.6 + 2.44 * i + 0.15), y + Inches(0.12), Inches(1.94), Inches(0.5),
                     [{"text": v, "size": 26, "bold": True, "color": WHITE}])
        add_text_box(s, Inches(0.6 + 2.44 * i + 0.15), y + Inches(0.7), Inches(1.94), Inches(0.3),
                     [{"text": l, "size": 11, "color": MUTED}])
    bullets(s, Inches(0.6), Inches(5.9), Inches(11.7), Inches(1.0), [
        "Read context.md → 'Why stable = unified' for the evidence (4 API origins, ~20 hardcoded service-catalog copies).",
        "North star: Vercel/Cloudflare clarity on Stellar rails.",
    ], size=12)

    # ---------- 03 Three surfaces (funnel) ----------
    s = S()
    title_block(s, "THE FRAMEWORK", "Three surfaces — one funnel", 
                "Learn → Build → Earn. Every ZEXVRO user sits in exactly one of these.", page=3, total=TOTAL)
    pathway_card(s, Inches(0.55), Inches(2.05), Inches(4.0), Inches(4.85), "SURFACE 01", "Labs", "labs.zexvro.in", BLUE,
                 ["Learn & Practice Lab",
                  "Interactive Web3 + Web2 courses, sandbox projects, guided tracks",
                  "SPPU bootcamp partner platform",
                  "Feeds learners into the Console"],
                 "FREE — only serious certifications are paid", "Owner · curriculum")
    pathway_card(s, Inches(4.72), Inches(2.05), Inches(4.0), Inches(4.85), "SURFACE 02", "Console", "console.zexvro.in", PURPLE,
                 ["Developer infrastructure — the control plane",
                  "Run the five services per workspace",
                  "Manage, monitor, audit",
                  "Pay with credits"],
                 "CREDITS (ZCR) — metered usage", "Owner · platform core")
    pathway_card(s, Inches(8.89), Inches(2.05), Inches(4.0), Inches(4.85), "SURFACE 03", "Zer0", "console.zexvro.in/zer0", SUCCESS,
                 ["Business money rails",
                  "Private payroll / business payments on the privacy pool",
                  "Stealth, proofs, settlement",
                  "Companion product on the console"],
                 "SUBSCRIPTION + per-payout volume", "Owner · Paris (Zer0)")

    # ---------- 04 Labs ----------
    s = S()
    title_block(s, "SURFACE 01", "Labs — learn to build on Web3",
                "The free top of the funnel. Turn curious people into builders.", page=4, total=TOTAL)
    bullets(s, Inches(0.6), Inches(2.1), Inches(6.8), Inches(3.4), [
        ("Interactive, hands-on courses — not lecture videos.", TEXT),
        "Web3 blocks: Stellar/Soroban, wallets, contracts, x402.",
        "Web2 blocks: APIs, auth, CLI, CI/CD — the pre-Web3 gaps.",
        "Sandbox + practice environments with live verification.",
        ("SPPU bootcamp already runs here.", SUCCESS),
        "Graded tracks nudge learners onto the Console to ship.",
    ], size=13, gap=9)
    card(s, Inches(7.7), Inches(2.05), Inches(5.0), Inches(2.4), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(2.25), Inches(4.5), Inches(0.4),
                 [{"text": "Revenue model", "size": 12, "bold": True, "color": BLUE}])
    add_text_box(s, Inches(7.95), Inches(2.7), Inches(4.5), Inches(1.6),
                 [{"text": "Keep learning free. Charge only for serious, verifiable certifications (a Web3 dev cert) — never for practice access.", "size": 13, "color": TEXT}])
    card(s, Inches(7.7), Inches(4.6), Inches(5.0), Inches(1.6), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(4.8), Inches(4.5), Inches(0.4),
                 [{"text": "Owner", "size": 12, "bold": True, "color": BLUE}])
    add_text_box(s, Inches(7.95), Inches(5.2), Inches(4.5), Inches(0.9),
                 [{"text": "To assign. Needs a curriculum lead + content/devrel helpers.", "size": 13, "color": TEXT2}])
    bullets(s, Inches(0.6), Inches(5.7), Inches(6.8), Inches(1.2), [
        "Open work: course scaffolding, sandbox infra, SPPU track, certification flow.",
    ], size=12)

    # ---------- 05 Console ----------
    s = S()
    title_block(s, "SURFACE 02", "Console — the developer control plane",
                "Where developers deploy, run, monitor and pay for ZEXVRO services.", page=5, total=TOTAL)
    bullets(s, Inches(0.6), Inches(2.1), Inches(6.8), Inches(3.4), [
        ("One logged-in identity + workspace + credentials.", TEXT),
        "Run the five services: NFTo, DEDSEC, REQWID, Morph, Zer0 admin.",
        "Service Registry drives sidebar, Services, docs, agent KB.",
        ("Unified API gateway + one audit + one /health per service.", TEXT),
        ("One ZCR ledger bills NFTo / DEDSEC / Zer0 settle.", TEXT),
    ], size=13, gap=9)
    card(s, Inches(7.7), Inches(2.05), Inches(5.0), Inches(2.4), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(2.25), Inches(4.5), Inches(0.4),
                 [{"text": "Revenue model", "size": 12, "bold": True, "color": PURPLE}])
    add_text_box(s, Inches(7.95), Inches(2.7), Inches(4.5), Inches(1.6),
                 [{"text": "Credits (ZCR). Developers buy credit packs and spend per service. One ledger, volume discounts as usage grows.", "size": 13, "color": TEXT}])
    card(s, Inches(7.7), Inches(4.6), Inches(5.0), Inches(1.6), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(4.8), Inches(4.5), Inches(0.4),
                 [{"text": "Owner", "size": 12, "bold": True, "color": PURPLE}])
    add_text_box(s, Inches(7.95), Inches(5.2), Inches(4.5), Inches(0.9),
                 [{"text": "Platform core (Paris · Rushi · Nabil). New members: Registry, gateway, credits.", "size": 13, "color": TEXT2}])
    bullets(s, Inches(0.6), Inches(5.7), Inches(6.8), Inches(1.2), [
        "Open work: Service Registry refactor, API Gateway, credits metering, workspace provisioning.",
    ], size=12)

    # ---------- 06 Console · Zer0 ----------
    s = S()
    title_block(s, "SURFACE 03", "Console · Zer0 — business payroll & private payments",
                "Zer0 is the product inside the console that actually moves business money.", page=6, total=TOTAL)
    bullets(s, Inches(0.6), Inches(2.1), Inches(6.8), Inches(3.4), [
        ("Zero-knowledge privacy for business payments.", TEXT),
        "Payroll runs: people, pay party, history, proofs, stealth.",
        "Businesses get Web3 rails without exposing sensitive tx details.",
        ("Product UI complete (2026-07-17).", SUCCESS),
        "Settle E2E, compliance view-keys and mainnet policy remain.",
        "Cross-sell wedge: NFTo indie studios → Zer0 for their payouts.",
    ], size=13, gap=9)
    card(s, Inches(7.7), Inches(2.05), Inches(5.0), Inches(2.4), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(2.25), Inches(4.5), Inches(0.4),
                 [{"text": "Revenue model", "size": 12, "bold": True, "color": SUCCESS}])
    add_text_box(s, Inches(7.95), Inches(2.7), Inches(4.5), Inches(1.6),
                 [{"text": "Business subscription + a per-payout volume fee (or per payroll run). Built for finance teams, not consumers.", "size": 13, "color": TEXT}])
    card(s, Inches(7.7), Inches(4.6), Inches(5.0), Inches(1.6), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(7.95), Inches(4.8), Inches(4.5), Inches(0.4),
                 [{"text": "Owner", "size": 12, "bold": True, "color": SUCCESS}])
    add_text_box(s, Inches(7.95), Inches(5.2), Inches(4.5), Inches(0.9),
                 [{"text": "Paris (Zer0). Weigh in on treasury keys, compliance.", "size": 13, "color": TEXT2}])
    bullets(s, Inches(0.6), Inches(5.7), Inches(6.8), Inches(1.2), [
        "Open work: settle E2E, compliance view-keys, treasury ops keys, payroll-run pricing.",
    ], size=12)

    # ---------- 07 What we ship (5 services table) ----------
    s = S()
    title_block(s, "WHAT WE SHIP", "Five services — one platform",
                "Always name consistently. Status is honest to context.md.", page=7, total=TOTAL)
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13),
               [Inches(1.5), Inches(4.4), Inches(3.2), Inches(3.0)],
               ["Service", "What it does", "Status", "Owner"],
               [
                   ["Zer0", "Zero-knowledge privacy for business payments", ("Product UI complete", SUCCESS, True), "Paris"],
                   ["Morph", "Transformation agent for Web2 → Web3 migration", ("CLI built · wiring next", WARNING, True), "Paris + Morph"],
                   ["REQWID", "Human vs agent classification for product flows", ("Partial", WARNING, True), "Rushi"],
                   ["NFTo", "Deploy & sell NFTs without chain complexity", ("Mainnet live", SUCCESS, True), "Nabil + Paris"],
                   ["DEDSEC", "x402 paid access gateway for APIs & compute", ("v1 · expansion planned", WARNING, True), "Nabil"],
               ],
               row_h=0.56, head_h=0.38, size=11)
    add_text_box(s, Inches(0.6), Inches(6.5), Inches(12.1), Inches(0.5),
                 [{"text": "Out of MVP: A2A Trade. New features are proposed until the team accepts them.", "size": 11, "color": MUTED}])

    # ---------- 08 Deep dive: in production ----------
    s = S()
    title_block(s, "DEEP DIVE", "In production today", "Zer0 and NFTo have mainnet-grade product UI.", page=8, total=TOTAL)
    service_card(s, Inches(0.6), Inches(2.05), Inches(6.0), Inches(4.3), "Zer0", 
                 "Zero-knowledge privacy pool for business payments. Multi-screen suite: dashboard, people, pay party, history, proofs, stealth, settings. Owned by Paris.", 
                 "Product UI complete", "Paris", PURPLE)
    service_card(s, Inches(6.78), Inches(2.05), Inches(6.0), Inches(4.3), "NFTo",
                 "NFT service — deploy and sell NFTs without chain complexity. Mainnet WASM + App Runner + atomic USDC checkout (SEP-41). Nabil builds the API/chain, Paris the dashboard.",
                 "Mainnet live", "Nabil + Paris", SUCCESS)
    add_text_box(s, Inches(0.6), Inches(6.55), Inches(12.1), Inches(0.4),
                 [{"text": "Dig deeper in context.md → Service Map · #1 Zer0 and #4 NFTo.", "size": 11, "color": MUTED}])

    # ---------- 09 Deep dive: in progress / next ----------
    s = S()
    title_block(s, "DEEP DIVE", "In progress & next", "Morph, REQWID and DEDSEC are not done — don't overclaim.", page=9, total=TOTAL)
    service_card(s, Inches(0.6), Inches(2.05), Inches(4.0), Inches(4.3), "Morph",
                 "Transformation agent — inspect a repo, explain Web2→Web3 migration, deploy through CLI + web. CLI built with Python/Typer, SQLite memory, tool registry.",
                 "CLI built · wiring next", "Paris + Morph track", BLUE)
    service_card(s, Inches(4.72), Inches(2.05), Inches(4.0), Inches(4.3), "REQWID",
                 "Dual-channel capability issuer — proves human vs agent without default-denying agents. Owned by Rushi. Nature of feelings: honest, no perfect detection.",
                 "Partial", "Rushi", WARNING)
    service_card(s, Inches(8.84), Inches(2.05), Inches(4.0), Inches(4.3), "DEDSEC",
                 "x402 paid-access gateway for APIs & compute. Economic firewall in front of expensive APIs; v1 is GET/HEAD routes.",
                 "v1 GET/HEAD · expansion planned", "Nabil", DANGER)
    add_text_box(s, Inches(0.6), Inches(6.55), Inches(12.1), Inches(0.4),
                 [{"text": "Morph · REQWID · DEDSEC growth stays Proposed until the team accepts it.", "size": 11, "color": MUTED}])

    # ---------- 10 Pricing philosophy ----------
    s = S()
    title_block(s, "PRICING — PART 1", "Pricing philosophy",
                "Credits are the metering layer — but we don't charge everywhere.", page=10, total=TOTAL)
    # 3 principle cards
    pw = Inches(3.9); px = Inches(0.6); py = Inches(2.2); ph = Inches(2.0)
    for i, (t, d) in enumerate([
        ("One ledger", "A single ZCR balance per workspace. Buy packs, spend per service. No fragmented billing."),
        ("Not everywhere", "Pricing is not mandatory. Where we win on distribution (Labs), stay free."),
        ("Freemium wedge", "One service free; pay for the rest. Easy in, grow into credits."),
    ]):
        card(s, Inches(0.6 + 4.16 * i), py, pw, ph, fill=HOVER, border=BORDER)
        accent_bar(s, Inches(0.6 + 4.16 * i), py, Inches(0.08), ph, PURPLE if i == 0 else (BLUE if i == 1 else SUCCESS))
        add_text_box(s, Inches(0.6 + 4.16 * i + 0.28), py + Inches(0.2), pw - Inches(0.56), Inches(0.4),
                     [{"text": t, "size": 17, "bold": True, "color": TEXT}])
        add_text_box(s, Inches(0.6 + 4.16 * i + 0.28), py + Inches(0.66), pw - Inches(0.56), Inches(1.2),
                     [{"text": d, "size": 12.5, "color": TEXT2}])
    card(s, Inches(0.6), Inches(4.55), Inches(12.13), Inches(1.9), fill=RAISED, border=BORDER)
    add_text_box(s, Inches(0.85), Inches(4.75), Inches(11.6), Inches(0.4),
                 [{"text": "Credit → what it buys", "size": 12, "bold": True, "color": PURPLE}])
    bullets(s, Inches(0.85), Inches(5.15), Inches(11.6), Inches(1.2), [
        ("1 ZCR = a metered unit of usage (a mint, a verified request, a payout, a migration task).", TEXT),
        "Price per unit per service; volume discounts as usage grows.",
        "Free tiers stay generous for acquisition; credits kick in at scale.",
    ], size=12.5, gap=7)
    add_text_box(s, Inches(0.6), Inches(6.6), Inches(12.1), Inches(0.4),
                 [{"text": "This is a proposal to kick the team conversation — validate numbers with real users before locking.", "size": 11, "color": MUTED}])

    # ---------- 11 Pricing by surface ----------
    s = S()
    title_block(s, "PRICING — PART 2", "Pricing by surface",
                "Who pays, and the model per surface.", page=11, total=TOTAL)
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13),
               [Inches(2.2), Inches(2.6), Inches(2.9), Inches(4.4)],
               ["Surface", "Who pays", "Model", "Notes"],
               [
                   ["Labs", "Learners", "Free", "Revenue only from serious, verifiable certifications."],
                   ["Console", "Developers", "Credits (ZCR)", "Buy credit packs; metered per service; volume discounts."],
                   ["Console · Zer0", "Businesses", "Subscription + per payout", "Built for finance teams; per-run or volume fee."],
               ],
               row_h=0.6, head_h=0.38, size=11.5)
    card(s, Inches(0.6), Inches(4.9), Inches(12.13), Inches(1.6), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(0.85), Inches(5.1), Inches(11.6), Inches(1.2),
                 [{"text": "Default rule", "size": 12, "bold": True, "color": BLUE},
                  {"text": "  Free for anything that grows reach (learn, practice, evaluate). Charge where real cost or real value accrues (compute, money movement, certifications).", "size": 12.5, "color": TEXT, "space_before": 4}])

    # ---------- 12 Pricing by service (proposal) ----------
    s = S()
    title_block(s, "PRICING — PART 3", "Pricing by service (proposal)",
                "Per-service unit. Numbers are direction, not final.", page=12, total=TOTAL)
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13),
               [Inches(1.6), Inches(2.6), Inches(7.9)],
               ["Service", "Model", "Proposed pricing"],
               [
                   ["Zer0", "Business plan", "Workspace subscription + per-payout volume fee (per payroll run)."],
                   ["Morph", "Credits", "Free during evaluation; credits per migration task."],
                   ["REQWID", "Free tier + credits", "Generous free verifications/day; credits beyond."],
                   ["NFTo", "Credits", "Free tier mints; then credits per mint / per collection (USDC-backed checkout)."],
                   ["DEDSEC", "Pay-per-request", "Coins/credits per verified x402 request; provider sets price."],
               ],
               row_h=0.56, head_h=0.38, size=11.5)
    add_text_box(s, Inches(0.6), Inches(6.5), Inches(12.1), Inches(0.5),
                 [{"text": "Validate with users and founders before these become policy. NFTo checkout stays SEP-41 atomic.", "size": 11, "color": MUTED}])

    # ---------- 13 Future dev plan ----------
    s = S()
    title_block(s, "FUTURE DEVELOPEMENT", "Future dev plan — Unified PaaS",
                "Stability = unifying the platform, not fixing five apps. Matches the funding plan.", page=13, total=TOTAL)
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13),
               [Inches(2.0), Inches(2.4), Inches(7.7)],
               ["Phase", "Theme", "Key work"],
               [
                   ["A · weeks 1–3", "Unify the spine", "Service Registry · unified API gateway · one identity/session · green tests (fix 12)."],
                   ["B · weeks 4–6", "Unify value", "One credits ledger · workspace provisioning · audit + health plane · onboard NFTo/DEDSEC."],
                   ["C · weeks 7–10", "Agentic + delivery", "Morph + REQWID as modules · CI/CD on the repo · cost discipline."],
                   ["D · weeks 10+", "Programs + team + client", "Startup programs · marketing refresh · hires · first client (SPPU anchor)."],
               ],
               row_h=0.7, head_h=0.38, size=11.5)
    add_text_box(s, Inches(0.6), Inches(6.0), Inches(12.1), Inches(0.9),
                 [{"text": "Reading: docs/roadmap-unified-paas.md (A–D) + docs/funding-and-infra-plan.md (costs).", "size": 11, "color": MUTED}])

    # ---------- 14 Assigning work ----------
    s = S()
    title_block(s, "OWNERSHIP", "Assigning work — who owns what",
                "Three founders keep ownership. New teammates pick up from an owner.", page=14, total=TOTAL)
    data_table(s, Inches(0.6), Inches(2.1), Inches(12.13),
               [Inches(3.4), Inches(2.6), Inches(6.1)],
               ["Area", "Owner", "Notable open work"],
               [
                   ["Zer0 (product / privacy)", "Paris", "Settle E2E, compliance view-keys, treasury ops."],
                   ["Morph", "Paris + Morph track", "WS memory, agentic wiring, dashboard, demo."],
                   ["REQWID", "Rushi", "Public host gate.zexvro.in, SDK distribution."],
                   ["NFTo (API / chain)", "Nabil + Paris (UI)", "Onboard to credits ledger, smoke mainnet."],
                   ["DEDSEC", "Nabil", "POST/stream gates, rate cards."],
                   ["Credits / RBAC / workspace", "Nabil", "Credits ledger (B1), workspace provisioning (B2)."],
                   ["Platform / control plane", "Paris · Rushi · Nabil", "Service Registry, API Gateway, audit plane."],
               ],
               row_h=0.42, head_h=0.36, size=10.5)
    card(s, Inches(0.6), Inches(6.25), Inches(12.13), Inches(0.72), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(0.85), Inches(6.4), Inches(11.6), Inches(0.45),
                 [{"text": "Quick wins for new members: Registry refactor, test fixes, service READMEs, marketing copy, devrel, curriculum.", "size": 12, "bold": True, "color": SUCCESS}])

    # ---------- 15 Getting started ----------
    s = S()
    title_block(s, "FOR NEW TEAMMATES", "Getting started",
                "A ten-minute onboarding to be productive.", page=15, total=TOTAL)
    bullets(s, Inches(0.6), Inches(2.1), Inches(11.7), Inches(3.6), [
        ("Read, in order: AGENTS.md → context.md → design.md → memory.md.", TEXT),
        "Know the three surfaces (Labs / Console / Console·Zer0) and the five services.",
        "Code layout: frontend/ (dashboard) · services/{nft-service, agent-auth, depin, transformation-agent} · landing/zexvro/.",
        ("Verify per service: cd <service> && npm run lint && npm test && npm run build.", TEXT),
        "Defaults: commit code + a memory.md note together · don't take a ticket without coordination · no secrets / .env in commits.",
        "Log meaningful work in memory.md and update context.md statuses.",
    ], size=13, gap=10)
    card(s, Inches(0.6), Inches(5.9), Inches(12.13), Inches(0.95), fill=HOVER, border=BORDER)
    add_text_box(s, Inches(0.85), Inches(6.1), Inches(11.6), Inches(0.6),
                 [{"text": "New here? Ask Paris, Rushi or Nabil for a pick-up item — Registry refactor and curriculum are the easiest first tasks.", "size": 13, "bold": True, "color": PURPLE}])

    prs.save(str(OUT))
    print(f"saved {OUT}")
    print(f"slides: {TOTAL}")


if __name__ == "__main__":
    build_deck()