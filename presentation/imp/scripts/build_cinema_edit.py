#!/usr/bin/env python3
"""
$10k-tier ZEXVRO founder cut.
Kinetic type · chapter cards · brand grade · open/close stings · hybrid captions.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

SRC = Path("/home/paris/Downloads/IMG_1817.MOV")
OUT_DIR = Path("/home/paris/Documents/ZEXVRO/presentation")
TRANSCRIPT = OUT_DIR / "img1817_transcript.json"
ASS = OUT_DIR / "img1817_cinema.ass"
OUT_MP4 = OUT_DIR / "IMG_1817_cinema.mp4"
OUT_PREVIEW = OUT_DIR / "IMG_1817_cinema_preview.mp4"
FONT_DIR = "/usr/share/fonts/noto"
LOGO = Path("/home/paris/Documents/ZEXVRO/frontend/public/brand/logo-transparent.png")
WORDMARK = Path(
    "/home/paris/Documents/ZEXVRO/frontend/public/brand/wordmark-transparent.png"
)
WORK = OUT_DIR / "_cinema_work"
DUR = 72.566667

# Hybrid: premium product beats (big type) + polished transcript fill
# (start, end, main, sub, mode)
# mode: open | hero | punch | thesis | list | close | end
BEATS: list[tuple[float, float, str, str, str]] = [
    (0.0, 1.8, "ZEXVRO", "FOUNDER BRIEF", "open"),
    (1.8, 4.2, "PARIS", "16  ·  BUILDER  ·  PUNE", "hero"),
    (4.2, 7.0, "BUILDING", "ZEXVRO", "hero"),
    (7.2, 11.0, "Most Web3 sells to users.", "", "thesis"),
    (11.0, 14.8, "We sell to businesses.", "", "punch"),
    (14.9, 19.2, "Adoption starts at the product.", "", "thesis"),
    (19.2, 24.0, "ONE INTEGRATION", "Millions of users benefit.", "punch"),
    (24.0, 28.4, "No habit change.", "Web3 under the hood.", "thesis"),
    (28.5, 33.2, "DEVELOPER INFRASTRUCTURE", "APIs  ·  SDKs  ·  tooling", "hero"),
    (33.2, 38.0, "ZK privacy payroll", "NFT services  ·  and more", "list"),
    (38.0, 42.2, "SHIP FAST", "Enterprise-ready surfaces", "list"),
    (42.2, 46.5, "MORPH", "AI agent on machine + web", "hero"),
    (46.5, 51.2, "WEB2  →  WEB3", "Transforms your codebase", "punch"),
    (51.2, 55.4, "Agents that call tools.", "Services that ship.", "thesis"),
    (55.4, 59.2, "Full-stack migration.", "Without rewriting everything.", "punch"),
    (59.4, 64.4, "MISSION", "Make Web3 as easy as a cloud API", "hero"),
    (64.4, 68.8, "INTEGRATE ONCE.", "ADOPT EVERYWHERE.", "close"),
    (68.8, 72.5, "ZEXVRO", "zexvro.com", "end"),
]

# Keywords that get extra glow when they appear in transcript layers
HOT = {
    "zexvro",
    "zexro",
    "web3",
    "web",
    "businesses",
    "business",
    "morph",
    "mof",
    "nft",
    "apis",
    "sdk",
    "sdks",
    "privacy",
    "payroll",
    "adoption",
    "integrate",
    "integration",
    "agent",
    "agents",
    "cloud",
}

REPLACEMENTS = {
    r"\bZexro\b": "ZEXVRO",
    r"\bZexvro\b": "ZEXVRO",
    r"\bMOF\b": "Morph",
    r"\bMof\b": "Morph",
}


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


def esc(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")


def dialogue(start: float, end: float, style: str, text: str, layer: int = 0) -> str:
    return f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{text}\n"


def clean_word(w: str) -> str:
    t = w.strip()
    for pat, rep in REPLACEMENTS.items():
        t = re.sub(pat, rep, t, flags=re.IGNORECASE)
    return t


def load_words() -> list[dict]:
    data = json.loads(TRANSCRIPT.read_text())
    words = []
    for seg in data:
        for w in seg.get("words") or []:
            token = clean_word(w["word"])
            if not token:
                continue
            words.append(
                {"start": float(w["start"]), "end": float(w["end"]), "word": token}
            )
    for i, w in enumerate(words):
        if w["end"] - w["start"] < 0.09:
            nxt = words[i + 1]["start"] if i + 1 < len(words) else w["start"] + 0.14
            w["end"] = min(w["start"] + 0.14, max(w["end"], nxt - 0.02))
    return words


def in_beat_window(t: float) -> bool:
    """True if a big product beat owns the screen (suppress transcript)."""
    for s, e, *_ in BEATS:
        if s <= t < e:
            # open/end always own; others leave room only for short gaps
            return True
    return False


def beat_at(t: float) -> tuple | None:
    for b in BEATS:
        if b[0] <= t < b[1]:
            return b
    return None


def build_ass() -> str:
    # Noto Sans Black for display, regular for micro labels
    header = """[Script Info]
