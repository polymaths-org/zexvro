#!/usr/bin/env python3
"""
Operator batch curation for captcha photos (not end-user UI).

Usage:
  python3 scripts/curate_batch.py prepare motorcycle
  python3 scripts/curate_batch.py reject motorcycle 3 7 12   # bad indices 1-based in current batch
  python3 scripts/curate_batch.py accept motorcycle          # save remaining of batch as verified
  python3 scripts/curate_batch.py status
  python3 scripts/curate_batch.py publish

State: services/agent-auth/captcha-assets/batches/<label>.json
"""
from __future__ import annotations
import hashlib, json, os, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'services' / 'agent-auth' / 'captcha-assets'
VERIFIED = ASSETS / 'verified'
REJECTED = ASSETS / 'rejected'
BATCHES = ASSETS / 'batches'
BATCH_SIZE = 50

LABELS = [
  'motorcycle','boat','bridge','bus','car','cat','crosswalk','dog',
  'hydrant','mountain','palm','stop_sign','traffic_light',
]

POOLS = {
  # motorcycle = pure rename of bicycle bank only
  'motorcycle': [
    ASSETS/'bicycle',
  ],
  'car': [
    Path('/tmp/zexvro-kaggle-dl/vehicle-detection/data/vehicles'),
    Path('/tmp/zexvro-kaggle-dl/vehicles-openimages'),
    Path('/tmp/zexvro-kaggle2/vehicle-types'), ASSETS/'car',
  ],
  'bus': [Path('/tmp/zexvro-kaggle2/vehicle-types'), ASSETS/'bus'],
  'boat': [Path('/tmp/zexvro-kaggle2/boats'), ASSETS/'boat'],
  'mountain': [Path('/tmp/zexvro-kaggle2/mountains'), ASSETS/'mountain'],
  'traffic_light': [Path('/tmp/zexvro-kaggle2/traffic-light'), ASSETS/'traffic_light'],
  'stop_sign': [
    Path('/tmp/zexvro-kaggle2/stop-sign'), Path('/tmp/zexvro-kaggle2/stop-sign-2'),
    Path('/tmp/zexvro-kaggle2/road-signs'), ASSETS/'stop_sign',
  ],
  'hydrant': [Path('/tmp/zexvro-kaggle2/hydrants'), ASSETS/'hydrant'],
  'palm': [Path('/tmp/zexvro-kaggle2/palm'), Path('/tmp/zexvro-openverse'), ASSETS/'palm'],
  'bridge': [ASSETS/'bridge', Path('/tmp/zexvro-openverse')],
  'crosswalk': [ASSETS/'crosswalk', Path('/tmp/zexvro-openverse')],
  'cat': [Path('/tmp/zexvro-kaggle-dl/cat-and-dog'), ASSETS/'cat'],
  'dog': [Path('/tmp/zexvro-kaggle-dl/cat-and-dog'), ASSETS/'dog'],
}

HINTS = {
  'motorcycle': ('motor','bike','scooter','cycle','bicycle'),
  'car': ('car','vehicle','sedan','auto'),
  'bus': ('bus','coach'),
  'boat': ('boat','ship','yacht','ferry','sail'),
  'mountain': ('mountain','peak','alps','summit'),
  'traffic_light': ('traffic','signal','light'),
  'stop_sign': ('stop',),
  'hydrant': ('hydrant',),
  'palm': ('palm',),
  'bridge': ('bridge',),
  'crosswalk': ('crosswalk','zebra','crossing'),
  'cat': ('cat',),
  'dog': ('dog',),
}

IMG = {'.jpg','.jpeg','.png','.webp'}

def sha1_file(p: Path) -> str:
    h = hashlib.sha1()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest()

def walk(root: Path, limit=8000):
    if not root.exists():
        return []
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {'.git','node_modules','verified','rejected','batches'}]
        for name in filenames:
            if len(out) >= limit: return out
            ext = Path(name).suffix.lower()
            if ext not in IMG: continue
            p = Path(dirpath)/name
            try:
                if p.stat().st_size < 2000: continue
            except OSError:
                continue
            out.append(p)
    return out

