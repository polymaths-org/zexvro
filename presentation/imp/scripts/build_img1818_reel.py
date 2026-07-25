#!/usr/bin/env python3
"""
IMG_1818 Hinglish multi-cut reel:
- Vertical 1080x1920
- Transcript word-highlight captions (cleaned ASR)
- Full-screen ZEXVRO logo cuts over flubs + open/end
- Transparent corner logo
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from PIL import Image

SRC = Path("/home/paris/Downloads/IMG_1818.MOV")
OUT_DIR = Path("/home/paris/Documents/ZEXVRO/presentation")
TRANSCRIPT = OUT_DIR / "img1818_transcript.json"
ASS = OUT_DIR / "img1818_captions.ass"
OUT_MP4 = OUT_DIR / "IMG_1818_transcript_captioned.mp4"
OUT_PREVIEW = OUT_DIR / "IMG_1818_transcript_captioned_preview.mp4"
FONT_DIR = OUT_DIR / "fonts"
WORK = OUT_DIR / "_1818_work"
LOGO_SRC = Path("/home/paris/Documents/ZEXVRO/frontend/public/brand/logo-transparent.png")
PIXEL = Path("/home/paris/Downloads/Pixel_LED_grid_ZEXVRO_logo_202607170124.mp4")
WORDMARK = Path("/home/paris/Downloads/ZEXVRO_wordmark_reveal_animation_202607051513.mp4")
BRAND = Path(
    "/home/paris/Documents/ZEXVRO/frontend/public/marketing/"
    "watermark-removed-Brand_intro_animation_logo_assembly_202607162304.mp4"
)

# Full-screen logo / brand cuts (cover flubs + open/close)
LOGO_CUTS: list[tuple[float, float, str]] = [
    (0.00, 1.15, "open"),  # cold open brand
    (5.00, 11.10, "pixel"),  # flub / switch to Hindi retake
    (44.30, 49.00, "brand"),  # flub
    (63.80, 72.90, "pixel"),  # flub / pure Hindi mess
    (99.70, 106.70, "brand"),  # damn flub
    (155.80, 158.89, "end"),  # close
]

# Also suppress captions during logo cuts
CHUNK_SIZE = 3
W, H = 1080, 1920

REPLACEMENTS = [
    (r"\bX-Rope\b", "ZEXVRO"),
    (r"\bX-rope\b", "ZEXVRO"),
    (r"\bX-Rouiser\b", "ZEXVRO"),
    (r"\bX-work\b", "ZEXVRO"),
    (r"\bX-Rou\b", "ZEXVRO"),
    (r"\bZexero\b", "ZEXVRO"),
    (r"\bZekshuro\b", "ZEXVRO"),
    (r"\bJekshuro\b", "ZEXVRO"),
    (r"\bthe X-Rope\b", "ZEXVRO"),
    (r"\bMOF\b", "Morph"),
    (r"\bMoff\b", "Morph"),
    (r"\bMof\b", "Morph"),
    (r"\bMCB\b", "MCP"),
    (r"\bMCPs\b", "MCPs"),
    (r"\bledges\b", "ledgers"),
    (r"\bwebsite start-ups\b", "Web3 startups"),
    (r"\bwebsite start\b", "Web3 start"),
    (r"\ba website or\b", "a Web3 or"),
    (r"\bthe website\b", "Web3"),
    (r"\bweb to services\b", "Web3 services"),
    (r"\bweb services\b", "Web3 services"),
    (r"\bweb 2\b", "Web2"),
    (r"\bweb 3\b", "Web3"),
    (r"\bweb tree\b", "Web3"),
    (r"\bweb female\b", "Web3"),
    (r"\bstart-ups\b", "startups"),
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


def esc(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")


def clean_token(w: str) -> str:
    t = w.strip()
    for pat, rep in REPLACEMENTS:
        t = re.sub(pat, rep, t, flags=re.IGNORECASE)
    return t


def in_logo_cut(t: float) -> bool:
    for s, e, _ in LOGO_CUTS:
        if s <= t < e:
            return True
    return False


def load_words() -> list[dict]:
    data = json.loads(TRANSCRIPT.read_text())
    words: list[dict] = []
    for seg in data:
        for w in seg.get("words") or []:
            token = clean_token(w["word"])
            if not token:
                continue
            # skip pure filler noises that ASR captured as words during flubs
            low = token.lower().strip(".,!?")
            if low in {
                "uh",
                "um",
                "uhh",
                "umm",
                "damn",
                "shit",
                "oh",
            }:
                # keep if not in logo window? still skip pure fillers
                if low in {"shit", "damn", "uh", "um", "uhh", "umm"}:
                    continue
            words.append(
                {
                    "start": float(w["start"]),
                    "end": float(w["end"]),
                    "word": token,
                }
            )
    for i, w in enumerate(words):
        if w["end"] - w["start"] < 0.08:
            nxt = words[i + 1]["start"] if i + 1 < len(words) else w["start"] + 0.12
            w["end"] = min(w["start"] + 0.12, max(w["end"], nxt - 0.02))
    # drop words fully inside logo cuts
    words = [w for w in words if not in_logo_cut((w["start"] + w["end"]) / 2)]
    return words


def style_word(active: bool, text: str) -> str:
    safe = esc(text)
    if active:
        return (
            r"{\c&HFFFFFF&\1a&H00&\3c&H000000&\bord7\shad2\b1\fsp1}"
            + safe
            + r"{\b0\fsp0}"
        )
    return (
        r"{\c&HFFFFFF&\1a&H60&\3c&H000000&\bord5\shad0\b0}"
        + safe
        + r"{\1a&H00&}"
    )


def build_ass(words: list[dict]) -> str:
    # vertical reel PlayRes
    header = f"""[Script Info]
