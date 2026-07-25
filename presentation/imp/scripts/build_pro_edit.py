#!/usr/bin/env python3
"""
PRO MAX founder cut — motion B-roll, brand graphics, Montserrat kinetic type.
Talking-head base + full-screen motion inserts + PiP + grade + end card.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

SRC = Path("/home/paris/Downloads/IMG_1817.MOV")
MKT = Path("/home/paris/Documents/ZEXVRO/frontend/public/marketing")
OUT_DIR = Path("/home/paris/Documents/ZEXVRO/presentation")
FONT_DIR = OUT_DIR / "fonts"
ASS = OUT_DIR / "img1817_pro.ass"
OUT_MP4 = OUT_DIR / "IMG_1817_pro.mp4"
OUT_PREVIEW = OUT_DIR / "IMG_1817_pro_preview.mp4"
WORK = OUT_DIR / "_pro_work"

# B-roll sources
PIXEL = Path("/home/paris/Downloads/Pixel_LED_grid_ZEXVRO_logo_202607170124.mp4")
WORDMARK = Path("/home/paris/Downloads/ZEXVRO_wordmark_reveal_animation_202607051513.mp4")
MISSION = MKT / "mission-brief_gwr_video_mvp.mp4"
ASSEMBLE = MKT / "NFT-Assemble_gwr_video_mvp.mp4"
FUEL = MKT / "NFT-fuleing_gwr_video_mvp.mp4"
LAUNCH = MKT / "NFT_Launch.mp4"
BOOT = MKT / "Platform-bootup.mp4"
BRAND = MKT / "watermark-removed-Brand_intro_animation_logo_assembly_202607162304.mp4"
LOGO = Path("/home/paris/Documents/ZEXVRO/frontend/public/brand/logo-transparent.png")
CUBES = Path("/home/paris/Documents/ZEXVRO/landing/zexvro/dist/cubes.png")
DEPLOY_STILL = Path(
    "/home/paris/Documents/ZEXVRO/landing/zexvro/dist/Deploy NTFs with just some clicks.png"
)

# Kinetic product beats — short, loud, Montserrat Black
# start, end, main, sub, style
BEATS: list[tuple[float, float, str, str, str]] = [
    (0.15, 2.4, "ZEXVRO", "THE PLATFORM FOR WEB3 ADOPTION", "open"),
    (2.5, 4.3, "PARIS", "16  ·  BUILDER  ·  PUNE", "lower"),
    (4.3, 6.9, "I BUILD", "ZEXVRO", "lower"),
    (7.1, 10.6, "WEB3 STARTUPS", "sell to users", "stack"),
    (10.6, 14.6, "WE SELL", "TO BUSINESSES", "slam"),
    (14.8, 18.8, "ADOPTION STARTS", "WITH THE PRODUCT", "stack"),
    (18.9, 23.5, "1 INTEGRATION", "MILLIONS OF USERS", "slam"),
    (23.6, 28.2, "NO HABIT CHANGE", "Web3 under the hood", "stack"),
    (28.4, 33.0, "INFRASTRUCTURE", "APIs · SDKs · tooling", "broll"),
    (33.0, 37.8, "ZK PAYROLL", "NFT · Morph · more", "broll"),
    (37.9, 42.0, "SHIP PRODUCT", "not crypto cosplay", "stack"),
    (42.1, 46.3, "MORPH", "AI agent on your machine", "slam"),
    (46.4, 51.0, "WEB2  →  WEB3", "transform the codebase", "broll"),
    (51.1, 55.2, "AGENTS + TOOLS", "services that ship", "stack"),
    (55.2, 59.0, "MIGRATE FULL-STACK", "without rewriting everything", "stack"),
    (59.2, 64.0, "MISSION", "Web3 as easy as cloud APIs", "slam"),
    (64.1, 68.5, "INTEGRATE ONCE", "ADOPT EVERYWHERE", "slam"),
    (68.6, 72.4, "ZEXVRO", "zexvro.com", "end"),
]


def ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    cs = int(round((t - int(t)) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def esc(t: str) -> str:
    return t.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")


def d(start: float, end: float, style: str, text: str, layer: int = 0) -> str:
    return f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{text}\n"


def build_ass() -> str:
    # Montserrat Black / ExtraBold — IG / startup edit energy
    header = """[Script Info]
