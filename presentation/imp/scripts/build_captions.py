#!/usr/bin/env python3
"""Build ASS captions + burn into IMG_1817 for ZEXVRO presentation."""

from __future__ import annotations

import subprocess
from pathlib import Path

SRC = Path("/home/paris/Downloads/IMG_1817.MOV")
OUT_DIR = Path("/home/paris/Documents/ZEXVRO/presentation")
ASS = OUT_DIR / "img1817_captions.ass"
OUT_MP4 = OUT_DIR / "IMG_1817_captioned.mp4"
OUT_PREVIEW = OUT_DIR / "IMG_1817_captioned_preview.mp4"
FONT_DIR = "/usr/share/fonts/noto"

# Loud IG-reel style product captions.
# start, end, primary, sub, style: hero | section | punch | list | close
CAPTIONS: list[tuple[float, float, str, str, str]] = [
    (1.4, 4.0, "PARIS", "16 · Builder · Pune", "hero"),
    (4.0, 6.8, "Building", "ZEXVRO", "hero"),
    (7.2, 10.8, "Web3 startups sell to users.", "", "section"),
    (10.8, 14.6, "ZEXVRO sells to businesses.", "", "punch"),
    (14.8, 19.0, "Adoption starts with the product.", "", "section"),
    (19.0, 23.6, "One integration.", "Millions of users benefit.", "punch"),
    (23.6, 28.2, "No habit change.", "Web3 under the hood.", "section"),
    (28.5, 33.0, "Developer infrastructure", "for real products", "hero"),
    (33.2, 37.8, "APIs  ·  SDKs  ·  tooling", "", "list"),
    (38.0, 41.6, "ZK privacy payroll", "NFT services  ·  and more", "list"),
    (42.0, 46.2, "MORPH", "Your AI agent on machine + web", "hero"),
    (46.4, 51.0, "Web2 to Web3", "transforms your codebase", "punch"),
    (51.0, 55.2, "Agents that call tools.", "Services that ship.", "section"),
    (55.2, 58.8, "Full-stack migration.", "Without rewriting everything.", "punch"),
    (59.4, 64.2, "Mission", "Make Web3 as easy as a cloud API", "hero"),
    (64.2, 68.8, "Integrate once.", "Adopt everywhere.", "close"),
    (69.0, 72.4, "ZEXVRO", "zexvro.com", "close"),
]


def ass_time(t: float) -> str:
    if t < 0:
        t = 0.0
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


def pop_in(fade_out_ms: int = 180) -> str:
    """Instagram-reel pop: scale 70 -> 108 -> 100, snap fade-in."""
    return (
        r"{\fad(60," + str(fade_out_ms) + r")"
        r"\fscx70\fscy70"
        r"\t(0,90,\fscx108\fscy108)"
        r"\t(90,160,\fscx100\fscy100)}"
    )


def pop_in_sub(fade_out_ms: int = 180) -> str:
    """Slightly softer pop for secondary line — still pure white."""
    return (
        r"{\fad(80," + str(fade_out_ms) + r")"
        r"\fscx80\fscy80"
        r"\t(0,100,\fscx104\fscy104)"
        r"\t(100,170,\fscx100\fscy100)}"
    )


def build_ass() -> str:
    # All pure white. Thick black outline = readable on any bg (IG reel look).
    # OutlineColour &H00000000 = black, PrimaryColour &H00FFFFFF = white
    # Outline 5-6, Shadow 2 for punchy legibility
    header = """[Script Info]
Title: ZEXVRO IMG_1817 Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: HeroMain,Noto Sans,96,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,6,2,2,60,60,170,1
Style: HeroSub,Noto Sans,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,4,1,2,60,60,95,1
Style: Section,Noto Sans,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,80,80,130,1
Style: Punch,Noto Sans,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,70,70,135,1
Style: List,Noto Sans,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,5,2,2,80,80,130,1
Style: Tag,Noto Sans,44,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,4,1,2,80,80,85,1
Style: CloseMain,Noto Sans,104,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,7,2,2,60,60,180,1
Style: CloseSub,Noto Sans,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,4,1,2,60,60,100,1
Style: Watermark,Noto Sans,24,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,2,0,9,48,48,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []

    # Light watermark (white, low alpha via override)
    events.append(
        dialogue(
            0.8,
            71.5,
            "Watermark",
            r"{\fad(300,300)\alpha&H90&}ZEXVRO",
        )
    )

    style_map = {
        "hero": ("HeroMain", "HeroSub"),
        "section": ("Section", "Tag"),
        "punch": ("Punch", "Tag"),
        "list": ("List", "Tag"),
        "close": ("CloseMain", "CloseSub"),
    }

    for start, end, main, sub, kind in CAPTIONS:
        main_style, sub_style = style_map[kind]
        fade_out_ms = 160

        events.append(
            dialogue(start, end, main_style, f"{pop_in(fade_out_ms)}{esc(main)}", layer=1)
        )

        if sub:
            # Beat later — classic reel stack (main pops, then sub)
            sub_start = min(start + 0.22, end - 0.4)
            events.append(
                dialogue(
                    sub_start,
                    end,
                    sub_style,
                    f"{pop_in_sub(fade_out_ms)}{esc(sub)}",
                    layer=1,
                )
            )

    return header + "".join(events)


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:8]), "...")
    subprocess.run(cmd, check=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASS.write_text(build_ass(), encoding="utf-8")
    print(f"Wrote {ASS}")

    ass_path = str(ASS).replace("\\", "/").replace(":", "\\:")
    vf = f"ass={ass_path}:fontsdir={FONT_DIR}"

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(SRC),
            "-vf",
            vf,
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