Title: ZEXVRO IMG_1818 Hinglish Reel
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Montserrat Black,64,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,1,0,1,5,2,2,50,50,280,1
Style: Watermark,Montserrat Bold,22,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,2,0,9,32,32,36,1
Style: Tag,Montserrat Bold,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,4,0,1,3,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev: list[str] = []
    # watermark only outside logo cuts — simplified: light during body
    for s, e in [(1.2, 5.0), (11.1, 44.3), (49.0, 63.8), (72.9, 99.7), (106.7, 155.8)]:
        ev.append(
            f"Dialogue: 0,{ass_time(s)},{ass_time(e)},Watermark,,0,0,0,,"
            r"{\fad(200,200)\alpha&H70&}ZEXVRO"
            "\n"
        )

    # logo cut labels (subtle)
    tags = {
        "open": "ZEXVRO",
        "pixel": "ZEXVRO",
        "brand": "ZEXVRO",
        "end": "ZEXVRO",
    }
    for s, e, kind in LOGO_CUTS:
        label = tags.get(kind, "ZEXVRO")
        # only show tiny tag if motion has no wordmark — skip to avoid clutter
        _ = label

    pos = r"\an2\pos(540,1580)"
    chunks = [words[i : i + CHUNK_SIZE] for i in range(0, len(words), CHUNK_SIZE)]

    for ci, chunk in enumerate(chunks):
        if not chunk:
            continue
        chunk_start = chunk[0]["start"]
        if ci + 1 < len(chunks):
            chunk_end = chunks[ci + 1][0]["start"] - 0.04
        else:
            chunk_end = max(chunk[-1]["end"] + 0.2, chunk_start + 0.35)
        if chunk_end <= chunk_start:
            chunk_end = chunk_start + 0.3

        # skip chunks that start in logo cut
        if in_logo_cut(chunk_start):
            continue

        for i, active_w in enumerate(chunk):
            start = chunk_start if i == 0 else active_w["start"]
            if i + 1 < len(chunk):
                end = chunk[i + 1]["start"]
            else:
                end = chunk_end
            if end <= start:
                end = start + 0.06
            if in_logo_cut((start + end) / 2):
                continue

            parts = [style_word(j == i, w["word"]) for j, w in enumerate(chunk)]
            line = "  ".join(parts)
            if i == 0:
                anim = (
                    rf"{{{pos}\fad(60,90)"
                    r"\fscx86\fscy86"
                    r"\t(0,90,\fscx104\fscy104)"
                    r"\t(90,150,\fscx100\fscy100)}"
                )
            elif i == len(chunk) - 1:
                anim = rf"{{{pos}\fad(0,90)}}"
            else:
                anim = rf"{{{pos}}}"

            ev.append(
                f"Dialogue: 1,{ass_time(start)},{ass_time(end)},Karaoke,,0,0,0,,"
                f"{anim}{line}\n"
            )

    return header + "".join(ev)


