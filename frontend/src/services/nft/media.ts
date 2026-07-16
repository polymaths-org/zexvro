/** Max cover/media upload size for collection deploy. */
export const NFT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const ALIAS_MIME: Record<string, string> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/svg+xml': 'image/svg+xml',
  'image/svg': 'image/svg+xml',
};

export const NFT_MEDIA_ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/pjpeg,image/svg+xml,image/svg,.png,.jpg,.jpeg,.webp,.svg';

/**
 * Resolve a canonical PNG/JPEG/WebP/SVG mime from browser File metadata.
 * Browsers (especially Linux/Brave) often leave `file.type` empty, send
 * `application/octet-stream`, or use aliases like `image/jpg`.
 * Fall back to the filename extension in those cases.
 */
export function resolveNftImageMime(file: Pick<File, 'name' | 'type'>): string | null {
  const reported = (file.type || '').trim().toLowerCase();
  if (reported && ALIAS_MIME[reported]) {
    return ALIAS_MIME[reported];
  }

  const extension = file.name.includes('.')
    ? file.name.split('.').pop()?.trim().toLowerCase() || ''
    : '';
  if (!extension || !MIME_BY_EXTENSION[extension]) {
    return null;
  }

  // Empty, generic binary, or non-image claims from pickers → trust extension.
  if (
    !reported ||
    reported === 'application/octet-stream' ||
    reported === 'binary/octet-stream' ||
    !reported.startsWith('image/')
  ) {
    return MIME_BY_EXTENSION[extension];
  }

  return null;
}

/** Return a File with a canonical Content-Type for multipart upload. */
export function normalizeNftImageFile(file: File): File | null {
  const mime = resolveNftImageMime(file);
  if (!mime) return null;
  if (file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}