Title: ZEXVRO Cinema Cut
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: OpenBrand,Noto Sans Black,110,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: OpenTag,Noto Sans,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,10,0,1,0,0,5,0,0,0,1
Style: HeroMain,Noto Sans Black,92,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,2,0,1,6,2,2,80,80,200,1
Style: HeroSub,Noto Sans,40,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,4,0,1,4,1,2,80,80,120,1
Style: PunchMain,Noto Sans Black,86,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,7,2,5,100,100,0,1
Style: ThesisMain,Noto Sans Black,70,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,150,1
Style: ThesisSub,Noto Sans,38,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,4,1,2,90,90,95,1
Style: ListMain,Noto Sans Black,64,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,5,2,2,90,90,150,1
Style: ListSub,Noto Sans,36,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,2,0,1,4,1,2,90,90,95,1
Style: CloseMain,Noto Sans Black,88,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,2,0,1,7,2,2,80,80,190,1
Style: CloseSub,Noto Sans Black,42,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,3,0,1,4,1,2,80,80,110,1
Style: EndBrand,Noto Sans Black,120,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,10,0,1,0,0,5,0,0,0,1
Style: EndUrl,Noto Sans,34,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: Micro,Noto Sans,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,2,0,7,40,40,36,1
Style: Chapter,Noto Sans,22,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,5,0,1,2,0,9,48,48,40,1
Style: Draw,Noto Sans,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Progress,Noto Sans,10,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,1,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    ev: list[str] = []

    # --- persistent chrome: corner brand + thin top progress ---
    # top-left micro brand
    ev.append(
        dialogue(
            1.6,
            68.5,
            "Micro",
            r"{\fad(500,400)\alpha&H40&}ZEXVRO  ·  FOUNDER BRIEF",
            layer=0,
        )
    )
    # top-right chapter labels that swap
    chapters = [
        (1.6, 14.8, "01  THESIS"),
        (14.8, 28.4, "02  ADOPTION"),
        (28.4, 42.2, "03  PLATFORM"),
        (42.2, 59.2, "04  MORPH"),
        (59.2, 68.5, "05  MISSION"),
    ]
    for s, e, label in chapters:
        ev.append(
            dialogue(
                s,
                e,
                "Chapter",
                rf"{{\fad(250,200)\alpha&H35&}}{esc(label)}",
                layer=0,
            )
        )

    # horizontal hairline under chrome
    for s, e in [(1.6, 68.5)]:
        bar = (
            r"{\an7\pos(48,72)\p1\bord0\shad0\c&HFFFFFF&\alpha&H70&}"
            r"m 0 0 l 220 0 l 220 1 l 0 1{\p0}"
        )
        ev.append(dialogue(s, e, "Draw", bar, layer=0))
        bar2 = (
            r"{\an9\pos(1872,72)\p1\bord0\shad0\c&HFFFFFF&\alpha&H70&}"
            r"m 0 0 l 180 0 l 180 1 l 0 1{\p0}"
        )
        ev.append(dialogue(s, e, "Draw", bar2, layer=0))

    # bottom progress bar segments (5 chapters) — fills as time progresses
    # drawn as expanding white rect from left
    prog_steps = [
        (1.6, 14.8, 0.20),
        (14.8, 28.4, 0.40),
        (28.4, 42.2, 0.60),
        (42.2, 59.2, 0.80),
        (59.2, 68.5, 1.00),
    ]
    for s, e, frac in prog_steps:
        w = int(1920 * frac)
        # track
        track = (
            r"{\an1\pos(0,1074)\p1\bord0\shad0\c&HFFFFFF&\alpha&HC0&}"
            r"m 0 0 l 1920 0 l 1920 3 l 0 3{\p0}"
        )
        fill = (
            rf"{{\an1\pos(0,1074)\p1\bord0\shad0\c&HFFFFFF&\alpha&H40&}}"
            rf"m 0 0 l {w} 0 l {w} 3 l 0 3{{\p0}}"
        )
        ev.append(dialogue(s, e, "Progress", track, layer=0))
        ev.append(dialogue(s, e, "Progress", fill, layer=1))

    # --- product beats ---
    for start, end, main, sub, mode in BEATS:
        dur = end - start
        fi = 80 if mode in ("open", "end") else 70
        fo = 120 if mode in ("open", "end") else 140

        if mode == "open":
            # center brand slam
            anim = (
                r"{\an5\pos(960,500)\fad(200,200)"
                r"\fscx70\fscy70\fsp20"
                r"\t(0,220,\fscx105\fscy105\fsp6)"
                r"\t(220,320,\fscx100\fscy100\fsp8)}"
            )
            ev.append(
                dialogue(start, end, "OpenBrand", f"{anim}{esc(main)}", layer=3)
            )
            if sub:
                sanim = (
                    r"{\an5\pos(960,600)\fad(300,200)\alpha&H20&\fsp10"
                    r"\t(100,280,\alpha&H00&)}"
                )
                ev.append(
                    dialogue(start + 0.25, end, "OpenTag", f"{sanim}{esc(sub)}", layer=3)
                )
            # underline draw
            ubar = (
                r"{\an5\pos(960,560)\fad(150,150)\p1\bord0\shad0\c&HFFFFFF&\alpha&H30&"
                r"\fscx0\t(120,320,\fscx100)}"
                r"m 0 0 l 180 0 l 180 2 l 0 2{\p0}"
            )
            ev.append(dialogue(start + 0.15, end, "Draw", ubar, layer=2))
            continue

        if mode == "end":
            anim = (
                r"{\an5\pos(960,500)\fad(250,400)"
                r"\fscx80\fscy80\fsp16"
                r"\t(0,250,\fscx100\fscy100\fsp10)}"
            )
            ev.append(
                dialogue(start, end, "EndBrand", f"{anim}{esc(main)}", layer=3)
            )
            if sub:
                sanim = r"{\an5\pos(960,600)\fad(400,400)\fsp8}"
                ev.append(
                    dialogue(start + 0.35, end, "EndUrl", f"{sanim}{esc(sub)}", layer=3)
                )
            continue

        # common pop for hero/punch/thesis/list/close
        if mode == "punch":
            # center screen impact
            main_style = "PunchMain"
            sub_style = "ThesisSub"
            pos = r"\an5\pos(960,540)"
            spos = r"\an5\pos(960,640)"
            anim = (
                rf"{{{pos}\fad({fi},{fo})"
                r"\fscx60\fscy60"
                r"\t(0,100,\fscx112\fscy112)"
                r"\t(100,180,\fscx100\fscy100)}"
            )
        elif mode == "hero":
            main_style = "HeroMain"
            sub_style = "HeroSub"
            pos = r"\an2\pos(960,860)"
            spos = r"\an2\pos(960,940)"
            anim = (
                rf"{{{pos}\fad({fi},{fo})"
                r"\fscx78\fscy78"
                r"\t(0,110,\fscx106\fscy106)"
                r"\t(110,180,\fscx100\fscy100)}"
            )
        elif mode == "close":
            main_style = "CloseMain"
            sub_style = "CloseSub"
            pos = r"\an2\pos(960,820)"
            spos = r"\an2\pos(960,910)"
            anim = (
                rf"{{{pos}\fad({fi},{fo})"
                r"\fscx70\fscy70"
                r"\t(0,120,\fscx108\fscy108)"
                r"\t(120,200,\fscx100\fscy100)}"
            )
        elif mode == "list":
            main_style = "ListMain"
            sub_style = "ListSub"
            pos = r"\an2\pos(960,850)"
            spos = r"\an2\pos(960,930)"
            anim = (
                rf"{{{pos}\fad({fi},{fo})"
                r"\fscx88\fscy88"
                r"\t(0,100,\fscx102\fscy102)"
                r"\t(100,160,\fscx100\fscy100)}"
            )
        else:  # thesis
            main_style = "ThesisMain"
            sub_style = "ThesisSub"
            pos = r"\an2\pos(960,860)"
            spos = r"\an2\pos(960,940)"
            anim = (
                rf"{{{pos}\fad({fi},{fo})"
                r"\fscx90\fscy90"
                r"\t(0,100,\fscx103\fscy103)"
                r"\t(100,160,\fscx100\fscy100)}"
            )

        ev.append(
            dialogue(start, end, main_style, f"{anim}{esc(main)}", layer=3)
        )

        if sub:
            sub_start = min(start + 0.22, end - 0.35)
            sanim = (
                rf"{{{spos}\fad(100,{fo})"
                r"\fscx90\fscy90"
                r"\t(0,120,\fscx100\fscy100)}"
            )
            ev.append(
                dialogue(sub_start, end, sub_style, f"{sanim}{esc(sub)}", layer=3)
            )

        # accent bar under punch/hero
        if mode in ("punch", "hero", "close"):
            y = 700 if mode == "punch" else 990
            ubar = (
                rf"{{\an5\pos(960,{y})\fad(100,120)\p1\bord0\shad0\c&HFFFFFF&\alpha&H35&"
                r"\fscx0\t(80,220,\fscx100)}"
                r"m 0 0 l 140 0 l 140 3 l 0 3{\p0}"
            )
            ev.append(dialogue(start + 0.12, end, "Draw", ubar, layer=2))

    # --- flash frames on chapter boundaries (white 2-frame pulse via ASS alpha box) ---
    flashes = [14.8, 28.4, 42.2, 59.2]
    for t in flashes:
        flash = (
            r"{\an5\pos(960,540)\p1\bord0\shad0\c&HFFFFFF&\alpha&HA0&"
            r"\t(0,80,\alpha&HFF&)}"
            r"m 0 0 l 1920 0 l 1920 1080 l 0 1080{\p0}"
        )
        ev.append(dialogue(t, t + 0.12, "Draw", flash, layer=5))

    return header + "".join(ev)


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(str(c) for c in cmd[:8]), "...")
    subprocess.run(cmd, check=True, **kw)


