// Browser-side upload wrapper. Thin I/O over the pure helpers in
// ./assets: uploads bytes to Firebase Storage at a content-hashed path
// and returns the { url, sha256 } reference stored in database rows.
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';
import { sha256Hex, storagePathForLabAsset, validateAssetRef } from './assets';

export async function uploadLabAsset(
  labId: string,
  kind: 'banner' | 'badge' | 'certificate' | 'element',
  bytes: Uint8Array,
  mime: string,
): Promise<{ url: string; sha256: string }> {
  const hash = await sha256Hex(bytes);
  const path = storagePathForLabAsset(labId, kind, hash, mime);
  const storage = getStorage(app);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, bytes, {
    contentType: mime,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  const url = await getDownloadURL(storageRef);
  const check = validateAssetRef(url, hash);
  if (!check.ok) throw new Error(check.error);
  return { url, sha256: hash };
}
