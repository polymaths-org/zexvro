# presentation/

Pitch media layout (local; large videos may be gitignored).

| Folder | Contents |
| --- | --- |
| `ppt/` | PowerPoint decks (`ZEXVRO.pptx`, enterprise + arcade backup) |
| `video/` | Full masters (pro / cinema / captioned) |
| `demo-video/` | Shareable `_preview` cuts |
| `imp/` | Important sources: scripts, fonts, charts, captions, transcripts, preview sheets |

## Quick paths

- Deck: `ppt/ZEXVRO.pptx` (enterprise B2B)
- Founder pro cut: `video/IMG_1817_pro.mp4`
- Pro preview: `demo-video/IMG_1817_pro_preview.mp4`

## Rebuild enterprise deck

```bash
python3 imp/scripts/build_enterprise_pitch.py
```

Writes to `ppt/ZEXVRO.pptx` and `ppt/ZEXVRO_Enterprise_Pitch.pptx`.
