#!/usr/bin/env python3
"""Build ZEXVRO enterprise B2B pitch deck (design.md tokens)."""

from __future__ import annotations

import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle
from PIL import Image, ImageDraw, ImageFilter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
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
BLACK = RGBColor(0x05, 0x05, 0x05)

FONT = "Inter"
FONT_MONO = "JetBrains Mono"
FONT_HEAD = "Inter"

# presentation/ (script lives in presentation/imp/scripts/)
ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
ASSETS = Path("/tmp/opencode/pitch/assets")
CHARTS = ROOT / "imp" / "charts"
CHARTS.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "ppt" / "ZEXVRO_Enterprise_Pitch.pptx"

# 16:9 widescreen
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

SERVICES = [
    {
        "name": "Morph",
        "line": "Web2 → Web3 transformation agent",
        "biz": "Migrate product capabilities without a chain tutorial for customers",
        "color": RGBColor(0xF5, 0x9E, 0x0B),
        "icon": ASSETS / "image9.png",
    },
    {
        "name": "Zer0",
        "line": "Private settlement with verifiable proof",
        "biz": "B2B payments that settle privately — prove compliance without a public graph",
        "color": PURPLE,
        "icon": ASSETS / "image7.png",
    },
    {
        "name": "NFTo",
        "line": "Embedded NFT infrastructure",
        "biz": "Issue, manage, checkout inside product UX — scale creators & commerce",
        "color": RGBColor(0xEC, 0x48, 0x99),
        "icon": ASSETS / "image11.png",
    },
    {
        "name": "REQWID",
        "line": "Human vs agent identity layer",
        "biz": "Gate access, price agent traffic, protect free tiers at platform scale",
        "color": BLUE,
        "icon": ASSETS / "image10.png",
    },
    {
        "name": "DEDSEC",
        "line": "x402 paid access for APIs & compute",
        "biz": "HTTP 402 → pay → unlock. Monetize machine traffic before it becomes free-tier abuse",
        "color": SUCCESS,
        "icon": ASSETS / "image13.png",
    },
]


def set_run(run, text, size=14, bold=False, color=TEXT, font=FONT, italic=False):
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    # east asian / latin font hint
    rPr = run._r.get_or_add_rPr()
    for tag in ("latin", "ea", "cs"):
        el = rPr.find(qn(f"a:{tag}"))
        if el is None:
            el = etree.SubElement(rPr, qn(f"a:{tag}"))
        el.set("typeface", font)


def add_text_box(slide, left, top, width, height, paragraphs, valign=MSO_ANCHOR.TOP):
    """paragraphs: list of dicts or strings."""
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
    # send to back
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
    # radius-ish via adj if available
    try:
        shape.adjustments[0] = 0.06
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


def footer(slide, page, total, label="ZEXVRO · Enterprise Web3 PaaS"):
    add_text_box(
        slide,
        Inches(0.6),
        Inches(7.1),
        Inches(8),
        Inches(0.3),
        [{"text": label, "size": 10, "color": MUTED, "font": FONT_MONO}],
    )
    add_text_box(
        slide,
        Inches(11.5),
        Inches(7.1),
        Inches(1.3),
        Inches(0.3),
        [{"text": f"{page:02d} / {total:02d}", "size": 10, "color": MUTED, "font": FONT_MONO, "align": PP_ALIGN.RIGHT}],
    )