def prepare_logo() -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / "logo_corner.png"
    im = Image.open(LOGO_SRC).convert("RGBA")
    im.thumbnail((96, 96), Image.Resampling.LANCZOS)
    im.save(out)
    # big logo for solid black card fallback
    big = WORK / "logo_center.png"
    im2 = Image.open(LOGO_SRC).convert("RGBA")
    im2.thumbnail((320, 320), Image.Resampling.LANCZOS)
    im2.save(big)
    return out


def esc_fc(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", "\\:")


def build_filter(logo_corner: Path) -> str:
    ass = esc_fc(ASS)
    fonts = esc_fc(FONT_DIR)
    logo = esc_fc(logo_corner)
    big = esc_fc(WORK / "logo_center.png")

    # Input map:
    # 0 main, 1 pixel, 2 brand, 3 wordmark, 4 corner logo still, 5 center logo still
    # Enable logo cuts as full-screen overlays
    enables = {
        "open": "between(t,0,1.15)",
        "pixel1": "between(t,5.00,11.10)",
        "brand1": "between(t,44.30,49.00)",
        "pixel2": "between(t,63.80,72.90)",
        "brand2": "between(t,99.70,106.70)",
        "end": "between(t,155.80,158.89)",
    }

    # Source is 1920x1080 with -90° rotation metadata → force upright vertical.
    return f"""
[0:v]transpose=2,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:brightness=-0.02:saturation=0.95,format=rgba[main];
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=rgba,eq=contrast=1.1[pixel];
[2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=rgba,eq=contrast=1.08[brand];
[3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=rgba[wm];
[main][pixel]overlay=0:0:format=auto:enable='{enables["open"]}+{enables["pixel1"]}+{enables["pixel2"]}'[v1];
[v1][brand]overlay=0:0:format=auto:enable='{enables["brand1"]}+{enables["brand2"]}'[v2];
[v2][wm]overlay=0:0:format=auto:enable='{enables["end"]}'[v3];
[4:v]format=rgba,colorchannelmixer=aa=0.9[logo_c];
[v3][logo_c]overlay=W-w-28:H-h-36:enable='not({enables["open"]}+{enables["pixel1"]}+{enables["brand1"]}+{enables["pixel2"]}+{enables["brand2"]}+{enables["end"]})'[v4];
[v4]ass={ass}:fontsdir={fonts},format=yuv420p[vout]
"""


def run(cmd: list) -> None:
    print("+", " ".join(str(c) for c in cmd[:12]), "...")
    subprocess.run(cmd, check=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    words = load_words()
    print(f"words for captions: {len(words)}")
    ASS.write_text(build_ass(words), encoding="utf-8")
    print(f"Wrote {ASS}")

    logo_corner = prepare_logo()
    fc = build_filter(logo_corner)

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
        str(BRAND),
        "-stream_loop",
        "-1",
        "-i",
        str(WORDMARK),
        "-loop",
        "1",
        "-i",
        str(logo_corner),
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
        "18",
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
            "scale=720:-2",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
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
