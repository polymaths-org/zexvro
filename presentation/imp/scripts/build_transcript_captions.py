#!/usr/bin/env python3
"""Word-highlight transcript captions — fixed alignment, cooler reel style."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

SRC = Path("/home/paris/Downloads/IMG_1817.MOV")
OUT_DIR = Path("/home/paris/Documents/ZEXVRO/presentation")
TRANSCRIPT = OUT_DIR / "img1817_transcript.json"
ASS = OUT_DIR / "img1817_transcript_captions.ass"
OUT_MP4 = OUT_DIR / "IMG_1817_transcript_captioned.mp4"
OUT_PREVIEW = OUT_DIR / "IMG_1817_transcript_captioned_preview.mp4"
FONT_DIR = "/usr/share/fonts/noto"

# 3 words per line = clean reel density, less wrap jitter
CHUNK_SIZE = 3
# Fixed on-screen anchor (center bottom)
POS_X = 960
POS_Y = 900

REPLACEMENTS = {
    r"\bZexro\b": "ZEXVRO",
    r"\bZexvro\b": "ZEXVRO",
    r"\bMOF\b": "Morph",
    r"\bMof\b": "Morph",
}


def clean_word(w: str) -> str:
    t = w.strip()
    for pat, rep in REPLACEMENTS.items():
        t = re.sub(pat, rep, t, flags=re.IGNORECASE)
    # drop trailing junk commas on filler words if alone — keep punctuation lightly
    return t


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


def load_words() -> list[dict]:
    data = json.loads(TRANSCRIPT.read_text())
    words: list[dict] = []
    for seg in data:
        for w in seg.get("words") or []:
            token = clean_word(w["word"])
            if not token:
                continue
            words.append(
                {
                    "start": float(w["start"]),
                    "end": float(w["end"]),
                    "word": token,
                }
            )
    for i, w in enumerate(words):
        if w["end"] - w["start"] < 0.09:
            nxt = words[i + 1]["start"] if i + 1 < len(words) else w["start"] + 0.14
            w["end"] = min(w["start"] + 0.14, max(w["end"], nxt - 0.02))
    return words


def chunk_words(words: list[dict], size: int = CHUNK_SIZE) -> list[list[dict]]:
    return [words[i : i + size] for i in range(0, len(words), size)]


def style_word(active: bool, text: str) -> str:
    """Highlight WITHOUT scale (scale reflows width and causes alignment jitter)."""
    safe = esc(text)
    if active:
        # full white, black outline, slight letter spacing bump for punch
        return (
            r"{\c&HFFFFFF&\1a&H00&\3c&H000000&\bord6\shad2\b1\fsp1}"
            + safe
            + r"{\b0\fsp0}"
        )
    # inactive: still white-ish, softer, same metrics (no scale)
    return (
        r"{\c&HFFFFFF&\1a&H70&\3c&H000000&\bord4\shad0\b0\fsp0}"
        + safe
        + r"{\1a&H00&}"
    )


def build_ass(words: list[dict]) -> str:
    # Noto Sans Black = heavy IG/display look
    header = f"""[Script Info]
Title: ZEXVRO IMG_1817 Transcript Karaoke v2
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Noto Sans Black,74,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,2,0,1,5,2,2,120,120,140,1
Style: LineIn,Noto Sans Black,74,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,2,0,1,5,2,2,120,120,140,1
Style: Watermark,Noto Sans,22,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,2,0,9,48,48,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []
    events.append(
        f"Dialogue: 0,{ass_time(0.8)},{ass_time(71.5)},Watermark,,0,0,0,,"
        r"{\fad(300,300)\alpha&H90&}ZEXVRO"
        "\n"
    )

    # fixed center position for every caption line
    base_pos = rf"\an2\pos({POS_X},{POS_Y})"

    chunks = chunk_words(words)
    for ci, chunk in enumerate(chunks):
        if not chunk:
            continue

        chunk_start = chunk[0]["start"]
        # end when next chunk starts (clean handoff) or hold last word
        if ci + 1 < len(chunks):
            chunk_end = chunks[ci + 1][0]["start"]
        else:
            chunk_end = max(chunk[-1]["end"] + 0.25, chunk_start + 0.4)

        # slight gap so lines don't overlap at switch
        if ci + 1 < len(chunks):
            handoff = chunks[ci + 1][0]["start"]
            # leave 40ms gap between lines for clean switch
            chunk_end = min(chunk_end, handoff - 0.04)

        if chunk_end <= chunk_start:
            chunk_end = chunk_start + 0.3

        for i, active_w in enumerate(chunk):
            start = active_w["start"]
            if i + 1 < len(chunk):
                end = chunk[i + 1]["start"]
            else:
                end = chunk_end

            if i == 0:
                # line appears with chunk start (not mid-word late)
                start = chunk_start

            if end <= start:
                end = start + 0.06

            parts = [style_word(j == i, w["word"]) for j, w in enumerate(chunk)]
            line = "  ".join(parts)  # double space for cleaner word gaps

            # Line enter: whole-line pop ONLY on first word of chunk
            # Line exit: quick fade on last word window end
            is_first = i == 0
            is_last = i == len(chunk) - 1

            if is_first and is_last:
                anim = (
                    rf"{{{base_pos}\fad(70,100)"
                    r"\fscx88\fscy88"
                    r"\t(0,90,\fscx103\fscy103)"
                    r"\t(90,150,\fscx100\fscy100)}"
                )
            elif is_first:
                anim = (
                    rf"{{{base_pos}\fad(70,0)"
                    r"\fscx88\fscy88"
                    r"\t(0,90,\fscx103\fscy103)"
                    r"\t(90,150,\fscx100\fscy100)}"
                )
            elif is_last:
                anim = rf"{{{base_pos}\fad(0,100)}}"
            else:
                anim = rf"{{{base_pos}}}"

            events.append(
                f"Dialogue: 1,{ass_time(start)},{ass_time(end)},Karaoke,,0,0,0,,"
                f"{anim}{line}\n"
            )

    return header + "".join(events)


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    words = load_words()
    print(f"Loaded {len(words)} words → {len(chunk_words(words))} lines")
    ASS.write_text(build_ass(words), encoding="utf-8")
    print(f"Wrote {ASS}")

    ass_path = str(ASS).replace("\\", "/").replace(":", "\\:")
    # force Black face via fontsdir
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