Title: ZEXVRO Pro Max Cut
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: OpenMain,Montserrat Black,118,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,10,0,1,0,0,5,0,0,0,1
Style: OpenSub,Montserrat Bold,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: LowerMain,Montserrat Black,78,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,1,0,1,6,3,2,70,70,170,1
Style: LowerSub,Montserrat Bold,36,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,3,0,1,4,2,2,70,70,100,1
Style: StackMain,Montserrat Black,72,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,0,0,1,6,3,2,80,80,200,1
Style: StackSub,Montserrat ExtraBold,48,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,1,0,1,5,2,2,80,80,125,1
Style: SlamMain,Montserrat Black,96,&H00FFFFFF,&H000000FF,&H00000000,&HC0000000,-1,0,0,0,100,100,2,0,1,8,3,5,60,60,0,1
Style: SlamSub,Montserrat Black,52,&H00FFFFFF,&H000000FF,&H00000000,&HC0000000,-1,0,0,0,100,100,3,0,1,5,2,5,60,60,0,1
Style: BrollMain,Montserrat Black,88,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,2,0,1,7,3,2,80,80,180,1
Style: BrollSub,Montserrat Bold,40,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,2,0,1,4,2,2,80,80,105,1
Style: EndMain,Montserrat Black,130,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,12,0,1,0,0,5,0,0,0,1
Style: EndSub,Montserrat Bold,36,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,10,0,1,0,0,5,0,0,0,1
Style: Chrome,Montserrat Bold,18,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,2,0,7,36,36,28,1
Style: Chapter,Montserrat Bold,18,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,2,0,9,36,36,28,1
Style: Draw,Montserrat Bold,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Chip,Montserrat Bold,26,&H00000000,&H000000FF,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,2,0,3,0,0,7,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev: list[str] = []

    # chrome
    ev.append(
        d(2.4, 68.3, "Chrome", r"{\fad(400,300)\alpha&H30&}ZEXVRO  ·  FOUNDER CUT", 0)
    )
    chapters = [
        (2.4, 14.6, "01  THESIS"),
        (14.6, 28.3, "02  ADOPTION"),
        (28.3, 42.0, "03  PLATFORM"),
        (42.0, 59.0, "04  MORPH"),
        (59.0, 68.3, "05  MISSION"),
    ]
    for s, e, lab in chapters:
        ev.append(d(s, e, "Chapter", rf"{{\fad(200,200)\alpha&H28&}}{esc(lab)}", 0))

    # bottom progress
    steps = [
        (2.4, 14.6, 384),
        (14.6, 28.3, 768),
        (28.3, 42.0, 1152),
        (42.0, 59.0, 1536),
        (59.0, 68.3, 1920),
    ]
    for s, e, w in steps:
        track = (
            r"{\an1\pos(0,1076)\p1\bord0\shad0\c&HFFFFFF&\alpha&HC8&}"
            r"m 0 0 l 1920 0 l 1920 4 l 0 4{\p0}"
        )
        fill = (
            rf"{{\an1\pos(0,1076)\p1\bord0\shad0\c&HFFFFFF&\alpha&H20&}}"
            rf"m 0 0 l {w} 0 l {w} 4 l 0 4{{\p0}}"
        )
        ev.append(d(s, e, "Draw", track, 0))
        ev.append(d(s, e, "Draw", fill, 1))

    # chip tags on broll windows
    chips = [
        (10.6, 14.6, "THESIS"),
        (28.4, 33.0, "ASSEMBLE"),
        (33.0, 37.8, "FUEL"),
        (42.1, 46.3, "MORPH"),
        (46.4, 51.0, "LAUNCH"),
        (64.1, 68.5, "BRAND"),
    ]
    for s, e, lab in chips:
        # white pill via BorderStyle 3 opaque box
        chip = rf"{{\fad(120,120)\bord8\shad0\3c&HFFFFFF&\4c&HFFFFFF&\c&H000000&}}  {esc(lab)}  "
        ev.append(d(s, e, "Chip", chip, 2))

    for start, end, main, sub, mode in BEATS:
        fo = 130
        fi = 60

        if mode == "open":
            anim = (
                r"{\an5\pos(960,480)\fad(180,200)"
                r"\fscx55\fscy55\fsp18"
                r"\t(0,200,\fscx108\fscy108\fsp8)"
                r"\t(200,280,\fscx100\fscy100\fsp10)}"
            )
            ev.append(d(start, end, "OpenMain", f"{anim}{esc(main)}", 4))
            if sub:
                sa = r"{\an5\pos(960,590)\fad(280,200)\fsp6\fscx90\fscy90\t(80,220,\fscx100\fscy100)}"
                ev.append(d(start + 0.28, end, "OpenSub", f"{sa}{esc(sub)}", 4))
            # draw line
            line = (
                r"{\an5\pos(960,540)\fad(100,150)\p1\bord0\c&HFFFFFF&\alpha&H20&"
                r"\fscx0\t(100,280,\fscx100)}"
                r"m 0 0 l 200 0 l 200 3 l 0 3{\p0}"
            )
            ev.append(d(start + 0.2, end, "Draw", line, 3))
            continue

        if mode == "end":
            anim = (
                r"{\an5\pos(960,470)\fad(220,400)"
                r"\fscx70\fscy70\fsp16"
                r"\t(0,260,\fscx100\fscy100\fsp10)}"
            )
            ev.append(d(start, end, "EndMain", f"{anim}{esc(main)}", 4))
            if sub:
                sa = r"{\an5\pos(960,580)\fad(350,400)\fsp8}"
                ev.append(d(start + 0.4, end, "EndSub", f"{sa}{esc(sub)}", 4))
            continue

        if mode == "slam":
            # full center impact cards
            anim = (
                r"{\an5\pos(960,500)\fad(50,140)"
                r"\fscx50\fscy50"
                r"\t(0,90,\fscx115\fscy115)"
                r"\t(90,160,\fscx100\fscy100)}"
            )
            ev.append(d(start, end, "SlamMain", f"{anim}{esc(main)}", 4))
            if sub:
                sa = (
                    r"{\an5\pos(960,600)\fad(90,140)"
                    r"\fscx80\fscy80\t(0,120,\fscx100\fscy100)}"
                )
                ev.append(
                    d(start + 0.18, end, "SlamSub", f"{sa}{esc(sub)}", 4)
                )
            # flash ring bar
            bar = (
                r"{\an5\pos(960,545)\fad(80,100)\p1\bord0\c&HFFFFFF&\alpha&H30&"
                r"\fscx0\t(60,200,\fscx100)}"
                r"m 0 0 l 220 0 l 220 4 l 0 4{\p0}"
            )
            ev.append(d(start + 0.1, end, "Draw", bar, 3))
            continue

        if mode == "broll":
            # big type over motion graphics
            anim = (
                r"{\an2\pos(960,820)\fad(70,140)"
                r"\fscx70\fscy70"
                r"\t(0,100,\fscx108\fscy108)"
                r"\t(100,170,\fscx100\fscy100)}"
            )
            ev.append(d(start, end, "BrollMain", f"{anim}{esc(main)}", 4))
            if sub:
                sa = r"{\an2\pos(960,920)\fad(100,140)\fscx90\fscy90\t(0,110,\fscx100\fscy100)}"
                ev.append(
                    d(start + 0.2, end, "BrollSub", f"{sa}{esc(sub)}", 4)
                )
            continue

        if mode == "stack":
            anim = (
                r"{\an2\pos(960,780)\fad(70,130)"
                r"\fscx85\fscy85"
                r"\t(0,100,\fscx104\fscy104)"
                r"\t(100,160,\fscx100\fscy100)}"
            )
            ev.append(d(start, end, "StackMain", f"{anim}{esc(main)}", 4))
            if sub:
                sa = (
                    r"{\an2\pos(960,870)\fad(90,130)"
                    r"\fscx88\fscy88\t(0,110,\fscx100\fscy100)}"
                )
                ev.append(
                    d(start + 0.18, end, "StackSub", f"{sa}{esc(sub)}", 4)
                )
            continue

        # lower thirds
        anim = (
            r"{\an2\pos(960,860)\fad(70,120)"
            r"\fscx80\fscy80"
            r"\t(0,100,\fscx105\fscy105)"
            r"\t(100,160,\fscx100\fscy100)}"
        )
        ev.append(d(start, end, "LowerMain", f"{anim}{esc(main)}", 4))
        if sub:
            sa = r"{\an2\pos(960,940)\fad(90,120)\fscx90\fscy90\t(0,100,\fscx100\fscy100)}"
            ev.append(d(start + 0.16, end, "LowerSub", f"{sa}{esc(sub)}", 4))

    # chapter flash cuts
    for t in (10.6, 14.8, 28.4, 42.1, 46.4, 59.2, 64.1):
        flash = (
            r"{\an5\pos(960,540)\p1\bord0\c&HFFFFFF&\alpha&HA8&"
            r"\t(0,90,\alpha&HFF&)}"
            r"m 0 0 l 1920 0 l 1920 1080 l 0 1080{\p0}"
        )
        ev.append(d(t, t + 0.1, "Draw", flash, 8))

    return header + "".join(ev)


