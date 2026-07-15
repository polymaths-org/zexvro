/**
 * Copy text to clipboard without throwing when Clipboard API is missing
 * (non-secure context, restricted iframe, some browsers).
 */
export async function copyText(text: string): Promise<boolean> {
  if (text == null || text === '') return false;
  const value = String(text);

  // Never read navigator.clipboard unless both navigator and clipboard exist.
  // Accessing .clipboard on undefined throws: "Cannot read properties of undefined (reading 'clipboard')"
  try {
    const nav = typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { navigator?: Navigator }).navigator
      : undefined;
    const clip = nav != null ? (nav as Navigator & { clipboard?: Clipboard }).clipboard : undefined;
    if (clip != null && typeof clip.writeText === 'function') {
      await clip.writeText(value);
      return true;
    }
  } catch {
    // NotAllowedError / SecurityError / missing API — use fallback
  }

  // Legacy path: works without Clipboard API permission in most desktop browsers
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    // ignore
  }

  return false;
}