def header_meta(slide, kicker="STELLAR BUILDSTATION"):
    add_text_box(
        slide,
        Inches(0.6),
        Inches(0.28),
        Inches(6),
        Inches(0.28),
        [{"text": kicker, "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO}],
    )
    add_text_box(
        slide,
        Inches(9.5),
        Inches(0.28),
        Inches(3.2),
        Inches(0.28),
        [{"text": "zexvro.in", "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO, "align": PP_ALIGN.RIGHT}],
    )


def add_logo(slide, path, left, top, height):
    if not path.exists():
        return None
    im = Image.open(path)
    w, h = im.size
    width = height * (w / h)
    return slide.shapes.add_picture(str(path), left, top, width=width, height=height)


def make_noise_bg(path: Path, w=1920, h=1080):
    import random

    random.seed(42)
    img = Image.new("RGB", (w, h), (5, 5, 5))
    px = img.load()
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            n = random.randint(0, 18)
            px[x, y] = (5 + n, 5 + n, 5 + n)
    # subtle grid
    draw = ImageDraw.Draw(img)
    for x in range(0, w, 80):
        draw.line([(x, 0), (x, h)], fill=(18, 18, 20), width=1)
    for y in range(0, h, 80):
        draw.line([(0, y), (w, y)], fill=(18, 18, 20), width=1)
    # soft vignette center glow
    glow = Image.new("RGB", (w, h), (5, 5, 5))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([w * 0.2, h * 0.1, w * 0.8, h * 0.9], fill=(20, 16, 32))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, glow, 0.35)
    img.save(path, quality=92)
    return path


def chart_style():
    plt.rcParams.update(
        {
            "figure.facecolor": "#050505",
            "axes.facecolor": "#0A0A0B",
            "axes.edgecolor": "#27272A",
            "axes.labelcolor": "#A1A1AA",
            "xtick.color": "#71717A",
            "ytick.color": "#71717A",
            "text.color": "#FAFAFA",
            "font.family": "DejaVu Sans",
            "axes.grid": True,
            "grid.color": "#27272A",
            "grid.linewidth": 0.6,
        }
    )


def build_charts():
    chart_style()

    # 1) Fragmented cost vs unified platform (illustrative index)
    fig, ax = plt.subplots(figsize=(10, 5.2), dpi=160)
    cats = ["Wallet &\nidentity", "Payments\n& privacy", "API\nmonetization", "Agent\ngating", "NFT\ncommerce", "Migration\ntooling"]
    fragmented = [8, 9, 7, 8, 6, 9]
    unified = [2, 2, 2, 2, 2, 2]
    x = range(len(cats))
    w = 0.36
    ax.bar([i - w / 2 for i in x], fragmented, w, color="#3F3F46", label="Fragmented stack (ops load)", edgecolor="#52525B")
    ax.bar([i + w / 2 for i in x], unified, w, color="#7C3AED", label="ZEXVRO unified surface", edgecolor="#A78BFA")
    ax.set_xticks(list(x))
    ax.set_xticklabels(cats, fontsize=9)
    ax.set_ylabel("Relative integration burden (index)", fontsize=10)
    ax.set_title("Platform surface area: many vendors vs one control plane", fontsize=12, pad=12, color="#FAFAFA")
    ax.legend(frameon=False, labelcolor="#A1A1AA", fontsize=9)
    ax.set_ylim(0, 11)
    for spine in ax.spines.values():
        spine.set_color("#27272A")
    fig.tight_layout()
    p1 = CHARTS / "burden_compare.png"
    fig.savefig(p1, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # 2) Architecture diagram
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=160)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis("off")
    fig.patch.set_facecolor("#050505")
    ax.set_facecolor("#050505")

    def box(x, y, w, h, title, sub, face="#111113", edge="#3F3F46", tc="#FAFAFA"):
        r = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.15", linewidth=1.2, edgecolor=edge, facecolor=face)
        ax.add_patch(r)
        ax.text(x + w / 2, y + h * 0.62, title, ha="center", va="center", fontsize=11, fontweight="bold", color=tc)
        ax.text(x + w / 2, y + h * 0.28, sub, ha="center", va="center", fontsize=8, color="#A1A1AA")

    def arrow(x1, y1, x2, y2, c="#3B82F6"):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="->", color=c, lw=1.6))

    box(0.3, 2.4, 2.4, 2.0, "Business apps", "Web2 product · SaaS · games\nAPI platforms · marketplaces", face="#0A0A0B", edge="#52525B")
    box(3.4, 2.4, 2.6, 2.0, "ZEXVRO PaaS", "Dashboard · APIs · SDKs\nAgents · policies · credits", face="#111113", edge="#7C3AED", tc="#FAFAFA")
    box(6.7, 4.5, 2.2, 1.5, "Morph", "Migrate & ship", face="#18181B", edge="#F59E0B")
    box(9.2, 4.5, 2.2, 1.5, "REQWID", "Human / agent", face="#18181B", edge="#3B82F6")
    box(6.7, 2.55, 2.2, 1.5, "DEDSEC", "x402 paywall", face="#18181B", edge="#22C55E")
    box(9.2, 2.55, 2.2, 1.5, "Zer0 + NFTo", "Private settle · NFT", face="#18181B", edge="#A78BFA")
    box(6.7, 0.45, 4.7, 1.5, "Stellar rails", "Settlement · Soroban · USDC/XLM · verifiable receipts", face="#0A0A0B", edge="#3B82F6")

    arrow(2.7, 3.4, 3.4, 3.4)
    arrow(6.0, 3.8, 6.7, 5.1, "#7C3AED")
    arrow(6.0, 3.4, 6.7, 3.3, "#7C3AED")
    arrow(6.0, 3.0, 6.7, 1.2, "#7C3AED")
    arrow(7.8, 2.55, 7.8, 1.95, "#3B82F6")
    arrow(10.3, 2.55, 10.3, 1.95, "#3B82F6")

    ax.text(6.0, 6.55, "Control plane for Web2 teams shipping Web3 capability", ha="center", fontsize=13, color="#FAFAFA", fontweight="bold")
    ax.text(6.0, 6.15, "Chain stays in infrastructure — product UX stays familiar", ha="center", fontsize=9, color="#A1A1AA")
    p2 = CHARTS / "architecture.png"
    fig.savefig(p2, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # 3) Business wedge: B2B → end users → volume
    fig, ax = plt.subplots(figsize=(10, 5.4), dpi=160)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#050505")

    # funnel trapezoids via polygons
    layers = [
        (0.8, 4.6, 8.4, 1.0, "#7C3AED", "1. Business customers", "SaaS, API platforms, studios, marketplaces — the buyer"),
        (1.5, 3.2, 7.0, 1.0, "#3B82F6", "2. Their end users & agents", "Humans + machine clients on their product surface"),
        (2.4, 1.8, 5.2, 1.0, "#22C55E", "3. High-volume events", "Requests, settlements, checkouts, migrations, proofs"),
        (3.3, 0.5, 3.4, 0.9, "#F59E0B", "4. Platform revenue flywheel", "Credits · paid access · settlement · commerce rails"),
    ]
    for x, y, w, h, c, t, s in layers:
        r = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12", linewidth=0, facecolor=c, alpha=0.85)
        ax.add_patch(r)
        ax.text(x + w / 2, y + h * 0.62, t, ha="center", va="center", fontsize=12, fontweight="bold", color="#FAFAFA")
        ax.text(x + w / 2, y + h * 0.28, s, ha="center", va="center", fontsize=8, color="#FAFAFA")
    ax.text(5, 5.85, "Who we sell to (not consumer crypto users)", ha="center", fontsize=13, fontweight="bold", color="#FAFAFA")
    p3 = CHARTS / "business_wedge.png"
    fig.savefig(p3, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # 4) Agent traffic monetization curve (illustrative)
    fig, ax = plt.subplots(figsize=(10, 5.0), dpi=160)
    xs = list(range(0, 11))
    free_abuse = [0, 5, 18, 40, 70, 95, 110, 120, 125, 128, 130]
    with_x402 = [0, 4, 12, 22, 32, 42, 52, 62, 72, 82, 92]
    ax.plot(xs, free_abuse, color="#EF4444", lw=2.4, label="Unpaid agent / free-tier load")
    ax.plot(xs, with_x402, color="#22C55E", lw=2.4, label="With DEDSEC x402 + REQWID policy")
    ax.fill_between(xs, with_x402, free_abuse, color="#7C3AED", alpha=0.18, label="Recoverable margin / protected capacity")
    ax.set_xlabel("Traffic scale (relative)", fontsize=10)
    ax.set_ylabel("Cost / abuse pressure (index)", fontsize=10)
    ax.set_title("Economic access control for machine traffic (illustrative)", fontsize=12, color="#FAFAFA", pad=10)
    ax.legend(frameon=False, labelcolor="#A1A1AA", fontsize=9)
    for spine in ax.spines.values():
        spine.set_color("#27272A")
    fig.tight_layout()
    p4 = CHARTS / "agent_economics.png"
    fig.savefig(p4, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # 5) Migration path flowchart
    fig, ax = plt.subplots(figsize=(11, 3.8), dpi=160)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 4)
    ax.axis("off")
    fig.patch.set_facecolor("#050505")
    steps = [
        (0.4, "Discover", "Inspect Web2\nsurface & risks"),
        (3.2, "Morph", "Agent-assisted\nmigration plan"),
        (6.0, "Wire rails", "DEDSEC · REQWID\nZer0 · NFTo"),
        (8.8, "Ship", "Familiar UX\nStellar under the hood"),
    ]
    for i, (x, t, s) in enumerate(steps):
        r = FancyBboxPatch((x, 1.1), 2.4, 1.8, boxstyle="round,pad=0.02,rounding_size=0.12", linewidth=1.2, edgecolor="#3F3F46", facecolor="#111113")
        ax.add_patch(r)
        ax.text(x + 1.2, 2.35, f"{i+1}. {t}", ha="center", fontsize=12, fontweight="bold", color="#FAFAFA")
        ax.text(x + 1.2, 1.65, s, ha="center", fontsize=8, color="#A1A1AA")
        if i < len(steps) - 1:
            ax.annotate("", xy=(x + 2.55, 2.0), xytext=(x + 2.4, 2.0), arrowprops=dict(arrowstyle="->", color="#3B82F6", lw=1.8))
    ax.text(6, 3.5, "Web2 → Web3 without turning the product into a wallet tutorial", ha="center", fontsize=12, fontweight="bold", color="#FAFAFA")
    p5 = CHARTS / "migration_flow.png"
    fig.savefig(p5, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # 6) Revenue model stacked (illustrative mix for platforms)
    fig, ax = plt.subplots(figsize=(9, 5.0), dpi=160)
    labels = ["API / agent\naccess", "Settlement\n& privacy", "Commerce\n(NFT)", "Migration\n& ops"]
    values = [35, 28, 22, 15]
    colors = ["#22C55E", "#7C3AED", "#EC4899", "#F59E0B"]
    bars = ax.barh(labels, values, color=colors, edgecolor="#27272A", height=0.62)
    ax.set_xlim(0, 50)
    ax.set_xlabel("Illustrative revenue mix for platform buyers (%)", fontsize=10)
    ax.set_title("Where money shows up for businesses on ZEXVRO", fontsize=12, color="#FAFAFA", pad=10)
    for b, v in zip(bars, values):
        ax.text(v + 1.2, b.get_y() + b.get_height() / 2, f"{v}%", va="center", color="#A1A1AA", fontsize=10)
    for spine in ax.spines.values():
        spine.set_color("#27272A")
    fig.tight_layout()
    p6 = CHARTS / "revenue_mix.png"
    fig.savefig(p6, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    return {
        "burden": p1,
        "architecture": p2,
        "wedge": p3,
        "agent": p4,
        "migration": p5,
        "revenue": p6,
    }


def build_deck(charts):
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]
    total = 14
    noise = CHARTS / "noise_bg.jpg"
    make_noise_bg(noise)
    logo = ASSETS / "logo2.png"
    if not logo.exists():
        logo = REPO / "assets/brand/logo2.png"
    mark = ASSETS / "logo.png"
    if not mark.exists():
        mark = REPO / "assets/brand/logo.png"

    # ---- 1 Title ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    s.shapes.add_picture(str(noise), 0, 0, SLIDE_W, SLIDE_H)
    # dark overlay
    ov = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    ov.fill.solid()
    ov.fill.fore_color.rgb = BG
    ov.fill.fore_color.rgb = RGBColor(0x05, 0x05, 0x05)
    # reduce opacity not easy — redraw solid and light noise later
    solid_bg(s)
    accent_bar(s, 0, 0, Inches(0.08), SLIDE_H, PURPLE)
    add_logo(s, logo, Inches(0.7), Inches(0.55), Inches(0.72))
    pill(s, Inches(0.7), Inches(1.55), Inches(2.6), Inches(0.34), "STELLAR BUILDSTATION", HOVER, TEXT2, 10)
    pill(s, Inches(3.45), Inches(1.55), Inches(1.7), Inches(0.34), "B2B  ·  PaaS", HOVER, TEXT2, 10)
    add_text_box(
        s,
        Inches(0.7),
        Inches(2.2),
        Inches(11.5),
        Inches(1.6),
        [
            {"text": "Web2 products. Web3 rails.", "size": 40, "bold": True, "color": TEXT},
            {"text": "Built for businesses that will onboard millions of users.", "size": 20, "color": TEXT2, "space_before": 10},
        ],
    )
    add_text_box(
        s,
        Inches(0.7),
        Inches(4.3),
        Inches(10),
        Inches(1.2),
        [
            {
                "text": "ZEXVRO is a unified Web3 PaaS — private, verifiable, agent-ready infrastructure on Stellar,",
                "size": 15,
                "color": TEXT2,
            },
            {
                "text": "so product teams ship capability without chain-first UX for their customers.",
                "size": 15,
                "color": TEXT2,
            },
        ],
    )
    card(s, Inches(0.7), Inches(5.7), Inches(3.6), Inches(0.85), RAISED, BORDER)
    add_text_box(
        s,
        Inches(0.9),
        Inches(5.85),
        Inches(3.2),
        Inches(0.6),
        [
            {"text": "BUYER", "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO},
            {"text": "Platforms · SaaS · Studios", "size": 13, "bold": True, "color": TEXT},
        ],
    )
    card(s, Inches(4.5), Inches(5.7), Inches(3.6), Inches(0.85), RAISED, BORDER)
    add_text_box(
        s,
        Inches(4.7),
        Inches(5.85),
        Inches(3.2),
        Inches(0.6),
        [
            {"text": "OUTCOME", "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO},
            {"text": "Scale users · monetize agents", "size": 13, "bold": True, "color": TEXT},
        ],
    )
    card(s, Inches(8.3), Inches(5.7), Inches(4.2), Inches(0.85), RAISED, BORDER)
    add_text_box(
        s,
        Inches(8.5),
        Inches(5.85),
        Inches(3.8),
        Inches(0.6),
        [
            {"text": "RAILS", "size": 10, "bold": True, "color": MUTED, "font": FONT_MONO},
            {"text": "Stellar · APIs · Agents · Dashboard", "size": 13, "bold": True, "color": TEXT},
        ],
    )
    footer(s, 1, total)

    # ---- 2 Who we sell to ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), BLUE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.9),
        [
            {"text": "Not consumer crypto users", "size": 28, "bold": True},
            {"text": "We sell infrastructure to businesses. Their customers — humans and agents — create volume.", "size": 14, "color": TEXT2, "space_before": 6},
        ],
    )
    s.shapes.add_picture(str(charts["wedge"]), Inches(0.7), Inches(1.9), width=Inches(7.4))
    card(s, Inches(8.4), Inches(1.9), Inches(4.3), Inches(4.5))
    add_text_box(
        s,
        Inches(8.65),
        Inches(2.15),
        Inches(3.9),
        Inches(4.0),
        [
            {"text": "ENTERPRISE LENS", "size": 11, "bold": True, "color": BLUE, "font": FONT_MONO},
            {"text": "Why this matters", "size": 18, "bold": True, "space_before": 8},
            {"text": "• One business customer can mean 10k–10M end users", "size": 13, "color": TEXT2, "space_before": 12},
            {"text": "• Agent traffic multiplies request volume overnight", "size": 13, "color": TEXT2, "space_before": 6},
            {"text": "• Paid access + settlement = real platform economics", "size": 13, "color": TEXT2, "space_before": 6},
            {"text": "• Privacy & proofs unlock B2B payment use cases", "size": 13, "color": TEXT2, "space_before": 6},
            {"text": "We optimize for seats that move money — not vanity wallets.", "size": 13, "color": TEXT, "bold": True, "space_before": 16},
        ],
    )
    footer(s, 2, total)

    # ---- 3 Problem ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), DANGER)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.85),
        [
            {"text": "The problem", "size": 28, "bold": True},
            {"text": "Web2 teams want Web3 capability — without chain-first UX for their customers.", "size": 14, "color": TEXT2, "space_before": 6},
        ],
    )
    problems = [
        ("01", "APIs can’t monetize machines", "Agents hit free endpoints. No clean pay-per-request layer.", DANGER),
        ("02", "Migration is painful", "Teams fear turning the product into a wallet tutorial.", WARNING),
        ("03", "Trust is broken", "Platforms claim “ready” without status, proof, or honest limits.", PURPLE),
        ("04", "Six products ≠ one story", "Selling everything at once kills credibility with buyers.", BLUE),
    ]
    for i, (n, t, d, c) in enumerate(problems):
        col = i % 2
        row = i // 2
        left = Inches(0.6 + col * 6.35)
        top = Inches(1.85 + row * 2.35)
        card(s, left, top, Inches(6.05), Inches(2.15))
        accent_bar(s, left, top, Inches(0.08), Inches(2.15), c)
        add_text_box(
            s,
            left + Inches(0.35),
            top + Inches(0.3),
            Inches(5.4),
            Inches(1.6),
            [
                {"text": n, "size": 12, "bold": True, "color": c, "font": FONT_MONO},
                {"text": t, "size": 18, "bold": True, "space_before": 8},
                {"text": d, "size": 13, "color": TEXT2, "space_before": 8},
            ],
        )
    footer(s, 3, total)

    # ---- 4 Burden graph ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), PURPLE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.75),
        [
            {"text": "Fragmented stack vs one control plane", "size": 26, "bold": True},
            {"text": "Businesses don’t want six vendors for migration, identity, paywalls, privacy, and commerce.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    s.shapes.add_picture(str(charts["burden"]), Inches(0.55), Inches(1.65), width=Inches(12.2))
    footer(s, 4, total)

    # ---- 5 Solution ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), SUCCESS)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11.5),
        Inches(1.0),
        [
            {"text": "The solution", "size": 28, "bold": True},
            {"text": "One developer-first platform for private, verifiable, agent-ready capability on Stellar.", "size": 15, "color": TEXT2, "space_before": 6},
        ],
    )
    pillars = [
        ("Private", "Settlement & proofs without exposing the full payment graph", SUCCESS),
        ("Verifiable", "Honest status, receipts, and limits — not vapor claims", BLUE),
        ("Agent-ready", "Classify, price, and unlock machine traffic cleanly", PURPLE),
        ("Product-first", "Chain stays in infra — UX stays familiar for end users", WARNING),
    ]
    for i, (t, d, c) in enumerate(pillars):
        left = Inches(0.6 + i * 3.15)
        card(s, left, Inches(2.1), Inches(3.0), Inches(3.8))
        accent_bar(s, left, Inches(2.1), Inches(3.0), Inches(0.08), c)
        add_text_box(
            s,
            left + Inches(0.25),
            Inches(2.5),
            Inches(2.5),
            Inches(3.0),
            [
                {"text": f"0{i+1}", "size": 12, "bold": True, "color": c, "font": FONT_MONO},
                {"text": t, "size": 20, "bold": True, "space_before": 14},
                {"text": d, "size": 13, "color": TEXT2, "space_before": 14},
            ],
        )
    footer(s, 5, total)

    # ---- 6 Architecture ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), BLUE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.55),
        [{"text": "Platform architecture", "size": 26, "bold": True}],
    )
    s.shapes.add_picture(str(charts["architecture"]), Inches(0.4), Inches(1.35), width=Inches(12.5))
    footer(s, 6, total)

    # ---- 7 Five services ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), PURPLE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "Five MVP services. One platform story.", "size": 26, "bold": True},
            {"text": "Each product is a revenue surface for the business — not a toy feature for hobby wallets.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    for i, svc in enumerate(SERVICES):
        left = Inches(0.45 + i * 2.55)
        card(s, left, Inches(1.75), Inches(2.4), Inches(4.85))
        accent_bar(s, left, Inches(1.75), Inches(2.4), Inches(0.07), svc["color"])
        if svc["icon"].exists():
            try:
                s.shapes.add_picture(str(svc["icon"]), left + Inches(0.55), Inches(2.05), width=Inches(1.3), height=Inches(1.3))
            except Exception:
                pass
        add_text_box(
            s,
            left + Inches(0.15),
            Inches(3.45),
            Inches(2.1),
            Inches(2.9),
            [
                {"text": svc["name"], "size": 16, "bold": True, "align": PP_ALIGN.CENTER},
                {"text": svc["line"], "size": 11, "color": TEXT2, "align": PP_ALIGN.CENTER, "space_before": 8},
                {"text": svc["biz"], "size": 11, "color": MUTED, "align": PP_ALIGN.CENTER, "space_before": 12},
            ],
        )
    footer(s, 7, total)

    # ---- 8 Money path ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), SUCCESS)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "How businesses make money on the rails", "size": 26, "bold": True},
            {"text": "Illustrative mix — real pricing follows usage, not token hype.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    s.shapes.add_picture(str(charts["revenue"]), Inches(0.5), Inches(1.55), width=Inches(7.2))
    card(s, Inches(8.0), Inches(1.7), Inches(4.7), Inches(4.7))
    add_text_box(
        s,
        Inches(8.25),
        Inches(1.95),
        Inches(4.3),
        Inches(4.3),
        [
            {"text": "UNIT ECONOMICS LENS", "size": 11, "bold": True, "color": SUCCESS, "font": FONT_MONO},
            {"text": "Volume compounds at the edge", "size": 16, "bold": True, "space_before": 10},
            {"text": "1 business seat", "size": 13, "color": TEXT2, "space_before": 14},
            {"text": "→ N end users + agents", "size": 13, "color": TEXT2, "space_before": 4},
            {"text": "→ M billable events / day", "size": 13, "color": TEXT2, "space_before": 4},
            {"text": "→ credits, 402 unlocks, settlement, commerce", "size": 13, "color": TEXT2, "space_before": 4},
            {"text": "We design for platforms where one design partner can unlock more traffic than a thousand retail wallets.", "size": 13, "color": TEXT, "space_before": 16},
        ],
    )
    footer(s, 8, total)

    # ---- 9 Agent economics graph ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), SUCCESS)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "Agent traffic is a business problem", "size": 26, "bold": True},
            {"text": "DEDSEC (x402) + REQWID turn free-tier abuse into priced, policy-aware access.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    s.shapes.add_picture(str(charts["agent"]), Inches(0.55), Inches(1.55), width=Inches(12.2))
    footer(s, 9, total)

    # ---- 10 Migration flow ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), WARNING)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "Morph: Web2 → Web3 without the tutorial tax", "size": 24, "bold": True},
            {"text": "Migration is a product workflow — not a multi-month chain consulting project.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    s.shapes.add_picture(str(charts["migration"]), Inches(0.5), Inches(1.7), width=Inches(12.3))
    # three outcome cards
    for i, (t, d) in enumerate(
        [
            ("Keep product UX", "Customers stay in familiar flows — wallets optional, not the product."),
            ("Ship faster", "Agent + MCP tooling shortens migration paths for real codebases."),
            ("Land revenue rails", "Wire DEDSEC / REQWID / NFTo / Zer0 where the business model needs them."),
        ]
    ):
        left = Inches(0.6 + i * 4.2)
        card(s, left, Inches(4.6), Inches(4.0), Inches(1.85))
        add_text_box(
            s,
            left + Inches(0.25),
            Inches(4.8),
            Inches(3.5),
            Inches(1.5),
            [
                {"text": t, "size": 15, "bold": True},
                {"text": d, "size": 12, "color": TEXT2, "space_before": 8},
            ],
        )
    footer(s, 10, total)

    # ---- 11 Services deep (business outcomes) ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), PURPLE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.55),
        [{"text": "Business outcomes by service", "size": 26, "bold": True}],
    )
    rows = [
        ("Morph", "Lower migration cost & time-to-Web3", "Product teams ship capability without hiring a chain squad", WARNING),
        ("Zer0", "B2B private settlement", "Prove payment without broadcasting the full commercial graph", PURPLE),
        ("NFTo", "Embedded commerce", "Collections & checkout inside the product — scale creators/users", RGBColor(0xEC, 0x48, 0x99)),
        ("REQWID", "Trust at the edge", "Price and route human vs agent traffic with honest confidence", BLUE),
        ("DEDSEC", "Monetize machine demand", "HTTP 402 → pay → unlock. Capacity stops being free by default", SUCCESS),
    ]
    for i, (name, outcome, detail, c) in enumerate(rows):
        top = Inches(1.45 + i * 1.0)
        card(s, Inches(0.6), top, Inches(12.1), Inches(0.9))
        accent_bar(s, Inches(0.6), top, Inches(0.08), Inches(0.9), c)
        add_text_box(s, Inches(0.95), top + Inches(0.22), Inches(2.0), Inches(0.5), [{"text": name, "size": 16, "bold": True, "color": c}])
        add_text_box(s, Inches(3.1), top + Inches(0.15), Inches(4.2), Inches(0.65), [{"text": outcome, "size": 14, "bold": True}, {"text": detail, "size": 12, "color": TEXT2, "space_before": 2}])
        add_text_box(
            s,
            Inches(8.0),
            top + Inches(0.28),
            Inches(4.4),
            Inches(0.45),
            [{"text": "Buyer impact → retention, margin, scale", "size": 12, "color": MUTED, "align": PP_ALIGN.RIGHT}],
        )
    footer(s, 11, total)

    # ---- 12 Why Stellar ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), BLUE)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "Why Stellar for business rails", "size": 26, "bold": True},
            {"text": "Settlement-grade network for payments, agents, and product commerce — not a casino UI.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    items = [
        ("Fast settlement", "Business workflows need confirmation that feels like software, not a waiting room."),
        ("Asset rails", "USDC / XLM-style settlement where product money already lives."),
        ("Soroban programs", "Programmable receipts, NFT collections, and paywall verification."),
        ("Agent-compatible", "Machine clients can pay and prove without a browser-only wallet dance."),
        ("Enterprise posture", "Clear ops surfaces: environments, proofs, status — claim-safe."),
        ("One story", "Infrastructure under the product — buyers sell features, not chains."),
    ]
    for i, (t, d) in enumerate(items):
        col = i % 3
        row = i // 3
        left = Inches(0.6 + col * 4.2)
        top = Inches(1.7 + row * 2.4)
        card(s, left, top, Inches(4.0), Inches(2.15))
        add_text_box(
            s,
            left + Inches(0.3),
            top + Inches(0.35),
            Inches(3.4),
            Inches(1.6),
            [
                {"text": t, "size": 16, "bold": True},
                {"text": d, "size": 13, "color": TEXT2, "space_before": 10},
            ],
        )
    footer(s, 12, total)

    # ---- 13 Proof / demos claim-safe ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    header_meta(s)
    accent_bar(s, Inches(0.6), Inches(0.72), Inches(0.08), Inches(0.42), WARNING)
    add_text_box(
        s,
        Inches(0.85),
        Inches(0.7),
        Inches(11),
        Inches(0.7),
        [
            {"text": "Proof points (claim-safe)", "size": 26, "bold": True},
            {"text": "We show working surfaces — not vapor. Status matches product reality.", "size": 13, "color": TEXT2, "space_before": 4},
        ],
    )
    proofs = [
        ("Product UI", "Zer0 & NFTo product surfaces live in the console", SUCCESS),
        ("DEDSEC path", "Unpaid → HTTP 402 → payment verification path in progress", WARNING),
        ("Morph", "CLI + agentic migration track; demos (e.g. arcade / PromptWars)", WARNING),
        ("REQWID / Gate", "Human vs agent gate — classification & captcha surfaces shipping", WARNING),
        ("Demos", "Live product demos for migration & commerce narratives", BLUE),
        ("Honesty rule", "No “fully shipped” claims beyond documented status", PURPLE),
    ]
    for i, (t, d, c) in enumerate(proofs):
        col = i % 3
        row = i // 3
        left = Inches(0.6 + col * 4.2)
        top = Inches(1.7 + row * 2.4)
        card(s, left, top, Inches(4.0), Inches(2.15))
        accent_bar(s, left, top, Inches(0.08), Inches(2.15), c)
        add_text_box(
            s,
            left + Inches(0.3),
            top + Inches(0.35),
            Inches(3.4),
            Inches(1.6),
            [
                {"text": t, "size": 16, "bold": True},
                {"text": d, "size": 13, "color": TEXT2, "space_before": 10},
            ],
        )
    footer(s, 13, total)

    # ---- 14 Close / CTA ----
    s = prs.slides.add_slide(blank)
    solid_bg(s)
    accent_bar(s, 0, 0, Inches(0.08), SLIDE_H, PURPLE)
    add_logo(s, logo, Inches(0.7), Inches(0.55), Inches(0.65))
    add_text_box(
        s,
        Inches(0.7),
        Inches(1.8),
        Inches(12),
        Inches(1.4),
        [
            {"text": "Build with businesses that scale.", "size": 36, "bold": True},
            {"text": "Thank you — let’s ship private, verifiable, agent-ready infrastructure.", "size": 18, "color": TEXT2, "space_before": 12},
        ],
    )
    ctas = [
        ("Console", "zexvro.in", BLUE),
        ("Positioning", "Web2 → Web3 PaaS", PURPLE),
        ("Network", "Stellar", SUCCESS),
        ("Contact", "@zexvro.in", WARNING),
    ]
    for i, (k, v, c) in enumerate(ctas):
        left = Inches(0.7 + i * 3.1)
        card(s, left, Inches(3.8), Inches(2.9), Inches(1.5))
        accent_bar(s, left, Inches(3.8), Inches(2.9), Inches(0.07), c)
        add_text_box(
            s,
            left + Inches(0.2),
            Inches(4.1),
            Inches(2.5),
            Inches(1.0),
            [
                {"text": k, "size": 11, "bold": True, "color": MUTED, "font": FONT_MONO},
                {"text": v, "size": 16, "bold": True, "space_before": 8},
            ],
        )
    add_text_box(
        s,
        Inches(0.7),
        Inches(5.7),
        Inches(12),
        Inches(0.8),
        [
            {
                "text": "We don’t chase individual wallets. We equip platforms that will onboard the users — and the volume.",
                "size": 14,
                "color": TEXT2,
            },
        ],
    )
    footer(s, 14, total, "ZEXVRO · Stellar BuildStation · Confidential if needed")

    # soft transitions via presentation defaults (pptx limited) — skip
    prs.save(OUT)
    return OUT


def main():
    print("Building charts…")
    charts = build_charts()
    print("Building deck…")
    path = build_deck(charts)
    # also overwrite main ZEXVRO.pptx with enterprise version? keep separate + copy as primary pitch
    primary = ROOT / "ppt" / "ZEXVRO.pptx"
    # backup old if different
    import shutil

    if primary.exists():
        bak = ROOT / "ppt" / "ZEXVRO_arcade_backup.pptx"
        if not bak.exists():
            shutil.copy2(primary, bak)
            print(f"Backed up previous deck → {bak}")
    primary.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, primary)
    print(f"Wrote {path}")
    print(f"Also set {primary}")
    # memory note path for agent
    print("Done.")


if __name__ == "__main__":
    main()