def run(cmd: list) -> None:
    print("+", " ".join(str(c) for c in cmd[:10]), "...")
    subprocess.run(cmd, check=True)


def prepare() -> dict[str, Path]:
    WORK.mkdir(parents=True, exist_ok=True)
    from PIL import Image

    logo = WORK / "logo.png"
    cubes = WORK / "cubes.png"
    deploy = WORK / "deploy.png"

    Image.open(LOGO).convert("RGBA").resize((160, 160), Image.Resampling.LANCZOS).save(
        logo
    )
    # cubes may be large — make PiP card
    c = Image.open(CUBES).convert("RGBA")
    c.thumbnail((640, 640), Image.Resampling.LANCZOS)
    c.save(cubes)
    if DEPLOY_STILL.exists():
        d_img = Image.open(DEPLOY_STILL).convert("RGBA")
        d_img.thumbnail((720, 440), Image.Resampling.LANCZOS)
        d_img.save(deploy)
    else:
        deploy = cubes
    return {"logo": logo, "cubes": cubes, "deploy": deploy}


def esc_fc(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", "\\:").replace("'", r"\'")


def build_filter(assets: dict[str, Path]) -> str:
    """
    Inputs:
      0 main talk
      1 pixel loop
      2 mission loop
      3 assemble loop
      4 fuel loop
      5 launch loop
      6 boot loop
      7 brand loop
      8 wordmark loop
      9 logo still
      10 cubes still
      11 deploy still
    """
    ass = esc_fc(ASS)
    fonts = esc_fc(FONT_DIR)

    # grade talking head
    # Fullscreen B-roll inserts with soft edge fade via alpha enable + fade filter on clip
    # Windows:
    #  0.0-2.5   pixel open
    # 10.6-14.6  mission (thesis slam)
    # 28.4-33.0  assemble
    # 33.0-37.8  fuel
    # 42.1-46.3  boot (morph)
    # 46.4-51.0  launch
    # 59.2-64.0  brand (mission)
    # 64.1-68.5  brand cont / pixel
    # 68.6-72.5  wordmark end

    fc = f"""
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,
eq=contrast=1.14:brightness=-0.03:saturation=0.88,
colorbalance=rs=0.03:bs=-0.04:rm=0.02:bm=-0.02,
unsharp=5:5:0.5:5:5:0.0,
vignette=PI/4.5,
fade=t=in:st=0:d=0.45,
fade=t=out:st=71.7:d=0.85,
format=rgba[main];

[1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1:saturation=0.7[pixel];
[2:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.15[mission];
[3:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[assemble];
[4:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[fuel];
[5:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.12[launch];
[6:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[boot];
[7:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.08[brand];
[8:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.05[wm];

[main][pixel]overlay=0:0:format=auto:enable='between(t,0,2.55)'[v01];
[v01][mission]overlay=0:0:format=auto:enable='between(t,10.55,14.65)'[v02];
[v02][assemble]overlay=0:0:format=auto:enable='between(t,28.35,33.05)'[v03];
[v03][fuel]overlay=0:0:format=auto:enable='between(t,33.0,37.85)'[v04];
[v04][boot]overlay=0:0:format=auto:enable='between(t,42.05,46.35)'[v05];
[v05][launch]overlay=0:0:format=auto:enable='between(t,46.35,51.05)'[v06];
[v06][brand]overlay=0:0:format=auto:enable='between(t,59.15,64.05)'[v07];
[v07][pixel]overlay=0:0:format=auto:enable='between(t,64.05,68.55)'[v08];
[v08][wm]overlay=0:0:format=auto:enable='between(t,68.55,72.55)'[v09];

[10:v]format=rgba,scale=420:-1[cubes];
[cubes]fade=t=in:st=0:d=0.25:alpha=1,colorchannelmixer=aa=0.92[cubes_a];
[v09][cubes_a]overlay=W-w-48:120:enable='between(t,19.0,28.2)'[v10];

[11:v]format=rgba,scale=520:-1[deploy];
[deploy]fade=t=in:st=0:d=0.25:alpha=1,colorchannelmixer=aa=0.9[deploy_a];
[v10][deploy_a]overlay=48:120:enable='between(t,37.9,42.0)'[v11];

[9:v]format=rgba,scale=56:-1[logo];
[logo]colorchannelmixer=aa=0.7[logo_a];
[v11][logo_a]overlay=W-w-40:H-h-40:enable='between(t,2.6,68.3)'[v12];

[3:v]scale=360:-1,format=rgba[pip];
[pip]colorchannelmixer=aa=0.95[pip_a];
[v12][pip_a]overlay=48:H-h-48:enable='between(t,51.1,58.8)'[v13];

[v13]ass={ass}:fontsdir={fonts},format=yuv420p[vout]
""".replace(
        "\n", ""
    )
    # keep readability of filter - actually newlines are fine in filter_complex
    return f"""
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast=1.14:brightness=-0.03:saturation=0.88,colorbalance=rs=0.03:bs=-0.04:rm=0.02:bm=-0.02,unsharp=5:5:0.5:5:5:0.0,vignette=PI/4.5,fade=t=in:st=0:d=0.45,fade=t=out:st=71.7:d=0.85,format=rgba[main];
[1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1:saturation=0.75[pixel];
[2:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.15[mission];
[3:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[assemble];
[4:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[fuel];
[5:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.12[launch];
[6:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.1[boot];
[7:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.08[brand];
[8:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba,eq=contrast=1.05[wm];
[main][pixel]overlay=0:0:format=auto:enable='between(t,0,2.55)'[v01];
[v01][mission]overlay=0:0:format=auto:enable='between(t,10.55,14.65)'[v02];
[v02][assemble]overlay=0:0:format=auto:enable='between(t,28.35,33.05)'[v03];
[v03][fuel]overlay=0:0:format=auto:enable='between(t,33.0,37.85)'[v04];
[v04][boot]overlay=0:0:format=auto:enable='between(t,42.05,46.35)'[v05];
[v05][launch]overlay=0:0:format=auto:enable='between(t,46.35,51.05)'[v06];
[v06][brand]overlay=0:0:format=auto:enable='between(t,59.15,64.05)'[v07];
[v07][pixel]overlay=0:0:format=auto:enable='between(t,64.05,68.55)'[v08];
[v08][wm]overlay=0:0:format=auto:enable='between(t,68.55,72.55)'[v09];
[10:v]format=rgba,scale=420:-1,fade=t=in:st=0:d=0.2:alpha=1,colorchannelmixer=aa=0.92[cubes_a];
[v09][cubes_a]overlay=W-w-48:120:enable='between(t,19.0,28.2)'[v10];
[11:v]format=rgba,scale=520:-1,fade=t=in:st=0:d=0.2:alpha=1,colorchannelmixer=aa=0.9[deploy_a];
[v10][deploy_a]overlay=48:120:enable='between(t,37.9,42.0)'[v11];
[9:v]format=rgba,scale=56:-1,colorchannelmixer=aa=0.7[logo_a];
[v11][logo_a]overlay=W-w-40:H-h-40:enable='between(t,2.6,68.3)'[v12];
[3:v]scale=360:-1,format=rgba,colorchannelmixer=aa=0.95[pip_a];
[v12][pip_a]overlay=48:H-h-48:enable='between(t,51.1,58.8)'[v13];
[v13]ass={ass}:fontsdir={fonts},format=yuv420p[vout]
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    ASS.write_text(build_ass(), encoding="utf-8")
    print(f"Wrote {ASS}")

    assets = prepare()
    fc = build_filter(assets)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(SRC),
        "-stream_loop",
        "-1",
        "-i",
        str(PIXEL),
        "-stream_loop",
        "-1",
        "-i",
        str(MISSION),
        "-stream_loop",
        "-1",
        "-i",
        str(ASSEMBLE),
        "-stream_loop",
        "-1",
        "-i",
        str(FUEL),
        "-stream_loop",
        "-1",
        "-i",
        str(LAUNCH),
        "-stream_loop",
        "-1",
        "-i",
        str(BOOT),
        "-stream_loop",
        "-1",
        "-i",
        str(BRAND),
        "-stream_loop",
        "-1",
        "-i",
        str(WORDMARK),
        "-loop",
        "1",
        "-i",
        str(assets["logo"]),
        "-loop",
        "1",
        "-i",
        str(assets["cubes"]),
        "-loop",
        "1",
        "-i",
        str(assets["deploy"]),
        "-filter_complex",
        fc,
        "-map",
        "[vout]",
        "-map",
        "0:a",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "17",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(OUT_MP4),
    ]
    run(cmd)
    print(f"Wrote {OUT_MP4}")

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(OUT_MP4),
            "-vf",
            "scale=1280:-2",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(OUT_PREVIEW),
        ]
    )
    print(f"Wrote {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
