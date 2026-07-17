#!/usr/bin/env python3
"""Curate captcha photo bank from local Kaggle/Openverse downloads into 160x160 JPEGs."""
from __future__ import annotations
import hashlib, json, random, re
from pathlib import Path
from PIL import Image, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[1] / 'services' / 'agent-auth' / 'captcha-assets'
ROOT.mkdir(parents=True, exist_ok=True)

# label -> list of source globs (directories to sample)
SOURCES: dict[str, list[Path]] = {
  'car': [
    Path('/tmp/zexvro-kaggle-dl/vehicle-detection/data/vehicles'),
    Path('/tmp/zexvro-kaggle-dl/vehicles-openimages'),
    Path('/tmp/zexvro-kaggle2/vehicle-types'),
  ],
  'bus': [
    Path('/tmp/zexvro-kaggle2/vehicle-types'),
    Path('/tmp/zexvro-kaggle2/traffic-light'),  # may contain road scenes; filter by name
  ],
  'bicycle': [Path('/tmp/zexvro-kaggle2'), Path('/tmp/zexvro-openverse')],
  'motorcycle': [Path('/tmp/zexvro-kaggle2/motorcycle'), Path('/tmp/zexvro-kaggle2/vehicle-types')],
  'traffic_light': [Path('/tmp/zexvro-kaggle2/traffic-light')],
  'stop_sign': [
    Path('/tmp/zexvro-kaggle2/stop-sign'),
    Path('/tmp/zexvro-kaggle2/stop-sign-2'),
    Path('/tmp/zexvro-kaggle2/road-signs'),
  ],
  'boat': [Path('/tmp/zexvro-kaggle2/boats')],
  'mountain': [Path('/tmp/zexvro-kaggle2/mountains')],
  'palm': [Path('/tmp/zexvro-kaggle2/palm'), Path('/tmp/zexvro-openverse')],
  'hydrant': [Path('/tmp/zexvro-kaggle2/hydrants')],
  'bridge': [Path('/tmp/zexvro-openverse'), Path('/home/wraient/Projects/zexvro/services/agent-auth/captcha-assets/bridge')],
  'crosswalk': [Path('/home/wraient/Projects/zexvro/services/agent-auth/captcha-assets/crosswalk'), Path('/tmp/zexvro-openverse')],
  'cat': [Path('/tmp/zexvro-kaggle-dl/cat-and-dog')],
  'dog': [Path('/tmp/zexvro-kaggle-dl/cat-and-dog')],
}

# name heuristics when folders are mixed
NAME_HINTS = {
  'bus': re.compile(r'bus|coach', re.I),
  'bicycle': re.compile(r'bike|bicycle|cycle', re.I),
  'motorcycle': re.compile(r'motor|bike|scooter', re.I),
  'car': re.compile(r'car|vehicle|sedan|auto', re.I),
  'traffic_light': re.compile(r'traffic.?light|signal|tl_', re.I),
  'stop_sign': re.compile(r'stop', re.I),
  'boat': re.compile(r'boat|ship|yacht|ferry|sail', re.I),
  'mountain': re.compile(r'mountain|peak|alps|summit', re.I),
  'palm': re.compile(r'palm', re.I),
  'hydrant': re.compile(r'hydrant', re.I),
  'cat': re.compile(r'cat', re.I),
  'dog': re.compile(r'dog', re.I),
  'bridge': re.compile(r'bridge', re.I),
  'crosswalk': re.compile(r'crosswalk|zebra|crossing', re.I),
}

IMG_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
random.seed(7)
PER_LABEL = 24

def quality_ok(im: Image.Image) -> bool:
    if min(im.size) < 64:
        return False
    if ImageStat.Stat(im.convert('L')).stddev[0] < 10:
        return False
    return True

def to_tile(src: Path, dest: Path) -> bool:
    try:
        im = Image.open(src).convert('RGB')
    except Exception:
        return False
    if not quality_ok(im):
        return False
    im = ImageOps.fit(im, (160, 160), method=Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'JPEG', quality=88, optimize=True)
    return True

def collect(label: str) -> list[Path]:
    files: list[Path] = []
    hint = NAME_HINTS.get(label)
    for root in SOURCES.get(label, []):
        if not root.exists():
            continue
        for p in root.rglob('*'):
            if p.suffix.lower() not in IMG_EXT:
                continue
            # cats/dogs path filter
            if label == 'cat' and 'cat' not in str(p).lower():
                continue
            if label == 'dog' and 'dog' not in str(p).lower():
                continue
            # if directory is specific (traffic-light, boats, mountains, hydrants, stop-sign) accept all
            specific = any(x in str(root) for x in [
                'traffic-light', 'boats', 'mountains', 'hydrants', 'stop-sign', 'palm',
                'vehicle-detection/data/vehicles', 'cat-and-dog',
            ])
            if specific or not hint or hint.search(p.name) or hint.search(str(p.parent)):
                files.append(p)
    random.shuffle(files)
    return files

def main():
    # Keep existing good tiles as seeds: merge into temp candidates first by scanning current bank
    counts = {}
    manifest = {}
    for label in sorted(SOURCES.keys()):
        dest_dir = ROOT / label
        dest_dir.mkdir(exist_ok=True)
        # wipe weak old tiles only if we can refill; keep existing jpegs as start set
        existing = list(dest_dir.glob('*.jpg'))
        n = len(existing)
        seen = set()
        for e in existing:
            try:
                seen.add(hashlib.sha1(e.read_bytes()[:8192]).hexdigest())
            except Exception:
                pass
        for src in collect(label):
            if n >= PER_LABEL:
                break
            try:
                raw_head = src.read_bytes()[:8192]
            except Exception:
                continue
            h = hashlib.sha1(raw_head).hexdigest()
            if h in seen:
                continue
            out = dest_dir / f'{label}_{n+1:02d}_{h[:10]}.jpg'
            if to_tile(src, out):
                seen.add(h)
                n += 1
        # prune if still 0
        files = sorted(f.name for f in dest_dir.glob('*.jpg'))
        if len(files) >= 4:
            # cap bank size at PER_LABEL by keeping newest/first PER_LABEL
            if len(files) > PER_LABEL:
                for extra in files[PER_LABEL:]:
                    (dest_dir / extra).unlink(missing_ok=True)
                files = files[:PER_LABEL]
            manifest[label] = files
            counts[label] = len(files)
        else:
            counts[label] = len(files)
        print(f'{label}: {counts[label]}')

    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (ROOT / 'SOURCES.md').write_text(
        '# Captcha photo bank\n\n'
        'Built from Kaggle datasets (legacy key via ~/.kaggle) + Openverse CC photos.\n'
        'Tiles: 160x160 JPEG, quality-filtered.\n\n'
        'Rebuild: `python3 scripts/rebuild_captcha_bank.py`\n'
    )
    print('TOTAL', sum(counts.values()), 'labels_ok', list(manifest.keys()))

if __name__ == '__main__':
    main()