def known_hashes(folder: Path) -> set[str]:
    s=set()
    if not folder.exists(): return s
    for f in folder.rglob('*'):
        if f.suffix.lower() in IMG:
            try: s.add(sha1_file(f))
            except OSError: pass
    return s

def collect_pool(label: str) -> list[Path]:
    roots = list(POOLS.get(label, [])) + [ASSETS/label]
    hints = HINTS.get(label, ())
    files=[]
    seen=set()
    for root in roots:
        for p in walk(Path(root)):
            key=str(p.resolve()) if p.exists() else str(p)
            if key in seen: continue
            s=str(p).lower()
            if label=='cat' and 'cat' not in s: continue
            if label=='dog' and 'dog' not in s: continue
            # motorcycle: ONLY bicycle+motorcycle asset folders (rename), never broad dumps
            if label == 'motorcycle':
                if '/captcha-assets/bicycle/' not in s:
                    continue
            else:
                bank = f'/captcha-assets/{label}/' in s
                specific = any(x in s for x in ['traffic-light','boats','mountains','hydrants','stop-sign','palm','vehicle-detection','cat-and-dog','vehicles'])
                if not bank and not specific and hints and not any(h in s for h in hints):
                    continue
            seen.add(key)
            files.append(p)
    files.sort(key=lambda p: hashlib.sha1(str(p).encode()).hexdigest())
    return files

def batch_path(label: str) -> Path:
    return BATCHES / f'{label}.json'

def load_state(label: str) -> dict:
    bp = batch_path(label)
    if bp.exists():
        return json.loads(bp.read_text())
    return {
        'label': label,
        'batch_index': 0,  # which batch number (0-based)
        'cursor': 0,       # index into filtered pool
        'current': None,   # current batch list
        'rejected_in_batch': [],
    }

def save_state(st: dict):
    BATCHES.mkdir(parents=True, exist_ok=True)
    batch_path(st['label']).write_text(json.dumps(st, indent=2))

def filter_unused(label: str, files: list[Path]) -> list[Path]:
    good = known_hashes(VERIFIED/label)
    bad = known_hashes(REJECTED/label)
    out=[]
    for p in files:
        try:
            h=sha1_file(p)
        except OSError:
            continue
        if h in good or h in bad: continue
        out.append(p)
    return out

def copy_bucket(label: str, paths: list[Path], dest_root: Path) -> int:
    dest = dest_root/label
    dest.mkdir(parents=True, exist_ok=True)
    n=0
    for p in paths:
        try:
            h=sha1_file(p)[:12]
            ext=p.suffix.lower()
            if ext=='.jpeg': ext='.jpg'
            out=dest/f'{label}_{h}{ext}'
            if not out.exists():
                shutil.copy2(p, out)
            n+=1
        except OSError:
            pass
    return n

def count_verified(label: str) -> int:
    d=VERIFIED/label
    if not d.exists(): return 0
    return sum(1 for f in d.iterdir() if f.suffix.lower() in IMG)

