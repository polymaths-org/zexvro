/**
 * Human curation: mark BAD images; rest of page becomes verified.
 * Verified: captcha-assets/verified/<label>/
 * Rejected: captcha-assets/rejected/<label>/
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

export function assetsRoot(): string {
  return join(packageRoot(), 'captcha-assets')
}

export function verifiedRoot(): string {
  return join(assetsRoot(), 'verified')
}

export function rejectedRoot(): string {
  return join(assetsRoot(), 'rejected')
}

/** bicycle removed — that pool was almost all motorcycles. */
export const CURATE_LABELS = [
  'motorcycle',
  'boat',
  'bridge',
  'bus',
  'car',
  'cat',
  'crosswalk',
  'dog',
  'hydrant',
  'mountain',
  'palm',
  'stop_sign',
  'traffic_light',
] as const

export type CurateLabel = (typeof CURATE_LABELS)[number]

const POOL_DIRS: Record<string, string[]> = {
  car: [
    '/tmp/zexvro-kaggle-dl/vehicle-detection/data/vehicles',
    '/tmp/zexvro-kaggle-dl/vehicles-openimages',
    '/tmp/zexvro-kaggle2/vehicle-types',
  ],
  bus: ['/tmp/zexvro-kaggle2/vehicle-types', '/tmp/zexvro-kaggle2/traffic-light'],
  // pure rename of bicycle bank only
  motorcycle: [
    join(assetsRoot(), 'bicycle'),
  ],
  traffic_light: ['/tmp/zexvro-kaggle2/traffic-light'],
  stop_sign: [
    '/tmp/zexvro-kaggle2/stop-sign',
    '/tmp/zexvro-kaggle2/stop-sign-2',
    '/tmp/zexvro-kaggle2/road-signs',
  ],
  boat: ['/tmp/zexvro-kaggle2/boats'],
  mountain: ['/tmp/zexvro-kaggle2/mountains'],
  palm: ['/tmp/zexvro-kaggle2/palm', '/tmp/zexvro-openverse'],
  hydrant: ['/tmp/zexvro-kaggle2/hydrants'],
  bridge: [join(assetsRoot(), 'bridge'), '/tmp/zexvro-openverse'],
  crosswalk: [join(assetsRoot(), 'crosswalk'), '/tmp/zexvro-openverse'],
  cat: ['/tmp/zexvro-kaggle-dl/cat-and-dog'],
  dog: ['/tmp/zexvro-kaggle-dl/cat-and-dog'],
}

const NAME_HINT: Partial<Record<CurateLabel, RegExp>> = {
  bus: /bus|coach/i,
  motorcycle: /motor|bike|scooter|cycle|bicycle/i,
  car: /car|vehicle|sedan|auto/i,
  traffic_light: /traffic.?light|signal|tl_/i,
  stop_sign: /stop/i,
  boat: /boat|ship|yacht|ferry|sail/i,
  mountain: /mountain|peak|alps|summit/i,
  palm: /palm/i,
  hydrant: /hydrant/i,
  cat: /cat/i,
  dog: /dog/i,
  bridge: /bridge/i,
  crosswalk: /crosswalk|zebra|crossing/i,
}

function isImage(path: string): boolean {
  return IMG_EXT.has(extname(path).toLowerCase())
}

function walkImages(root: string, limit = 5000): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const stack = [root]
  while (stack.length && out.length < limit) {
    const dir = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (out.length >= limit) break
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git' || name === 'verified' || name === 'rejected')
          continue
        stack.push(full)
      } else if (st.isFile() && isImage(full) && st.size > 2000) {
        out.push(full)
      }
    }
  }
  return out
}

function hashPath(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 16)
}

export function labelPrompt(label: CurateLabel): string {
  const pretty = label.replaceAll('_', ' ')
  return `Select GOOD ${pretty} images`
}

