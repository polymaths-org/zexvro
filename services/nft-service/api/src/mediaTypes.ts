const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

const ALIAS_MIME: Record<string, string> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/svg+xml': 'image/svg+xml',
  'image/svg': 'image/svg+xml',
}

/**
 * Canonical PNG/JPEG/WebP/SVG mime for NFT media uploads.
 * Accepts browser aliases and empty/generic mimetypes when the filename extension is known.
 */
export function resolveNftImageMime(
  mimetype: string | undefined,
  originalname: string | undefined,
): string | null {
  const reported = (mimetype || '').trim().toLowerCase()
  if (reported && ALIAS_MIME[reported]) {
    return ALIAS_MIME[reported]
  }

  const name = originalname || ''
  const extension = name.includes('.')
    ? name.split('.').pop()?.trim().toLowerCase() || ''
    : ''
  if (!extension || !MIME_BY_EXTENSION[extension]) {
    return null
  }

  // Empty, generic binary, or non-image claims from pickers → trust extension.
  if (
    !reported ||
    reported === 'application/octet-stream' ||
    reported === 'binary/octet-stream' ||
    !reported.startsWith('image/')
  ) {
    return MIME_BY_EXTENSION[extension]
  }

  return null
}