def prepare(label: str):
    if label not in LABELS:
        raise SystemExit(f'unknown label {label}. choose: {", ".join(LABELS)}')
    st=load_state(label)
    pool=filter_unused(label, collect_pool(label))
    start=st.get('cursor',0)
    batch_files=pool[start:start+BATCH_SIZE]
    if not batch_files:
        print(json.dumps({'ok':False,'error':'no_more_images','label':label,'verified':count_verified(label)}, indent=2))
        return
    items=[]
    for i,p in enumerate(batch_files,1):
        hid=hashlib.sha1(str(p.resolve()).encode()).hexdigest()[:16]
        items.append({
            'n': i,
            'id': hid,
            'path': str(p),
            'url': f'http://127.0.0.1:4103/demo/curate/asset?id={hid}',
            'name': p.name,
        })
        # register for asset server via a sidecar map
    # write sidecar id map for this batch (asset server uses process memory - also write flat map file)
    idmap_path = BATCHES / '_idmap.json'
    idmap = json.loads(idmap_path.read_text()) if idmap_path.exists() else {}
    for it,p in zip(items, batch_files):
        idmap[it['id']] = str(p.resolve())
    idmap_path.write_text(json.dumps(idmap))

    st['current']={
        'batch_no': st.get('batch_index',0)+1,
        'start': start,
        'items': [{'n':it['n'],'id':it['id'],'path':it['path'],'name':it['name']} for it in items],
    }
    st['rejected_in_batch']=[]
    save_state(st)

    # human-readable markdown for the operator
    md = BATCHES / f'{label}_batch_{st["current"]["batch_no"]}.md'
    lines=[
        f'# Batch {st["current"]["batch_no"]} · **{label}**',
        '',
        f'Target: keep ~50+ verified. Currently verified: **{count_verified(label)}**.',
        f'Remaining in pool (unreviewed): **{len(pool)-start}**.',
        '',
        '## Instructions',
        f'1. Review these **{len(items)}** images.',
        '2. Reply with **GOOD numbers only**, e.g. `good: 1 2 4 5 8 ...`',
        '3. Anything you do **not** list is junk forever (never shown again).',
        '4. Listed numbers are saved as verified captcha photos.',
        '',
        '## Images',
        '',
    ]
    for it in items:
        lines.append(f'{it["n"]:>2}. `{it["id"]}`  {it["url"]}  \n   file: `{it["path"]}`')
    lines += ['', '---', f'Tell me: `good: 1 2 3 ...`  (unlisted = permanently rejected)',
              f'CLI: `python3 scripts/curate_batch.py accept {label} --good 1,2,4,5`']
    md.write_text('\n'.join(lines))

    print(json.dumps({
        'ok': True,
        'label': label,
        'batch_no': st['current']['batch_no'],
        'count': len(items),
        'verified_so_far': count_verified(label),
        'pool_remaining_after_batch': max(0, len(pool)-start-len(items)),
        'markdown': str(md),
        'items': [{'n':it['n'],'id':it['id'],'url':it['url'],'name':it['name']} for it in items],
        'reply_format': f'good: 1 2 4 5   (unlisted numbers permanently rejected for {label})',
    }, indent=2))

def reject(label: str, nums: list[int]):
    st=load_state(label)
    if not st.get('current'):
        raise SystemExit('no current batch — run prepare first')
    items=st['current']['items']
    bad=set(nums)
    rejected=[]
    for it in items:
        if it['n'] in bad:
            rejected.append(it)
    st['rejected_in_batch']=[it['n'] for it in rejected]
    save_state(st)
    print(json.dumps({'ok':True,'label':label,'marked_bad':sorted(bad),'count':len(rejected)}, indent=2))

def accept(label: str, good_nums: list[int]|None=None, bad_nums: list[int]|None=None):
    """
    Select-GOOD workflow:
      - good_nums: images to KEEP as verified
      - everything else in the current batch: permanently REJECT (never show again)
    If good_nums is None and bad_nums provided: treat bad_nums as rejects, rest good (legacy).
    If only good_nums: rest of batch rejected.
    """
    st=load_state(label)
    if not st.get('current'):
        raise SystemExit('no current batch — run prepare first')
    items=st['current']['items']
    all_n={it['n'] for it in items}
    if good_nums is not None:
        good=set(good_nums)
        bad=all_n-good
    elif bad_nums is not None:
        bad=set(bad_nums)
        good=all_n-bad
    else:
        # no selection info: keep none, reject all (safe)
        good=set()
        bad=all_n
    good_paths=[]; bad_paths=[]
    for it in items:
        p=Path(it['path'])
        if it['n'] in good:
            good_paths.append(p)
        else:
            bad_paths.append(p)
    n_good=copy_bucket(label, good_paths, VERIFIED)
    n_bad=copy_bucket(label, bad_paths, REJECTED)
    # advance cursor past this batch so neither good nor junk is offered again
    st['cursor']=st['current']['start']+len(items)
    st['batch_index']=st['current']['batch_no']
    st['current']=None
    st['rejected_in_batch']=[]
    st['last_good']=sorted(good)
    st['last_bad']=sorted(bad)
    save_state(st)
    write_verified_manifest()
    print(json.dumps({
        'ok': True,
        'label': label,
        'saved_good': n_good,
        'rejected_rest': n_bad,
        'verified_total': count_verified(label),
        'note': 'Unselected images permanently rejected — will not appear in later batches',
        'next': f'python3 scripts/curate_batch.py prepare {label}',
    }, indent=2))