export function listLabelStats() {
  return CURATE_LABELS.map((label) => {
    const vdir = join(verifiedRoot(), label)
    const rdir = join(rejectedRoot(), label)
    const verified = existsSync(vdir)
      ? readdirSync(vdir).filter((f) => isImage(join(vdir, f))).length
      : 0
    const rejected = existsSync(rdir)
      ? readdirSync(rdir).filter((f) => isImage(join(rdir, f))).length
      : 0
    return {
      label,
      prompt: labelPrompt(label),
      verified,
      rejected,
      target: 50,
      remaining: Math.max(0, 50 - verified),
      poolAvailable: true,
    }
  })
}

const candidateIndex = new Map<string, string>()

export function resolveCandidate(id: string): string | undefined {
  return candidateIndex.get(id)
}

export function ensureCandidateIndexed(id: string, label?: CurateLabel): string | undefined {
  const hit = candidateIndex.get(id)
  if (hit) return hit
  if (label) listCandidates(label, 0, 200)
  return candidateIndex.get(id)
}

export function listCandidates(label: CurateLabel, offset = 0, limit = 50) {
  if (!(CURATE_LABELS as readonly string[]).includes(label)) {
    throw new Error('unknown_label')
  }
  const verifiedDir = join(verifiedRoot(), label)
  const rejectedDir = join(rejectedRoot(), label)
  const verifiedHashes = new Set<string>()
  const rejectedHashes = new Set<string>()
  if (existsSync(verifiedDir)) {
    for (const f of readdirSync(verifiedDir)) {
      try {
        verifiedHashes.add(createHash('sha1').update(readFileSync(join(verifiedDir, f))).digest('hex'))
      } catch {
        /* */
      }
    }
  }
  if (existsSync(rejectedDir)) {
    for (const f of readdirSync(rejectedDir)) {
      try {
        rejectedHashes.add(createHash('sha1').update(readFileSync(join(rejectedDir, f))).digest('hex'))
      } catch {
        /* */
      }
    }
  }

  // motorcycle is a rename of bicycle only — do not also scan captcha-assets/motorcycle junk
  const roots =
    label === 'motorcycle'
      ? [...(POOL_DIRS[label] || [])]
      : [join(assetsRoot(), label), ...(POOL_DIRS[label] || [])]

  const hint = NAME_HINT[label]
  const files: string[] = []
  const seen = new Set<string>()
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const f of walkImages(root, 8000)) {
      if (seen.has(f)) continue
      if (label === 'cat' && !/cat/i.test(f)) continue
      if (label === 'dog' && !/dog/i.test(f)) continue
      if (label === 'motorcycle') {
        if (!f.includes('/captcha-assets/bicycle/')) continue
      } else {
        const isBank = f.includes(`/captcha-assets/${label}/`)
        const isSpecific = /traffic-light|boats|mountains|hydrants|stop-sign|palm|vehicle-detection|cat-and-dog/.test(
          f,
        )
        if (!isBank && !isSpecific && hint && !hint.test(basename(f)) && !hint.test(f)) continue
      }
      seen.add(f)
      files.push(f)
    }
  }
  files.sort((a, b) => hashPath(a).localeCompare(hashPath(b)))

  const review: string[] = []
  for (const abs of files) {
    try {
      const h = createHash('sha1').update(readFileSync(abs)).digest('hex')
      if (verifiedHashes.has(h) || rejectedHashes.has(h)) continue
      review.push(abs)
    } catch {
      review.push(abs)
    }
  }

  const page = review.slice(offset, offset + limit).map((abs) => {
    const id = hashPath(abs)
    return {
      id,
      url: `/demo/curate/asset?id=${id}`,
      alreadyVerified: false,
      name: basename(abs),
    }
  })

  for (const abs of review.slice(Math.max(0, offset - limit), offset + limit * 2)) {
    candidateIndex.set(hashPath(abs), abs)
  }

  return {
    label,
    prompt: labelPrompt(label),
    mode: 'select_good' as const,
    offset,
    limit,
    total: review.length,
    verified: verifiedHashes.size,
    rejected: rejectedHashes.size,
    target: 50,
    items: page,
  }
}