def prepare_overlays() -> tuple[Path, Path]:
    WORK.mkdir(parents=True, exist_ok=True)
    logo_sm = WORK / "logo_128.png"
    word_sm = WORK / "wordmark_480.png"
    # resize brand assets
    from PIL import Image

    im = Image.open(LOGO).convert("RGBA")
    im.thumbnail((140, 140), Image.Resampling.LANCZOS)
    im.save(logo_sm)

    wm = Image.open(WORDMARK).convert("RGBA")
    # force white-ish if dark
    wm.thumbnail((480, 80), Image.Resampling.LANCZOS)
    wm.save(word_sm)
    return logo_sm, word_sm


def build_filter(logo: Path, word: Path) -> str:
    """
    Cinema pipeline:
    1) grade plate (contrast, mild teal/orange, vignette)
    2) open black with logo scale-in 0-1.6s
    3) end card fade from 68.8s
    4) ass burn
    5) subtle grain
    """
    ass_path = str(ASS).replace("\\", "/").replace(":", "\\:")
    font_dir = FONT_DIR.replace("\\", "/").replace(":", "\\:")
    logo_p = str(logo).replace("\\", "/").replace(":", "\\:")
    word_p = str(word).replace("\\", "/").replace(":", "\\:")

    # Complex filtergraph
    fc = (
        # --- main video grade ---
        f"[0:v]"
        f"eq=contrast=1.12:brightness=-0.02:saturation=0.92,"
        f"colorbalance=rs=0.02:gs=-0.01:bs=-0.03:rm=0.01:bm=-0.02,"
        f"unsharp=5:5:0.4:5:5:0.0,"
        f"vignette=PI/5,"
        # open fade from black
        f"fade=t=in:st=0:d=0.6,"
        # close fade to black before end card holds
        f"fade=t=out:st=71.6:d=0.9,"
        f"format=rgba[base];"
        # --- logo open sting (0-1.9s) ---
        f"movie={logo_p},format=rgba,scale=180:-1[logo];"
        f"[logo]fade=t=in:st=0:d=0.35:alpha=1,"
        f"fade=t=out:st=1.35:d=0.4:alpha=1[logo_f];"
        f"[base][logo_f]overlay=(W-w)/2:(H-h)/2-40:enable='between(t,0,1.9)'[v1];"
        # --- corner logo during body (1.9 - 68.5) ---
        f"movie={logo_p},format=rgba,scale=48:-1[logo_c];"
        f"[logo_c]fade=t=in:st=0:d=0.4:alpha=1,"
        f"colorchannelmixer=aa=0.55[logo_c2];"
        f"[v1][logo_c2]overlay=W-w-40:H-h-36:enable='between(t,1.9,68.5)'[v2];"
        # --- end wordmark ---
        f"movie={word_p},format=rgba,scale=420:-1[wm];"
        f"[wm]fade=t=in:st=0:d=0.5:alpha=1[wm_f];"
        f"[v2][wm_f]overlay=(W-w)/2:(H-h)/2+80:enable='between(t,69.3,72.5)'[v3];"
        # --- burn ASS ---
        f"[v3]ass={ass_path}:fontsdir={font_dir},"
        f"format=yuv420p[vout]"
    )
    return fc


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASS.write_text(build_ass(), encoding="utf-8")
    print(f"Wrote {ASS}")

    logo, word = prepare_overlays()
    fc = build_filter(logo, word)

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(SRC),
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
            "-movflags",
            "+faststart",
            str(OUT_MP4),
        ]
    )
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

    # contact strip for QC
    sheet = OUT_DIR / "cinema_preview_sheet.jpg"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(OUT_PREVIEW),
            "-vf",
            "select='eq(n\\,30)+eq(n\\,300)+eq(n\\,900)+eq(n\\,1500)+eq(n\\,2400)+eq(n\\,3600)',"
            "scale=480:-1,tile=3x2",
            "-frames:v",
            "1",
            "-update",
            "1",
            str(sheet),
        ]
    )
    print(f"Wrote {sheet}")


if __name__ == "__main__":
    main()