def write_verified_manifest():
    man={}
    VERIFIED.mkdir(parents=True, exist_ok=True)
    for label in LABELS:
        d=VERIFIED/label
        if not d.exists(): continue
        files=sorted([f.name for f in d.iterdir() if f.suffix.lower() in IMG])
        if files: man[label]=files
    (VERIFIED/'manifest.json').write_text(json.dumps(man, indent=2))

def publish():
    # Runtime bank is verified/ only — refresh verified manifest; no live root copies.
    write_verified_manifest()
    man=json.loads((VERIFIED/'manifest.json').read_text()) if (VERIFIED/'manifest.json').exists() else {}
    published={label: len(files) for label, files in man.items() if len(files) >= 6}
    (ASSETS/'SOURCES.md').write_text(
        '# Captcha photo bank — VERIFIED ONLY\n\n'
        'Source of truth: captcha-assets/verified/\n'
        'Gate loads verified/manifest.json only.\n'
        'Built via scripts/curate_batch.py operator batches.\n'
    )
    # Remove stale root manifests / accidental live dirs if present
    root_man = ASSETS/'manifest.json'
    if root_man.exists():
        try: root_man.unlink()
        except OSError: pass
    print(json.dumps({'ok':True,'published':published,'live_labels':list(published.keys()), 'mode':'verified_only'}, indent=2))

def status():
    rows=[]
    for label in LABELS:
        st=load_state(label) if batch_path(label).exists() else {}
        rows.append({
            'label': label,
            'verified': count_verified(label),
            'batch_no': st.get('batch_index',0),
            'has_open_batch': bool(st.get('current')),
        })
    print(json.dumps({'labels':rows}, indent=2))

def main():
    if len(sys.argv)<2:
        print(__doc__); return
    cmd=sys.argv[1]
    if cmd=='prepare':
        prepare(sys.argv[2])
    elif cmd=='reject':
        label=sys.argv[2]
        nums=[int(x) for x in sys.argv[3:]]
        reject(label, nums)
    elif cmd=='accept':
        label=sys.argv[2]
        good=None
        bad=None
        if '--good' in sys.argv:
            i=sys.argv.index('--good')
            raw=sys.argv[i+1] if i+1 < len(sys.argv) else ''
            good=[int(x) for x in raw.replace(' ',',').split(',') if x.strip()]
        if '--bad' in sys.argv:
            i=sys.argv.index('--bad')
            raw=sys.argv[i+1] if i+1 < len(sys.argv) else ''
            bad=[int(x) for x in raw.replace(' ',',').split(',') if x.strip()]
        # positional numbers after label mean GOOD (select-good workflow)
        pos=[]
        for a in sys.argv[3:]:
            if a.startswith('--'): break
            if a.isdigit(): pos.append(int(a))
        if good is None and pos:
            good=pos
        accept(label, good_nums=good, bad_nums=bad)
    elif cmd=='status':
        status()
    elif cmd=='publish':
        write_verified_manifest(); publish()
    else:
        raise SystemExit(f'unknown cmd {cmd}')

if __name__=='__main__':
    main()