function copyIntoBucket(bucketRoot: string, label: CurateLabel, ids: string[]) {
  const destDir = join(bucketRoot, label)
  mkdirSync(destDir, { recursive: true })
  const savedPaths: string[] = []
  for (const id of ids) {
    const src = ensureCandidateIndexed(id, label) || candidateIndex.get(id)
    if (!src || !existsSync(src)) continue
    let buf: Buffer
    try {
      buf = readFileSync(src)
    } catch {
      continue
    }
    const contentHash = createHash('sha1').update(buf).digest('hex').slice(0, 12)
    const ext = extname(src).toLowerCase() || '.jpg'
    const dest = join(destDir, `${label}_${contentHash}${ext === '.jpeg' ? '.jpg' : ext}`)
    if (!existsSync(dest)) copyFileSync(src, dest)
    savedPaths.push(dest)
  }
  return savedPaths
}

export function saveVerified(label: CurateLabel, ids: string[]) {
  if (!(CURATE_LABELS as readonly string[]).includes(label)) throw new Error('unknown_label')
  const savedPaths = copyIntoBucket(verifiedRoot(), label, ids)
  writeVerifiedManifest()
  const destDir = join(verifiedRoot(), label)
  const total = existsSync(destDir)
    ? readdirSync(destDir).filter((f) => isImage(join(destDir, f))).length
    : 0
  return { saved: savedPaths.length, total, paths: savedPaths.map((p) => basename(p)) }
}

export function rejectBad(label: CurateLabel, ids: string[]) {
  if (!(CURATE_LABELS as readonly string[]).includes(label)) throw new Error('unknown_label')
  const saved = copyIntoBucket(rejectedRoot(), label, ids)
  const destDir = join(rejectedRoot(), label)
  const totalRejected = existsSync(destDir)
    ? readdirSync(destDir).filter((f) => isImage(join(destDir, f))).length
    : 0
  return { rejected: saved.length, totalRejected }
}

/** Selected = BAD; unselected on page = GOOD (verified). */
export function processPageSelection(
  label: CurateLabel,
  selectedBadIds: string[],
  pageGoodIds: string[],
) {
  const rej = rejectBad(label, selectedBadIds)
  const good = saveVerified(label, pageGoodIds)
  return {
    rejected: rej.rejected,
    saved: good.saved,
    totalVerified: good.total,
    totalRejected: rej.totalRejected,
  }
}

export function removeVerified(label: CurateLabel, filenames: string[]) {
  const destDir = join(verifiedRoot(), label)
  let removed = 0
  for (const name of filenames) {
    const full = join(destDir, basename(name))
    if (existsSync(full)) {
      try {
        unlinkSync(full)
        removed++
      } catch {
        /* */
      }
    }
  }
  writeVerifiedManifest()
  return { removed }
}

export function writeVerifiedManifest() {
  const root = verifiedRoot()
  mkdirSync(root, { recursive: true })
  const man: Record<string, string[]> = {}
  for (const label of CURATE_LABELS) {
    const dir = join(root, label)
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
      .filter((f) => isImage(join(dir, f)))
      .sort()
    if (files.length) man[label] = files
  }
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(man, null, 2))
  return man
}

export function publishVerifiedToBank(minPerLabel = 10) {
  const verifiedMan = writeVerifiedManifest()
  // Runtime bank is verified/ only — do not republish live root label dirs.
  const published: Record<string, number> = {}
  for (const [label, files] of Object.entries(verifiedMan)) {
    if (files.length < minPerLabel) continue
    published[label] = files.length
  }
  writeFileSync(
    join(assetsRoot(), 'SOURCES.md'),
    '# Captcha photo bank — VERIFIED ONLY\n\nSource of truth: captcha-assets/verified/\nGate loads verified/manifest.json only.\nCurate via /demo/curate (select BAD, keep rest).\n',
  )
  return { published, manifestLabels: Object.keys(published) }
}

export function readVerifiedAsset(label: string, file: string) {
  const full = join(verifiedRoot(), label, basename(file))
  if (!existsSync(full)) return null
  return { path: full }
}
